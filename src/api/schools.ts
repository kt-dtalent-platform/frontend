import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from './client'

// GET /v1/schools?keyword=&size= · 백엔드에 아직 없음(11/15 회의: 학교 테이블과 검색 API) · FE 연동: Mock
// 캠퍼스는 이름에 포함한다(예: 고려대학교 (세종캠퍼스)). 응답 모양은 확인 필요
export type School = { id: number; name: string; region: string | null }

export function useSchools(keyword: string) {
  const k = keyword.trim()
  return useQuery({
    queryKey: ['schools', k],
    queryFn: () => api<{ items: School[] }>(`/schools?${new URLSearchParams({ keyword: k, size: '8' })}`),
    enabled: k.length > 0,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  })
}
