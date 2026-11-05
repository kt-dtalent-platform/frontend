import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { SubmissionStatus } from './types'

// GET /me/tasks · 담당 정윤 · FE 연동: Mock
export type MyTask = {
  requestId: number
  title: string
  dueAt: string
  dDay: number
  status: SubmissionStatus
  revisionReason: string | null
}

export type MyTasksFilter = 'TODO' | 'DONE' | 'ALL'

export function useMyTasks(status: MyTasksFilter = 'TODO') {
  return useQuery({
    queryKey: ['me', 'tasks', status],
    queryFn: () => api<{ items: MyTask[] }>(`/me/tasks?status=${status}`),
  })
}
