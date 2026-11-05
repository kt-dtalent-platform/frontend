import { ChartColumn, ClipboardList, LayoutDashboard, Users, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { Logo } from '../../components/ui/Logo'
import { cn } from '../../lib/cn'

const menu: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/manager', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/manager/requests', label: '요청 관리', icon: ClipboardList },
  { to: '/manager/submissions', label: '제출 현황', icon: ChartColumn },
  { to: '/manager/scholars', label: '장학생', icon: Users },
]

// C02 담당자: 왼쪽 메뉴(232) + 넓은 본문(1200).
export function ManagerLayout() {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-sidebar-w shrink-0 flex-col gap-6 bg-surface px-3 py-4">
        <div className="flex h-10 items-center px-3">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1">
          {menu.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  // 모든 상태에서 KT 스퀘어 자리(왼쪽 24px)를 비워 둬 글자 시작점이 같다.
                  'relative flex h-control-default items-center gap-2 rounded-md pr-3 pl-6 text-label font-normal text-ink-2',
                  'before:absolute before:top-4 before:left-2 before:size-kt-square before:rounded-xs',
                  'hover:bg-gray-50 active:bg-gray-150',
                  isActive && 'bg-gray-50 font-semibold text-ink before:bg-kt-red',
                )
              }
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-12">
        <div className="mx-auto max-w-page-wide">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
