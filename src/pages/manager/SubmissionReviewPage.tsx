import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useConfirm, useRequestRevision, useRequestSubmissions, useSubmissionDetail, type Comparison, type SubmissionDetail } from '../../api/review'
import { fieldBase, fieldBorder } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormDialog } from '../../components/ui/FormDialog'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tag } from '../../components/ui/Tag'
import { cn } from '../../lib/cn'
import { formatBytes, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'

type Notice = { title: string; body: string }

// A02 개별 검토: 제출 내용 + 문서 비교 → 확인 완료 또는 보완 요청. 끝나면 같은 요청의 다음 검토 대기로
export function SubmissionReviewPage() {
  const submissionId = Number(useParams().submissionId)
  const query = useSubmissionDetail(submissionId)
  const d = query.data
  usePageTitle(d ? `${d.scholar.name} 검토` : '검토')

  return (
    <div className="mx-auto flex max-w-page-form flex-col gap-6 lg:max-w-page-wide">
      {query.isPending && <LoadingCards count={2} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {/* key: 다음 제출로 넘어가면 대화상자·안내 상태를 새로 시작한다 */}
      {d && <Review key={d.id} d={d} />}
    </div>
  )
}

function Review({ d }: { d: SubmissionDetail }) {
  const navigate = useNavigate()
  const location = useLocation()
  // 바로 앞 제출을 처리하고 넘어왔으면 그 결과를 한 번 보여 준다
  const [notice] = useState(() => (location.state as { notice?: Notice } | null)?.notice)
  useEffect(() => {
    if ((location.state as { notice?: Notice } | null)?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  // 검토 순서: 같은 요청의 검토 대기 전체(이전·다음). 한 요청 대상은 수백 명 안이라 한 번에 받는다
  const queue = useRequestSubmissions(d.requestId, { status: 'WAITING', keyword: '', page: 1, pageSize: 500 })
  const ids = (queue.data?.items ?? []).map((r) => r.submissionId!).filter(Boolean)
  const pos = ids.indexOf(d.id)
  const prev = pos > 0 ? ids[pos - 1] : null
  const next = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null

  const confirm = useConfirm(d.id)
  const revision = useRequestRevision(d.id)
  const [confirming, setConfirming] = useState(false)
  const [revising, setRevising] = useState(false)
  const [revisionRound, setRevisionRound] = useState(0)
  const waiting = d.status === 'SUBMITTED' || d.status === 'RESUBMITTED'
  const mismatched = (d.analysis?.comparisons ?? []).filter((c) => c.result !== 'MATCH')

  // 처리한 뒤: 남은 검토 대기가 있으면 다음 사람으로, 없으면 제출 현황으로
  const afterAction = (notice: Notice) => {
    const nextId = next ?? (prev && ids.length > 1 ? ids.find((id) => id !== d.id) : null)
    if (nextId) navigate(`/manager/submissions/${nextId}`, { replace: true, state: { notice } })
    else
      navigate(`/manager/requests/${d.requestId}?status=WAITING`, {
        replace: true,
        state: { notice: { ...notice, body: `${notice.body} 남은 검토 대기가 없어요.` } },
      })
  }

  const onConfirm = () =>
    confirm.mutate(
      { version: d.version },
      {
        onSuccess: () => {
          setConfirming(false)
          afterAction({ title: `${d.scholar.name} 확인 완료`, body: '장학생에게 결과가 보여요.' })
        },
        onError: () => setConfirming(false),
      },
    )

  const actionError = [confirm.error, revision.error].find((e) => e instanceof ApiError) as ApiError | undefined

  return (
    <>
      <Link to={`/manager/requests/${d.requestId}`} className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        {d.requestTitle}
      </Link>

      {notice && (
        <Banner tone="success" title={notice.title}>
          {notice.body}
        </Banner>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={d.status} />
            {d.late && <Tag tone="danger">마감 후</Tag>}
          </div>
          <PageTitle description={[d.scholar.cohortName, d.submittedAt && `${formatDue(d.submittedAt)} 제출`].filter(Boolean).join(' · ')}>
            {d.scholar.name}
          </PageTitle>
        </div>
        {waiting && ids.length > 0 && pos >= 0 && (
          <nav aria-label="검토 순서" className="flex items-center gap-2 text-caption text-ink-3 tabular-nums">
            <Button size="compact" aria-label="이전 제출" disabled={!prev} onClick={() => prev && navigate(`/manager/submissions/${prev}`)}>
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            </Button>
            <span>
              검토 대기 {pos + 1} / {ids.length}
            </span>
            <Button size="compact" aria-label="다음 제출" disabled={!next} onClick={() => next && navigate(`/manager/submissions/${next}`)}>
              <ChevronRight size={16} strokeWidth={2} aria-hidden />
            </Button>
          </nav>
        )}
      </div>

      {d.status === 'REVISION_REQUIRED' && d.revisions.at(-1) && (
        <Banner tone="warning" title="보완 요청 중이에요">
          {d.revisions.at(-1)!.reason} ({labelsOf(d, d.revisions.at(-1)!.fieldKeys)})
        </Banner>
      )}
      {d.status === 'CONFIRMED' && (
        <Banner tone="success" title="확인 완료한 제출이에요">
          더 처리할 일이 없어요.
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="answers" className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-6 md:px-8">
          <h2 id="answers" className="m-0 text-title-2">
            제출 내용
          </h2>
          <dl className="m-0 flex flex-col gap-4">
            {d.fields.map((f) => (
              <div key={f.fieldKey} className="flex flex-col gap-1">
                <dt className="text-caption text-ink-3">{f.label}</dt>
                <dd className="m-0">
                  {f.fieldType === 'FILE' ? (
                    <FileList files={d.files.filter((x) => x.fieldKey === f.fieldKey)} />
                  ) : (
                    <span className={cn('text-body', isEmpty(d.answers[f.fieldKey]) && 'text-ink-3')}>{show(d.answers[f.fieldKey])}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <CompareCard d={d} />
          <section aria-labelledby="history" className="flex flex-col gap-3 rounded-lg bg-surface px-6 py-6 md:px-8">
            <h2 id="history" className="m-0 text-title-2">
              처리 이력
            </h2>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {[...d.history].reverse().map((h, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 text-body">
                  <span>
                    {h.actorType === 'SCHOLAR' ? '장학생' : '담당자'} · {historyLabel(h.to)}
                  </span>
                  <span className="shrink-0 text-caption text-ink-3 tabular-nums">{formatDue(h.changedAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {actionError && (
        <Banner tone="danger" title={actionError.code === 'VERSION_CONFLICT' ? '그사이 제출 내용이 바뀌었어요' : '처리하지 못했어요'}>
          {actionError.code === 'VERSION_CONFLICT' || actionError.code === 'INVALID_STATE_TRANSITION'
            ? '최신 내용을 다시 불러왔어요. 내용을 확인한 뒤 다시 처리하세요.'
            : '잠시 후 다시 시도하세요.'}
        </Banner>
      )}

      {waiting && (
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
          <Button disabled={confirm.isPending || revision.isPending} onClick={() => (setRevisionRound((n) => n + 1), setRevising(true))}>
            보완 요청
          </Button>
          <Button variant="primary" disabled={confirm.isPending || revision.isPending} onClick={() => setConfirming(true)}>
            {confirm.isPending ? '처리하는 중' : '확인 완료'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        busy={confirm.isPending}
        title="확인 완료"
        confirmLabel="확인 완료"
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      >
        {mismatched.length > 0
          ? `문서 값과 다른 항목이 있어요(${mismatched.map((c) => c.label).join(', ')}). 확인 완료하면 장학생이 입력한 값으로 기록돼요.`
          : '확인 완료하면 장학생에게 결과가 보이고 더 고칠 수 없어요.'}
      </ConfirmDialog>

      <RevisionDialog
        // 다시 열 때마다 고른 항목·사유·오류 표시를 처음부터
        key={revisionRound}
        open={revising}
        d={d}
        preselect={mismatched.map((c) => c.field)}
        busy={revision.isPending}
        onCancel={() => setRevising(false)}
        onSubmit={(fieldKeys, reason) =>
          revision.mutate(
            { fieldKeys, reason, dueAt: null, version: d.version },
            {
              onSuccess: () => {
                setRevising(false)
                afterAction({ title: `${d.scholar.name}에게 보완 요청을 보냈어요`, body: `${labelsOf(d, fieldKeys)} 항목만 다시 받아요.` })
              },
              onError: () => setRevising(false),
            },
          )
        }
      />
    </>
  )
}

// 문서 비교: 장학생 입력값과 문서에서 읽은 값. 기록되는 값은 장학생 입력값(정책)
function CompareCard({ d }: { d: SubmissionDetail }) {
  const result: Record<Comparison['result'], string> = { MATCH: '일치', MISMATCH: '다름', UNREADABLE: '읽지 못함' }
  return (
    <section aria-labelledby="compare" className="flex flex-col gap-3 rounded-lg bg-surface py-6">
      <div className="flex items-center justify-between gap-3 px-6 md:px-8">
        <h2 id="compare" className="m-0 text-title-2">
          문서 비교
        </h2>
        {d.analysis && d.analysis.overallResult !== 'MATCH' && (
          <Tag tone="danger">{d.analysis.overallResult === 'UNREADABLE' ? '읽지 못한 값 있음' : '다른 값 있음'}</Tag>
        )}
      </div>
      {!d.analysis ? (
        <p className="m-0 px-6 text-ink-3 md:px-8">이 요청은 문서 비교를 하지 않아요.</p>
      ) : (
        <>
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="h-control-default border-b border-line-subtle text-caption text-ink-3">
                <th scope="col" className="pl-6 text-left font-normal md:pl-8">
                  항목
                </th>
                <th scope="col" className="px-3 text-right font-normal">
                  장학생 입력
                </th>
                <th scope="col" className="pr-6 text-right font-normal md:pr-8">
                  문서 값
                </th>
              </tr>
            </thead>
            <tbody>
              {d.analysis.comparisons.map((c) => {
                const off = c.result !== 'MATCH'
                return (
                  <tr key={c.field} className="h-row-h border-b border-line-subtle last:border-b-0">
                    <th scope="row" className="pl-6 text-left font-normal md:pl-8">
                      {c.label}
                    </th>
                    <td className="px-3 text-right tabular-nums">{c.entered}</td>
                    <td className={cn('pr-6 text-right tabular-nums md:pr-8', off && 'font-bold text-danger-text')}>
                      <span className="inline-flex items-center justify-end gap-2">
                        {c.extracted ?? '–'}
                        {off && <Tag tone="danger">{result[c.result]}</Tag>}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="m-0 px-6 text-caption text-ink-3 md:px-8">기록되는 값은 장학생 입력값이에요. 문서 값은 확인용이에요.</p>
        </>
      )}
    </section>
  )
}

function RevisionDialog({
  open,
  d,
  preselect,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean
  d: SubmissionDetail
  preselect: string[]
  busy: boolean
  onCancel: () => void
  onSubmit: (fieldKeys: string[], reason: string) => void
}) {
  const [keys, setKeys] = useState<string[]>(preselect)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const reasonId = useId()
  const keysError = tried && keys.length === 0 ? '보완할 항목을 하나 이상 고르세요.' : null
  const reasonError = tried && !reason.trim() ? '보완 사유를 입력하세요.' : null

  return (
    <FormDialog
      open={open}
      title="보완 요청 보내기"
      submitLabel="보완 요청 보내기"
      busy={busy}
      onCancel={onCancel}
      onSubmit={() => {
        setTried(true)
        if (keys.length && reason.trim()) onSubmit(keys, reason.trim())
      }}
    >
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-1 p-0 text-label">다시 받을 항목</legend>
        {d.fields.map((f) => (
          <label key={f.fieldKey} className="flex min-h-control-default items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-action"
              checked={keys.includes(f.fieldKey)}
              aria-invalid={!!keysError}
              onChange={(e) => setKeys((k) => (e.target.checked ? [...k, f.fieldKey] : k.filter((x) => x !== f.fieldKey)))}
            />
            {f.label}
          </label>
        ))}
        {keysError && <p className="m-0 text-caption text-danger-text">{keysError}</p>}
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor={reasonId} className="text-label">
          보완 사유
        </label>
        <textarea
          id={reasonId}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={!!reasonError}
          aria-describedby={`${reasonId}-help`}
          className={cn(fieldBase, 'resize-y py-3 text-input-touch md:text-body-long', fieldBorder(!!reasonError))}
        />
        <p id={`${reasonId}-help`} className={cn('m-0 text-caption', reasonError ? 'text-danger-text' : 'text-ink-3')}>
          {reasonError ?? '장학생에게 그대로 보여요.'}
        </p>
      </div>
    </FormDialog>
  )
}

function FileList({ files }: { files: SubmissionDetail['files'] }) {
  if (files.length === 0) return <span className="text-ink-3">올린 파일 없음</span>
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {files.map((f) => (
        <li key={f.id} className="flex min-h-control-h items-center gap-2 rounded-md bg-surface-sunken px-4 text-ink-2">
          <FileText size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{f.originalName}</span>
          <span className="shrink-0 text-caption text-ink-3 tabular-nums">{formatBytes(f.sizeBytes)}</span>
        </li>
      ))}
    </ul>
  )
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
const show = (v: SubmissionDetail['answers'][string]) =>
  isEmpty(v)
    ? '입력하지 않음'
    : Array.isArray(v)
      ? v.join(', ')
      : typeof v === 'number'
        ? v.toLocaleString()
        : typeof v === 'boolean'
          ? v
            ? '예'
            : '아니요'
          : String(v)
const labelsOf = (d: SubmissionDetail, keys: string[]) => keys.map((k) => d.fields.find((f) => f.fieldKey === k)?.label ?? k).join(', ')
const historyLabel = (to: string) =>
  ({ SUBMITTED: '제출', RESUBMITTED: '다시 제출', REVISION_REQUIRED: '보완 요청', CONFIRMED: '확인 완료', DRAFT: '작성' })[to] ?? to
