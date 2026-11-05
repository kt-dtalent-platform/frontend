import { ChevronDown, ChevronLeft } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useMe } from '../../api/auth'
import { ApiError } from '../../api/client'
import {
  useCohorts,
  useCreateRequest,
  usePublishRequest,
  useRequestTemplates,
  useUpdateRequest,
  type RequestDetail,
  type RequestStatus,
  type Semester,
} from '../../api/manager'
import { fieldErrorsOf } from '../../api/types'
import { fieldBase, fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

export type Notice = { tone: 'success' | 'warning'; title: string; body: string }

type Values = {
  templateId: string
  title: string
  cohortId: string // '' = 전체 기수
  academicYear: string
  semester: Semester
  closeDate: string // YYYY-MM-DD
  closeTime: string // HH:mm
  description: string
  completionMessage: string
}

const semesters: { value: Semester; label: string }[] = [
  { value: '1', label: '1학기' },
  { value: '2', label: '2학기' },
  { value: 'SUMMER', label: '여름학기' },
  { value: 'WINTER', label: '겨울학기' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function defaults(): Values {
  const now = new Date()
  const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const month = now.getMonth() + 1
  return {
    templateId: '',
    title: '',
    cohortId: '',
    // 1~2월은 아직 지난해 2학기
    academicYear: String(month <= 2 ? now.getFullYear() - 1 : now.getFullYear()),
    semester: month >= 3 && month <= 8 ? '1' : '2',
    closeDate: ymd(due),
    closeTime: '23:59',
    description: '',
    completionMessage: '',
  }
}

// 저장된 작성 중 요청을 입력칸 값으로
// 서버 마감 시각 → 화면 시각(YYYY-MM-DD, HH:mm:ss). 시간대가 붙어 오면 이 기기 시각으로 바꾼다(형식 확인 필요)
function splitClose(closesAt: string | null) {
  if (!closesAt) return { date: '', time: '' }
  if (/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(closesAt)) {
    const t = new Date(closesAt)
    if (!Number.isNaN(t.getTime())) return { date: ymd(t), time: `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}` }
  }
  const [date = '', time = ''] = closesAt.split('T')
  return { date, time: time.slice(0, 8) }
}

function fromDetail(d: RequestDetail): Values {
  const { date, time } = splitClose(d.closesAt)
  return {
    templateId: d.templateId ? String(d.templateId) : '',
    title: d.title,
    cohortId: d.cohortId ? String(d.cohortId) : '',
    academicYear: String(d.academicYear),
    semester: d.semester,
    closeDate: date,
    closeTime: time.slice(0, 5) || '23:59',
    description: d.description ?? '',
    completionMessage: d.completionMessage ?? '',
  }
}

// A03·A04 요청 만들기: 유형 고르기 → 요청 정보 → 작성 중으로 저장 또는 공개
export function RequestCreatePage() {
  usePageTitle('요청 만들기')
  return <RequestFormShell title="요청 만들기">{(props) => <CreateForm {...props} />}</RequestFormShell>
}

// 요청 만들기·작성 중 요청 고치기가 함께 쓰는 틀: 담당 프로그램·유형·기수를 불러온 뒤 폼을 그린다
export function RequestFormShell({
  title,
  extraLoading,
  extraError,
  onRetryExtra,
  children,
}: {
  title: string
  extraLoading?: boolean
  extraError?: Error | null
  onRetryExtra?: () => void
  children: (props: FormProps) => ReactNode
}) {
  const me = useMe()
  const programId = me.data?.accessiblePrograms?.[0]?.id
  const templates = useRequestTemplates()
  const cohorts = useCohorts(programId)

  const loading = me.isPending || templates.isPending || (programId !== undefined && cohorts.isPending) || !!extraLoading
  const error = me.error ?? templates.error ?? cohorts.error ?? extraError ?? null

  return (
    <div className="mx-auto flex max-w-page-form flex-col gap-6">
      <Link to="/manager/requests" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        요청 관리
      </Link>
      <PageTitle>{title}</PageTitle>
      {loading && <LoadingCards count={2} />}
      {error && (
        <ErrorState
          error={error}
          onRetry={() => (me.error ? me.refetch() : templates.error ? templates.refetch() : cohorts.error ? cohorts.refetch() : onRetryExtra?.())}
        />
      )}
      {!loading && !error && programId === undefined && (
        <Banner tone="danger" title="담당 프로그램이 없어요">
          재단 관리자에게 담당 프로그램 지정을 요청하세요.
        </Banner>
      )}
      {!loading &&
        !error &&
        programId !== undefined &&
        templates.data &&
        cohorts.data &&
        children({ programId, templates: templates.data, cohorts: cohorts.data })}
    </div>
  )
}

export type FormProps = {
  programId: number
  templates: NonNullable<ReturnType<typeof useRequestTemplates>['data']>
  cohorts: NonNullable<ReturnType<typeof useCohorts>['data']>
  existing?: RequestDetail // 있으면 작성 중 요청 고치기
}

export function CreateForm({ programId, templates, cohorts, existing }: FormProps) {
  const navigate = useNavigate()
  const create = useCreateRequest()
  const update = useUpdateRequest(existing?.id ?? 0)
  const publish = usePublishRequest()
  const [confirming, setConfirming] = useState(false)
  // 저장이 끝나 이동할 곳. 이동 확인 창이 뜨지 않도록 렌더 뒤에 이동한다
  const [leaving, setLeaving] = useState<{ status: RequestStatus; notice: Notice } | null>(null)
  const [today] = useState(() => ymd(new Date()))
  const running = useRef(false) // 빠르게 두 번 눌러도 한 번만 보내게
  const { register, handleSubmit, control, setError, trigger, formState } = useForm<Values>({
    defaultValues: existing ? fromDetail(existing) : defaults(),
    mode: 'onBlur',
  })
  const errors = formState.errors

  useEffect(() => {
    // replace: 뒤로 가기로 빈 만들기 화면에 돌아오지 않게
    if (leaving) navigate(`/manager/requests?status=${leaving.status}`, { replace: true, state: { notice: leaving.notice } })
  }, [leaving, navigate])

  const [templateId, cohortId] = useWatch({ control, name: ['templateId', 'cohortId'] })
  const template = templates.find((t) => String(t.id) === templateId)
  const cohort = cohorts.find((c) => String(c.id) === cohortId)
  const targetCount = cohort ? cohort.scholarCount : cohorts.reduce((n, c) => n + c.scholarCount, 0)
  const busy = formState.isSubmitting || create.isPending || update.isPending || publish.isPending

  // 날짜·시각을 그대로 두면 서버 값의 초(예: 23:59:59)를 지킨다
  const original = existing ? splitClose(existing.closesAt) : null
  const seconds = (v: Values) =>
    original && original.date === v.closeDate && original.time.slice(0, 5) === v.closeTime ? original.time.slice(6, 8) || '00' : '00'

  const toBody = (v: Values) => ({
    programId,
    cohortId: v.cohortId ? Number(v.cohortId) : null,
    templateId: Number(v.templateId),
    title: v.title.trim(),
    description: v.description.trim() || null,
    academicYear: Number(v.academicYear),
    semester: v.semester,
    closesAt: `${v.closeDate}T${v.closeTime}:${seconds(v)}`,
    completionMessage: v.completionMessage.trim() || null,
  })

  const showServerErrors = (error: unknown) => {
    if (!(error instanceof ApiError)) return
    const map: Record<string, keyof Values> = { closesAt: 'closeDate', templateId: 'templateId', title: 'title' }
    fieldErrorsOf(error.details).forEach((fe, i) => {
      const key = map[fe.key] ?? (fe.key as keyof Values)
      setError(key, { message: fe.message }, { shouldFocus: i === 0 })
    })
  }

  // 새로 만들거나(POST) 작성 중 요청을 고친다(PATCH). 요청 번호를 돌려준다
  const save = async (v: Values) => (existing ? (await update.mutateAsync(toBody(v)), existing.id) : (await create.mutateAsync(toBody(v))).id)

  const onSaveDraft = handleSubmit(async (v) => {
    try {
      await save(v)
      setLeaving({
        status: 'DRAFT',
        notice: { tone: 'success', title: '작성 중으로 저장했어요', body: `"${v.title.trim()}" 요청은 공개하기 전까지 장학생에게 보이지 않아요.` },
      })
    } catch (error) {
      showServerErrors(error)
    }
  })

  // 빠르게 두 번 눌러도 한 번만 실행되게 한다(검사가 끝나 버튼이 꺼지기 전의 두 번째 누름)
  const once = (run: () => Promise<void>) => () => {
    if (running.current) return
    running.current = true
    void run().finally(() => {
      running.current = false
    })
  }

  const onPublishClick = handleSubmit(() => setConfirming(true))

  const doPublish = handleSubmit(async (v) => {
    setConfirming(false)
    try {
      const id = await save(v)
      try {
        const result = await publish.mutateAsync(id)
        setLeaving({
          status: 'IN_PROGRESS',
          notice: { tone: 'success', title: '요청을 공개했어요', body: `"${v.title.trim()}" 요청이 장학생 ${result.targetCount}명의 내 할 일에 보여요.` },
        })
      } catch {
        // 만들기는 됐고 공개만 실패: 같은 요청을 다시 만들지 않도록 작성 중 목록으로 보낸다
        setLeaving({
          status: 'DRAFT',
          notice: { tone: 'warning', title: '작성 중으로 저장됐지만 공개하지 못했어요', body: `"${v.title.trim()}" 요청을 열어 다시 공개하세요.` },
        })
      }
    } catch (error) {
      showServerErrors(error)
    }
  })

  const saveError = create.error ?? update.error
  const actionError = saveError instanceof ApiError ? saveError : saveError ? new ApiError(0, { code: 'NETWORK_ERROR', message: '' }) : null

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
      <UnsavedChangesGuard when={formState.isDirty && !leaving} />

      <section className="flex flex-col gap-4 rounded-lg bg-surface px-6 py-8 md:px-8">
        <h2 className="m-0 text-title-2">무엇을 받을지</h2>
        <fieldset className="m-0 flex flex-col border-0 p-0" aria-describedby={errors.templateId ? 'templateId-error' : undefined}>
          <legend className="mb-2 p-0 text-label">
            요청 유형
            <Required />
          </legend>
          {templates.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-start gap-3 border-b border-line-subtle py-3 last:border-b-0">
              <input
                type="radio"
                value={String(t.id)}
                aria-invalid={!!errors.templateId}
                className="mt-0.5 size-5 shrink-0 accent-action"
                {...register('templateId', { required: '요청 유형을 고르세요.' })}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-body-strong">{t.name}</span>
                <span className="text-caption text-ink-3">{t.fields.map((f) => f.label).join(' · ') || '입력 항목 없음'}</span>
              </span>
            </label>
          ))}
          {errors.templateId && <ErrorText id="templateId-error">{errors.templateId.message}</ErrorText>}
        </fieldset>
      </section>

      <section className="flex flex-col gap-6 rounded-lg bg-surface px-6 py-8 md:px-8">
        <h2 className="m-0 text-title-2">요청 정보</h2>

        <Field label="제목" required error={errors.title?.message}>
          {(p) => (
            <input
              {...p}
              placeholder={template ? `예: 2학기 ${template.name}` : undefined}
              className={cn(fieldControl, fieldBorder(!!errors.title))}
              {...register('title', {
                validate: (s) => (s.trim() ? true : '제목을 입력하세요.'),
                maxLength: { value: 200, message: '200자 안으로 입력하세요.' },
              })}
            />
          )}
        </Field>

        <Field label="대상" required hint={`장학생 ${targetCount}명`}>
          {(p) => (
            <SelectBox>
              <select {...p} className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(false))} {...register('cohortId')}>
                <option value="">전체 기수</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </SelectBox>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="대상 연도" required>
            {(p) => (
              <SelectBox>
                <select {...p} className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(false))} {...register('academicYear')}>
                  {yearOptions().map((y) => (
                    <option key={y} value={String(y)}>
                      {y}년
                    </option>
                  ))}
                </select>
              </SelectBox>
            )}
          </Field>
          <Field label="대상 학기" required>
            {(p) => (
              <SelectBox>
                <select {...p} className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(false))} {...register('semester')}>
                  {semesters.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </SelectBox>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="마감일" required error={errors.closeDate?.message}>
            {(p) => (
              <input
                {...p}
                type="date"
                min={today}
                className={cn(fieldControl, fieldBorder(!!errors.closeDate))}
                {...register('closeDate', {
                  required: '마감일을 고르세요.',
                  validate: (d, all) => (!all.closeTime || new Date(`${d}T${all.closeTime}:00`).getTime() > Date.now() ? true : '마감은 지금보다 뒤여야 해요.'),
                })}
              />
            )}
          </Field>
          <Field label="마감 시각" required error={errors.closeTime?.message}>
            {(p) => (
              <input
                {...p}
                type="time"
                className={cn(fieldControl, fieldBorder(!!errors.closeTime))}
                // 시각을 바꾸면 "마감은 지금보다 뒤" 검사를 날짜 쪽에서 다시 한다
                {...register('closeTime', {
                  required: '마감 시각을 고르세요.',
                  onChange: () => formState.touchedFields.closeDate && void trigger('closeDate'),
                })}
              />
            )}
          </Field>
        </div>

        <Field label="제출 안내" hint="장학생 제출 화면 맨 위에 보여요.">
          {(p) => (
            <textarea
              {...p}
              rows={4}
              className={cn(fieldBase, 'resize-y py-3 text-input-touch md:text-body-long', fieldBorder(false))}
              {...register('description')}
            />
          )}
        </Field>

        <Field label="제출 완료 안내" hint="제출한 직후 장학생에게 보여요.">
          {(p) => (
            <textarea
              {...p}
              rows={2}
              className={cn(fieldBase, 'resize-y py-3 text-input-touch md:text-body-long', fieldBorder(false))}
              {...register('completionMessage')}
            />
          )}
        </Field>
      </section>

      {actionError && (
        <Banner
          tone="danger"
          title={actionError.code === 'INVALID_REQUEST' || actionError.code === 'VALIDATION_ERROR' ? '확인이 필요한 항목이 있어요' : '저장하지 못했어요'}
        >
          {actionError.code === 'INVALID_REQUEST' || actionError.code === 'VALIDATION_ERROR'
            ? '빨간색으로 표시된 항목을 고친 뒤 다시 시도하세요.'
            : '입력한 내용은 그대로 있어요. 잠시 후 다시 시도하세요.'}
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
        <Button disabled={busy} onClick={once(onSaveDraft)}>
          {(create.isPending || update.isPending) && !confirming ? '저장하는 중' : '작성 중으로 저장'}
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => void onPublishClick()}>
          {publish.isPending ? '공개하는 중' : '공개하기'}
        </Button>
      </div>

      <ConfirmDialog open={confirming} title="공개하기" confirmLabel="공개하기" onConfirm={once(doPublish)} onCancel={() => setConfirming(false)}>
        {cohort ? cohort.name : '전체 기수'} 장학생 {targetCount}명의 내 할 일에 이 요청이 바로 보여요. 공개한 뒤에는 입력 항목을 바꿀 수 없어요.
      </ConfirmDialog>
    </form>
  )
}

// 올해 기준 앞뒤 1년
function yearOptions() {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1]
}

function Required() {
  return (
    <>
      <span className="ml-0.5 text-kt-red-text" aria-hidden>
        *
      </span>
      <span className="sr-only">(필수)</span>
    </>
  )
}

function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="m-0 mt-2 text-caption text-danger-text">
      {children}
    </p>
  )
}

function SelectBox({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
}

// 라벨 + 입력칸 + 도움말/오류. 입력칸에 id·aria 속성을 넘겨준다.
function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-required'?: boolean; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = useId()
  const describedBy = [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {required && <Required />}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-required': required || undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="m-0 text-caption text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="m-0 text-caption text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}
