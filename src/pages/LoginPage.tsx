import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { useLogin } from '../api/auth'
import { ApiError } from '../api/client'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { cn } from '../lib/cn'

const schema = z.object({
  email: z.email('이메일 형식을 확인하세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상입니다.'),
})
type Values = z.infer<typeof schema>

// C01 로그인. 브랜드 플로우는 다음 작업에서 붙인다.
export function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (data) => navigate(data.role === 'MANAGER' ? '/manager' : '/tasks'),
    }),
  )

  const serverError = login.error instanceof ApiError ? login.error.message : login.error && '잠시 후 다시 시도하세요.'

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-5">
      <form onSubmit={onSubmit} noValidate className="flex w-full max-w-page-narrow flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Logo />
          <h1 className="m-0 text-title-1">로그인</h1>
        </div>

        <div className="flex flex-col gap-5">
          <Field label="이메일" error={errors.email?.message}>
            <input
              type="email"
              autoComplete="username"
              className={inputClass(!!errors.email)}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Field label="비밀번호" error={errors.password?.message}>
            <input
              type="password"
              autoComplete="current-password"
              className={inputClass(!!errors.password)}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
        </div>

        {serverError && (
          <p role="alert" className="m-0 rounded-md bg-danger-bg px-4 py-3 text-label font-normal text-danger-text">
            {serverError}
          </p>
        )}

        <Button type="submit" variant="primary" size="cta" disabled={login.isPending}>
          {login.isPending ? '확인하는 중' : '로그인'}
        </Button>
        <p className="m-0 text-caption text-ink-3">목업: admin으로 시작하는 이메일은 담당자 화면으로 갑니다.</p>
      </form>
    </main>
  )
}

function inputClass(invalid: boolean) {
  return cn(
    'h-control-h w-full rounded-md border bg-surface px-4 text-body text-ink outline-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    invalid ? 'border-danger-line' : 'border-line-control',
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-3">
      <span className="text-label text-ink">{label}</span>
      {children}
      {error && <span className="text-caption text-danger-text">{error}</span>}
    </label>
  )
}
