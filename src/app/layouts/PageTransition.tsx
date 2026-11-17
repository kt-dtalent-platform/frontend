import { Outlet, useLocation } from 'react-router'

// 화면이 바뀔 때 본문만 살짝 나타난다(160ms, 4px). 업무 화면이라 미끄러지는 큰 전환 대신 짧은 페이드(Fluent: 최상위 이동은 빠른 페이드).
// 주소 경로가 바뀔 때만 다시 그린다. 필터, 정렬, 쪽 번호처럼 ?뒤만 바뀌면 움직이지 않는다
export function PageTransition() {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="animate-page-in">
      <Outlet />
    </div>
  )
}
