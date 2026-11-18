import { Outlet, useLocation } from 'react-router'

// 화면이 바뀔 때 본문만 나타난다. 주소 경로가 바뀔 때만 다시 그린다. 필터, 정렬, 쪽 번호처럼 ?뒤만 바뀌면 움직이지 않는다.
// productive(담당자): 160ms, 4px. 업무 화면이라 짧은 페이드(Fluent: 최상위 이동은 빠른 페이드)
// expressive(장학생): 400ms, 12px. 가끔 들어와 제출하는 화면이라 이동을 또렷하게(Carbon expressive)
export function PageTransition({ tone = 'productive' }: { tone?: 'productive' | 'expressive' }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className={tone === 'expressive' ? 'animate-page-in-expressive' : 'animate-page-in'}>
      <Outlet />
    </div>
  )
}
