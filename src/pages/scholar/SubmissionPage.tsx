import { Check, ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useSaveDraft, useSubmissionForm, type Answers, type FormField as Field, type SubmissionForm } from '../../api/submissions'
import { fieldErrorsOf } from '../../api/types'
import { FormField, type FormValues } from '../../components/form/FormField'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tag } from '../../components/ui/Tag'
import { daysUntil } from '../../api/tasks'
import { dDayText, formatDue, formatTime } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'

// S02 제출 입력 · 임시 저장
export function SubmissionPage() {
  const requestId = Number(useParams().requestId)
  const query = useSubmissionForm(requestId)
  usePageTitle(query.data?.request.title ?? '제출')
  // 저장하면 버전이 바뀌어 폼이 새로 그려지므로, 저장 시각은 바깥에 둔다
  const [savedAt, setSavedAt] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <Link to="/tasks" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />내 할 일
      </Link>
      {query.isPending && <LoadingCards count={2} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {/* key: 다시 불러온 내용(버전)이 바뀌면 폼을 새로 채운다 */}
      {query.data && (
        <SubmissionEditor
          key={query.data.version}
          requestId={requestId}
          form={query.data}
          savedAt={savedAt}
          onSaved={setSavedAt}
          onReload={() => query.refetch()}
        />
      )}
    </div>
  )
}

type EditorProps = {
  requestId: number
  form: SubmissionForm
  savedAt: string | null
  onSaved: (at: string) => void
  onReload: () => void
}

