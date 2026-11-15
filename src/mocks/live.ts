import { http, passthrough } from 'msw'
import { isDemo } from '../lib/env'

// 실제 서버로 보낼 API 묶음. .env의 VITE_LIVE_API에 쉼표로 적는다(예: VITE_LIVE_API=auth,scholars).
// 적은 묶음은 목업을 거치지 않고 개발 서버 프록시로 백엔드에 간다. 나머지는 목업이 답한다.
// 화면 흐름 단위로 묶었다. 한 흐름 안에서 실제 서버와 목업이 섞이면 ID가 서로 맞지 않는다.
const groups = {
  // 로그인, 내 정보, 비밀번호 변경
  auth: [/^\/auth\//, /^\/me$/],
  // 장학생 명단, 상세, 등록, 수정, 기수 목록, 학교 검색
  scholars: [/^\/scholars(\/|$)/, /^\/programs\/\d+\/cohorts$/],
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

const patterns = Object.entries(groups)
  .filter(([name]) => all || chosen.includes(name))
  .flatMap(([, list]) => list)

export const liveGroups = all ? Object.keys(groups) : chosen.filter((g) => g in groups)
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
