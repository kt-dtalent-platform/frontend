import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, BASE_URL, api } from './client'
import { tokenStore } from './token'
import type { SubmissionStatus } from './types'

// 담당자 제출 현황·개별 검토. 모두 백엔드 구현 없음(담당 승완). 노션 명세서 모양을 임시로 쓴다(확인 필요).

// GET /requests/{requestId}/submissions?status=&keyword=&page=
// status 필터는 명세서에 없지만 상태 칩으로 나눠 보려면 필요하다(확인 필요)
export type StatusSummary = { target: number; notSubmitted: number; submitted: number; revisionRequired: number; confirmed: number }
export type SubmissionRow = {
  scholarId: number
  scholarName: string
  cohortName?: string | null
  submissionId: number | null
  status: SubmissionStatus
  submittedAt: string | null
  late?: boolean // 마감 뒤 제출(확인 필요: 서버가 줄지, 화면이 계산할지)
  hasInputError: boolean
}
export type SubmissionPage = {
  request: { id: number; title: string; cohortName: string | null; closesAt: string | null }
  summary: StatusSummary
  items: SubmissionRow[]
  page: number
  page_size: number
  total: number
}

// 화면의 상태 칩. 검토 대기는 SUBMITTED·RESUBMITTED를 함께 센다
export type StatusFilter = 'NOT_SUBMITTED' | 'WAITING' | 'REVISION_REQUIRED' | 'CONFIRMED'

export function useRequestSubmissions(requestId: number, q: { status: StatusFilter | null; keyword: string; page: number; pageSize?: number }) {
  const pageSize = q.pageSize ?? 20
  const params = new URLSearchParams({ page: String(q.page), page_size: String(pageSize) })
  if (q.status) params.set('status', q.status)
  if (q.keyword) params.set('keyword', q.keyword)
  return useQuery({
    queryKey: ['manager', 'submissions', requestId, q.status, q.keyword, q.page, pageSize],
    queryFn: () => api<SubmissionPage>(`/requests/${requestId}/submissions?${params}`),
    placeholderData: keepPreviousData,
  })
}

// GET /requests/{requestId}/export?status=&format=csv → 파일 내려받기(형식 csv·xlsx 중 무엇인지 확인 필요)
export async function downloadExport(requestId: number, status: StatusFilter | null) {
  const params = new URLSearchParams({ format: 'csv' })
  if (status) params.set('status', status)
  const res = await fetch(`${BASE_URL}/requests/${requestId}/export?${params}`, {
    headers: tokenStore.access() ? { Authorization: `Bearer ${tokenStore.access()}` } : {},
  })
  if (!res.ok) throw new ApiError(res.status, { code: 'EXPORT_FAILED', message: '파일을 만들지 못했습니다.' })
  const name = fileNameOf(res.headers.get('Content-Disposition')) ?? `request_${requestId}.csv`
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  // Safari는 내려받기 시작이 늦을 수 있어 넉넉히 기다린 뒤 푼다
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Content-Disposition에서 파일 이름. 한글 이름은 filename*=UTF-8''... 로 온다
function fileNameOf(header: string | null) {
  if (!header) return null
  const star = /filename\*=(?:UTF-8|utf-8)''([^;]+)/.exec(header)?.[1]
  if (star) {
    try {
      return decodeURIComponent(star.trim())
    } catch {
      /* 아래 filename으로 */
    }
  }
  return /filename="?([^";]+)"?/.exec(header)?.[1] ?? null
}

// GET /submissions/{submissionId}
// analysis(문서 분석 결과)는 명세서에서 별도 API(/analysis-results/{id})지만, 연결 키가 없어 상세에 함께 온다고 가정한다(확인 필요)
export type Comparison = { field: string; label: string; entered: string; extracted: string | null; result: 'MATCH' | 'MISMATCH' | 'UNREADABLE' }
export type SubmissionDetail = {
  id: number
  requestId: number
  requestTitle: string
  scholar: { id: number; name: string; cohortName: string | null }
  status: SubmissionStatus
  submittedAt: string | null
  late: boolean
  fields: { fieldKey: string; label: string; fieldType: string }[]
  answers: Record<string, string | number | boolean | string[] | null>
  files: { id: number; fieldKey: string; originalName: string; contentType: string; sizeBytes: number }[]
  analysis: { overallResult: 'MATCH' | 'MISMATCH' | 'UNREADABLE'; comparisons: Comparison[] } | null
  history: { from: string | null; to: string; actorType: 'SCHOLAR' | 'MANAGER'; changedAt: string }[]
  revisions: { fieldKeys: string[]; reason: string; dueAt: string | null; resolvedAt: string | null }[]
  version: number
}

export const detailKey = (id: number) => ['manager', 'submission', id] as const

// GET /submissions/{id}/files/{fileId}/url → 원본 보기용 임시 주소. 백엔드 API 없음(경로와 응답 모양 확인 필요)
export function useFileUrl(submissionId: number, fileId: number | null) {
  return useQuery({
    queryKey: ['manager', 'file-url', submissionId, fileId],
    queryFn: () => api<{ url: string; expiresAt: string }>(`/submissions/${submissionId}/files/${fileId}/url`),
    enabled: fileId !== null,
    // 임시 주소는 몇 분 뒤 만료되므로 오래 두지 않는다
    staleTime: 4 * 60 * 1000,
  })
}

export function useSubmissionDetail(submissionId: number) {
  return useQuery({ queryKey: detailKey(submissionId), queryFn: () => api<SubmissionDetail>(`/submissions/${submissionId}`) })
}

function useReviewAction<T>(submissionId: number, path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<{ status: SubmissionStatus }>(`/submissions/${submissionId}/${path}`, { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'submissions'] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'dashboard'] })
      void queryClient.invalidateQueries({ queryKey: detailKey(submissionId) })
    },
    // 그사이 바뀌었으면(409 버전 충돌, 422 상태 전이 불가) 최신 내용을 다시 불러온다
    onError: (e) => {
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
        void queryClient.invalidateQueries({ queryKey: detailKey(submissionId) })
        void queryClient.invalidateQueries({ queryKey: ['manager', 'submissions'] })
      }
    },
  })
}

// POST /submissions/{id}/confirm, POST /submissions/{id}/revision
export const useConfirm = (submissionId: number) => useReviewAction<{ version: number }>(submissionId, 'confirm')
export const useRequestRevision = (submissionId: number) =>
  useReviewAction<{ fieldKeys: string[]; reason: string; dueAt: string | null; version: number }>(submissionId, 'revision')
