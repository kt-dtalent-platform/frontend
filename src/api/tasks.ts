import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { isDone, type SubmissionStatus } from './types'
import { daysBetween, kstParts, kstToday, toDate } from '../lib/time'

// GET /me/tasks · 백엔드 KT-16 기준
// 응답(MyTaskResponse.Item): requestId, title, dueAt, dDay, status, revisionReason
// 마감은 백엔드 이름 그대로 dueAt(제출 화면도 toForm에서 request.dueAt으로 쓴다)
// 남은 날(dDay)은 한국 날짜 기준으로 화면에서 다시 계산한다(백엔드 기준 시간대는 확인 필요)
// 필터는 TODO / ALL 두 가지뿐이라 ALL로 받아 화면에서 나눈다
type RawTask = {
  requestId: number
  title: string
  dueAt: string
  status: SubmissionStatus
  revisionReason: string | null
}

export type MyTask = RawTask & { dDay: number; overdue: boolean; done: boolean }

export function useMyTasks() {
  return useQuery({
    queryKey: ['me', 'tasks'],
    queryFn: async () => {
      const { items } = await api<{ items: RawTask[] }>('/me/tasks?status=ALL')
      return items.map((t): MyTask => ({ ...t, dDay: daysUntil(t.dueAt), overdue: isPastDue(t.dueAt), done: isDone(t.status) }))
    },
  })
}

// GET /me/submissions · 백엔드 #59
// 내 할 일은 진행 중인 요청만 주므로, 마감된 요청까지 포함한 지난 제출은 이 API로 본다.
// 작성 중(DRAFT)은 오지 않는다. 최근 제출 순. page_size 최대 100(한 사람의 제출은 학기마다 몇 건이라 한 번에 받는다)
export type SubmissionHistory = {
  requestId: number
  title: string
  status: SubmissionStatus
  submittedAt: string
  confirmedAt: string | null
  purged: boolean // 보관 기간(1년)이 지나 서류 파일이 지워짐
}

export function useMySubmissionHistory() {
  return useQuery({
    queryKey: ['me', 'submissions', 'history'],
    queryFn: async () => {
      const r = await api<{ items: SubmissionHistory[]; total: number }>('/me/submissions?page_size=100')
      if (r.total > r.items.length) console.warn(`내 제출 이력 ${r.total}건 중 ${r.items.length}건만 보여 줍니다.`)
      return r.items
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
