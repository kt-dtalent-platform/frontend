import { http } from 'msw'
import type { Answers } from '../api/submissions'
import { getForm, now, saveDraft, taskList } from './db'
import { fail, ok } from './respond'

const BASE = '/api/v1'

const ME = {
  SCHOLAR: { id: 101, name: '홍길동', email: 'hong@kt.com', role: 'SCHOLAR', cohort: { id: 6, name: '6기' }, accessiblePrograms: null },
  MANAGER: { id: 7, name: '정지은', email: 'admin@kt.com', role: 'MANAGER', cohort: null, accessiblePrograms: [{ id: 1, name: 'KT 디지털인재장학' }] },
} as const

// 목업 토큰에 역할을 담아 /me가 맞는 사람을 돌려주게 한다
const roleOf = (request: Request) =>
  request.headers.get('Authorization')?.includes('manager') ? 'MANAGER' : request.headers.get('Authorization') ? 'SCHOLAR' : null

const unauthorized = (path: string) => fail(path, 401, 'UNAUTHORIZED', '인증 정보가 없거나 만료되었습니다')

export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }
    if (password.length < 8) {
      return fail('/api/v1/auth/login', 401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 올바르지 않습니다')
    }
    const role = email.startsWith('admin') ? 'MANAGER' : 'SCHOLAR'
    return ok('/api/v1/auth/login', {
      accessToken: `mock-access-${role.toLowerCase()}`,
      refreshToken: `mock-refresh-${role.toLowerCase()}`,
      role,
      name: ME[role].name,
    })
  }),

  http.post(`${BASE}/auth/logout`, () => ok('/api/v1/auth/logout', null)),

  http.get(`${BASE}/me`, ({ request }) => {
    const role = roleOf(request)
    return role ? ok('/api/v1/me', ME[role]) : unauthorized('/api/v1/me')
  }),

  http.get(`${BASE}/me/tasks`, ({ request }) => {
    if (!roleOf(request)) return unauthorized('/api/v1/me/tasks')
    const status = new URL(request.url).searchParams.get('status') ?? 'TODO'
    const done = (s: string) => s === 'SUBMITTED' || s === 'CONFIRMED'
    const items = taskList()
      .filter((t) => status === 'ALL' || (status === 'DONE' ? done(t.status) : !done(t.status)))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    return ok('/api/v1/me/tasks', { items })
  }),

  http.get(`${BASE}/me/submissions/:requestId`, ({ params, request }) => {
    const path = `/api/v1/me/submissions/${params.requestId}`
    if (!roleOf(request)) return unauthorized(path)
    const form = getForm(Number(params.requestId))
    return form ? ok(path, form) : fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없거나 아직 공개되지 않았습니다')
  }),

  http.put(`${BASE}/me/submissions/:requestId/draft`, async ({ params, request }) => {
    const id = Number(params.requestId)
    const path = `/api/v1/me/submissions/${id}/draft`
    if (!roleOf(request)) return unauthorized(path)
    const form = getForm(id)
    if (!form) return fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
    const body = (await request.json()) as { answers: Answers; version: number }
    if (form.editableFieldKeys.length === 0) {
      return fail(path, 422, 'SUBMISSION_LOCKED', '이미 제출했거나 마감된 요청입니다')
    }
    if (body.version !== form.version) {
      return fail(path, 409, 'VERSION_CONFLICT', '다른 탭에서 수정되었습니다')
    }
    const saved = saveDraft(id, body.answers)
    return ok(path, { submissionId: saved.submissionId, status: saved.status, savedAt: now(), version: saved.version })
  }),
]
