// Run from the repository root: node --test tests/loginNotices.test.mjs
// Vite loads the application's TypeScript and import.meta.env without adding a test dependency.
import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const root = fileURLToPath(new URL('../', import.meta.url))
const sender = { senderName: '장학 사무국', fromAddress: 'scholarship@example.com' }
const item = (scholarId, status, errorCode = null) => ({ scholarId, status, errorCode })
const storage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}

let vite
let api
let notices
let scholars
let client
const originals = new Map()

function replaceGlobal(name, value) {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

before(async () => {
  vite = await createServer({
    root,
    configFile: false,
    envFile: false,
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
})

beforeEach(async () => {
  replaceGlobal('localStorage', storage())
  replaceGlobal('sessionStorage', storage())
  // Reload stateful mock modules so no sender, notices, or scholar edits leak between tests.
  vite.moduleGraph.invalidateAll()
  api = await vite.ssrLoadModule('/src/api/loginNotices.ts')
  notices = await vite.ssrLoadModule('/src/mocks/loginNotices.ts')
  scholars = await vite.ssrLoadModule('/src/mocks/scholars.ts')
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
})

afterEach(() => {
  client.clear()
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  originals.clear()
})

after(async () => { await vite?.close() })

// Render under the real QueryClient to exercise the public hooks and their actual cache entries.
function renderHook(hook) {
  let result
  function Probe() {
    result = hook()
    return null
  }
  renderToString(createElement(QueryClientProvider, { client }, createElement(Probe)))
  return result
}

function respond(t, data) {
  return t.mock.method(globalThis, 'fetch', async () => Response.json({ resultType: 'SUCCESS', success: { data }, error: null }))
}

describe('login notice messages', () => {
  for (const [code, expected] of [
    ['PASSWORD_ALREADY_CHANGED', '이미 비밀번호를 바꿈'],
    ['ALREADY_SENT', '이미 보냄'],
    ['ALREADY_QUEUED', '보내는 중'],
    ['ACCOUNT_DISABLED', '로그인할 수 없는 계정'],
    ['SCHOLAR_NOT_FOUND', '없는 장학생'],
    [null, '건너뜀'],
    ['FUTURE_BACKEND_CODE', '건너뜀'],
  ]) {
    it(`describes skip reason ${code}`, () => assert.equal(api.skipText(code), expected))
  }

  it('distinguishes an unsent scholar from a failed delivery', () => {
    assert.equal(api.noticeText(undefined), '보낸 적 없음')
    assert.equal(api.noticeText(item(1, 'FAILED')), '보내지 못함')
  })

  for (const [status, error, expected] of [
    ['PENDING', null, '보내는 중'],
    ['SENDING', null, '보내는 중'],
    ['SENT', null, '보냄'],
    ['FAILED', 'DELIVERY_UNKNOWN', '보냈는지 확인 안 됨'],
    ['FAILED', 'DELIVERY_FAILED', '보내지 못함'],
    ['FAILED', 'UNRECOGNIZED', '보내지 못함'],
    ['SKIPPED', 'ACCOUNT_DISABLED', '로그인할 수 없는 계정'],
    ['SKIPPED', null, '건너뜀'],
  ]) {
    it(`describes ${status}/${error}`, () => assert.equal(api.noticeText(item(1, status, error)), expected))
  }

  it('reports the queued count without a skipped suffix', () => {
    assert.equal(api.sentText({ queued: 2, items: [item(1, 'PENDING'), item(2, 'PENDING')] }), '2명에게 보내는 중이에요')
  })

  it('counts skipped scholars while deduplicating reasons in encounter order', () => {
    const result = { queued: 1, items: [item(1, 'PENDING'), item(2, 'SKIPPED', 'ALREADY_SENT'), item(3, 'SKIPPED', 'ACCOUNT_DISABLED'), item(4, 'SKIPPED', 'ALREADY_SENT')] }
    assert.equal(api.sentText(result), '1명에게 보내는 중이에요. 3명은 건너뛰었어요(이미 보냄, 로그인할 수 없는 계정)')
  })

  it('explains when every requested scholar was skipped', () => {
    assert.equal(api.sentText({ queued: 0, items: [item(1, 'SKIPPED', 'PASSWORD_ALREADY_CHANGED')] }), '보낼 장학생이 없어요(이미 비밀번호를 바꿈)')
  })

  it('does not count failed deliveries as skipped scholars', () => {
    assert.equal(api.sentText({ queued: 1, items: [item(1, 'PENDING'), item(2, 'FAILED', 'DELIVERY_FAILED')] }), '1명에게 보내는 중이에요')
  })
})

describe('login notice query hooks', () => {
  it('loads an unset sender as null', async (t) => {
    const fetch = respond(t, null)
    renderHook(api.useNoticeSender)
    const query = client.getQueryCache().find({ queryKey: ['manager', 'login-notice-sender'] })
    assert.equal(await query.fetch(), null)
    assert.equal(fetch.mock.calls[0].arguments[0], '/v1/scholars/login-notices/sender')
  })

  it('saves the sender with PUT and updates the sender cache', async (t) => {
    const fetch = respond(t, sender)
    const mutation = renderHook(api.useSaveNoticeSender)
    assert.deepEqual(await mutation.mutateAsync(sender), sender)
    const [path, options] = fetch.mock.calls[0].arguments
    assert.equal(path, '/v1/scholars/login-notices/sender')
    assert.equal(options.method, 'PUT')
    assert.deepEqual(JSON.parse(options.body), sender)
    assert.deepEqual(client.getQueryData(['manager', 'login-notice-sender']), sender)
  })

  for (const reissue of [false, true]) {
    it(`sends selected IDs with reissue=${reissue} and invalidates only notice statuses`, async (t) => {
      const result = { queued: 1, items: [item(1001, 'PENDING')] }
      const fetch = respond(t, result)
      client.setQueryData(['manager', 'login-notices', '1001'], [])
      client.setQueryData(['manager', 'login-notices', '1002'], [])
      client.setQueryData(['manager', 'login-notice-sender'], sender)
      const mutation = renderHook(api.useSendNotices)
      assert.deepEqual(await mutation.mutateAsync({ scholarIds: [1001], reissue }), result)
      const [path, options] = fetch.mock.calls[0].arguments
      assert.equal(path, '/v1/scholars/login-notices')
      assert.equal(options.method, 'POST')
      assert.deepEqual(JSON.parse(options.body), { scholarIds: [1001], reissue })
      assert.equal(client.getQueryState(['manager', 'login-notices', '1001']).isInvalidated, true)
      assert.equal(client.getQueryState(['manager', 'login-notices', '1002']).isInvalidated, true)
      assert.equal(client.getQueryState(['manager', 'login-notice-sender']).isInvalidated, false)
    })
  }

  it('propagates MAIL_UNAVAILABLE without invalidating a successful cached status', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ resultType: 'FAIL', error: { code: 'MAIL_UNAVAILABLE', message: '메일 발송을 사용할 수 없습니다.' } }, { status: 503 }))
    client.setQueryData(['manager', 'login-notices', '1001'], [])
    await assert.rejects(renderHook(api.useSendNotices).mutateAsync({ scholarIds: [1001], reissue: false }), { status: 503, code: 'MAIL_UNAVAILABLE' })
    assert.equal(client.getQueryState(['manager', 'login-notices', '1001']).isInvalidated, false)
  })

  it('keeps the saved sender when a replacement fails', async (t) => {
    client.setQueryData(['manager', 'login-notice-sender'], sender)
    t.mock.method(globalThis, 'fetch', async () => Response.json({ resultType: 'FAIL', error: { code: 'INVALID_REQUEST', message: 'invalid sender' } }, { status: 400 }))
    await assert.rejects(renderHook(api.useSaveNoticeSender).mutateAsync({ ...sender, fromAddress: 'invalid' }), { code: 'INVALID_REQUEST' })
    assert.deepEqual(client.getQueryData(['manager', 'login-notice-sender']), sender)
  })

  it('disables status requests for an empty selection', (t) => {
    const fetch = respond(t, [])
    renderHook(() => api.useNoticeStatus([]))
    const query = client.getQueryCache().find({ queryKey: ['manager', 'login-notices', ''] })
    assert.equal(query.options.enabled, false)
    assert.equal(fetch.mock.callCount(), 0)
  })

  it('requests only the selected IDs and keeps selections in separate cache entries', async (t) => {
    const expected = [item(1001, 'SENT')]
    const fetch = respond(t, expected)
    renderHook(() => api.useNoticeStatus([1001, 1003]))
    renderHook(() => api.useNoticeStatus([1002]))
    const query = client.getQueryCache().find({ queryKey: ['manager', 'login-notices', '1001,1003'] })
    assert.equal(query.options.enabled, true)
    assert.deepEqual(await query.fetch(), expected)
    assert.equal(fetch.mock.calls[0].arguments[0], '/v1/scholars/login-notices?scholarIds=1001,1003')
    assert.equal(client.getQueryData(['manager', 'login-notices', '1002']), undefined)
  })

  for (const [statuses, expected] of [
    [undefined, false], [[], false], [['PENDING'], 5000], [['SENDING'], 5000],
    [['SENT', 'FAILED', 'SKIPPED'], false], [['SENT', 'PENDING'], 5000],
  ]) {
    it(`polls only while work is outstanding: ${statuses}`, () => {
      renderHook(() => api.useNoticeStatus([1001]))
      const query = client.getQueryCache().find({ queryKey: ['manager', 'login-notices', '1001'] })
      assert.equal(query.options.refetchInterval({ state: { data: statuses?.map((status, i) => item(i, status)) } }), expected)
    })
  }
})

