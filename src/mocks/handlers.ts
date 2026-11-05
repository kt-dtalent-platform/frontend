import { http } from 'msw'
import type { MyTask } from '../api/tasks'
import { fail, ok } from './respond'

const BASE = '/api/v1'

const DAY = 24 * 60 * 60 * 1000

// 오늘 기준 n일 뒤 23:59:59 (서버처럼 시간대 없는 형식)
function dueIn(days: number) {
  const d = new Date(Date.now() + days * DAY)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59:59`
}

function dDayOf(dueAt: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueAt)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / DAY)
}

// 명세서 예시 값을 쓰되 마감일은 오늘 기준으로 잡는다. 화면을 만들 때 경우(빈 목록, 마감 지남 등)를 여기에 더한다.
const tasks: Omit<MyTask, 'dDay'>[] = [
  {
    requestId: 31,
    title: '10월 행사 교통비 증빙',
    dueAt: dueIn(2),
    status: 'REVISION_REQUIRED',
    revisionReason: '영수증 이미지가 흐려 금액이 보이지 않습니다.',
  },
  {
    requestId: 35,
    title: '2학기 지속심사 서류 제출',
    dueAt: dueIn(10),
    status: 'NOT_SUBMITTED',
    revisionReason: null,
  },
  {
    requestId: 28,
    title: '1학기 성적 증빙',
    dueAt: dueIn(-15),
    status: 'CONFIRMED',
    revisionReason: null,
  },
]

export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }
    if (password.length < 8) {
      return fail('/api/v1/auth/login', 401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 올바르지 않습니다')
    }
    const role = email.startsWith('admin') ? 'MANAGER' : 'SCHOLAR'
    return ok('/api/v1/auth/login', {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      role,
      name: role === 'MANAGER' ? '정지은' : '홍길동',
    })
  }),

  http.get(`${BASE}/me/tasks`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status') ?? 'TODO'
    const items: MyTask[] = tasks
      .filter((t) => {
        if (status === 'ALL') return true
        const done = t.status === 'SUBMITTED' || t.status === 'CONFIRMED'
        return status === 'DONE' ? done : !done
      })
      .map((t) => ({ ...t, dDay: dDayOf(t.dueAt) }))
    return ok('/api/v1/me/tasks', { items })
  }),
]
