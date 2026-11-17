// 실행 환경 판단을 한곳에 모은다.

// 미리보기 사이트(GitHub Pages) 빌드. 배포 빌드지만 목업으로 돈다.
export const isDemo = import.meta.env.VITE_DEMO === 'true'

// 목업(MSW)을 켜는지: 개발 서버에서 VITE_USE_MOCK=false가 아니거나, 미리보기 빌드일 때
export const mockOn = (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false') || isDemo

// 로그인이 실제 서버로 가는지: 개발 서버에서 VITE_LIVE_API에 묶음을 하나라도 적으면 로그인(auth)도 함께 실제 서버로 간다(mocks/live.ts)
export const liveAuthOn = import.meta.env.DEV && !isDemo && mockOn && !!import.meta.env.VITE_LIVE_API?.trim()

// 앱이 올라간 경로. 보통 '/', GitHub Pages에서는 '/frontend/'
export const basePath = import.meta.env.BASE_URL

// 앱 안의 경로('/login')를 실제 주소로 바꾼다
export const appUrl = (path: string) => basePath.replace(/\/$/, '') + path

// 요청 목록이 실제 서버로 가는지: 목업을 끄거나, VITE_LIVE_API에 requests(또는 함께 켜지는 review, all)를 적었을 때
const liveNames = (import.meta.env.DEV && !isDemo ? (import.meta.env.VITE_LIVE_API ?? '') : '').split(',').map((s: string) => s.trim())
export const liveRequestsOn = !mockOn || liveNames.some((g: string) => g === 'requests' || g === 'review' || g === 'all')