describe('login notice mock state machine', () => {
  it('requires a sender and leaves no delivery state when unavailable', () => {
    assert.equal(notices.getSender(), null)
    assert.equal(notices.sendNotices([1001], false), 'MAIL_UNAVAILABLE')
    assert.deepEqual(notices.noticeStatus([1001]), [])
  })

  it('persists sender settings and reloads them', async () => {
    assert.deepEqual(notices.setSender(sender), sender)
    assert.deepEqual(JSON.parse(localStorage.getItem('kt-dtalent:mock-notice-sender')), sender)
    vite.moduleGraph.invalidateAll()
    const reloaded = await vite.ssrLoadModule('/src/mocks/loginNotices.ts')
    assert.deepEqual(reloaded.getSender(), sender)
  })

  it('tolerates malformed saved sender data', async () => {
    localStorage.setItem('kt-dtalent:mock-notice-sender', '{broken')
    vite.moduleGraph.invalidateAll()
    const reloaded = await vite.ssrLoadModule('/src/mocks/loginNotices.ts')
    assert.equal(reloaded.getSender(), null)
  })

  it('keeps sender settings in memory when browser storage is unavailable', (t) => {
    t.mock.method(localStorage, 'setItem', () => { throw new Error('storage denied') })
    assert.deepEqual(notices.setSender(sender), sender)
    assert.deepEqual(notices.getSender(), sender)
  })

  it('sorts accepted scholars without mutating the caller selection', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    notices.setSender(sender)
    const ids = [1003, 1001]
    assert.deepEqual(notices.sendNotices(ids, false), { queued: 2, items: [item(1001, 'PENDING'), item(1003, 'PENDING')] })
    assert.deepEqual(ids, [1003, 1001])
    t.mock.timers.tick(1999)
    assert.deepEqual(notices.noticeStatus([1003]), [item(1003, 'PENDING')])
    t.mock.timers.tick(1)
    assert.deepEqual(notices.noticeStatus([1003, 999999, 1001]), [item(1003, 'SENT'), item(1001, 'FAILED', 'DELIVERY_FAILED')])
  })

  for (const reissue of [false, true]) {
    it(`never sends to missing, locked, or inactive accounts, even with reissue=${reissue}`, () => {
      notices.setSender(sender)
      assert.deepEqual(notices.sendNotices([999999, 1006, 1004], reissue), { queued: 0, items: [item(1004, 'SKIPPED', 'ACCOUNT_DISABLED'), item(1006, 'SKIPPED', 'ACCOUNT_DISABLED'), item(999999, 'SKIPPED', 'SCHOLAR_NOT_FOUND')] })
      assert.deepEqual(notices.noticeStatus([999999, 1006, 1004]), [])
    })

    it(`prevents duplicate pending work with reissue=${reissue}`, (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      notices.setSender(sender)
      notices.sendNotices([1003], false)
      assert.deepEqual(notices.sendNotices([1003], reissue), { queued: 0, items: [item(1003, 'SKIPPED', 'ALREADY_QUEUED')] })
      assert.deepEqual(notices.noticeStatus([1003]), [item(1003, 'PENDING')])
    })
  }

  it('skips changed passwords on first send but permits explicit reissue', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    notices.setSender(sender)
    assert.deepEqual(notices.sendNotices([1000], false), { queued: 0, items: [item(1000, 'SKIPPED', 'PASSWORD_ALREADY_CHANGED')] })
    assert.deepEqual(notices.sendNotices([1000], true), { queued: 1, items: [item(1000, 'PENDING')] })
  })

  it('preserves a sent notice when skipped and permits explicit reissue', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    notices.setSender(sender)
    notices.sendNotices([1003], false)
    t.mock.timers.tick(2000)
    assert.deepEqual(notices.sendNotices([1003], false), { queued: 0, items: [item(1003, 'SKIPPED', 'ALREADY_SENT')] })
    assert.deepEqual(notices.noticeStatus([1003]), [item(1003, 'SENT')])
    assert.deepEqual(notices.sendNotices([1003], true), { queued: 1, items: [item(1003, 'PENDING')] })
  })

  it('allows retrying a failed delivery without requesting reissue', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    notices.setSender(sender)
    notices.sendNotices([1001], false)
    t.mock.timers.tick(2000)
    assert.deepEqual(notices.noticeStatus([1001]), [item(1001, 'FAILED', 'DELIVERY_FAILED')])
    assert.deepEqual(notices.sendNotices([1001], false), { queued: 1, items: [item(1001, 'PENDING')] })
  })

  it('counts only accepted scholars in mixed batches', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    notices.setSender(sender)
    const result = notices.sendNotices([1003, 1000, 1004, 999999], false)
    assert.equal(result.queued, 1)
    assert.equal(result.items.filter((i) => i.status === 'SKIPPED').length, 3)
    assert.deepEqual(notices.noticeStatus([1000, 1003, 1004, 999999]), [item(1003, 'PENDING')])
  })

  it('newly registered accounts are active and eligible even when their ID is divisible by five', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const created = scholars.createScholar({ name: '테스트', email: 'new@example.com', phone: '010-1234-5678', cohortId: 6, university: '테스트대학교', major: '컴퓨터공학', studentNo: '20260001' })
    assert.equal(created.accountStatus, 'ACTIVE')
    assert.equal(scholars.accountStatusOf(created.id), 'ACTIVE')
    notices.setSender(sender)
    assert.deepEqual(notices.sendNotices([created.id], false), { queued: 1, items: [item(created.id, 'PENDING')] })
  })

  it('exports inactive accounts as disabled rather than awaiting their first login', () => {
    const csv = scholars.exportScholarsCsv([], null, ['email', 'accountStatus'])
    assert.ok(csv.includes('scholar007@example.com,사용 중지'))
    assert.ok(!csv.includes('로그인 전'))
  })
})

