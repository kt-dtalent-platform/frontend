import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from './client'

// GET /v1/schools?keyword=&size= · 백엔드 KT-52(#76). 담당자만 부를 수 있다
// 캠퍼스는 이름에 포함한다(예: 고려대학교 (세종캠퍼스)). 빈 검색은 빈 목록이고, 목록 밖 학교명도 저장할 수 있다
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
