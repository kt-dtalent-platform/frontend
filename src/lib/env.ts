// 실행 환경 판단을 한곳에 모은다.

// 미리보기 사이트(GitHub Pages) 빌드. 배포 빌드지만 목업으로 돈다.
export const isDemo = import.meta.env.VITE_DEMO === 'true'

// 목업(MSW)을 켜는지: 개발 서버에서 VITE_USE_MOCK=false가 아니거나, 미리보기 빌드일 때
export const mockOn = (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false') || isDemo

// 앱이 올라간 경로. 보통 '/', GitHub Pages에서는 '/frontend/'
export const basePath = import.meta.env.BASE_URL

// 앱 안의 경로('/login')를 실제 주소로 바꾼다
export const appUrl = (path: string) => basePath.replace(/\/$/, '') + path
