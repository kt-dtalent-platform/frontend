import { ChevronLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useMe } from '../../api/auth'
import { PasswordChangeForm } from '../../components/form/PasswordChangeForm'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { usePageTitle } from '../../lib/usePageTitle'

// S04 비밀번호 변경: 내 정보에서 들어온다. 입력칸 세 개라 좁은 폭(360)으로 둔다
export function MyPasswordPage() {
  usePageTitle('비밀번호 변경')
  const me = useMe()
  const navigate = useNavigate()
  // 기록에 쌓지 않고 바꾼다. 쌓으면 내 정보에서 뒤로 가기를 눌렀을 때 빈 비밀번호 폼이 다시 열린다
  const back = () => navigate('/me', { replace: true })
  return (
    <div className="mx-auto flex w-full max-w-login-card-w flex-col gap-6">
      <Link to="/me" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />내 정보
      </Link>
      <PageTitle>비밀번호 변경</PageTitle>
      {me.isPending && <LoadingCards count={1} />}
      {me.isError && <ErrorState error={me.error} onRetry={() => me.refetch()} />}
      {me.data && (
        <PasswordChangeForm
          email={me.data.email}
          mode="change"
          onCancel={back}
          onDone={() => navigate('/me', { replace: true, state: { toast: '비밀번호를 바꿨어요' } })}
        />
      )}
    </div>
  )
}
