import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sortParam, type Sort } from '../lib/sort'
import { api } from './client'

// 장학생 명단·상세·수정·등록. 백엔드 KT-10~13 응답·요청 모양 기준
// 연락처 형식(숫자와 -). 백엔드 검증 규칙은 확인 필요
export const PHONE = /^[0-9-]{9,20}$/

// 장학생 상태: 재학, 휴학, 수료, 중단(11/10 재단 요청 3개 + 11/17 군휴학 때문에 휴학 추가, 백엔드와 같은 값)
export type ScholarStatus = 'ENROLLED' | 'LEAVE' | 'COMPLETED' | 'WITHDRAWN'
// 필터, 상태 바꾸기, 내보내기가 같이 쓰는 순서와 이름
export const scholarStatuses: { value: ScholarStatus; label: string }[] = [
  { value: 'ENROLLED', label: '재학' },
  { value: 'LEAVE', label: '휴학' },
  { value: 'COMPLETED', label: '수료' },
  { value: 'WITHDRAWN', label: '중단' },
]
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

// 한 쪽에 보일 수. 백엔드 page_size는 1~100
export const SCHOLAR_PAGE_SIZES = [20, 50, 100] as const

export function useScholars(q: { cohortId: number | null; status: ScholarStatus | null; keyword: string; page: number; pageSize?: number; sort?: Sort }) {
  const pageSize = q.pageSize ?? SCHOLAR_PAGE_SIZES[0]
  const params = new URLSearchParams({ page: String(q.page), page_size: String(pageSize) })
  if (q.cohortId) params.set('cohortId', String(q.cohortId))
  if (q.status) params.set('status', q.status)
  if (q.keyword) params.set('keyword', q.keyword)
  // 열 정렬 sort=name,asc. 키는 name, cohort, university, status, email(백엔드 main). 없으면 등록 순
  const sort = sortParam(q.sort ?? null)
  if (sort) params.set('sort', sort)
  return useQuery({
    queryKey: ['manager', 'scholars', q.cohortId, q.status, q.keyword, q.page, pageSize, sort],
    queryFn: () => api<ScholarPage>(`/scholars?${params}`),
    placeholderData: keepPreviousData,
  })
}

// GET /v1/scholars/{id} (KT-11). 응답의 제출 요약과 계좌(bankAccount)는 아직 화면에 쓰지 않는다
export type ScholarDetail = StatusInfo & {
  id: number
  name: string
  email: string
  maskedPhone: string | null
  university: string
  major: string | null
  cohort: { id: number; name: string }
  // 목록에서 고른 학교의 ID. 직접 쓴 이름이면 null(KT-54)
  schoolId?: number | null
}

export function useScholar(id: number) {
  // 주소의 번호가 숫자가 아니면 부르지 않는다
  return useQuery({ queryKey: ['manager', 'scholar', id], queryFn: () => api<ScholarDetail>(`/scholars/${id}`), enabled: Number.isInteger(id) && id > 0 })
}

// PATCH /v1/scholars/{id} (KT-12): 보낸 항목만 바꾼다. 빈 값(null)으로 지우기와 상태 변경은 아직 지원하지 않음.
// 학교를 바꿀 때는 university와 schoolId(목록의 학교면 ID, 직접 쓴 이름이면 null)를 함께 보낸다(KT-54)
export type ScholarUpdate = Partial<Record<'name' | 'phone' | 'university' | 'major', string>> & { schoolId?: number | null }

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

// PATCH /v1/scholars/{id}/status: 상태 바꾸기. 수료면 수료 연도, 중단이면 사유가 필요하다. 백엔드 KT-47(#70)
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

// PATCH /v1/scholars/status: 여러 명 상태를 한 번에(최대 1000명). 백엔드 KT-47(#70)
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

// GET /v1/scholars/export?format=xlsx&status=A,B&cohortId=&columns=... 백엔드 KT-48(#88). 이름은 늘 들어가고 연락처는 가려서 나온다
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
      { key: 'withdrawalReasonDetail', label: '중단 상세 사유', default: true },
      { key: 'accountStatus', label: '로그인 상태' },
    ],
  },
]

// POST /v1/scholars (백엔드 KT-13). 생년월일은 MVP에서 받지 않고 학교는 필수(11/11 백엔드 결정).
// 응답: { id, accountStatus, temporaryPassword }. 임시 비밀번호는 이 응답에서 한 번만 온다(DB에는 해시만)
export type ScholarCreate = {
  cohortId: number
  name: string
  email: string
  phone: string | null
  university: string
  major: string | null
  studentNo: string | null
  // 목록에서 고른 학교면 ID. 서버가 목록의 이름으로 저장한다(KT-54). 직접 쓴 이름이면 보내지 않는다
  schoolId?: number
}

// POST /v1/scholars/bulk · 백엔드에 아직 없음(11/15 요청) · FE 연동: Mock
// 프론트가 엑셀을 읽어 명단만 보낸다. 이미 등록된 이메일이 있으면 409 DUPLICATE_EMAIL, details에 그 이메일 목록(가정, 확인 필요)
export type ScholarBulkCreate = { cohortId: number; scholars: Omit<ScholarCreate, 'cohortId'>[] }

export function useBulkCreateScholars() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ScholarBulkCreate) => api<{ created: number }>('/scholars/bulk', { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['manager', 'scholars'] }),
  })
}

export type ScholarCreated = { id: number; accountStatus: AccountStatus; temporaryPassword: string | null }

export function useCreateScholar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ScholarCreate) => api<ScholarCreated>('/scholars', { method: 'POST', body }),
    // 응답에 임시 비밀번호가 있어 끝난 요청 기록을 캐시에 남기지 않는다
    gcTime: 0,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['manager', 'scholars'] }),
  })
}
