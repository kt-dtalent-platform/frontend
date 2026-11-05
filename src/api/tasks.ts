import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { isDone, type SubmissionStatus } from './types'

// GET /me/tasks · 담당 정윤 · 백엔드 PR #25(KT-16) 기준
// 백엔드 조회 결과(MyTaskRepository.TaskRow): requestId, title, requestDueAt, status, revisionReason
// 필터는 TODO / ALL 두 가지뿐이라 ALL로 받아 화면에서 나눈다. 쿼리 이름(status)은 컨트롤러가 없어 확인 필요.
type RawTask = {
  requestId: number
  title: string
  requestDueAt: string
  status: SubmissionStatus
  revisionReason: string | null
}

export type MyTask = RawTask & { dDay: number; overdue: boolean; done: boolean }

export function useMyTasks() {
  return useQuery({
    queryKey: ['me', 'tasks'],
    queryFn: async () => {
      const { items } = await api<{ items: RawTask[] }>('/me/tasks?status=ALL')
      return items.map((t): MyTask => ({ ...t, dDay: daysUntil(t.requestDueAt), overdue: isPastDue(t.requestDueAt), done: isDone(t.status) }))
    },
  })
}

// 마감 시각이 지났는지(날짜가 같아도 시각까지 비교)
export function isPastDue(iso: string) {
  return new Date(iso).getTime() < Date.now()
}

// 오늘 기준 남은 날(마감일 - 오늘, 날짜만 비교)
export function daysUntil(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(iso)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}
