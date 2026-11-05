import { Check, ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useBlocker, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useFileActions } from '../../api/files'
import {
  useSaveDraft,
  useSubmissionForm,
  useSubmit,
  type Answers,
  type FormField as Field,
  type SubmissionForm,
  type SubmitResult,
} from '../../api/submissions'
import { fieldErrorsOf } from '../../api/types'
import type { FileHandlers } from '../../components/form/FileField'
import { FormField, type FormValues } from '../../components/form/FormField'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tag } from '../../components/ui/Tag'
import { daysUntil, isPastDue } from '../../api/tasks'
import { dDayText, formatDue, formatTime } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'

// S02 제출 입력 · 임시 저장
export function SubmissionPage() {
  const requestId = Number(useParams().requestId)
  const query = useSubmissionForm(requestId)
  usePageTitle(query.data?.request.title ?? '제출')

  return (
    <div className="flex flex-col gap-6">
      <Link to="/tasks" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />내 할 일
      </Link>
      {query.isPending && <LoadingCards count={2} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {/* key: 다른 요청으로 옮겨 가면 폼과 저장 시각을 새로 시작한다.
          저장으로 버전이 바뀌어도 폼은 그대로 둔다(저장 중에 입력한 내용을 지키기 위해). */}
      {query.data && <SubmissionEditor key={requestId} requestId={requestId} form={query.data} onReload={() => query.refetch()} />}
    </div>
  )
}

type EditorProps = {
  requestId: number
  form: SubmissionForm
  onReload: () => Promise<{ data?: SubmissionForm }>
}

function SubmissionEditor({ requestId, form, onReload }: EditorProps) {
  const save = useSaveDraft(requestId)
  const submit = useSubmit(requestId)
  const fileActions = useFileActions(requestId)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null)
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null)
  const [busyFields, setBusyFields] = useState<string[]>([])
  const topRef = useRef<HTMLDivElement>(null)
  const defaults = useMemo(() => toFormValues(form.fields, form.answers), [form.fields, form.answers])
  const { register, handleSubmit, watch, setError, clearErrors, reset, getValues, formState } = useForm<FormValues>({
    defaultValues: defaults,
    mode: 'onBlur',
  })

  const locked = form.editableFieldKeys.length === 0
  const isRevision = form.status === 'REVISION_REQUIRED'
  const dDay = daysUntil(form.request.dueAt)
  const late = !locked && isPastDue(form.request.dueAt)
  const uploading = busyFields.length > 0

  // 파일은 제출 ID가 있어야 올릴 수 있다. 처음 들어온 요청이면 지금 값으로 임시 저장부터 한다.
  const creating = useRef<Promise<number> | null>(null)
  const ensureSubmissionId = useCallback(async () => {
    if (form.submissionId) return form.submissionId
    creating.current ??= (async () => {
      const values = getValues()
      const result = await save.mutateAsync({
        answers: toAnswers(form.fields, values, form.answers),
        version: form.version,
      })
      reset(values, { keepValues: true })
      setSavedAt(result.savedAt)
      return result.submissionId
    })().finally(() => {
      creating.current = null
    })
    return creating.current
  }, [form.submissionId, form.fields, form.answers, form.version, getValues, reset, save])

  const onBusyChange = useCallback(
    (fieldKey: string, busy: boolean) => setBusyFields((list) => (busy ? [...new Set([...list, fieldKey])] : list.filter((k) => k !== fieldKey))),
    [],
  )

  const fileHandlers: FileHandlers = {
    upload: async (fieldKey, file, onProgress, signal) => {
      const submissionId = await ensureSubmissionId()
      const uploaded = await fileActions.upload({
        submissionId,
        fieldKey,
        file,
        onProgress,
        signal,
      })
      clearErrors(fieldKey)
      return uploaded
    },
    remove: (fileId) => fileActions.remove(fileId),
    onBusyChange,
  }

  const onSave = handleSubmit((values) => {
    if (save.isPending) return
    const answers = toAnswers(form.fields, values, form.answers)
    save.mutate(
      { answers, version: form.version },
      {
        onSuccess: (result) => {
          // 보낸 값을 "저장된 상태"로 삼되, 저장 중에 더 입력한 내용은 그대로 둔다
          reset(values, { keepValues: true })
          setSavedAt(result.savedAt)
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return
          fieldErrorsOf(error.details).forEach((fe, i) => setError(fe.key, { message: fe.message }, { shouldFocus: i === 0 }))
        },
      },
    )
  })

  // 409(다른 곳에서 먼저 저장)일 때만 서버 내용으로 다시 채운다
  const reload = async () => {
    const { data } = await onReload()
    if (!data) return
    save.reset()
    submit.reset()
    reset(toFormValues(data.fields, data.answers))
  }

  // 저장하지 않은 내용이 있을 때 창을 닫거나 새로고침하면 한 번 묻는다
  useEffect(() => {
    if (!formState.isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // 예전 Safari·Chrome용
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [formState.isDirty])

  // 화면 안에서 다른 곳으로 옮겨 갈 때도 묻는다(내 할 일, 로고, 로그아웃)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => formState.isDirty && currentLocation.pathname !== nextLocation.pathname)

  // Cmd/Ctrl + S로도 임시 저장. 한글 자판에서도 되도록 글자 대신 키 위치(code)로 확인한다.
  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
        e.preventDefault()
        void onSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // 제출 전 확인: 형식 검사(handleSubmit) → 올리는 중인 파일 → 빈 필수 항목 → 확인 창
  const onSubmitClick = handleSubmit(() => {
    setNotice(null)
    if (uploading) {
      setNotice({
        title: '파일을 올리는 중이에요',
        body: '다 올라간 뒤 제출하세요.',
      })
      return
    }
    const missing = missingRequired(form, getValues())
    if (missing.length > 0) {
      missing.forEach((key, i) => setError(key, { message: '필수 항목이에요.' }, { shouldFocus: i === 0 }))
      setNotice({
        title: `빈 필수 항목이 ${missing.length}개 있어요`,
        body: '빨간색으로 표시된 항목을 채운 뒤 제출하세요.',
      })
      return
    }
    setConfirming(true)
  })

  const doSubmit = () => {
    setConfirming(false)
    const values = getValues()
    const all = toAnswers(form.fields, values, form.answers)
    // 보완 후 다시 제출할 때는 보완 요청된 항목만 보낸다(그 밖의 항목이 있으면 서버가 거부)
    const answers = isRevision ? Object.fromEntries(Object.entries(all).filter(([k]) => form.editableFieldKeys.includes(k))) : all
    submit.mutate(
      { answers, version: form.version, resubmit: isRevision },
      {
        onSuccess: (result) => {
          reset(values)
          setSubmitted(result)
          // 결과 안내가 보이도록 맨 위로 올리고, 화면 낭독기가 읽도록 안내에 포커스
          window.scrollTo({ top: 0 })
          requestAnimationFrame(() => topRef.current?.focus())
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return
          fieldErrorsOf(error.details).forEach((fe, i) => setError(fe.key, { message: fe.message }, { shouldFocus: i === 0 }))
        },
      },
    )
  }

  const rawError = submit.error ?? save.error
  const actionError = rawError instanceof ApiError ? rawError : rawError ? new ApiError(0, { code: 'NETWORK_ERROR', message: '' }) : null
  const submitLabel = isRevision ? '다시 제출하기' : '제출하기'

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
          {!locked && ` · ${dDayText(dDay, late)}`}
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
      {submitted && (
        <div ref={topRef} tabIndex={-1} className="outline-none">
          <Banner tone="success" title={submitted.status === 'RESUBMITTED' ? '다시 제출했어요' : '제출했어요'}>
            {submitted.completionMessage || '검토가 끝나면 내 할 일에서 알려 드려요.'}
          </Banner>
        </div>
      )}
      {!submitted && (form.status === 'SUBMITTED' || form.status === 'RESUBMITTED') && (
        <Banner tone="info" title="검토를 기다리고 있어요">
          결과가 나오면 여기와 내 할 일에서 알려 드려요.
        </Banner>
      )}
      {form.request.closed && form.status !== 'CONFIRMED' && (
        <Banner tone="info" title="마감된 요청이에요">
          더 이상 고치거나 제출할 수 없어요.
        </Banner>
      )}
      {form.status === 'CONFIRMED' && (
        <Banner tone="success" title="확인이 끝났어요">
          확인이 끝난 제출은 고칠 수 없어요.
        </Banner>
      )}

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
              fileHandlers={fileHandlers}
            />
          )
        })}
      </section>

      {notice && (
        <Banner tone="warning" title={notice.title}>
          {notice.body}
        </Banner>
      )}
      {actionError && (
        <Banner
          tone="danger"
          title={errorTitle(actionError.code, submit.isError)}
          action={
            actionError.code === 'VERSION_CONFLICT' ? (
              <Button size="compact" onClick={() => void reload()}>
                새로 불러오기
              </Button>
            ) : undefined
          }
        >
          {errorBody(actionError, submit.isError)}
        </Banner>
      )}

      {!locked && (
        // 모바일: 화면 아래에 고정(디자인 시스템 › 레이아웃 › 고정 영역). PC: 폼 끝 오른쪽
        <div className="sticky bottom-0 z-(--z-sticky) -mx-4 flex items-center gap-3 border-t border-line-subtle bg-surface px-4 pt-3 pb-safe-bar md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <p className="m-0 inline-flex flex-1 items-center gap-1.5 text-caption text-ink-3" aria-live="polite">
            {savedAt && !formState.isDirty && (
              <>
                <Check size={16} strokeWidth={2} aria-hidden />
                {formatTime(savedAt)} 저장됨
              </>
            )}
            {formState.isDirty && '저장 안 됨'}
          </p>
          <Button type="submit" size="cta" className="md:h-control-h" disabled={save.isPending || submit.isPending}>
            {save.isPending ? '저장하는 중' : '임시 저장'}
          </Button>
          <Button variant="primary" size="cta" className="md:h-control-h" disabled={save.isPending || submit.isPending} onClick={() => void onSubmitClick()}>
            {submit.isPending ? '제출하는 중' : submitLabel}
          </Button>
        </div>
      )}
      <ConfirmDialog open={confirming} title={submitLabel} confirmLabel={submitLabel} onConfirm={doSubmit} onCancel={() => setConfirming(false)}>
        {isRevision ? '보완 요청된 항목만 다시 제출돼요. ' : ''}
        제출하면 검토가 끝날 때까지 고칠 수 없어요.
        {late ? ' 마감이 지나 지연 제출로 표시돼요.' : ''}
      </ConfirmDialog>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="저장하지 않고 나가기"
        confirmLabel="저장하지 않고 나가기"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        저장하지 않은 내용은 사라져요. 남기려면 취소한 뒤 임시 저장을 누르세요.
      </ConfirmDialog>
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

