import { Link, Navigate, useNavigate } from 'react-router'
import { roleHome, useMe } from '../api/auth'
import { ApiError } from '../api/client'
import { tokenStore } from '../api/token'
import type { Role } from '../api/types'
import { PasswordChangeForm } from '../components/form/PasswordChangeForm'
import { Logo } from '../components/ui/Logo'
import { ErrorState, FullPageLoading } from '../components/ui/StateView'
import { usePageTitle } from '../lib/usePageTitle'

// C01 첫 로그인 비밀번호 변경: 재단이 준 임시 비밀번호로 처음 로그인하면 여기서 바꾼 뒤 시작한다
export function PasswordChangePage() {
  usePageTitle('비밀번호 변경')
  const me = useMe()
  if (tokenStore.access() === null || (me.error instanceof ApiError && me.error.status === 401)) return <Navigate to="/login" replace />
  if (me.isPending) return <FullPageLoading />
  if (me.isError) {
    return (
      <div className="mx-auto max-w-page-form px-4 py-12">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    )
  }
  if (me.data && !tokenStore.mustChangePassword()) return <Navigate to={roleHome(me.data.role)} replace />
  return <ChangeForm email={me.data.email} role={me.data.role} />
}

function ChangeForm({ email, role }: { email: string; role: Role }) {
  const navigate = useNavigate()
  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10 md:justify-center md:py-12">
      <div className="flex w-full max-w-login-card-w flex-col gap-6">
        <div className="px-2">
          <Logo />
        </div>
        <div className="flex flex-col gap-6 rounded-xl bg-surface px-6 py-8 md:p-10">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-title-1">비밀번호 변경</h1>
            <p className="m-0 text-ink-2">처음 로그인했어요. 받은 임시 비밀번호를 내 비밀번호로 바꿔 주세요.</p>
          </div>
          <PasswordChangeForm email={email} mode="first" onDone={() => navigate(roleHome(role), { replace: true })} />
        </div>
        <p className="m-0 text-center text-caption text-ink-3">
          내 계정이 아니라면 <Link to="/logout">로그아웃</Link>
        </p>
      </div>
    </main>
  )
}
