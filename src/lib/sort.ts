// 목록 열 정렬 값. 화면 주소와 서버 요청에 sort=name,asc 모양으로 쓴다(서버 쪽은 백엔드 확인 필요)
export type SortDir = 'asc' | 'desc'
export type Sort = { key: string; dir: SortDir } | null

export const parseSort = (raw: string | null, keys: readonly string[]): Sort => {
  const [key, dir] = (raw ?? '').split(',')
  return keys.includes(key) && (dir === 'asc' || dir === 'desc') ? { key, dir } : null
}
export const sortParam = (s: Sort) => (s ? `${s.key},${s.dir}` : null)

// 같은 열을 누를 때마다 오름차순 → 내림차순 → 기본 순서(정렬 없음). 다른 열을 누르면 그 열 오름차순(11/15)
export const nextSort = (cur: Sort, key: string): Sort => (cur?.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null)
