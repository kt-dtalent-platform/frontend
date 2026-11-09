import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PAGE_SIZE, useRequests, type RequestRow, type RequestStatus } from '../../api/manager'
import { daysUntil, isPastDue } from '../../api/tasks'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import type { Notice } from './RequestCreatePage'
import { PageTitle } from '../../components/ui/PageTitle'
import { RequestStatusBadge } from '../../components/ui/RequestStatusBadge'
import { FilterChips } from '../../components/ui/FilterChips'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { dDayText, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { MetaList } from '../../components/ui/MetaList'

const tabs: { status: RequestStatus | null; label: string; empty: string }[] = [
  { status: null, label: '전체', empty: '아직 만든 요청이 없어요. 요청을 만들어 장학생에게 서류를 받아 보세요.' },
  { status: 'IN_PROGRESS', label: '진행 중', empty: '지금 진행 중인 요청이 없어요.' },
  { status: 'DRAFT', label: '작성 중', empty: '작성 중인 요청이 없어요.' },
  { status: 'CLOSED', label: '마감', empty: '마감된 요청이 없어요.' },
]

// 요청 유형 코드 → 화면 이름. 모르는 코드는 표시하지 않는다(유형 목록은 백엔드 KT-15 템플릿 API 확인 필요).

// A04 요청 관리: 상태별 목록. 행을 누르면 그 요청의 제출 현황으로.
export function RequestsPage() {
  usePageTitle('요청 관리')
  const [params, setParams] = useSearchParams()
  const status = (tabs.find((t) => t.status === params.get('status'))?.status ?? null) as RequestStatus | null
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const query = useRequests({ status, page })
  // 요청 만들기에서 넘어온 결과 안내(작성 중으로 저장, 공개). 한 번 보여 준 뒤 기록에서 지워 새로고침하면 사라지게 한다
  const location = useLocation()
  const navigate = useNavigate()
  const [notice] = useState(() => (location.state as { notice?: Notice } | null)?.notice)
  useEffect(() => {
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])
  const tab = tabs.find((t) => t.status === status)!

  const go = (next: { status?: RequestStatus | null; page?: number }) => {
    const p = new URLSearchParams()
    const s = next.status === undefined ? status : next.status
    if (s) p.set('status', s)
    const pg = next.page ?? 1
    if (pg > 1) p.set('page', String(pg))
    setParams(p)
  }

  const data = query.data
  const from = data ? (data.page - 1) * data.page_size + 1 : 0
  const to = data ? Math.min(data.page * data.page_size, data.total) : 0
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const loadingNext = query.isPlaceholderData // 탭·페이지를 바꿔 새 결과를 기다리는 중(이전 결과가 대신 보임)

  // 주소의 페이지가 범위를 넘으면(예: ?page=99) 마지막 페이지로 옮긴다
  const outOfRange = !!data && !loadingNext && data.total > 0 && data.items.length === 0
  useEffect(() => {
    if (!outOfRange) return
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (lastPage > 1) p.set('page', String(lastPage))
    setParams(p, { replace: true })
  }, [outOfRange, lastPage, status, setParams])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>요청 관리</PageTitle>
        <Link to="/manager/requests/new" className={buttonClass({ variant: 'primary', size: 'default' })}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          요청 만들기
        </Link>
      </div>

      {notice && (
        <Banner tone={notice.tone} title={notice.title}>
          {notice.body}
        </Banner>
      )}

      <FilterChips label="요청 상태" items={tabs.map((t) => ({ value: t.status, label: t.label }))} value={status} onChange={(s) => go({ status: s })} />

      {query.isPending && <LoadingCards count={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {loadingNext && data?.items.length === 0 && <LoadingCards count={3} />}
      {data && !loadingNext && !outOfRange && data.items.length === 0 && <EmptyState title="요청이 없어요">{tab.empty}</EmptyState>}
      {data && data.items.length > 0 && (
        <div className={cn('flex flex-col gap-4', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isPlaceholderData}>
          <div className="overflow-hidden rounded-lg bg-surface">
            {/* 머리 행: 넓은 화면에서만. 좁은 화면은 행 안에서 이름을 붙여 보여 준다 */}
            <div aria-hidden className="hidden h-control-default items-center gap-4 border-b border-line-subtle px-6 text-caption text-ink-3 md:flex">
              <span className="flex-1">요청</span>
              <span className="w-24">상태</span>
              <span className="w-48">마감</span>
              <span className="w-20 text-right">제출</span>
              <span className="w-20 text-right">보완 필요</span>
              <span className="w-5" />
            </div>
            <ul className="m-0 list-none p-0">
              {data.items.map((r) => (
                <Row key={r.id} row={r} />
              ))}
            </ul>
          </div>

          {data.total > PAGE_SIZE && (
            <nav aria-label="페이지" className="flex items-center justify-end gap-3 text-caption text-ink-3 tabular-nums">
              <span>
                {from}–{to} / 전체 {data.total}건
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
    </div>
  )
}

function Row({ row }: { row: RequestRow }) {
  const due = row.closesAt
  const overdue = due ? isPastDue(due) : false
  const dDay = due ? daysUntil(due) : null
  const urgent = row.status === 'IN_PROGRESS' && dDay !== null && dDay <= 3
  // MVP는 요청 유형이 성적증명서 하나라 유형은 따로 적지 않는다
  const meta = [row.cohortName ?? '전체 기수']

  return (
    <li className="border-b border-line-subtle last:border-b-0">
      <Link
        // 작성 중이면 열어서 고치고, 공개한 요청은 제출 현황으로
        to={row.status === 'DRAFT' ? `/manager/requests/${row.id}/edit` : `/manager/requests/${row.id}`}
        className="group flex flex-col gap-2 px-6 py-4 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:min-h-row-h md:flex-row md:items-center md:gap-4 md:py-3"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-strong">{row.title}</span>
          {meta.length > 0 && <MetaList items={meta} className="text-caption text-ink-3" />}
        </span>
        <span className="md:w-24">
          <RequestStatusBadge status={row.status} />
        </span>
        <span className="text-caption whitespace-nowrap text-ink-3 tabular-nums md:w-48">
          {due ? (
            <>
              <span className="md:sr-only">마감 </span>
              {formatDue(due)}
              {row.status === 'IN_PROGRESS' && dDay !== null && (
                <span className={cn('ml-1', urgent && 'font-semibold text-danger-text')}>{dDayText(dDay, overdue)}</span>
              )}
            </>
          ) : (
            '마감 미정'
          )}
        </span>
        <span className="flex gap-4 text-caption text-ink-3 tabular-nums md:contents">
          <span className="md:w-20 md:text-right">
            <span className="md:sr-only">제출 </span>
            {row.targetCount > 0 ? (
              <>
                <span className="text-body text-ink">{row.submittedCount}</span> / {row.targetCount}
              </>
            ) : (
              '대상 미정'
            )}
          </span>
          <span className="md:w-20 md:text-right">
            <span className="md:sr-only">보완 필요 </span>
            <span className={cn('text-body', row.revisionCount > 0 ? 'font-semibold text-warning-text' : 'text-ink-3')}>{row.revisionCount}</span>
          </span>
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="hidden shrink-0 text-ink-3 group-hover:text-ink md:block" aria-hidden />
      </Link>
    </li>
  )
}
