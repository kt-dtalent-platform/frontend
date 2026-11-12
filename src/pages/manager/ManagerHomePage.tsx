import { ChevronRight } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useManagerDashboard, type DashboardRequest, type ManagerDashboard } from '../../api/manager'
import { daysUntil, isPastDue } from '../../api/tasks'
import { buttonClass } from '../../components/ui/buttonClass'
import { MetaList } from '../../components/ui/MetaList'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { dDayText, formatDue } from '../../lib/format'
import { TIME_ZONE } from '../../lib/time'
import { usePageTitle } from '../../lib/usePageTitle'

const today = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, month: 'long', day: 'numeric', weekday: 'long' })

// A08 담당자 대시보드: 담당자가 움직이는 숫자 세 개(검토 대기, 미제출, 보완 필요)와 각 행동 → 진행 중 요청
export function ManagerHomePage() {
  usePageTitle('대시보드')
  const query = useManagerDashboard()
  const [date] = useState(() => today.format(new Date()))

  return (
    <div className="flex flex-col gap-8">
      <PageTitle description={`${date} 기준`}>대시보드</PageTitle>
      {query.isPending && <LoadingCards count={2} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && <Dashboard data={query.data} />}
    </div>
  )
}

function Dashboard({ data }: { data: ManagerDashboard }) {
  const id = useId()
  const live = data.requests
  // 진행 중 요청이 하나면 그 요청의 제출 현황으로, 여럿이면 요청 관리로 보낸다
  const listOf = (status: string) => (live.length === 1 ? `/manager/requests/${live[0].requestId}?status=${status}` : '/manager/requests?status=IN_PROGRESS')
  const notSubmitted = live.reduce((n, r) => n + r.notSubmitted, 0)
  const revision = live.reduce((n, r) => n + r.revisionRequired, 0)
  const nearest = live[0] // 마감이 가까운 순으로 온다
  const hasReview = data.review.waiting > 0 && data.review.oldestSubmissionId !== null

  return (
    <>
      {/* 지금 할 일: 숫자 바로 아래에 그 숫자로 할 행동을 둔다 */}
      <section aria-label="지금 할 일" className="grid gap-4 md:grid-cols-3">
        <TaskCard
          label="검토 대기"
          value={data.review.waiting}
          unit="건"
          note={data.review.resubmitted > 0 ? `다시 제출 ${data.review.resubmitted}건 포함` : null}
          action={
            hasReview && (
              <Link to={`/manager/submissions/${data.review.oldestSubmissionId}`} className={buttonClass({ variant: 'primary', size: 'default' })}>
                검토 시작
              </Link>
            )
          }
        />
        <TaskCard
          label="미제출"
          value={notSubmitted}
          unit="명"
          note={nearest ? <Due closesAt={nearest.closesAt} /> : null}
          action={
            notSubmitted > 0 && (
              <Link to={listOf('NOT_SUBMITTED')} className={buttonClass({ size: 'default' })}>
                명단 보기
              </Link>
            )
          }
        />
        <TaskCard
          label="보완 필요"
          value={revision}
          unit="명"
          note={revision > 0 ? '장학생이 고치는 중' : null}
          action={
            revision > 0 && (
              <Link to={listOf('REVISION_REQUIRED')} className={buttonClass({ size: 'default' })}>
                명단 보기
              </Link>
            )
          }
        />
      </section>

      <section aria-labelledby={`${id}-requests`} className="flex flex-col gap-4">
        <h2 id={`${id}-requests`} className="m-0 text-title-2">
          진행 중인 요청
        </h2>
        {live.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-lg bg-surface px-6 py-8">
            <p className="m-0 text-ink-3">진행 중인 요청이 없어요.</p>
            <Link to="/manager/requests/new" className={buttonClass({ size: 'default' })}>
              요청 만들기
            </Link>
          </div>
        ) : (
          <ul className="m-0 list-none overflow-hidden rounded-lg bg-surface p-0">
            {live.map((r) => (
              <RequestRow key={r.requestId} r={r} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

// 숫자 하나와 행동 하나. 이름은 위, 숫자는 왼쪽 아래, 버튼은 오른쪽 아래.
// 숫자와 버튼을 같은 줄 양끝에 둬서 무게가 왼쪽에 몰리지 않고, 카드 세 개의 버튼이 같은 높이에 선다
function TaskCard({ label, value, unit, note, action }: { label: string; value: number; unit: string; note: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface px-6 py-6">
      <span className="text-label text-ink-2">{label}</span>
      <div className="mt-auto flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={cn('text-number tabular-nums', value === 0 && 'text-ink-3')}>
            {value}
            <span className="ml-0.5 text-body font-normal text-ink-3">{unit}</span>
          </span>
          {/* 설명이 없는 카드도 숫자 줄 높이를 맞춘다 */}
          <span className="min-h-5 text-caption text-ink-3">{note}</span>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

function Due({ closesAt }: { closesAt: string }) {
  const dDay = daysUntil(closesAt)
  const overdue = isPastDue(closesAt)
  return (
    <MetaList
      className="tabular-nums"
      items={[
        `마감 ${formatDue(closesAt)}`,
        <span key="d" className={cn((overdue || dDay <= 3) && 'font-semibold text-danger-text')}>
          {dDayText(dDay, overdue)}
        </span>,
      ]}
    />
  )
}

// 진행 중 요청 한 줄: 제목과 마감, 오른쪽에 제출 인원. 상태별 숫자는 위 카드와 제출 현황에서 본다
function RequestRow({ r }: { r: DashboardRequest }) {
  const done = r.targetCount - r.notSubmitted
  return (
    <li className="border-b border-line-subtle last:border-b-0">
      <Link
        to={`/manager/requests/${r.requestId}`}
        className="group flex items-center gap-4 px-6 py-4 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-strong">{r.title}</span>
          <span className="text-caption text-ink-3">
            <Due closesAt={r.closesAt} />
          </span>
          {/* 휴대폰: 제목이 잘리지 않게 제출 인원은 아래 줄로 */}
          <span className="text-caption text-ink-3 tabular-nums md:hidden">
            제출 <span className="text-ink">{done}</span> / {r.targetCount}명
          </span>
        </span>
        <span className="hidden shrink-0 text-caption text-ink-3 tabular-nums md:block">
          제출 <span className="text-body text-ink">{done}</span> / {r.targetCount}명
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
      </Link>
    </li>
  )
}
