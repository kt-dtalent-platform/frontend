import { ChevronLeft, ChevronRight, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import {
  useConfirm,
  useFileUrl,
  useRequestRevision,
  useRequestSubmissions,
  useSubmissionDetail,
  type Comparison,
  type SubmissionDetail,
} from '../../api/review'
import { fieldBase, fieldBorder } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormDialog } from '../../components/ui/FormDialog'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tag } from '../../components/ui/Tag'
import { cn } from '../../lib/cn'
import { formatBytes, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { MetaList } from '../../components/ui/MetaList'

type Notice = { title: string; body: string }

// A02 개별 검토: 왼쪽 서류 원본 + 오른쪽 입력값과 서류 비교 → 확인 완료 또는 보완 요청. 끝나면 같은 요청의 다음 검토 대기로
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
    // 다음이 없으면 남은 검토 대기 중 아무나(순서 목록을 못 받았거나 지금 건이 목록에 없을 때도)
    const nextId = next ?? ids.find((id) => id !== d.id) ?? null
    if (nextId) navigate(`/manager/submissions/${nextId}`, { replace: true, state: { notice } })
    else
      navigate(`/manager/requests/${d.requestId}?status=WAITING`, {
        replace: true,
        // 순서 목록을 받았을 때만 '남은 게 없다'고 말한다
        state: { notice: queue.isSuccess ? { ...notice, body: `${notice.body} 남은 검토 대기가 없어요.` } : notice },
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
          <PageTitle
            description={
              (d.scholar.cohortName || d.submittedAt) && <MetaList items={[d.scholar.cohortName, d.submittedAt && `${formatDue(d.submittedAt)} 제출`]} />
            }
          >
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

      {/* 왼쪽: 올린 서류 원본, 오른쪽: 입력값과 서류 비교, 처리 버튼(PC에서는 스크롤을 따라온다) */}
      {/* PC: 왼쪽 원본(7칸), 오른쪽 비교와 처리 버튼(5칸, 스크롤을 따라옴). 휴대폰: 원본 → 비교·버튼 → 처리 이력 */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:col-span-7">
          <DocumentViewer d={d} />
        </div>
        <aside
          aria-label="입력값 확인과 처리"
          className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-header-h lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1"
        >
          <CompareCard d={d} />
          {actionError && (
            <Banner tone="danger" title={actionError.code === 'VERSION_CONFLICT' ? '그사이 제출 내용이 바뀌었어요' : '처리하지 못했어요'}>
              {actionError.code === 'VERSION_CONFLICT' || actionError.code === 'INVALID_STATE_TRANSITION'
                ? '최신 내용을 다시 불러왔어요. 내용을 확인한 뒤 다시 처리하세요.'
                : '잠시 후 다시 시도하세요.'}
            </Banner>
          )}
          {waiting && (
            <div className="grid grid-cols-2 gap-3">
              <Button disabled={confirm.isPending || revision.isPending} onClick={() => (setRevisionRound((n) => n + 1), setRevising(true))}>
                보완 요청
              </Button>
              <Button variant="primary" disabled={confirm.isPending || revision.isPending} onClick={() => setConfirming(true)}>
                {confirm.isPending ? '처리하는 중' : '확인 완료'}
              </Button>
            </div>
          )}
        </aside>
        <div className="min-w-0 lg:col-span-7">
          <section aria-labelledby="history" className="flex flex-col gap-3 rounded-lg bg-surface px-6 py-6 md:px-8">
            <h2 id="history" className="m-0 text-title-2">
              처리 이력
            </h2>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {[...d.history].reverse().map((h, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 text-body">
                  <MetaList items={[h.actorType === 'SCHOLAR' ? '장학생' : '담당자', historyLabel(h.to)]} />
                  <span className="shrink-0 text-caption text-ink-3 tabular-nums">{formatDue(h.changedAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

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

// 입력값과 서류 비교. 기록되는 값은 장학생 입력값이고(정책), 서류에서 읽은 값은 확인용이다
function CompareCard({ d }: { d: SubmissionDetail }) {
  const result: Record<Comparison['result'], string> = { MATCH: '일치', MISMATCH: '다름', UNREADABLE: '읽지 못함' }
  const compared = new Set(d.analysis?.comparisons.map((c) => c.field))
  // 비교하지 않은 입력(전달할 내용 등). 파일은 왼쪽 원본으로 본다
  const others = d.fields.filter((f) => f.fieldType !== 'FILE' && !compared.has(f.fieldKey) && !isEmpty(d.answers[f.fieldKey]))
  const verdict = !d.analysis
    ? null
    : d.analysis.overallResult === 'MATCH'
      ? { tone: 'text-success-text', text: '모든 값이 서류와 같아요' }
      : d.analysis.overallResult === 'UNREADABLE'
        ? { tone: 'text-danger-text', text: '서류에서 읽지 못한 값이 있어요' }
        : { tone: 'text-danger-text', text: '서류와 다른 값이 있어요' }

  return (
    <section aria-labelledby="compare" className="flex flex-col gap-3 rounded-lg bg-surface py-6">
      <div className="flex flex-col gap-1 px-6">
        <h2 id="compare" className="m-0 text-title-2">
          입력값과 서류 비교
        </h2>
        {verdict && <p className={cn('m-0 text-label', verdict.tone)}>{verdict.text}</p>}
      </div>
      {!d.analysis ? (
        <p className="m-0 px-6 text-ink-3">자동 비교를 하지 못했어요. 원본을 보고 입력값이 맞는지 확인하세요.</p>
      ) : (
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="h-control-default border-b border-line-subtle text-caption text-ink-3">
              <th scope="col" className="pl-6 text-left font-normal">
                항목
              </th>
              <th scope="col" className="bg-surface-sunken px-3 text-right font-normal">
                장학생 입력
              </th>
              <th scope="col" className="pr-6 pl-3 text-right font-normal">
                서류에서 읽은 값
              </th>
            </tr>
          </thead>
          <tbody>
            {d.analysis.comparisons.map((c) => {
              const off = c.result !== 'MATCH'
              return (
                <tr key={c.field} className="h-row-h border-b border-line-subtle last:border-b-0">
                  <th scope="row" className="pl-6 text-left font-normal">
                    {c.label}
                  </th>
                  <td className="bg-surface-sunken px-3 text-right text-title-2 tabular-nums">{c.entered}</td>
                  <td className={cn('pr-6 pl-3 text-right tabular-nums', off && 'font-bold text-danger-text')}>
                    <span className="inline-flex flex-col items-end gap-1">
                      {c.extracted ?? '–'}
                      {off && <Tag tone="danger">{result[c.result]}</Tag>}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="m-0 px-6 text-caption text-ink-3">확인 완료하면 장학생 입력값으로 기록돼요.</p>
      {others.length > 0 && (
        <dl className="m-0 flex flex-col gap-3 border-t border-line-subtle px-6 pt-4">
          {others.map((f) => (
            <div key={f.fieldKey} className="flex flex-col gap-1">
              <dt className="text-caption text-ink-3">{f.label}</dt>
              <dd className="m-0 text-body whitespace-pre-wrap">{show(d.answers[f.fieldKey])}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

// 올린 서류 원본. 사진은 확대·축소, PDF는 브라우저 기본 보기. 새 탭에서 크게 볼 수 있다
// 처음에는 한 쪽 전체가 보이게(전체), 그다음 폭에 맞춰, 그 이상은 폭의 배수로 키운다
const ZOOM = [
  { label: '전체', width: null },
  { label: '폭 맞춤', width: 1 },
  { label: '150%', width: 1.5 },
  { label: '200%', width: 2 },
] as const

function DocumentViewer({ d }: { d: SubmissionDetail }) {
  const [activeId, setActiveId] = useState<number | null>(d.files[0]?.id ?? null)
  const file = d.files.find((f) => f.id === activeId) ?? null
  const url = useFileUrl(d.id, file?.id ?? null)
  const [zoomStep, setZoomStep] = useState(0)
  const zoom = ZOOM[zoomStep]
  // 확대하면 가로 가운데를 보여 준다. 마우스로 끌어서 옮길 수 있다
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const center = () => {
    const box = boxRef.current
    if (box) box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2
  }
  // 확대 단계나 보는 파일이 바뀌면 가운데로. 그림이 늦게 뜨면 onLoad에서 한 번 더
  useEffect(center, [zoomStep, url.data?.url])
  const isImage = !!file?.contentType.startsWith('image/')
  const isPdf = file?.contentType === 'application/pdf'
  const label = file ? (d.fields.find((f) => f.fieldKey === file.fieldKey)?.label ?? '제출 서류') : '제출 서류'

  return (
    <section aria-labelledby="doc" className="flex flex-col overflow-hidden rounded-lg bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="doc" className="m-0 text-title-2">
            {label} 원본
          </h2>
          {file && <MetaList oneLine items={[formatBytes(file.sizeBytes), file.originalName]} className="flex text-caption text-ink-3 tabular-nums" />}
        </div>
        {file && url.data && (
          <div className="flex items-center gap-1">
            {isImage && (
              <>
                <Button size="compact" variant="ghost" aria-label="축소" disabled={zoomStep === 0} onClick={() => setZoomStep((z) => z - 1)}>
                  <ZoomOut size={16} strokeWidth={2} aria-hidden />
                </Button>
                <span className="w-14 text-center text-caption text-ink-3 tabular-nums" aria-live="polite">
                  {zoom.label}
                </span>
                <Button size="compact" variant="ghost" aria-label="확대" disabled={zoomStep === ZOOM.length - 1} onClick={() => setZoomStep((z) => z + 1)}>
                  <ZoomIn size={16} strokeWidth={2} aria-hidden />
                </Button>
              </>
            )}
            <a href={url.data.url} target="_blank" rel="noreferrer" className={buttonClass({ size: 'compact' })}>
              <ExternalLink size={16} strokeWidth={2} aria-hidden />
              크게 보기
            </a>
          </div>
        )}
      </div>

      {d.files.length > 1 && (
        <div role="tablist" aria-label="올린 파일" className="flex gap-2 overflow-x-auto px-6 pb-3">
          {d.files.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === activeId}
              onClick={() => (setActiveId(f.id), setZoomStep(0))}
              className={cn(buttonClass({ size: 'compact', variant: f.id === activeId ? 'primary' : 'secondary' }), 'max-w-full truncate')}
            >
              {f.originalName}
            </button>
          ))}
        </div>
      )}

      <div
        ref={boxRef}
        className={cn(
          'flex h-viewer-h-m overflow-auto bg-surface-sunken lg:h-viewer-h',
          isImage && zoom.width === null && 'items-center justify-center p-4',
          isImage && zoom.width !== null && 'cursor-grab active:cursor-grabbing',
        )}
        onPointerDown={(e) => {
          if (!isImage || zoom.width === null || e.pointerType !== 'mouse') return
          const box = e.currentTarget
          drag.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop }
          box.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const start = drag.current
          if (!start) return
          e.currentTarget.scrollLeft = start.left - (e.clientX - start.x)
          e.currentTarget.scrollTop = start.top - (e.clientY - start.y)
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {!file ? (
          <p className="m-auto text-ink-3">올린 파일이 없어요.</p>
        ) : url.isPending ? (
          <p className="m-auto text-ink-3">원본을 불러오는 중</p>
        ) : url.isError ? (
          <div className="m-auto flex flex-col items-center gap-3 text-ink-3">
            <p className="m-0">원본을 불러오지 못했어요.</p>
            <Button size="compact" onClick={() => url.refetch()}>
              다시 불러오기
            </Button>
          </div>
        ) : isImage ? (
          zoom.width === null ? (
            <img src={url.data.url} alt={`${d.scholar.name} ${label}`} draggable={false} className="block max-h-full max-w-full object-contain shadow-dialog" />
          ) : (
            // 확대 단계는 사용자가 고르는 값이라 폭을 비율로 준다
            <img
              src={url.data.url}
              alt={`${d.scholar.name} ${label}`}
              draggable={false}
              onLoad={center}
              className="mx-auto block max-w-none shrink-0 self-start select-none"
              style={{ width: `${zoom.width * 100}%` }}
            />
          )
        ) : isPdf ? (
          <iframe src={url.data.url} title={`${d.scholar.name} ${label}`} className="size-full border-0" />
        ) : (
          <p className="m-auto text-ink-3">이 형식은 미리 볼 수 없어요. 크게 보기로 여세요.</p>
        )}
      </div>
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
