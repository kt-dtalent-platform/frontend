import { ClipboardList, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Users, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Logo } from '../../components/ui/Logo'
import { UserMenu } from '../../components/ui/UserMenu'
import { cn } from '../../lib/cn'

const menu: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/manager', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/manager/requests', label: '요청 관리', icon: ClipboardList },
  { to: '/manager/scholars', label: '장학생', icon: Users },
]

// compact: 메뉴를 접었을 때. 아이콘만 보이고 이름은 낭독기와 마우스 툴팁으로 전한다.
function Nav({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <nav aria-label="담당자 메뉴" className="flex flex-col gap-1">
      {menu.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={compact ? label : undefined}
          className={({ isActive }) =>
            cn(
              // 펼친 메뉴: 모든 상태에서 KT 스퀘어 자리(왼쪽 24px)를 비워 둬 글자 시작점이 같다.
              // 접은 메뉴: 아이콘만 있어 스퀘어 자리가 애매하므로 바탕과 진한 아이콘으로만 선택을 보인다(11/12)
              'relative flex h-control-default items-center gap-2 rounded-md text-label font-normal text-ink-2 no-underline',
              compact ? 'justify-center px-0' : 'pr-3 pl-6 before:absolute before:top-4 before:left-2 before:size-kt-square before:rounded-xs',
              'hover:bg-surface-hover active:bg-surface-sunken',
              isActive && 'bg-surface-sunken font-semibold text-ink',
              isActive && !compact && 'before:bg-kt-red',
            )
          }
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden />
          <span className={cn(compact && 'sr-only')}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

// 넓은 화면에서 메뉴를 접고 펴기. 고른 상태는 이 브라우저에 기억한다(못 쓰면 이번 화면에서만).
const NAV_KEY = 'kt-dtalent:manager-nav-compact'
function useCompactNav() {
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(NAV_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = () => {
    const next = !compact
    setCompact(next)
    try {
      localStorage.setItem(NAV_KEY, next ? '1' : '0')
    } catch {
      // 저장소를 못 쓰면 기억하지 않는다
    }
  }
  return [compact, toggle] as const
}

// 좁은 화면(1024px 미만): 상단 바의 메뉴 버튼으로 왼쪽에서 여는 메뉴. 브라우저 기본 <dialog>로 포커스 가두기·Esc 닫기.
function MobileNav() {
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  // 메뉴를 연 채 화면을 넓히면(1024px 이상) 메뉴는 안 보이는데 모달이 남아 화면이 막힌다. 그때 닫는다.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)')
    const onChange = () => wide.matches && setOpen(false)
    wide.addEventListener('change', onChange)
    return () => wide.removeEventListener('change', onChange)
  }, [])

  // iOS Safari는 모달 뒤 본문도 스크롤되므로 열려 있는 동안 막는다
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <>
      <Button size="compact" variant="ghost" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(true)} className="lg:hidden">
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </Button>
      <dialog
        ref={ref}
        aria-label="담당자 메뉴"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        className="m-0 h-dvh max-h-none w-sidebar-w bg-surface p-0 backdrop:bg-scrim lg:hidden"
      >
        <div className="flex h-full flex-col gap-6 px-3 py-4">
          <div className="flex h-10 items-center justify-between pl-3">
            <Logo to="/manager" />
            <Button size="compact" variant="ghost" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
              <X size={20} strokeWidth={1.75} aria-hidden />
            </Button>
          </div>
          {/* 메뉴에서 화면을 고르면 닫는다 */}
          <Nav onNavigate={() => setOpen(false)} />
        </div>
      </dialog>
    </>
  )
}

// C02 담당자: 왼쪽 메뉴(232) + 넓은 본문(1200). 1024px 미만은 메뉴를 접는다.
export function ManagerLayout() {
  const [compact, toggleCompact] = useCompactNav()
  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 bg-surface px-3 py-4 motion-safe:transition-[width] lg:flex',
          compact ? 'w-sidebar-rail' : 'w-sidebar-w',
        )}
      >
        <div className={cn('flex h-10 items-center', compact ? 'justify-center' : 'justify-between pl-3')}>
          {!compact && <Logo to="/manager" />}
          <Button
            size="compact"
            variant="ghost"
            aria-label={compact ? '메뉴 펼치기' : '메뉴 접기'}
            aria-expanded={!compact}
            title={compact ? '메뉴 펼치기' : '메뉴 접기'}
            onClick={toggleCompact}
          >
            {compact ? <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden /> : <PanelLeftClose size={20} strokeWidth={1.75} aria-hidden />}
          </Button>
        </div>
        <Nav compact={compact} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-(--z-sticky) flex h-header-h items-center justify-between gap-2 bg-canvas px-4 md:px-8 lg:justify-end">
          <div className="flex items-center gap-1 lg:hidden">
            <MobileNav />
            <Logo to="/manager" />
          </div>
          <UserMenu />
        </header>
        <main className="min-w-0 flex-1 px-4 pt-4 pb-12 md:px-8">
          <div className="mx-auto max-w-page-wide">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
