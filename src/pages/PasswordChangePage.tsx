import { Check, Circle } from 'lucide-react'
import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate } from 'react-router'
import { roleHome, useChangePassword, useMe } from '../api/auth'
import { ApiError } from '../api/client'
import { tokenStore } from '../api/token'
import { fieldBorder, fieldControl } from '../components/form/fieldClass'
import { LabeledField } from '../components/form/LabeledField'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { ErrorState, FullPageLoading } from '../components/ui/StateView'
import { cn } from '../lib/cn'
import { usePageTitle } from '../lib/usePageTitle'

type Values = { currentPassword: string; newPassword: string; confirm: string }

// 비밀번호 규칙. 백엔드 규칙은 확인 필요(지금은 명세서의 8자 이상 + 영문·숫자)
const rules = [
  { label: '8자 이상', test: (v: string) => v.length >= 8 },
  { label: '영문 포함', test: (v: string) => /[A-Za-z]/.test(v) },
  { label: '숫자 포함', test: (v: string) => /\d/.test(v) },
]

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
  if (me.data && !me.data.passwordChangeRequired) return <Navigate to={roleHome(me.data.role)} replace />
  return <ChangeForm email={me.data?.email ?? ''} />
}

function ChangeForm({ email }: { email: string }) {
  const change = useChangePassword()
  const rulesId = useId()
  const { register, handleSubmit, control, formState, setError, getValues, trigger } = useForm<Values>({
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
    mode: 'onTouched',
  })
  const e = formState.errors
  const next = useWatch({ control, name: 'newPassword' })
  const busy = formState.isSubmitting || change.isPending

  const onSubmit = handleSubmit(async (v) => {
    try {
      // 성공하면 내 정보를 다시 받고, 위 PasswordChangePage가 역할별 첫 화면으로 보낸다
      await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_PASSWORD')
        setError('currentPassword', { message: '임시 비밀번호가 맞지 않아요.' }, { shouldFocus: true })
      else if (err instanceof ApiError && err.code === 'SAME_PASSWORD')
        setError('newPassword', { message: '임시 비밀번호와 다른 비밀번호를 쓰세요.' }, { shouldFocus: true })
      else setError('root', { message: err instanceof ApiError ? err.message : '잠시 뒤 다시 시도하세요.' })
    }
  })

  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10 md:justify-center md:py-12">
      <div className="flex w-full max-w-login-card-w flex-col gap-6">
        <div className="px-2">
          <Logo />
        </div>
        <form onSubmit={(ev) => void onSubmit(ev)} noValidate className="flex flex-col gap-6 rounded-xl bg-surface px-6 py-8 md:p-10">
          {/* 비밀번호 관리자(Safari 키체인, Chrome)가 어느 계정의 새 비밀번호인지 알도록 아이디를 숨겨 둔다 */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-title-1">비밀번호 변경</h1>
            <p className="m-0 text-ink-2">처음 로그인했어요. 받은 임시 비밀번호를 내 비밀번호로 바꿔 주세요.</p>
          </div>

          <LabeledField label="임시 비밀번호" error={e.currentPassword?.message}>
            {(p) => (
              <input
                {...p}
                type="password"
                autoComplete="current-password"
                className={cn(fieldControl, fieldBorder(!!e.currentPassword))}
                {...register('currentPassword', { required: '임시 비밀번호를 입력하세요.' })}
              />
            )}
          </LabeledField>

          <div className="flex flex-col gap-2">
            <LabeledField label="새 비밀번호" error={e.newPassword?.message}>
              {(p) => (
                <input
                  {...p}
                  aria-describedby={[p['aria-describedby'], rulesId].filter(Boolean).join(' ')}
                  type="password"
                  autoComplete="new-password"
                  className={cn(fieldControl, fieldBorder(!!e.newPassword))}
                  {...register('newPassword', {
                    required: '새 비밀번호를 입력하세요.',
                    // 확인 칸에 이미 입력했으면 새 비밀번호를 고칠 때 다시 검사한다
                    onChange: () => getValues('confirm') && void trigger('confirm'),
                    validate: (v) => rules.every((r) => r.test(v)) || '아래 조건을 모두 맞춰 주세요.',
                  })}
                />
              )}
            </LabeledField>
            <ul id={rulesId} aria-label="비밀번호 조건" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-caption">
              {rules.map((r) => {
                const ok = r.test(next)
                const Icon = ok ? Check : Circle
                return (
                  <li key={r.label} className={cn('flex items-center gap-1', ok ? 'text-success-text' : 'text-ink-3')}>
                    <Icon size={14} strokeWidth={ok ? 2.5 : 1.75} aria-hidden />
                    {r.label}
                    <span className="sr-only">{ok ? ' 맞음' : ' 아직'}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <LabeledField label="새 비밀번호 확인" error={e.confirm?.message}>
            {(p) => (
              <input
                {...p}
                type="password"
                autoComplete="new-password"
                className={cn(fieldControl, fieldBorder(!!e.confirm))}
                {...register('confirm', {
                  required: '새 비밀번호를 한 번 더 입력하세요.',
                  validate: (v, all) => v === all.newPassword || '새 비밀번호와 같지 않아요.',
                })}
              />
            )}
          </LabeledField>

          {e.root && (
            <Banner tone="danger" title="바꾸지 못했어요">
              {e.root.message}
            </Banner>
          )}

          <Button type="submit" variant="primary" size="cta" className="mt-2" disabled={busy}>
            {busy ? '바꾸는 중' : '비밀번호 바꾸기'}
          </Button>
        </form>
        <p className="m-0 text-center text-caption text-ink-3">
          내 계정이 아니라면 <Link to="/logout">로그아웃</Link>
        </p>
      </div>
    </main>
  )
}
