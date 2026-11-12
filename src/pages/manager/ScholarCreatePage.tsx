import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useMe } from '../../api/auth'
import { useCohorts } from '../../api/manager'
import { ApiError } from '../../api/client'
import { PHONE, useCreateScholar } from '../../api/scholars'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { LabeledField, SelectBox } from '../../components/form/LabeledField'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { PageTitle } from '../../components/ui/PageTitle'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

type Values = { cohortId: string; name: string; email: string; phone: string; university: string; major: string; studentNo: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const opt = (v: string) => v.trim() || null

// A06 장학생 등록: 한 명씩 등록(백엔드 KT-13 요청 형식 기준). 여러 명 일괄 등록은 MVP 범위 밖
export function ScholarCreatePage() {
  usePageTitle('장학생 등록')
  const navigate = useNavigate()
  const me = useMe()
  const cohorts = useCohorts(me.data?.accessiblePrograms?.[0]?.id)
  const create = useCreateScholar()
  // 등록이 끝나면 이탈 확인을 끈 뒤(다음 렌더) 명단으로 옮긴다
  const [done, setDone] = useState<string | null>(null)
  useEffect(() => {
    if (done)
      navigate('/manager/scholars', {
        replace: true,
        state: { notice: { title: `${done} 님을 등록했어요`, body: '처음 로그인하면 비밀번호를 바꾸도록 안내돼요.' } },
      })
  }, [done, navigate])
  const { register, handleSubmit, formState, setError } = useForm<Values>({
    defaultValues: { cohortId: '', name: '', email: '', phone: '', university: '', major: '', studentNo: '' },
    mode: 'onBlur',
  })
  const e = formState.errors
  // 보내는 동안 버튼을 막아 두 번 등록되지 않게 한다
  const busy = formState.isSubmitting || create.isPending || !!done

  const onSubmit = handleSubmit(async (v) => {
    try {
      await create.mutateAsync({
        cohortId: Number(v.cohortId),
        name: v.name.trim(),
        email: v.email.trim(),
        phone: opt(v.phone),
        university: v.university.trim(),
        major: opt(v.major),
        studentNo: opt(v.studentNo),
      })
      setDone(v.name.trim())
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_EMAIL') setError('email', { message: '이미 등록된 이메일이에요.' }, { shouldFocus: true })
      else if (err instanceof ApiError) setError('root', { message: err.message })
      else setError('root', { message: '잠시 뒤 다시 시도하세요.' })
    }
  })

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
          <LabeledField label="기수" required error={e.cohortId?.message}>
            {(p) => (
              <SelectBox>
                <select
                  {...p}
                  className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(!!e.cohortId))}
                  {...register('cohortId', { required: '기수를 고르세요.' })}
                >
                  <option value="">기수 선택</option>
                  {cohorts.data?.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </SelectBox>
            )}
          </LabeledField>
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
          <LabeledField label="학교" required error={e.university?.message}>
            {(p) => (
              <input
                {...p}
                autoComplete="off"
                className={cn(fieldControl, fieldBorder(!!e.university))}
                {...register('university', {
                  validate: (x) => (x.trim() ? true : '학교를 입력하세요.'),
                  maxLength: { value: 100, message: '100자 안으로 입력하세요.' },
                })}
              />
            )}
          </LabeledField>
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
