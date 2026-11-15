import { http, passthrough } from 'msw'
import { isDemo } from '../lib/env'

// 실제 서버로 보낼 API 묶음. .env의 VITE_LIVE_API에 쉼표로 적는다(예: VITE_LIVE_API=auth,scholars).
// 적은 묶음은 목업을 거치지 않고 개발 서버 프록시로 백엔드에 간다. 나머지는 목업이 답한다.
// 화면 흐름 단위로 묶었다. 한 흐름 안에서 실제 서버와 목업이 섞이면 ID가 서로 맞지 않는다.
const groups = {
  // 로그인, 내 정보, 비밀번호 변경
  auth: [/^\/auth\//, /^\/me$/],
  // 장학생 명단, 상세, 등록, 수정, 기수 목록, 학교 검색
  scholars: [/^\/scholars(\/|$)/, /^\/programs\/\d+\/cohorts$/, /^\/schools$/],
  // 장학생: 내 할 일, 제출 입력, 임시 저장, 파일 올리기와 지우기, 제출
  tasks: [/^\/me\/(tasks|submissions)(\/|$)/, /^\/submissions\/\d+\/files\/(presign|\d+\/complete)$/, /^\/files\/\d+$/],
  // 담당자: 대시보드, 요청 목록, 만들기, 공개, 제출 현황, 내보내기, 요청 유형
  requests: [/^\/dashboard\//, /^\/requests(\/|$)/, /^\/request-templates$/],
  // 담당자: 개별 검토, 확인, 보완 요청, 서류 원본 주소
  review: [/^\/submissions\/\d+(\/(confirm|revision|files\/\d+\/url))?$/],
} satisfies Record<string, RegExp[]>

export type LiveGroup = keyof typeof groups

// 미리보기 사이트는 항상 목업
const raw = import.meta.env.DEV && !isDemo ? (import.meta.env.VITE_LIVE_API ?? '') : ''
const chosen = raw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const all = chosen.includes('all')
const unknown = chosen.filter((g) => g !== 'all' && !(g in groups))
if (unknown.length) console.warn(`VITE_LIVE_API에 모르는 이름이 있습니다: ${unknown.join(', ')}. 쓸 수 있는 이름: ${Object.keys(groups).join(', ')}, all`)

// 같이 켜야 하는 묶음. 실제 서버는 진짜 토큰이 있어야 하므로 어느 묶음이든 auth를 함께 켠다.
// 개별 검토는 제출 현황(requests)에서 받은 제출 ID로 들어가므로 requests를 함께 켠다(목업 ID로 실제 제출을 고치지 않게).
// 요청 만들기는 기수 목록(scholars)의 기수 ID를 보내므로 scholars를 함께 켠다
const needs: Partial<Record<LiveGroup, LiveGroup[]>> = { review: ['requests'], requests: ['scholars'] }
const picked = new Set<LiveGroup>(all ? (Object.keys(groups) as LiveGroup[]) : chosen.filter((g): g is LiveGroup => g in groups))
for (const g of [...picked]) for (const d of needs[g] ?? []) picked.add(d)
if (picked.size) picked.add('auth')
const added = [...picked].filter((g) => !all && !chosen.includes(g))
if (added.length) console.warn(`VITE_LIVE_API: 함께 써야 해서 ${added.join(', ')}도 실제 서버로 보냅니다.`)

const patterns = [...picked].flatMap((g) => groups[g])

export const liveGroups = [...picked]
if (liveGroups.length) console.info(`실제 서버로 보내는 API: ${liveGroups.join(', ')}. 나머지는 목업`)

// /v1 뒤의 경로가 실제 서버로 갈 묶음에 들어가는지
export function isLive(pathname: string) {
  const path = pathname.replace(/^.*?\/v1(?=\/)/, '')
  return patterns.some((re) => re.test(path))
}

// 목업 처리기 맨 앞에 둔다. 실제 서버로 갈 요청은 그대로 내보낸다.
export const liveHandler = http.all('*/v1/*', ({ request }) => {
  if (isLive(new URL(request.url).pathname)) return passthrough()
})