function SubmissionEditor({ requestId, form, savedAt, onSaved, onReload }: EditorProps) {
  const save = useSaveDraft(requestId)
  const defaults = useMemo(() => toFormValues(form.fields, form.answers), [form.fields, form.answers])
  const { register, handleSubmit, watch, setError, reset, formState } = useForm<FormValues>({ defaultValues: defaults, mode: 'onBlur' })

  const locked = form.editableFieldKeys.length === 0
  const isRevision = form.status === 'REVISION_REQUIRED'
  const dDay = daysUntil(form.request.dueAt)
  const late = !locked && dDay < 0

  // 저장하지 않은 내용이 있을 때 창을 닫으면 한 번 묻는다
  useEffect(() => {
    if (!formState.isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [formState.isDirty])

  // Cmd/Ctrl + S로도 임시 저장
  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void onSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onSave = handleSubmit((values) => {
    const answers = toAnswers(form.fields, values, form.answers)
    save.mutate(
      { answers, version: form.version },
      {
        onSuccess: (result) => {
          reset(values) // 지금 값을 "저장된 상태"로
          onSaved(result.savedAt)
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return
          for (const fe of fieldErrorsOf(error.details)) setError(fe.key, { message: fe.message })
        },
      },
    )
  })

  const saveError = save.error instanceof ApiError ? save.error : save.error ? new ApiError(0, { code: 'NETWORK_ERROR', message: '' }) : null

  return (
    <form onSubmit={onSave} noValidate className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={form.status} />
          {late && <Tag tone="danger">마감 지남</Tag>}
        </div>
        <PageTitle>{form.request.title}</PageTitle>
        <p className="m-0 pl-5 text-caption text-ink-3 tabular-nums">
          마감 {formatDue(form.request.dueAt)}
          {!locked && ` · ${dDayText(dDay)}`}
        </p>
      </header>

      {isRevision && form.revision && (
        <Banner tone="warning" title="보완 요청이 있어요">
          {form.revision.reason} 표시된 항목만 고칠 수 있어요.
        </Banner>
      )}
      {late && (
        <Banner tone="danger" title="마감이 지났어요">
          지금 제출해도 받지만 지연 제출로 표시돼요.
        </Banner>
      )}
      {(form.status === 'SUBMITTED' || form.status === 'RESUBMITTED') && (
        <Banner tone="info" title="검토를 기다리고 있어요">결과가 나오면 여기와 내 할 일에서 알려 드려요.</Banner>
      )}
      {form.request.closed && form.status !== 'CONFIRMED' && (
        <Banner tone="info" title="마감된 요청이에요">더 이상 고치거나 제출할 수 없어요.</Banner>
      )}
      {form.status === 'CONFIRMED' && <Banner tone="success" title="확인이 끝났어요">확인이 끝난 제출은 고칠 수 없어요.</Banner>}

      {form.request.description && (
        <section className="flex flex-col gap-3 rounded-lg bg-surface px-6 py-6 md:px-8">
          <h2 className="m-0 text-title-2">안내</h2>
          <p className="m-0 text-body-long text-ink-2">{form.request.description}</p>
        </section>
      )}

      <section className="flex flex-col gap-6 rounded-lg bg-surface px-6 py-8 md:px-8">
        <h2 className="m-0 text-title-2">제출 내용</h2>
        {form.fields.map((field) => {
          const editable = form.editableFieldKeys.includes(field.fieldKey)
          return (
            <FormField
              key={field.fieldKey}
              field={field}
              register={register}
              editable={editable}
              highlight={isRevision && editable}
              error={formState.errors[field.fieldKey]?.message as string | undefined}
              hint={crossCheck(field, watch)}
              value={form.answers[field.fieldKey] ?? null}
              files={form.files.filter((f) => f.fieldKey === field.fieldKey)}
            />
          )
        })}
      </section>

      {saveError && (
        <Banner
          tone="danger"
          title={saveErrorTitle(saveError.code)}
          action={
            saveError.code === 'VERSION_CONFLICT' ? (
              <Button size="compact" onClick={onReload}>
                새로 불러오기
              </Button>
            ) : undefined
          }
        >
          {saveErrorBody(saveError)}
        </Banner>
      )}

      {!locked && (
        // 모바일: 화면 아래에 고정(디자인 시스템 › 레이아웃 › 고정 영역). PC: 폼 끝 오른쪽
        <div className="sticky bottom-0 z-(--z-sticky) -mx-4 flex items-center gap-3 border-t border-line-subtle bg-surface px-4 pt-3 pb-[max(var(--space-3),env(safe-area-inset-bottom))] md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <p className="m-0 inline-flex flex-1 items-center gap-1.5 text-caption text-ink-3" aria-live="polite">
            {savedAt && !formState.isDirty && (
              <>
                <Check size={16} strokeWidth={2} aria-hidden />
                {formatTime(savedAt)} 저장됨
              </>
            )}
            {formState.isDirty && '저장하지 않은 내용이 있어요'}
          </p>
          {/* 제출하기는 파일 첨부와 함께 다음 작업에서 붙인다 */}
          <Button type="submit" size="cta" className="md:h-control-h" disabled={save.isPending}>
            {save.isPending ? '저장하는 중' : '임시 저장'}
          </Button>
        </div>
      )}
    </form>
  )
}

// 서버 값 → 입력칸 값(문자열·체크)
function toFormValues(fields: Field[], answers: Answers): FormValues {
  const values: FormValues = {}
  for (const f of fields) {
    const v = answers[f.fieldKey]
    if (f.fieldType === 'CHECKBOX') values[f.fieldKey] = v === true
    else if (f.fieldType === 'SELECT_MULTI') values[f.fieldKey] = Array.isArray(v) ? v : []
    else if (f.fieldType !== 'FILE') values[f.fieldKey] = v === null || v === undefined ? '' : String(v)
  }
  return values
}

// 입력칸 값 → 서버 값. 수정할 수 없는 항목은 원래 값을 그대로 보낸다.
function toAnswers(fields: Field[], values: FormValues, original: Answers): Answers {
  const answers: Answers = { ...original }
  for (const f of fields) {
    if (f.fieldType === 'FILE' || !(f.fieldKey in values)) continue
    const v = values[f.fieldKey]
    if (f.fieldType === 'NUMBER') {
      const s = String(v).trim()
      answers[f.fieldKey] = s === '' ? null : Number(s)
    } else if (typeof v === 'string') {
      answers[f.fieldKey] = v.trim() === '' ? null : v
    } else {
      answers[f.fieldKey] = v
    }
  }
  return answers
}

// 막지는 않지만 흔한 실수를 알려 준다(성적 제출: 평점이 만점보다 큼)
function crossCheck(field: Field, watch: (key: string) => FormValues[string]) {
  if (field.fieldKey !== 'gpa') return undefined
  const gpa = Number(watch('gpa'))
  const scale = Number(watch('gpa_scale'))
  if (!scale || Number.isNaN(gpa) || gpa <= scale) return undefined
  return `만점 기준(${scale})보다 큽니다. 평점이나 만점 기준을 확인하세요.`
}


function saveErrorTitle(code: string) {
  if (code === 'VERSION_CONFLICT') return '다른 곳에서 먼저 저장했어요'
  if (code === 'SUBMISSION_LOCKED') return '저장할 수 없는 요청이에요'
  if (code === 'INVALID_REQUEST' || code === 'VALIDATION_ERROR') return '형식이 맞지 않는 항목이 있어요'
  return '저장하지 못했어요'
}

function saveErrorBody(error: ApiError) {
  if (error.code === 'VERSION_CONFLICT') return '다른 탭이나 기기에서 고친 내용이 있어요. 새로 불러온 뒤 다시 입력하세요.'
  if (error.code === 'SUBMISSION_LOCKED') return '이미 제출했거나 마감된 요청이에요.'
  if (error.code === 'INVALID_REQUEST' || error.code === 'VALIDATION_ERROR') return '빨간색으로 표시된 항목을 확인하세요.'
  return '입력한 내용은 그대로 있어요. 잠시 후 다시 시도하세요.'
}
