import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// 장학생 명단·상세·수정·등록. 담당 정윤. 백엔드 PR #16~#19(KT-10~13) 응답·요청 모양 기준.
// 연락처 형식(숫자와 -). 백엔드 검증 규칙은 확인 필요
export const PHONE = /^[0-9-]{9,20}$/

// 장학생 상태(재단 요청 11/10): 재학, 수료, 중단. 값 이름은 백엔드 수정에 맞춘다(확인 필요)
export type ScholarStatus = 'ENROLLED' | 'COMPLETED' | 'WITHDRAWN'
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

// 중단 사유. 기타는 withdrawalReasonDetail에 직접 쓴 내용(확인 필요)
export type WithdrawalReason = 'ACADEMIC_STATUS' | 'DOUBLE_BENEFIT' | 'GRADE_NOT_MET' | 'ACTIVITY_NOT_MET' | 'VOLUNTARY' | 'OTHER'
export const withdrawalReasons: { value: WithdrawalReason; label: string }[] = [
  { value: 'ACADEMIC_STATUS', label: '학적 변동/상실' },
  { value: 'DOUBLE_BENEFIT', label: '이중 수혜' },
  { value: 'GRADE_NOT_MET', label: '성적 미충족' },
  { value: 'ACTIVITY_NOT_MET', label: '활동 요건 미충족' },
  { value: 'VOLUNTARY', label: '자발적 포기' },
  { value: 'OTHER', label: '기타' },
]

// 수료 연도와 중단 사유(재단 요청 11/10). 백엔드 필드 이름은 확인 필요
export type StatusInfo = {
  status: ScholarStatus
  completedYear: number | null
  withdrawalReason: WithdrawalReason | null
  withdrawalReasonDetail: string | null
}

// 중단 사유 글자. short: 명단처럼 한 줄에 놓을 때는 기타 사유를 직접 쓴 내용 대신 "기타"로
export function withdrawalText(s: StatusInfo, short = false) {
  if (!s.withdrawalReason) return null
  if (s.withdrawalReason === 'OTHER' && !short && s.withdrawalReasonDetail) return s.withdrawalReasonDetail
  return withdrawalReasons.find((r) => r.value === s.withdrawalReason)?.label ?? null
}

// 명단에 보여 줄 상태 설명: "2027년 수료", "중단 사유: 성적 미충족"
export function statusNote(s: StatusInfo) {
  if (s.status === 'COMPLETED' && s.completedYear) return `${s.completedYear}년 수료`
  const reason = s.status === 'WITHDRAWN' ? withdrawalText(s, true) : null
  return reason ? `중단 사유: ${reason}` : null
}

// GET /v1/scholars?cohortId=&status=&keyword=&page=&page_size= (KT-10)
export type ScholarItem = StatusInfo & {
  id: number
  name: string
  email: string
  maskedPhone: string | null
  cohortName: string
  university: string
  accountStatus: AccountStatus
}
export type ScholarPage = { items: ScholarItem[]; page: number; pageSize: number; total: number }

export function useScholars(q: { cohortId: number | null; status: ScholarStatus | null; keyword: string; page: number }) {
  const params = new URLSearchParams({ page: String(q.page), page_size: '20' })
  if (q.cohortId) params.set('cohortId', String(q.cohortId))
  if (q.status) params.set('status', q.status)
  if (q.keyword) params.set('keyword', q.keyword)
  return useQuery({
    queryKey: ['manager', 'scholars', q.cohortId, q.status, q.keyword, q.page],
    queryFn: () => api<ScholarPage>(`/scholars?${params}`),
    placeholderData: keepPreviousData,
  })
}

// GET /v1/scholars/{id} (KT-11). 계좌번호·제출 요약은 백엔드 미완료
export type ScholarDetail = StatusInfo & {
  id: number
  name: string
  email: string
  maskedPhone: string | null
  university: string
  major: string | null
  cohort: { id: number; name: string }
}

export function useScholar(id: number) {
  // 주소의 번호가 숫자가 아니면 부르지 않는다
  return useQuery({ queryKey: ['manager', 'scholar', id], queryFn: () => api<ScholarDetail>(`/scholars/${id}`), enabled: Number.isInteger(id) && id > 0 })
}

// PATCH /v1/scholars/{id} (KT-12): 보낸 문자열 항목만 바꾼다. 빈 값(null)으로 지우기와 상태 변경은 아직 지원하지 않음
export type ScholarUpdate = Partial<Record<'name' | 'phone' | 'university' | 'major', string>>

export function useUpdateScholar(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ScholarUpdate) => api<{ id: number; updatedAt: string }>(`/scholars/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'scholar', id] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'scholars'] })
    },
  })
}

// PATCH /v1/scholars/{id}/status: 상태 바꾸기. 수료면 수료 연도, 중단이면 사유가 필요하다
// 백엔드에 아직 없음. 주소와 본문은 프론트 제안(확인 필요)
export type StatusChange = StatusInfo

export function useChangeScholarStatus(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: StatusChange) => api<{ id: number; updatedAt: string }>(`/scholars/${id}/status`, { method: 'PATCH', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'scholar', id] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'scholars'] })
    },
  })
}

// PATCH /v1/scholars/status: 여러 명 상태를 한 번에(11/12). 백엔드에 질문할 것, 모양은 프론트 제안(확인 필요)
export function useChangeScholarsStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: StatusChange & { scholarIds: number[] }) => api<{ updated: number }>('/scholars/status', { method: 'PATCH', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'scholars'] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'scholar'] })
    },
  })
}

// GET /v1/scholars/export?format=xlsx&status=A,B&cohortId=&columns=... (재단 요청 11/10, 확인 필요)
export const scholarExportColumns = [
  {
    label: '장학생 정보',
    columns: [
      { key: 'name', label: '이름', required: true },
      { key: 'cohort', label: '기수', default: true },
      { key: 'university', label: '학교', default: true },
      { key: 'major', label: '학과', default: true },
      { key: 'studentNo', label: '학번' },
      { key: 'email', label: '이메일', default: true },
      { key: 'phone', label: '연락처' },
    ],
  },
  {
    label: '상태',
    columns: [
      { key: 'status', label: '상태', default: true },
      { key: 'completedYear', label: '수료 연도', default: true },
      { key: 'withdrawalReason', label: '중단 사유', default: true },
      { key: 'accountStatus', label: '로그인 상태' },
    ],
  },
]

// POST /v1/scholars (백엔드 KT-13). 생년월일은 MVP에서 받지 않고 학교는 필수(11/11 백엔드 결정). 응답 모양은 확인 필요({ id }로 가정)
export type ScholarCreate = {
  cohortId: number
  name: string
  email: string
  phone: string | null
  university: string
  major: string | null
  studentNo: string | null
}

export function useCreateScholar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ScholarCreate) => api<{ id: number }>('/scholars', { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['manager', 'scholars'] }),
  })
}
