import { ChevronLeft, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useCreateScholar } from '../../api/scholars'
import { formatPhoneInput, isPhone, PHONE_ERROR, phoneDigits } from '../../lib/phone'
import { CohortField } from '../../components/form/CohortField'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { LabeledField } from '../../components/form/LabeledField'
import { SchoolField } from '../../components/form/SchoolCombobox'
import { useFindSchoolId } from '../../api/schools'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { PageTitle } from '../../components/ui/PageTitle'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'
import { LoginNoticeDialog } from './LoginNoticeDialog'
import { noticeText, sentText, useNoticeStatus, type NoticeResult } from '../../api/loginNotices'
import { useToast } from '../../components/ui/useToast'
import { errorText } from '../../api/errorText'

type Values = { cohortId: string; name: string; email: string; phone: string; university: string; major: string; studentNo: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const opt = (v: string) => v.trim() || null
const EMPTY: Values = { cohortId: '', name: '', email: '', phone: '', university: '', major: '', studentNo: '' }

// A06 장학생 등록: 한 명씩 등록(백엔드 KT-13 요청 형식 기준). 여러 명은 A07 일괄 등록
export function ScholarCreatePage() {
  const navigate = useNavigate()
  const create = useCreateScholar()
  // 등록이 끝나면 이탈 확인을 끈 뒤(다음 렌더) 처리한다.
  // 임시 비밀번호가 오면 결과 화면에서 한 번 보여 주고, 없으면 토스트 후 명단으로
  const [done, setDone] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: number; name: string; email: string; password: string } | null>(null)
  usePageTitle(created ? '장학생 등록 완료' : '장학생 등록')
  const toast = useToast()
  useEffect(() => {
    if (!done || created) return
    toast(`${done} 님을 등록했어요`)
    navigate('/manager/scholars', { replace: true })
  }, [done, created, navigate, toast])
  const { register, handleSubmit, formState, setError, control, reset, getValues, setFocus } = useForm<Values>({
    defaultValues: EMPTY,
    mode: 'onBlur',
  })
  const e = formState.errors
  // 보내는 동안 버튼을 막아 두 번 등록되지 않게 한다
  const busy = formState.isSubmitting || create.isPending || !!done

  const findSchoolId = useFindSchoolId()

  const onSubmit = handleSubmit(async (v) => {
    try {
      const schoolId = await findSchoolId(v.university)
      const r = await create.mutateAsync({
        cohortId: Number(v.cohortId),
        name: v.name.trim(),
        email: v.email.trim(),
        phone: opt(phoneDigits(v.phone)),
        university: v.university.trim(),
        major: opt(v.major),
        studentNo: opt(v.studentNo),
        ...(schoolId ? { schoolId } : {}),
      })
      if (r.temporaryPassword) setCreated({ id: r.id, name: v.name.trim(), email: v.email.trim(), password: r.temporaryPassword })
      // 임시 비밀번호를 화면 상태로 옮겼으니 요청 결과 캐시에서는 바로 지운다
      create.reset()
      setDone(v.name.trim())
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_EMAIL') setError('email', { message: '이미 등록된 이메일이에요.' }, { shouldFocus: true })
      else setError('root', { message: errorText(err) })
    }
  })

  // 한 명 더: 폼을 비우고 결과를 닫는다(기수는 그대로 둔다)
  if (created)
    return (
      <CreatedResult
        {...created}
        // 메일을 보내면 서버가 비밀번호를 새로 만들어 화면의 것은 쓸모가 없으므로 메모리에서도 지운다
        onMailed={() => setCreated((prev) => prev && { ...prev, password: '' })}
        onAgain={() => {
          reset({ ...EMPTY, cohortId: getValues('cohortId') })
          setCreated(null)
          setDone(null)
          // 입력 화면이 다시 그려진 뒤 이름 칸으로
          setTimeout(() => setFocus('name'))
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
          <LabeledField label="연락처" hint="예: 010-1234-5678" error={e.phone?.message}>
            {(p) => (
              <input
                {...p}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={13}
                className={cn(fieldControl, 'tabular-nums', fieldBorder(!!e.phone))}
                {...register('phone', { onChange: formatPhoneInput, validate: (x) => !x.trim() || isPhone(x) || PHONE_ERROR })}
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
function CreatedResult({
  id,
  name,
  email,
  password,
  onAgain,
  onMailed,
}: {
  id: number
  name: string
  email: string
  password: string
  onAgain: () => void
  onMailed: () => void
}) {
  const toast = useToast()
  // 로그인 안내 메일(백엔드 KT-60). 보내면 서버가 새 임시 비밀번호를 만들어 보내므로 화면의 비밀번호는 숨긴다
  const [mailing, setMailing] = useState(false)
  const [mailed, setMailed] = useState<NoticeResult | null>(null)
  const status = useNoticeStatus(mailed ? [id] : [])
  const result = useRef<HTMLDivElement>(null)
  const onSent = (r: NoticeResult) => {
    setMailing(false)
    // 접수되지 않았으면(건너뜀) 비밀번호가 그대로 유효하므로 화면에 남긴다
    if (!r.queued) return toast(sentText(r))
    setMailed(r)
    onMailed()
    // 메일 보내기 버튼이 사라지므로 결과 문구로 포커스를 옮긴다
    requestAnimationFrame(() => result.current?.focus())
  }
  const record = status.data?.find((i) => i.scholarId === id)
  const top = useRef<HTMLDivElement>(null)
  const secret = useRef<HTMLSpanElement>(null)
  // 등록 버튼이 사라지므로 결과 첫머리로 포커스를 옮겨 스크린 리더가 결과를 읽게 한다
  useEffect(() => top.current?.focus(), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      return toast('임시 비밀번호를 복사했어요')
    } catch {
      // http 주소나 권한 거부로 클립보드 API를 못 쓸 때: 글자를 선택해 예전 복사 명령을 한 번 더 시도한다
      const el = secret.current
      const sel = window.getSelection()
      if (el && sel) {
        const range = document.createRange()
        range.selectNodeContents(el)
        sel.removeAllRanges()
        sel.addRange(range)
        if (document.execCommand('copy')) return toast('임시 비밀번호를 복사했어요')
      }
      // 그래도 안 되면 선택한 채로 두어 바로 복사할 수 있게 한다
      toast('복사하지 못했어요. 선택된 글자를 직접 복사하세요')
    }
  }
  return (
    <div ref={top} tabIndex={-1} className="mx-auto flex w-full max-w-page-form flex-col gap-6 outline-none">
      <PageTitle>{name} 님을 등록했어요</PageTitle>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 rounded-lg bg-surface py-3 pr-3 pl-4">
          <Mail size={20} strokeWidth={2} className="shrink-0 text-ink-2" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">로그인 안내 메일</span>
            <span className="text-caption text-ink-3">아이디와 임시 비밀번호를 {email}로 보내요</span>
          </div>
          {!mailed && (
            <Button size="compact" variant="primary" onClick={() => setMailing(true)}>
              메일 보내기
            </Button>
          )}
        </div>
        {/* 처음부터 그려 두고 글만 바꿔야 스크린 리더가 바뀐 내용을 읽는다 */}
        <div ref={result} tabIndex={-1} className="flex flex-wrap items-center gap-x-3 gap-y-2 outline-none">
          <p role="status" className="m-0 text-caption text-ink-3">
            {mailed ? (record ? noticeText(record) : sentText(mailed)) : ''}
          </p>
          {record?.status === 'FAILED' && (
            <Button size="compact" onClick={() => setMailing(true)}>
              다시 보내기
            </Button>
          )}
        </div>
      </div>
      {mailing && <LoginNoticeDialog scholarIds={[id]} who={`${name} 님`} reissue={false} onClose={() => setMailing(false)} onSent={onSent} />}
      {!mailed && (
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-label text-ink-2">메일을 쓸 수 없을 때</h2>
          <section aria-label="로그인 정보" className="rounded-lg bg-surface px-6 py-2 md:px-8">
            <dl className="m-0">
              <div className="flex min-h-row-h items-center gap-4 border-b border-line-subtle py-3">
                <dt className="w-28 shrink-0 text-ink-3">아이디(이메일)</dt>
                <dd className="m-0 min-w-0 flex-1 break-all">{email}</dd>
              </div>
              <div className="flex min-h-row-h items-center gap-4 py-3">
                <dt className="w-28 shrink-0 text-ink-3">임시 비밀번호</dt>
                {/* dl 안 줄에는 dt와 dd만 둔다: 복사 버튼은 dd 안에 */}
                <dd className="m-0 flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span ref={secret} className="font-semibold break-all tabular-nums">
                    {password}
                  </span>
                  <Button size="compact" aria-label="임시 비밀번호 복사" onClick={() => void copy()}>
                    복사
                  </Button>
                </dd>
              </div>
            </dl>
          </section>
          <p className="m-0 text-caption text-ink-3">이 화면을 떠나면 다시 볼 수 없어요.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
        <Button onClick={onAgain}>한 명 더 등록</Button>
        <Link to="/manager/scholars" replace className={buttonClass({ variant: 'primary', size: 'md' })}>
          명단으로
        </Link>
      </div>
    </div>
  )
}
