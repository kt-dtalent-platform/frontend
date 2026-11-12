import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// 담당자 화면 API. 둘 다 백엔드 구현 없음(담당 승완). 노션 명세서 모양을 임시로 쓰고,
// 요청 상태는 실제 DB 값(DRAFT·IN_PROGRESS·CLOSED)만 쓴다(확인 필요).

export type RequestStatus = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED'

// GET /dashboard/manager
// 명세서에는 경비·문의·행사·소모임 수치도 있지만 MVP 범위(제출·검토) 밖이라 화면에 쓰지 않는다.
// 대시보드는 백엔드 API가 없다. 화면에 필요한 모양을 프론트가 정했다(11/12, 확인 필요)
// review: 진행 중 요청 전체의 검토 대기. oldestSubmissionId는 가장 오래 기다린 제출(검토 시작 버튼)
// requests: 진행 중 요청을 마감 순으로. 네 숫자를 더하면 targetCount
export type DashboardRequest = {
  requestId: number
  title: string
  closesAt: string
  targetCount: number
  confirmed: number
  waiting: number
  revisionRequired: number
  notSubmitted: number
}
export type ManagerDashboard = {
  review: { waiting: number; resubmitted: number; oldestSubmissionId: number | null; oldestSubmittedAt: string | null }
  requests: DashboardRequest[]
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
  closesAt: string
  targetCount: number
  submittedCount: number
  // 담당자가 검토할 제출(다시 제출 포함). 요청 목록에서 할 일을 보이려고 프론트가 제안(확인 필요)
  waitingCount?: number
  revisionCount: number
}
// 응답의 pageSize는 장학생 목록(백엔드 #16)과 같은 모양으로 가정(확인 필요)
export type RequestPage = { items: RequestRow[]; page: number; pageSize: number; total: number }

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

// ── 요청 만들기 ──────────────────────────────────────────

// GET /v1/request-templates · 담당 정윤 · 백엔드 PR #21(KT-15) 기준: items[{id, code, name, fields}]
// fields는 DB default_fields(JSON) 그대로라 모양이 정해지지 않았다. 화면에서는 label·fieldType만 쓴다(확인 필요).
export type TemplateField = { fieldKey: string; label: string; fieldType: string; required?: boolean }
export type RequestTemplate = { id: number; code: string; name: string; fields: TemplateField[] }

export function useRequestTemplates() {
  return useQuery({
    queryKey: ['manager', 'templates'],
    queryFn: async () => (await api<{ items: RequestTemplate[] }>('/request-templates')).items,
    staleTime: 10 * 60_000, // 시스템 프리셋이라 자주 바뀌지 않는다
  })
}

// GET /v1/programs/{programId}/cohorts · 백엔드 PR #11(KT-9) 기준: items[{id, name, startedOn, endedOn, scholarCount}]
export type Cohort = { id: number; name: string; startedOn: string | null; endedOn: string | null; scholarCount: number }

export function useCohorts(programId: number | undefined) {
  return useQuery({
    queryKey: ['manager', 'cohorts', programId],
    queryFn: async () => (await api<{ items: Cohort[] }>(`/programs/${programId}/cohorts`)).items,
    enabled: programId !== undefined,
    staleTime: 10 * 60_000,
  })
}

// POST /requests(작성 중으로 만들기), POST /requests/{id}/publish(공개) · 담당 승완 · 백엔드 구현 없음
// 요청 본문은 실제 DB(requests) 열을 따른다: 공개 일시·개인정보 안내·보관 기간 열은 DB에 없어 보내지 않는다(확인 필요).
export type Semester = '1' | '2' | 'SUMMER' | 'WINTER'
export type CreateRequestBody = {
  programId: number
  cohortId: number | null
  templateId: number
  title: string
  description: string | null
  academicYear: number
  semester: Semester
  closesAt: string // 서버 형식(시간대 없음) 2026-11-20T23:59:00
  completionMessage: string | null
}
export type CreatedRequest = { id: number; status: RequestStatus }
export type PublishResult = { status: RequestStatus; targetCount: number; publishedAt: string }

export function useCreateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRequestBody) => api<CreatedRequest>('/requests', { method: 'POST', body }),
    // 바뀌는 것은 요청 목록·대시보드뿐. 기다리지 않아야 화면 이동이 늦어지지 않는다
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'requests'] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'dashboard'] })
    },
  })
}

// GET /requests/{id}: 작성 중 요청 열기. 백엔드 구현 없음, 응답 모양 확인 필요
export type RequestDetail = Omit<CreateRequestBody, 'templateId'> & { id: number; status: RequestStatus; templateId: number | null }

export function useRequestDetail(id: number) {
  return useQuery({
    queryKey: ['manager', 'request', id],
    queryFn: () => api<RequestDetail>(`/requests/${id}`),
    enabled: Number.isInteger(id) && id > 0,
    // 고치는 중에 다시 불러와 공개 상태로 바뀌면 폼이 사라진다
    refetchOnWindowFocus: false,
  })
}

// PATCH /requests/{id}: 작성 중일 때만 고칠 수 있다. 백엔드 구현 없음, 확인 필요
export function useUpdateRequest(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRequestBody) => api<CreatedRequest>(`/requests/${id}`, { method: 'PATCH', body }),
    onSuccess: (_data, body) => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'requests'] })
      // 상세는 다시 부르지 않고 보낸 값으로 맞춘다. 다시 부르면 공개 직후 응답이 와서 폼이 "이미 공개함"으로 바뀔 수 있다
      queryClient.setQueryData<RequestDetail>(['manager', 'request', id], (old) => (old ? { ...old, ...body } : old))
    },
  })
}

export function usePublishRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: number) => api<PublishResult>(`/requests/${requestId}/publish`, { method: 'POST', body: {} }),
    // 바뀌는 것은 요청 목록·대시보드뿐. 기다리지 않아야 화면 이동이 늦어지지 않는다
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'requests'] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'dashboard'] })
    },
  })
}
