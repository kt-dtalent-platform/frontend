import { tokenStore } from './token'
import type { ApiEnvelope, ApiErrorBody } from './types'

// 백엔드 API 경로. 예전 .env의 /api/v1이 남아 있으면 목업과 프록시가 모두 어긋나므로 /v1로 바꾸고 알린다.
function apiBase() {
  const value = import.meta.env.VITE_API_BASE_URL || '/v1'
  if (/\/api\/v1\/?$/.test(value)) {
    console.warn('.env의 VITE_API_BASE_URL이 예전 값(/api/v1)입니다. /v1로 바꿔 주세요. 지금은 /v1로 보냅니다.')
    return '/v1'
  }
  return value.replace(/\/$/, '')
}

export const BASE_URL = apiBase()

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  // 다른 로그인으로 바뀐 뒤에 도착한 이전 로그인의 401. 지금 로그인을 끊지 않게 표시한다
  staleSession = false

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

// 로그인, 재발급, 로그아웃은 토큰 재발급 대상이 아니다
const NO_REFRESH = /^\/auth\/(login|refresh|logout)$/

// 액세스 토큰을 새로 받는다(백엔드 #108). 동시에 여러 요청이 401을 받아도 재발급은 한 번만 한다.
// 리프레시 토큰은 한 번 쓰면 바뀌므로 두 번 보내면 두 번째가 실패한다.
let refreshing: Promise<boolean> | null = null
export function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.refresh()
  if (!refreshToken) return Promise.resolve(false)
  refreshing ??= (async () => {
    const session = tokenStore.session()
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ accessToken: string; refreshToken: string }> | null
      // 그사이 로그아웃하거나 다른 계정으로 들어왔으면 받은 토큰을 쓰지 않는다
      if (session !== tokenStore.session()) return false
      // 그사이 다른 쪽(비밀번호 변경)이 이미 새 쌍으로 바꿨으면 그 쌍을 지키고, 이 응답은 버린다
      if (tokenStore.refresh() !== refreshToken) return tokenStore.access() !== null
      if (json?.resultType !== 'SUCCESS') {
        // 리프레시 토큰이 만료되었거나 이미 쓰였으면 다시 로그인해야 한다. 연결 문제면 토큰을 남겨 둔다
        if (res.status === 401) tokenStore.clear()
        return false
      }
      tokenStore.rotate(json.success.data)
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

// 파일 내려받기처럼 공통 응답이 아닌 요청. 토큰을 붙이고, 401이면 한 번 재발급하고 다시 보낸다
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!tokenStore.access() && tokenStore.refresh()) await refreshTokens()
  const go = () => {
    const headers = new Headers(init.headers)
    const token = tokenStore.access()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }
  const res = await go()
  if (res.status !== 401 || !(await refreshTokens())) return res
  return go()
}

// 공통 응답을 풀어서 data만 돌려준다. 실패면 ApiError를 던진다.
// 액세스 토큰이 없거나(새로고침 직후) 401이면 한 번 재발급하고 다시 보낸다.
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const canRefresh = !NO_REFRESH.test(path)
  if (canRefresh && !tokenStore.access() && tokenStore.refresh()) await refreshTokens()
  const session = tokenStore.session()
  const sent = tokenStore.access()
  try {
    return await send<T>(path, options)
  } catch (err) {
    if (!(canRefresh && err instanceof ApiError && err.status === 401)) throw err
    // 기다리는 사이 로그아웃하거나 다른 계정으로 들어왔으면 이전 요청을 새 토큰으로 다시 보내지 않는다
    if (session !== tokenStore.session()) {
      err.staleSession = true
      throw err
    }
    if (!tokenStore.refresh()) throw err
    // 기다리는 사이 다른 요청이 이미 새로 받았으면 그 토큰으로 다시 보낸다
    const renewed = tokenStore.access() !== sent && tokenStore.access() !== null
    if (!renewed && !(await refreshTokens())) throw err
    return send<T>(path, options)
  }
}

async function send<T>(path: string, { body, headers, ...init }: RequestOptions): Promise<T> {
  const token = tokenStore.access()
  // 호출하는 쪽이 넘긴 헤더가 먼저다. 없을 때만 기본값을 채운다.
  const merged = new Headers(headers)
  if (body !== undefined && !merged.has('Content-Type')) merged.set('Content-Type', 'application/json')
  if (token && !merged.has('Authorization')) merged.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: merged,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!json) {
    throw new ApiError(res.status, { code: 'NETWORK_ERROR', message: '서버 응답을 읽지 못했습니다.' })
  }
  if (json.resultType === 'FAIL') {
    throw new ApiError(res.status, json.error)
  }
  return json.success.data
}
