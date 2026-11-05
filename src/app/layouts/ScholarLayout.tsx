import { Outlet } from 'react-router'
import { Logo } from '../../components/ui/Logo'

// C02 장학생: 상단 바 + 가운데 폼 폭(720).
export function ScholarLayout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-(--z-sticky) h-header-h bg-surface">
        <div className="mx-auto flex h-full max-w-page-form items-center justify-between px-5">
          <Logo />
          <span className="text-caption text-ink-3">홍길동 · 6기</span>
        </div>
      </header>
      <main className="mx-auto max-w-page-form px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
