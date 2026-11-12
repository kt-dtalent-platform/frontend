import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { roleHome, useMe } from '../api/auth'
import { ApiError } from '../api/client'
import { tokenStore } from '../api/token'
import type { Role } from '../api/types'
import { ErrorState, FullPageLoading } from '../components/ui/StateView'

// 로그인한 사람만, 그리고 맞는 역할만 들어오게 한다.
export function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const location = useLocation()
  const me = useMe()

  if (tokenStore.access() === null || (me.error instanceof ApiError && me.error.status === 401)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (me.isPending) return <FullPageLoading />
  if (me.isError) {
    return (
      <div className="mx-auto max-w-page-form px-4 py-12">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    )
  }
  // 임시 비밀번호로 들어왔으면 비밀번호부터 바꾼다
  if (tokenStore.mustChangePassword()) return <Navigate to="/password" replace />
  if (me.data.role !== role) return <Navigate to={roleHome(me.data.role)} replace />
  return children
}

// 주소 / 로 오면 로그인 여부에 따라 보낸다.
export function RootRedirect() {
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
  return <Navigate to={roleHome(me.data.role)} replace />
}
