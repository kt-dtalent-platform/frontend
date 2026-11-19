import { zodResolver } from '@hookform/resolvers/zod'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { roleHome, useLogin } from '../api/auth'
import { BrandFlow } from '../components/brand/BrandFlow'
import { Button } from '../components/ui/Button'
import { KtSquare } from '../components/ui/KtSquare'
import { cn } from '../lib/cn'
import { liveAuthOn, mockOn } from '../lib/env'
import { errorText } from '../api/errorText'

const schema = z.object({
  email: z.email('이메일 형식을 확인하세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상입니다.'),
})
type Values = z.infer<typeof schema>

// 목업 계정으로 로그인할 때만 보이는 안내. 실제 서버로 로그인할 때(VITE_LIVE_API)와 배포 화면에는 나오지 않는다
const isMock = mockOn && !liveAuthOn

// C01 로그인: 전체 브랜드 플로우 바탕 + 오른쪽 흰 카드
export function LoginPage() {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      // 로그인 전에 가려던 화면이 같은 역할의 화면이면 그리로, 아니면 역할별 첫 화면으로
      onSuccess: (data) => {
        const home = roleHome(data.role)
        navigate(from && from.startsWith(home) ? from : home, { replace: true })
      },
    }),
  )

  const serverError = login.error ? errorText(login.error) : null

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden">
      <BrandFlow />

      <div className="relative grid w-full max-w-page-narrow items-center gap-8 px-6 py-10 md:max-w-page-brand md:grid-cols-[minmax(0,1fr)_var(--spacing-login-card-w)] md:gap-16 md:px-16 md:py-12">
        <div className="animate-[rise_.5s_ease-out_.5s_backwards]">
          <p className="m-0 flex items-center gap-2 text-caption font-semibold text-ink-2">
            <KtSquare />
            KT그룹희망나눔재단
          </p>
          <h1 className="m-0 mt-4 text-display-sm md:text-display">KT디지털인재장학생</h1>
          <p className="m-0 mt-3 text-ink-2">장학 활동에 필요한 일을 한곳에서.</p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-6 rounded-xl bg-surface px-6 py-8 shadow-brand md:p-10 animate-[card-in_.6s_cubic-bezier(.2,.7,.2,1)_.3s_backwards]"
        >
          <h2 className="m-0 text-title-1">로그인</h2>

          <Field label="이메일" error={errors.email?.message}>
            <input type="email" autoComplete="username" className={inputClass(!!errors.email)} aria-invalid={!!errors.email} {...register('email')} />
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

          {serverError && (
            <p role="alert" className="m-0 rounded-md bg-danger-bg px-4 py-3 text-danger-text">
              {serverError}
            </p>
          )}

          <Button type="submit" variant="primary" size="cta" className="mt-2" disabled={login.isPending}>
            {login.isPending ? '확인하는 중' : '로그인'}
          </Button>
          <p className="m-0 text-caption text-ink-3">계정은 재단에서 발급합니다.</p>
          {isMock && <MockGuide />}
        </form>
      </div>
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

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label text-ink">{label}</span>
      {children}
      {error && <span className="text-caption text-danger-text">{error}</span>}
    </label>
  )
}

// 목업(미리보기 사이트, 개발 서버)에서만 보이는 테스트 안내. 처음 보는 사람이 바로 들어가 볼 수 있게
function MockGuide() {
  const rows: [string, string][] = [
    ['담당자 화면', 'admin@kt.com'],
    ['장학생 화면', 'hong@kt.com'],
    ['비밀번호', '8자 이상 아무거나'],
    ['첫 로그인 화면', 'new1@kt.com, 비밀번호 temp1234'],
  ]
  return (
    <section aria-label="테스트 계정 안내" className="flex flex-col gap-2 rounded-md bg-surface-sunken px-4 py-3 text-caption">
      <p className="m-0 font-semibold text-ink-2">테스트 계정 (연습용 데이터)</p>
      <dl className="m-0 flex flex-col gap-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <dt className="w-24 shrink-0 text-ink-3">{k}</dt>
            <dd className="m-0 break-all text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
