import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { isDone, type SubmissionStatus } from './types'
import { daysBetween, kstParts, kstToday, toDate } from '../lib/time'

// GET /me/tasks · 백엔드 KT-16 기준
// 응답(MyTaskResponse.Item): requestId, title, dueAt, dDay, status, revisionReason
// 마감은 응답에서 dueAt인데 화면은 제출 화면(request.requestDueAt)과 같은 이름 requestDueAt으로 쓴다
// 남은 날(dDay)은 한국 날짜 기준으로 화면에서 다시 계산한다(백엔드 기준 시간대는 확인 필요)
// 필터는 TODO / ALL 두 가지뿐이라 ALL로 받아 화면에서 나눈다
type RawTask = {
  requestId: number
  title: string
  dueAt: string
  status: SubmissionStatus
  revisionReason: string | null
}

export type MyTask = Omit<RawTask, 'dueAt'> & { requestDueAt: string; dDay: number; overdue: boolean; done: boolean }

export function useMyTasks() {
  return useQuery({
    queryKey: ['me', 'tasks'],
    queryFn: async () => {
      const { items } = await api<{ items: RawTask[] }>('/me/tasks?status=ALL')
      return items.map(({ dueAt, ...t }): MyTask => ({
        ...t,
        requestDueAt: dueAt,
        dDay: daysUntil(dueAt),
        overdue: isPastDue(dueAt),
        done: isDone(t.status),
      }))
    },
  })
}

// 마감 시각이 지났는지(날짜가 같아도 시각까지 비교)
export function isPastDue(iso: string) {
  return toDate(iso).getTime() < Date.now()
}

// 오늘 기준 남은 날(마감일 - 오늘, 한국 날짜만 비교)
export function daysUntil(iso: string) {
  return daysBetween(kstToday(), kstParts(iso).date)
}
