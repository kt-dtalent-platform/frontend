import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from './client'

// 담당자 화면 API. 둘 다 백엔드 구현 없음(담당 승완). 노션 명세서 모양을 임시로 쓰고,
// 요청 상태는 실제 DB 값(DRAFT·IN_PROGRESS·CLOSED)만 쓴다(확인 필요).

export type RequestStatus = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'

// GET /dashboard/manager
// 명세서에는 경비·문의·행사·소모임 수치도 있지만 MVP 범위(제출·검토) 밖이라 화면에 쓰지 않는다.
export type ManagerDashboard = {
  today: { unreviewedSubmissions: number; resubmitted: number }
  tasks: { closingSoon: { requestId: number; title: string; closesAt: string; notSubmitted: number; targetCount: number }[] }
  overview: { scholarCount: number; byCohort: { cohortName: string; count: number }[]; inProgressRequests: number }
}

export function useManagerDashboard() {
  return useQuery({
    queryKey: ['manager', 'dashboard'],
    queryFn: () => api<ManagerDashboard>('/dashboard/manager'),
  })
}

// GET /requests?status=&page=&page_size=
export type RequestRow = {
  id: number
  title: string
  templateCode: string | null
  cohortName: string | null
  status: RequestStatus
  opensAt: string | null
  closesAt: string | null
  targetCount: number
  submittedCount: number
  revisionCount: number
}
export type RequestPage = { items: RequestRow[]; page: number; page_size: number; total: number }

export const PAGE_SIZE = 20

export function useRequests({ status, page }: { status: RequestStatus | null; page: number }) {
  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
  if (status) params.set('status', status)
  return useQuery({
    queryKey: ['manager', 'requests', status, page],
    queryFn: () => api<RequestPage>(`/requests?${params}`),
    placeholderData: keepPreviousData, // 탭·페이지를 바꿀 때 표가 비었다가 다시 차지 않게
  })
}
