import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sortParam, type Sort } from '../lib/sort'
import { ApiError, BASE_URL, api } from './client'
import { tokenStore } from './token'
import type { SubmissionStatus } from './types'

// 담당자 제출 현황과 개별 검토. 제출 현황, 개별 조회는 백엔드 KT-55(#85). 확인 완료, 보완 요청은 PR #89 머지 대기

// GET /requests/{requestId}/submissions?status=&keyword=&page=
// status: NOT_SUBMITTED, WAITING(제출 + 재제출), REVISION_REQUIRED, CONFIRMED. summary는 조건과 상관없이 전체 기준
export type StatusSummary = { target: number; notSubmitted: number; submitted: number; revisionRequired: number; confirmed: number }
export type SubmissionRow = {
  scholarId: number
  scholarName: string
  cohortName?: string | null
  university?: string | null
  gpa?: number | null
  gpaScale?: string | null
  submissionId: number | null
  status: SubmissionStatus
  submittedAt: string | null
  late?: boolean // 마감 뒤 제출. 서버가 준다
  hasInputError: boolean
}
export type SubmissionPage = {
  request: { id: number; title: string; cohortName: string | null; closesAt: string | null }
  summary: StatusSummary
  items: SubmissionRow[]
  page: number
  pageSize: number
  total: number
}

// 화면의 상태 칩. 검토 대기는 SUBMITTED·RESUBMITTED를 함께 센다
export type StatusFilter = 'NOT_SUBMITTED' | 'WAITING' | 'REVISION_REQUIRED' | 'CONFIRMED'

export function useRequestSubmissions(requestId: number, q: { status: StatusFilter | null; keyword: string; page: number; pageSize?: number; sort?: Sort }) {
  const pageSize = q.pageSize ?? 20
  const params = new URLSearchParams({ page: String(q.page), page_size: String(pageSize) })
  if (q.status) params.set('status', q.status)
  if (q.keyword) params.set('keyword', q.keyword)
  // 열 정렬. 백엔드에 아직 없음(11/15 요청). 실제 서버일 때는 화면에서 보내지 않는다
  const order = sortParam(q.sort ?? null)
  if (order) params.set('sort', order)
  return useQuery({
    queryKey: ['manager', 'submissions', requestId, q.status, q.keyword, q.page, pageSize, order],
    queryFn: () => api<SubmissionPage>(`/requests/${requestId}/submissions?${params}`),
    placeholderData: keepPreviousData,
  })
}

// GET /requests/{requestId}/export?format=xlsx&status=A,B&columns=name,cohort,...
// 범위(상태 여러 개, 비우면 전체)와 열을 고른다(재단 요청 11/10). 파라미터 모양은 프론트 제안(확인 필요)
export const submissionExportColumns = [
  {
    label: '장학생 정보',
    columns: [
      { key: 'name', label: '이름', required: true },
      { key: 'cohort', label: '기수', default: true },
      { key: 'university', label: '학교', default: true },
      { key: 'major', label: '학과' },
      { key: 'studentNo', label: '학번' },
      { key: 'email', label: '이메일' },
      { key: 'phone', label: '연락처' },
    ],
  },
  {
    label: '제출 정보',
    columns: [
      { key: 'status', label: '제출 상태', default: true },
      { key: 'submittedAt', label: '제출 일시', default: true },
      { key: 'gpa', label: '평점', default: true },
      { key: 'gpaScale', label: '만점 기준', default: true },
      { key: 'credits', label: '이수 학점', default: true },
      { key: 'revisionReason', label: '보완 사유' },
    ],
  },
]

export async function downloadExport(requestId: number, choice: { scopes: string[]; columns: string[] }) {
  return downloadFile(`/requests/${requestId}/export`, choice, `request_${requestId}.xlsx`)
}

// 내보내기 공통: 파일을 받아 브라우저 내려받기로 넘긴다
export async function downloadFile(path: string, choice: { scopes: string[]; columns: string[] }, fallbackName: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ format: 'xlsx', columns: choice.columns.join(','), ...extra })
  if (choice.scopes.length) params.set('status', choice.scopes.join(','))
  const res = await fetch(`${BASE_URL}${path}?${params}`, {
    headers: tokenStore.access() ? { Authorization: `Bearer ${tokenStore.access()}` } : {},
  })
  if (!res.ok) {
    // 실패 응답은 공통 형식(JSON)이라 오류 코드를 꺼내 이유를 보여 준다
    const json = (await res.json().catch(() => null)) as { resultType?: string; error?: { code: string; message: string } } | null
    throw new ApiError(res.status, json?.error ?? { code: 'EXPORT_FAILED', message: '' })
  }
  const name = fileNameOf(res.headers.get('Content-Disposition')) ?? fallbackName
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
      // 보완 기한이 장학생 마감을 늘릴 수 있다(백엔드 #103)
      void queryClient.invalidateQueries({ queryKey: ['manager', 'deadline'] })
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

// 장학생별 마감 연장(백엔드 KT-50, #78). 담당자만.
// GET  /requests/{requestId}/targets/{scholarId}/deadline → 공통 마감과 이 장학생의 마감(연장 반영)
// PATCH 같은 주소 {dueAt}: 진행 중인 요청의 대상자만, 지금 마감보다 뒤인 미래 시각으로만 늘린다
export type TargetDeadline = { requestId: number; scholarId: number; commonDueAt: string; dueAt: string }
const deadlineKey = (requestId: number, scholarId: number) => ['manager', 'deadline', requestId, scholarId] as const

export function useTargetDeadline(requestId: number, scholarId: number | null) {
  return useQuery({
    queryKey: deadlineKey(requestId, scholarId ?? 0),
    queryFn: () => api<TargetDeadline>(`/requests/${requestId}/targets/${scholarId}/deadline`),
    enabled: scholarId !== null,
  })
}

export function useExtendDeadline(requestId: number, scholarId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dueAt: string) => api<TargetDeadline>(`/requests/${requestId}/targets/${scholarId}/deadline`, { method: 'PATCH', body: { dueAt } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deadlineKey(requestId, scholarId) })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'submissions', requestId] })
    },
  })
}
