// 목업 목록 정렬(sort=name,asc). 키마다 비교할 값을 받는다. 글자는 가나다순, 빈 값은 맨 뒤
export function sortRows<T>(list: T[], raw: string | null, values: Record<string, (row: T) => string | number | null | undefined>) {
  const [key, dir] = (raw ?? '').split(',')
  const get = values[key]
  if (!get || (dir !== 'asc' && dir !== 'desc')) return list
  const sign = dir === 'desc' ? -1 : 1
  return [...list].sort((a, b) => {
    const x = get(a)
    const y = get(b)
    if (x == null || x === '') return y == null || y === '' ? 0 : 1
    if (y == null || y === '') return -1
    return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko'))
  })
}