// 비어 있는 필수 항목(수정할 수 있는 항목만). 파일은 올린 파일이 있어야 한다.
function missingRequired(form: SubmissionForm, values: FormValues) {
  return form.fields
    .filter((f) => f.required && form.editableFieldKeys.includes(f.fieldKey))
    .filter((f) => {
      if (f.fieldType === 'FILE') return !form.files.some((x) => x.fieldKey === f.fieldKey)
      const v = values[f.fieldKey]
      if (f.fieldType === 'CHECKBOX') return v !== true
      if (Array.isArray(v)) return v.length === 0
      return typeof v !== 'string' || v.trim() === ''
    })
    .map((f) => f.fieldKey)
}

function errorTitle(code: string, submitting: boolean) {
  if (code === 'VERSION_CONFLICT') return '다른 곳에서 먼저 고쳤어요'
  if (code === 'SUBMISSION_LOCKED' || code === 'NOT_IN_REVISION') return submitting ? '제출할 수 없는 상태예요' : '저장할 수 없는 요청이에요'
  if (code === 'DEADLINE_PASSED') return '보완 기한이 지났어요'
  if (code === 'FIELD_NOT_EDITABLE') return '고칠 수 없는 항목이 포함됐어요'
  if (code === 'INVALID_REQUEST' || code === 'VALIDATION_ERROR') return '확인이 필요한 항목이 있어요'
  return submitting ? '제출하지 못했어요' : '저장하지 못했어요'
}

function errorBody(error: ApiError, submitting: boolean) {
  if (error.code === 'VERSION_CONFLICT') return '다른 탭이나 기기에서 고친 내용이 있어요. 새로 불러온 뒤 다시 입력하세요.'
  if (error.code === 'SUBMISSION_LOCKED' || error.code === 'NOT_IN_REVISION') return '이미 제출했거나 마감된 요청이에요. 새로고침해서 상태를 확인하세요.'
  if (error.code === 'DEADLINE_PASSED') return '담당자에게 기한 연장을 요청하세요.'
  if (error.code === 'FIELD_NOT_EDITABLE') return '새로고침한 뒤 보완 요청된 항목만 고쳐서 다시 제출하세요.'
  if (error.code === 'INVALID_REQUEST' || error.code === 'VALIDATION_ERROR') return '빨간색으로 표시된 항목을 고친 뒤 다시 시도하세요.'
  return `입력한 내용은 그대로 있어요. 잠시 후 다시 ${submitting ? '제출하세요' : '시도하세요'}.`
}
