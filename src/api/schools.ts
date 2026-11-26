import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// GET /v1/schools?keyword=&size= · 백엔드 KT-52(#76). 담당자만 부를 수 있다
// 캠퍼스는 이름에 포함한다(예: 고려대학교 (세종캠퍼스)). 빈 검색은 빈 목록이고, 목록 밖 학교명도 저장할 수 있다
export type School = { id: number; name: string; region: string | null }

const schoolsQuery = (k: string) => ({
  queryKey: ['schools', k],
  queryFn: () => api<{ items: School[] }>(`/schools?${new URLSearchParams({ keyword: k, size: '8' })}`),
  staleTime: 10 * 60_000,
})

export function useSchools(keyword: string) {
  const k = keyword.trim()
  return useQuery({ ...schoolsQuery(k), enabled: k.length > 0, placeholderData: keepPreviousData })
}

// 저장할 때 학교 이름으로 목록의 학교 ID를 찾는다(백엔드 KT-54, #83).
// 목록에서 골랐거나 이름을 똑같이 쓴 경우만 ID가 나오고, 목록에 없으면 null(이름만 저장).
// 고르는 칸이 이미 같은 검색을 했으므로 보통 캐시에서 바로 나온다. 찾기에 실패해도 저장은 막지 않는다
// 학교 이름 비교 기준. 서버 학교 검색과 같게 띄어쓰기와 괄호를 빼고 영문은 소문자로 본다
// 예: "고려대학교(세종캠퍼스)"와 "고려대학교 (세종캠퍼스)"는 같은 학교
export function schoolKey(name: string) {
  return name.replace(/[\s()]/g, '').toLowerCase()
}

export function useFindSchoolId() {
  const queryClient = useQueryClient()
  return async (name: string): Promise<number | null> => {
    const k = name.trim()
    if (!k) return null
    try {
      const data = await queryClient.fetchQuery(schoolsQuery(k))
      return data.items.find((s) => schoolKey(s.name) === schoolKey(k))?.id ?? null
    } catch {
      return null
    }
  }
}
