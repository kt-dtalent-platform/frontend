import { Check, Circle } from 'lucide-react'
import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useChangePassword } from '../../api/auth'
import { ApiError } from '../../api/client'
import { cn } from '../../lib/cn'
import { Banner } from '../ui/Banner'
import { Button } from '../ui/Button'
import { fieldBorder, fieldControl } from './fieldClass'
import { LabeledField } from './LabeledField'

type Values = { currentPassword: string; newPassword: string; confirm: string }

// 비밀번호 규칙. 백엔드는 8~64자만 본다(#45). 영문, 숫자 포함은 프론트에서 더 거는 규칙
const rules = [
  { label: '8~64자', test: (v: string) => v.length >= 8 && v.length <= 64 },
  { label: '영문 포함', test: (v: string) => /[A-Za-z]/.test(v) },
  { label: '숫자 포함', test: (v: string) => /\d/.test(v) },
]

type Props = {
  email: string
  // first: 임시 비밀번호로 처음 로그인했을 때, change: 내 정보에서 바꿀 때
  mode: 'first' | 'change'
  onDone: () => void
  onCancel?: () => void
}

// 비밀번호 바꾸기 입력칸 세 개와 조건 표시. 첫 로그인 화면과 내 정보 화면이 같이 쓴다
export function PasswordChangeForm({ email, mode, onDone, onCancel }: Props) {
  const change = useChangePassword()
  const rulesId = useId()
  const current = mode === 'first' ? '임시 비밀번호' : '지금 비밀번호'
  const { register, handleSubmit, control, formState, setError, getValues, trigger } = useForm<Values>({
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
    mode: 'onTouched',
  })
  const e = formState.errors
  const next = useWatch({ control, name: 'newPassword' })
  const busy = formState.isSubmitting || change.isPending

  const onSubmit = handleSubmit(async (v) => {
    try {
      await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword })
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PASSWORD_MISMATCH')
        setError('currentPassword', { message: `${current}가 맞지 않아요.` }, { shouldFocus: true })
      else if (err instanceof ApiError && err.code === 'SAME_AS_CURRENT')
        setError('newPassword', { message: `${current}와 다른 비밀번호를 쓰세요.` }, { shouldFocus: true })
      else setError('root', { message: err instanceof ApiError ? err.message : '잠시 뒤 다시 시도하세요.' })
    }
  })

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} noValidate className="flex flex-col gap-6">
      {/* 비밀번호 관리자(Safari 키체인, Chrome)가 어느 계정의 새 비밀번호인지 알도록 아이디를 숨겨 둔다 */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <LabeledField label={current} error={e.currentPassword?.message}>
        {(p) => (
          <input
            {...p}
            type="password"
            autoComplete="current-password"
            className={cn(fieldControl, fieldBorder(!!e.currentPassword))}
            {...register('currentPassword', { required: `${current}를 입력하세요.` })}
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

      {mode === 'first' ? (
        <Button type="submit" variant="primary" size="cta" className="mt-2" disabled={busy}>
          {busy ? '바꾸는 중' : '비밀번호 바꾸기'}
        </Button>
      ) : (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? '바꾸는 중' : '비밀번호 바꾸기'}
          </Button>
        </div>
      )}
    </form>
  )
}
