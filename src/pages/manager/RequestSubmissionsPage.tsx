import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { downloadExport, submissionExportColumns, useRequestSubmissions, type StatusFilter, type SubmissionRow } from '../../api/review'
import { daysUntil, isPastDue } from '../../api/tasks'
import { TIME_ZONE, toDate } from '../../lib/time'
import { filterField } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { ExportDialog, type ExportChoice } from '../../components/ui/ExportDialog'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tag } from '../../components/ui/Tag'
import { cn } from '../../lib/cn'
import { dDayText, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { MetaList } from '../../components/ui/MetaList'

const filters: { value: StatusFilter | null; label: string; empty: string }[] = [
  { value: null, label: '전체', empty: '대상 장학생이 없어요.' },
  { value: 'NOT_SUBMITTED', label: '미제출', empty: '모두 제출했어요.' },
  { value: 'WAITING', label: '검토 대기', empty: '검토할 제출이 없어요.' },
  { value: 'REVISION_REQUIRED', label: '보완 필요', empty: '보완 요청 중인 제출이 없어요.' },
  { value: 'CONFIRMED', label: '확인 완료', empty: '아직 확인 완료한 제출이 없어요.' },
]

const submittedAt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// A01 제출 현황: 요청 하나의 대상 장학생 전원. 상태 칩, 이름 검색, 내보내기, 행을 누르면 개별 검토
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

  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const filter = filters.find((f) => f.value === status)!
  const onExport = async (choice: ExportChoice) => {
    setExporting(true)
    setExportError(false)
    try {
      await downloadExport(requestId, choice)
      setExportOpen(false)
    } catch {
      setExportOpen(false)
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  const s = data?.summary
  const counts: Record<string, number | undefined> = s
    ? { all: s.target, NOT_SUBMITTED: s.notSubmitted, WAITING: s.submitted, REVISION_REQUIRED: s.revisionRequired, CONFIRMED: s.confirmed }
    : {}
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
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
          <PageTitle description={<RequestMeta cohortName={data.request.cohortName} closesAt={data.request.closesAt} />}>{data.request.title}</PageTitle>
          {exportError && (
            <Banner tone="danger" title="파일을 만들지 못했어요">
              잠시 후 다시 내보내세요.
            </Banner>
          )}
          {exportOpen && (
            <ExportDialog
              open
              title="제출 현황 내보내기"
              total={data.summary.target}
              scopes={filters.slice(1).map((f) => ({ value: f.value!, label: f.label, count: counts[f.value!] }))}
              initialScopes={status ? [status] : []}
              columnGroups={submissionExportColumns}
              busy={exporting}
              onCancel={() => setExportOpen(false)}
              onSubmit={(c) => void onExport(c)}
            />
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <FilterChips
              label="제출 상태"
              items={filters.map((f) => ({ value: f.value, label: f.label, count: counts[f.value ?? 'all'] }))}
              value={status}
              onChange={(v) => go({ status: v })}
            />
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64 md:flex-none">
                <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" aria-hidden />
                <input
                  type="search"
                  aria-label="이름으로 찾기"
                  placeholder="이름으로 찾기"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className={cn(filterField, 'pl-8')}
                />
              </div>
              {/* 목록에 대한 보조 행동이라 테두리 없는 버튼으로 필터 옆에 둔다(11/12) */}
              <Button
                size="compact"
                variant="ghost"
                disabled={exporting || data.summary.target === 0}
                onClick={() => (setExportError(false), setExportOpen(true))}
              >
                <Download size={16} strokeWidth={2} aria-hidden />
                내보내기
              </Button>
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
                  <span className="w-28">기수</span>
                  <span className="w-44">학교</span>
                  <span className="w-48">상태</span>
                  <span className="w-20 text-right">평점</span>
                  <span className="w-28 text-right">제출</span>
                  <span className="w-5" />
                </div>
                <ul className="m-0 list-none p-0">
                  {data.items.map((r) => (
                    <Row key={r.scholarId} row={r} requestId={requestId} />
                  ))}
                </ul>
              </div>
              <Pagination page={page} lastPage={lastPage} disabled={loadingNext} onChange={(p) => go({ page: p })} />
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
      <MetaList
        items={[
          cohortName ?? '전체 기수',
          `마감 ${formatDue(closesAt)}`,
          <span key="d" className={cn((overdue || dDay <= 3) && 'font-semibold text-danger-text')}>
            {dDayText(dDay, overdue)}
          </span>,
        ]}
      />
    </>
  )
}

function Row({ row, requestId }: { row: SubmissionRow; requestId: number }) {
  const tags = (
    <>
      {row.late && <Tag tone="danger">마감 후</Tag>}
      {row.hasInputError && <Tag tone="warning">형식 확인</Tag>}
    </>
  )
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* 휴대폰: 보조 표시는 이름 옆에 둬서 아래 줄이 꺾이지 않게 한다 */}
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body-strong">{row.scholarName}</span>
          <span className="flex shrink-0 gap-1 md:hidden">{tags}</span>
        </span>
        {/* 휴대폰: 이름 아래 기수와 학교 */}
        <MetaList oneLine items={[row.cohortName, row.university]} className="flex text-caption text-ink-3 md:hidden" />
      </span>
      <span className="hidden truncate text-ink-2 md:block md:w-28">{row.cohortName ?? '–'}</span>
      <span className="hidden truncate text-ink-2 md:block md:w-44">{row.university ?? '–'}</span>
      {/* 휴대폰: 상태, 평점, 제출 시각을 한 줄에. PC에서는 각자 열이 된다 */}
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
        <span className="flex flex-wrap items-center gap-2 md:w-48">
          <StatusBadge status={row.status} />
          <span className="hidden md:contents">{tags}</span>
        </span>
        <span className="text-caption text-ink-2 tabular-nums md:w-20 md:text-right md:text-body">
          {row.gpa != null ? (
            <>
              <span className="md:sr-only">평점 </span>
              {row.gpa.toFixed(2)}
              {row.gpaScale && <span className="text-ink-3"> / {row.gpaScale}</span>}
            </>
          ) : (
            <span className="hidden text-ink-3 md:inline">–</span>
          )}
        </span>
        <span className="text-caption text-ink-3 tabular-nums md:w-28 md:text-right">
          <span className="md:sr-only">제출 </span>
          {row.submittedAt ? submittedAt.format(toDate(row.submittedAt)) : '–'}
        </span>
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
