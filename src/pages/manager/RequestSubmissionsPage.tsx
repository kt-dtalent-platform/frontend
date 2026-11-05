import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { downloadExport, useRequestSubmissions, type StatusFilter, type SubmissionRow } from '../../api/review'
import { daysUntil, isPastDue } from '../../api/tasks'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tag } from '../../components/ui/Tag'
import { cn } from '../../lib/cn'
import { dDayText, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'

const filters: { value: StatusFilter | null; label: string; empty: string }[] = [
  { value: null, label: '전체', empty: '대상 장학생이 없어요.' },
  { value: 'NOT_SUBMITTED', label: '미제출', empty: '모두 제출했어요.' },
  { value: 'WAITING', label: '검토 대기', empty: '검토할 제출이 없어요.' },
  { value: 'REVISION_REQUIRED', label: '보완 필요', empty: '보완 요청 중인 제출이 없어요.' },
  { value: 'CONFIRMED', label: '확인 완료', empty: '아직 확인 완료한 제출이 없어요.' },
]

const submittedAt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

// A01 제출 현황: 요청 하나의 대상 장학생 전원. 상태 칩·이름 검색·내려받기, 행을 누르면 개별 검토
export function RequestSubmissionsPage() {
  const requestId = Number(useParams().requestId)
  const [params, setParams] = useSearchParams()
  const status = (filters.find((f) => f.value === params.get('status'))?.value ?? null) as StatusFilter | null
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const keyword = params.get('q') ?? ''
  const [typed, setTyped] = useState(keyword)
  // 뒤로 가기 등으로 주소의 검색어가 바뀌면 입력칸도 맞춘다
  const [seen, setSeen] = useState(keyword)
  if (seen !== keyword) {
    setSeen(keyword)
    setTyped(keyword)
  }
  const query = useRequestSubmissions(requestId, { status, keyword, page })
  const data = query.data
  usePageTitle(data ? `${data.request.title} 제출 현황` : '제출 현황')

  // 마지막 검토를 마치고 넘어왔으면 결과를 한 번 보여 준다
  const location = useLocation()
  const navigate = useNavigate()
  const [notice] = useState(() => (location.state as { notice?: { title: string; body: string } } | null)?.notice)
  useEffect(() => {
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])

  const go = (next: { status?: StatusFilter | null; page?: number; q?: string }) => {
    const p = new URLSearchParams()
    const s = next.status === undefined ? status : next.status
    const q = next.q ?? keyword
    if (s) p.set('status', s)
    if (q) p.set('q', q)
    if ((next.page ?? 1) > 1) p.set('page', String(next.page))
    setParams(p, { replace: true })
  }

  // 이름 검색: 입력을 멈추고 0.3초 뒤에 찾는다
  useEffect(() => {
    if (typed === keyword) return
    const t = setTimeout(() => {
      const p = new URLSearchParams(params)
      if (typed) p.set('q', typed)
      else p.delete('q')
      p.delete('page')
      setParams(p, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [typed, keyword, params, setParams])

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const filter = filters.find((f) => f.value === status)!
  const exportLabel = status ? `${filter.label} 내려받기` : '전체 내려받기'
  const onExport = async () => {
    setExporting(true)
    setExportError(false)
    try {
      await downloadExport(requestId, status)
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  const s = data?.summary
  const counts: Record<string, number | undefined> = s
    ? { all: s.target, NOT_SUBMITTED: s.notSubmitted, WAITING: s.submitted, REVISION_REQUIRED: s.revisionRequired, CONFIRMED: s.confirmed }
    : {}
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const loadingNext = query.isPlaceholderData

  // 없는 쪽(예: 마지막 쪽에서 모두 처리됨)이면 마지막 쪽으로
  useEffect(() => {
    if (!data || query.isPlaceholderData || page <= lastPage) return
    const p = new URLSearchParams(params)
    if (lastPage > 1) p.set('page', String(lastPage))
    else p.delete('page')
    setParams(p, { replace: true })
  }, [data, query.isPlaceholderData, page, lastPage, params, setParams])

  return (
    <div className="flex flex-col gap-6">
      <Link to="/manager/requests" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        요청 관리
      </Link>

      {notice && (
        <Banner tone="success" title={notice.title}>
          {notice.body}
        </Banner>
      )}

      {query.isPending && <LoadingCards count={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {data && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <PageTitle description={<RequestMeta cohortName={data.request.cohortName} closesAt={data.request.closesAt} />}>{data.request.title}</PageTitle>
            <Button size="default" disabled={exporting || (status ? data.total : data.summary.target) === 0} onClick={() => void onExport()}>
              <Download size={16} strokeWidth={2} aria-hidden />
              {exporting ? '만드는 중' : exportLabel}
            </Button>
          </div>
          {exportError && (
            <Banner tone="danger" title="파일을 만들지 못했어요">
              잠시 후 다시 내려받으세요.
            </Banner>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <FilterChips
              label="제출 상태"
              items={filters.map((f) => ({ value: f.value, label: f.label, count: counts[f.value ?? 'all'] }))}
              value={status}
              onChange={(v) => go({ status: v })}
            />
            <div className="relative md:w-64">
              <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                type="search"
                aria-label="이름으로 찾기"
                placeholder="이름으로 찾기"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={cn(fieldControl, 'h-control-default pl-9', fieldBorder(false))}
              />
            </div>
          </div>

          {data.items.length === 0 ? (
            loadingNext ? (
              <LoadingCards count={2} />
            ) : (
              <EmptyState title={keyword ? `'${keyword}'에 맞는 장학생이 없어요` : filter.empty}>{keyword ? '이름을 다시 확인하세요.' : undefined}</EmptyState>
            )
          ) : (
            <div className={cn('flex flex-col gap-4', loadingNext && 'opacity-60')} aria-busy={loadingNext}>
              <div className="overflow-hidden rounded-lg bg-surface">
                <div aria-hidden className="hidden h-control-default items-center gap-4 border-b border-line-subtle px-6 text-caption text-ink-3 md:flex">
                  <span className="flex-1">이름</span>
                  <span className="w-56">상태</span>
                  <span className="w-28 text-right">제출</span>
                  <span className="w-5" />
                </div>
                <ul className="m-0 list-none p-0">
                  {data.items.map((r) => (
                    <Row key={r.scholarId} row={r} requestId={requestId} />
                  ))}
                </ul>
              </div>
              {data.total > data.page_size && (
                <nav aria-label="페이지" className="flex items-center justify-end gap-3 text-caption text-ink-3 tabular-nums">
                  <span>
                    {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} / 전체 {data.total}명
                  </span>
                  <Button size="compact" aria-label="이전 페이지" disabled={loadingNext || page <= 1} onClick={() => go({ page: page - 1 })}>
                    <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                  </Button>
                  <Button size="compact" aria-label="다음 페이지" disabled={loadingNext || page >= lastPage} onClick={() => go({ page: page + 1 })}>
                    <ChevronRight size={16} strokeWidth={2} aria-hidden />
                  </Button>
                </nav>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function RequestMeta({ cohortName, closesAt }: { cohortName: string | null; closesAt: string | null }) {
  if (!closesAt) return <>{cohortName ?? '전체 기수'}</>
  const overdue = isPastDue(closesAt)
  const dDay = daysUntil(closesAt)
  return (
    <>
      {cohortName ?? '전체 기수'} · 마감 {formatDue(closesAt)} ·{' '}
      <span className={cn((overdue || dDay <= 3) && 'font-semibold text-danger-text')}>{dDayText(dDay, overdue)}</span>
    </>
  )
}

function Row({ row, requestId }: { row: SubmissionRow; requestId: number }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body-strong">{row.scholarName}</span>
        {row.cohortName && <span className="text-caption text-ink-3">{row.cohortName}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-2 md:w-56">
        <StatusBadge status={row.status} />
        {row.late && <Tag tone="danger">마감 후</Tag>}
        {row.hasInputError && <Tag tone="warning">형식 확인</Tag>}
      </span>
      <span className="text-caption text-ink-3 tabular-nums md:w-28 md:text-right">
        <span className="md:sr-only">제출 </span>
        {row.submittedAt ? submittedAt.format(new Date(row.submittedAt)) : '–'}
      </span>
    </>
  )
  const cls = 'flex flex-col gap-2 px-6 py-4 md:min-h-row-h md:flex-row md:items-center md:gap-4 md:py-3'
  return (
    <li className="border-b border-line-subtle last:border-b-0">
      {row.submissionId && row.status !== 'DRAFT' ? (
        <Link
          to={`/manager/submissions/${row.submissionId}`}
          state={{ requestId }}
          className={cn(
            cls,
            'group text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          )}
        >
          {body}
          <ChevronRight size={20} strokeWidth={1.75} className="hidden shrink-0 text-ink-3 group-hover:text-ink md:block" aria-hidden />
        </Link>
      ) : (
        // 미제출·작성 중은 볼 내용이 없어 누를 수 없다
        <div className={cn(cls, 'text-ink')}>
          {body}
          <span className="hidden w-5 md:block" />
        </div>
      )}
    </li>
  )
}
