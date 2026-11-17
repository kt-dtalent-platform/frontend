import SCHOOLS from './data/schools.json'

// 목업 학교 목록: 운영 중인 대학 455곳(대학 251, 전문대학 160, 대학원대학 44).
// 팀에서 받은 명단(11/17)에서 id, 이름, 지역, 구분만 뽑았다. 원천: 대학알리미 학교 개황(2026-09-28),
// 교육부 대학교개황리스트(학교코드), 공공데이터포털 전국대학및전문대학정보표준데이터(주소 교차 확인).
// 캠퍼스는 이름에 포함(예: 고려대학교 (세종캠퍼스)). 실제 목록과 검색은 백엔드 API가 준비되면 그쪽을 쓴다
const all: { id: number; name: string; region: string; group: string }[] = SCHOOLS

// 띄어쓰기와 괄호를 무시하고 찾는다. "고대 세종"처럼 줄여 쓴 말은 찾지 못함(실제 API에서 정함)
const norm = (s: string) => s.replace(/[\s()]/g, '').toLowerCase()

export function searchSchools(keyword: string, size: number) {
  const k = norm(keyword)
  if (!k) return { items: [] }
  const hit = all.filter((s) => norm(s.name).includes(k))
  // 앞부분이 맞는 학교를 먼저
  hit.sort((a, b) => Number(!norm(a.name).startsWith(k)) - Number(!norm(b.name).startsWith(k)))
  return { items: hit.slice(0, size).map(({ id, name, region }) => ({ id, name, region })) }
}
