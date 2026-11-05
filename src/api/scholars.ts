import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// 장학생 명단·상세·수정·등록. 담당 정윤. 백엔드 PR #16~#19(KT-10~13) 응답·요청 모양 기준.
// 연락처 형식(숫자와 -). 백엔드 검증 규칙은 확인 필요
export const PHONE = /^[0-9-]{9,20}$/

export type ScholarStatus = 'ENROLLED' | 'LEAVE' | 'GRADUATED' | 'WITHDRAWN'
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

// GET /v1/scholars?cohortId=&status=&keyword=&page=&page_size= (KT-10)
export type ScholarItem = {
  id: number
  name: string
  email: string
  maskedPhone: string | null
  cohortName: string
  university: string
  status: ScholarStatus
  accountStatus: AccountStatus
}
export type ScholarPage = { items: ScholarItem[]; page: number; page_size: number; total: number }

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
export type ScholarDetail = {
  id: number
  name: string
  email: string
  maskedPhone: string | null
  university: string
  major: string | null
  cohort: { id: number; name: string }
  status: ScholarStatus
}

export function useScholar(id: number) {
  return useQuery({ queryKey: ['manager', 'scholar', id], queryFn: () => api<ScholarDetail>(`/scholars/${id}`) })
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

// POST /v1/scholars (KT-13 요청 검증만 있음). 응답 모양은 확인 필요({ id }로 가정)
export type ScholarCreate = {
  cohortId: number
  name: string
  email: string
  phone: string | null
  birthDate: string // YYYY-MM-DD
  university: string | null
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

// 기수 목록(KT-9). 요청 만들기(KT-24)의 useCohorts와 같은 API·같은 캐시 키. 두 PR이 합쳐지면 하나로 정리한다
export function useCohortOptions(programId: number | undefined) {
  return useQuery({
    queryKey: ['manager', 'cohorts', programId],
    queryFn: async () => (await api<{ items: { id: number; name: string; scholarCount: number }[] }>(`/programs/${programId}/cohorts`)).items,
    enabled: programId !== undefined,
    staleTime: 10 * 60_000,
  })
}
