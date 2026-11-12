import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { useManagerDashboard, type ManagerDashboard } from '../../api/manager'
import { daysUntil, isPastDue } from '../../api/tasks'
import { TIME_ZONE } from '../../lib/time'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { dDayText, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { MetaList } from '../../components/ui/MetaList'

const today = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, month: 'long', day: 'numeric', weekday: 'long' })

// A01 담당자 대시보드: 오늘 처리할 일 → 마감이 가까운 요청 → 전체 현황
export function ManagerHomePage() {
  usePageTitle('대시보드')
  const query = useManagerDashboard()
  const [date] = useState(() => today.format(new Date()))

  return (
    <div className="flex flex-col gap-8">
      <PageTitle description={`${date} 기준`}>대시보드</PageTitle>
      {query.isPending && <LoadingCards count={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && <Dashboard data={query.data} />}
    </div>
  )
}

function Dashboard({ data }: { data: ManagerDashboard }) {
  const { today: t, tasks, overview } = data
  const id = useId()
  return (
    <>
      <section aria-labelledby={`${id}-today`} className="flex flex-col gap-4">
        <h2 id={`${id}-today`} className="m-0 text-title-2">
          오늘 처리할 일
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard to="/manager/submissions" label="검토 대기" value={t.unreviewedSubmissions} empty="검토할 제출이 없어요" />
          <StatCard to="/manager/submissions" label="보완 후 다시 제출" value={t.resubmitted} empty="다시 제출된 건이 없어요" />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby={`${id}-closing`} className="flex flex-col gap-4 lg:col-span-2">
          <h2 id={`${id}-closing`} className="m-0 text-title-2">
            마감이 가까운 요청
          </h2>
          {tasks.closingSoon.length === 0 ? (
            <p className="m-0 rounded-lg bg-surface px-6 py-8 text-ink-3">일주일 안에 마감되는 요청이 없어요.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col rounded-lg bg-surface p-0">
              {tasks.closingSoon.map((r) => (
                <ClosingRow key={r.requestId} row={r} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={`${id}-overview`} className="flex flex-col gap-4">
          <h2 id={`${id}-overview`} className="m-0 text-title-2">
            현황
          </h2>
          <dl className="m-0 flex flex-col gap-6 rounded-lg bg-surface px-6 py-6">
            <div className="flex flex-col gap-1">
              <dt className="text-caption text-ink-3">장학생</dt>
              <dd className="m-0 text-title-1 tabular-nums">
                {overview.scholarCount.toLocaleString()}
                <span className="ml-0.5 text-body text-ink-3">명</span>
              </dd>
              {overview.byCohort.length > 0 && (
                <dd className="m-0 text-caption text-ink-3 tabular-nums">{overview.byCohort.map((c) => `${c.cohortName} ${c.count}명`).join(', ')}</dd>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-caption text-ink-3">진행 중인 요청</dt>
              <dd className="m-0 flex items-baseline justify-between gap-2">
                <span className="text-title-1 tabular-nums">
                  {overview.inProgressRequests}
                  <span className="ml-0.5 text-body text-ink-3">건</span>
                </span>
                <Link to="/manager/requests?status=IN_PROGRESS" className="text-label text-ink-2">
                  요청 보기
                </Link>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}

// 숫자 카드: 누르면 해당 목록으로. 0이면 숫자 대신 할 일이 없다고 쓴다.
function StatCard({ to, label, value, empty }: { to: string; label: string; value: number; empty: string }) {
  return (
    <Link
      to={to}
      className="group flex items-end justify-between gap-4 rounded-lg bg-surface px-6 py-5 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
    >
      <span className="flex flex-col gap-1">
        <span className="text-label">{label}</span>
        {value > 0 ? (
          <span className="text-number tabular-nums">
            {value}
            <span className="ml-0.5 text-body font-normal text-ink-3">건</span>
          </span>
        ) : (
          <span className="flex h-control-default items-end text-ink-3">{empty}</span>
        )}
      </span>
      <ChevronRight size={20} strokeWidth={1.75} className="mb-1 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
    </Link>
  )
}

function ClosingRow({ row }: { row: ManagerDashboard['tasks']['closingSoon'][number] }) {
  const dDay = daysUntil(row.closesAt)
  const overdue = isPastDue(row.closesAt)
  return (
    <li className="border-b border-line-subtle last:border-b-0">
      <Link
        to={`/manager/requests/${row.requestId}`}
        className="group flex min-h-row-h items-center gap-4 px-6 py-3 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-strong">{row.title}</span>
          <span className="text-caption text-ink-3 tabular-nums">
            <MetaList
              items={[
                `마감 ${formatDue(row.closesAt)}`,
                <span key="d" className={cn((overdue || dDay <= 3) && 'font-semibold text-danger-text')}>
                  {dDayText(dDay, overdue)}
                </span>,
              ]}
            />
          </span>
        </span>
        <span className="shrink-0 text-right text-caption text-ink-3 tabular-nums">
          미제출 <span className={cn('text-body-strong', row.notSubmitted > 0 ? 'text-ink' : 'text-ink-3')}>{row.notSubmitted}</span>
          <span className="hidden sm:inline"> / {row.targetCount}명</span>
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
      </Link>
    </li>
  )
}