describe('login notice HTTP handlers', () => {
  async function request(method, path = '', body, token = 'mock-manager') {
    const { getResponse } = await import('msw')
    const { handlers } = await vite.ssrLoadModule('/src/mocks/handlers.ts')
    const headers = new Headers()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (body !== undefined) headers.set('Content-Type', 'application/json')
    const response = await getResponse(handlers, new Request(`http://localhost/v1/scholars/login-notices${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), { baseUrl: 'http://localhost' })
    assert.ok(response, 'the login notice route should be handled before /scholars/:id')
    return { status: response.status, body: await response.json() }
  }

  for (const token of [null, 'mock-scholar', 'invalid-token']) {
    for (const [method, path, body] of [['GET', '/sender'], ['PUT', '/sender', sender], ['GET', '?scholarIds=1001'], ['POST', '', { scholarIds: [1001] }]]) {
      it(`denies ${method} ${path || '/'} to ${token ?? 'anonymous users'}`, async () => {
        const response = await request(method, path, body, token)
        assert.equal(response.status, 403)
        assert.equal(response.body.error.code, 'ACCESS_DENIED')
      })
    }
  }

  it('returns an unset sender and trims a saved sender name', async () => {
    assert.equal((await request('GET', '/sender')).body.success.data, null)
    const response = await request('PUT', '/sender', { ...sender, senderName: `  ${sender.senderName}  ` })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.success.data, sender)
    assert.deepEqual((await request('GET', '/sender')).body.success.data, sender)
  })

  for (const body of [{}, { ...sender, senderName: '   ' }, { ...sender, fromAddress: 'missing-at.example.com' }, { ...sender, fromAddress: 'a@b' }]) {
    it(`rejects invalid sender settings ${JSON.stringify(body)}`, async () => {
      const response = await request('PUT', '/sender', body)
      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_REQUEST')
      assert.equal(notices.getSender(), null)
    })
  }

  for (const path of ['', '?scholarIds=', '?scholarIds=0,-1,invalid', `?scholarIds=${Array.from({ length: 501 }, (_, i) => i + 1).join(',')}`]) {
    it(`rejects a missing, invalid, or oversized status selection (${path.length} characters)`, async () => {
      const response = await request('GET', path)
      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_REQUEST')
    })
  }

  it('accepts the 500-scholar status boundary and omits unsent accounts', async () => {
    const response = await request('GET', `?scholarIds=${Array.from({ length: 500 }, (_, i) => i + 1).join(',')}`)
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.success.data, [])
  })

  for (const body of [{}, { scholarIds: [] }, { scholarIds: [1001, 1001] }, { scholarIds: Array.from({ length: 501 }, (_, i) => i + 1) }]) {
    it(`rejects a missing, duplicate, or oversized send selection (${body.scholarIds?.length ?? 'missing'} IDs)`, async () => {
      const response = await request('POST', '', body)
      assert.equal(response.status, 400)
      assert.equal(response.body.error.code, 'INVALID_REQUEST')
      assert.deepEqual(response.body.error.details, ['scholarIds'])
    })
  }

  it('reports mail unavailability as 503 rather than accepting the request', async () => {
    const response = await request('POST', '', { scholarIds: [1001], reissue: false })
    assert.equal(response.status, 503)
    assert.equal(response.body.error.code, 'MAIL_UNAVAILABLE')
  })

  it('accepts exactly 500 IDs with a 202 envelope, even when every account is skipped', async () => {
    notices.setSender(sender)
    const ids = Array.from({ length: 500 }, (_, i) => 900000 + i)
    const response = await request('POST', '', { scholarIds: ids, reissue: false })
    assert.equal(response.status, 202)
    assert.equal(response.body.resultType, 'SUCCESS')
    assert.equal(response.body.error, null)
    assert.equal(response.body.meta.path, '/v1/scholars/login-notices')
    assert.equal(response.body.success.data.queued, 0)
    assert.deepEqual(response.body.success.data.items, ids.map((id) => item(id, 'SKIPPED', 'SCHOLAR_NOT_FOUND')))
  })
})
