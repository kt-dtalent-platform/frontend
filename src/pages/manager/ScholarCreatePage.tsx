import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { PHONE, useCreateScholar } from '../../api/scholars'
import { CohortField } from '../../components/form/CohortField'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { LabeledField } from '../../components/form/LabeledField'
import { SchoolField } from '../../components/form/SchoolCombobox'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { PageTitle } from '../../components/ui/PageTitle'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'
import { useToast } from '../../components/ui/useToast'

type Values = { cohortId: string; name: string; email: string; phone: string; university: string; major: string; studentNo: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const opt = (v: string) => v.trim() || null
const EMPTY: Values = { cohortId: '', name: '', email: '', phone: '', university: '', major: '', studentNo: '' }

// A06 장학생 등록: 한 명씩 등록(백엔드 KT-13 요청 형식 기준). 여러 명은 A07 일괄 등록
export function ScholarCreatePage() {
  usePageTitle('장학생 등록')
  const navigate = useNavigate()
  const create = useCreateScholar()
  // 등록이 끝나면 이탈 확인을 끈 뒤(다음 렌더) 처리한다.
  // 임시 비밀번호가 오면 결과 화면에서 한 번 보여 주고, 없으면 토스트 후 명단으로
  const [done, setDone] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null)
  const toast = useToast()
  useEffect(() => {
    if (!done || created) return
    toast(`${done} 님을 등록했어요`)
    navigate('/manager/scholars', { replace: true })
  }, [done, created, navigate, toast])
  const { register, handleSubmit, formState, setError, control, reset, getValues } = useForm<Values>({
    defaultValues: EMPTY,
    mode: 'onBlur',
  })
  const e = formState.errors
  // 보내는 동안 버튼을 막아 두 번 등록되지 않게 한다
  const busy = formState.isSubmitting || create.isPending || !!done

  const onSubmit = handleSubmit(async (v) => {
    try {
      const r = await create.mutateAsync({
        cohortId: Number(v.cohortId),
        name: v.name.trim(),
        email: v.email.trim(),
        phone: opt(v.phone),
        university: v.university.trim(),
        major: opt(v.major),
        studentNo: opt(v.studentNo),
      })
      if (r.temporaryPassword) setCreated({ name: v.name.trim(), email: v.email.trim(), password: r.temporaryPassword })
      setDone(v.name.trim())
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_EMAIL') setError('email', { message: '이미 등록된 이메일이에요.' }, { shouldFocus: true })
      else if (err instanceof ApiError) setError('root', { message: err.message })
      else setError('root', { message: '잠시 뒤 다시 시도하세요.' })
    }
  })

  // 한 명 더: 폼을 비우고 결과를 닫는다(기수는 그대로 둔다)
  if (created)
    return (
      <CreatedResult
        {...created}
        onAgain={() => {
          reset({ ...EMPTY, cohortId: getValues('cohortId') })
          setCreated(null)
          setDone(null)
        }}
      />
    )

  return (
    <div className="mx-auto flex w-full max-w-page-form flex-col gap-6">
      <Link to="/manager/scholars" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        장학생
      </Link>
      <PageTitle description="등록하면 장학생 계정이 만들어져요.">장학생 등록</PageTitle>

      <form noValidate className="flex flex-col gap-6" onSubmit={(ev) => void onSubmit(ev)}>
        <UnsavedChangesGuard when={formState.isDirty && !done} />
        <section className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-8 md:px-8">
          <h2 className="m-0 text-title-2">기본 정보</h2>
          <Controller
            control={control}
            name="cohortId"
            rules={{ required: '기수를 고르세요.' }}
            render={({ field }) => (
              <CohortField name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={e.cohortId?.message} />
            )}
          />
          <LabeledField label="이름" required error={e.name?.message}>
            {(p) => (
              <input
                {...p}
                autoComplete="off"
                className={cn(fieldControl, fieldBorder(!!e.name))}
                {...register('name', {
                  validate: (x) => (x.trim() ? true : '이름을 입력하세요.'),
                  maxLength: { value: 50, message: '50자 안으로 입력하세요.' },
                })}
              />
            )}
          </LabeledField>
          <LabeledField label="이메일" required hint="로그인 아이디로 써요." error={e.email?.message}>
            {(p) => (
              <input
                {...p}
                type="email"
                inputMode="email"
                autoComplete="off"
                className={cn(fieldControl, fieldBorder(!!e.email))}
                {...register('email', { required: '이메일을 입력하세요.', pattern: { value: EMAIL, message: '이메일 형식으로 입력하세요.' } })}
              />
            )}
          </LabeledField>
          <LabeledField label="연락처" error={e.phone?.message}>
            {(p) => (
              <input
                {...p}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="010-0000-0000"
                className={cn(fieldControl, fieldBorder(!!e.phone))}
                {...register('phone', { validate: (x) => (!x.trim() || PHONE.test(x.trim()) ? true : '숫자와 - 만 입력하세요.') })}
              />
            )}
          </LabeledField>
        </section>

        <section className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-8 md:px-8">
          <h2 className="m-0 text-title-2">학적</h2>
          <SchoolField
            control={control}
            name="university"
            required
            rules={{
              validate: (x: string) => (x.trim() ? true : '학교를 입력하세요.'),
              maxLength: { value: 100, message: '100자 안으로 입력하세요.' },
            }}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <LabeledField label="전공" error={e.major?.message}>
              {(p) => (
                <input
                  {...p}
                  autoComplete="off"
                  className={cn(fieldControl, fieldBorder(!!e.major))}
                  {...register('major', { maxLength: { value: 100, message: '100자 안으로 입력하세요.' } })}
                />
              )}
            </LabeledField>
            <LabeledField label="학번" error={e.studentNo?.message}>
              {(p) => (
                <input
                  {...p}
                  autoComplete="off"
                  className={cn(fieldControl, fieldBorder(!!e.studentNo))}
                  {...register('studentNo', { maxLength: { value: 30, message: '30자 안으로 입력하세요.' } })}
                />
              )}
            </LabeledField>
          </div>
        </section>

        {e.root && (
          <Banner tone="danger" title="등록하지 못했어요">
            {e.root.message}
          </Banner>
        )}
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
          <Button disabled={busy} onClick={() => navigate('/manager/scholars')}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? '등록하는 중' : '등록하기'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// 등록 결과: 임시 비밀번호는 서버가 이 응답에서 한 번만 준다. 화면을 떠나면 다시 볼 수 없다
function CreatedResult({ name, email, password, onAgain }: { name: string; email: string; password: string; onAgain: () => void }) {
  usePageTitle('장학생 등록 완료')
  const toast = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      toast('임시 비밀번호를 복사했어요')
    } catch {
      toast('복사하지 못했어요. 직접 적어 두세요')
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-page-form flex-col gap-6">
      <PageTitle description="첫 로그인에 쓸 임시 비밀번호예요. 이 화면을 떠나면 다시 볼 수 없으니 지금 장학생에게 전달하세요.">
        {name} 님을 등록했어요
      </PageTitle>
      <section aria-label="로그인 정보" className="rounded-lg bg-surface px-6 py-2 md:px-8">
        <dl className="m-0">
          <div className="flex min-h-row-h items-center gap-4 border-b border-line-subtle py-3">
            <dt className="w-24 shrink-0 text-ink-3">아이디(이메일)</dt>
            <dd className="m-0 min-w-0 flex-1 break-all">{email}</dd>
          </div>
          <div className="flex min-h-row-h items-center gap-4 py-3">
            <dt className="w-24 shrink-0 text-ink-3">임시 비밀번호</dt>
            {/* dl 안 줄에는 dt와 dd만 둔다: 복사 버튼은 dd 안에 */}
            <dd className="m-0 flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="font-semibold break-all tabular-nums">{password}</span>
              <Button size="compact" onClick={() => void copy()}>
                복사
              </Button>
            </dd>
          </div>
        </dl>
      </section>
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
        <Button onClick={onAgain}>한 명 더 등록</Button>
        <Link to="/manager/scholars" replace className={buttonClass({ variant: 'primary', size: 'md' })}>
          명단으로
        </Link>
      </div>
    </div>
  )
}
