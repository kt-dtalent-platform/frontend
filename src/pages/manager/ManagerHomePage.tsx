import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { useManagerDashboard, type DashboardRequest, type ManagerDashboard } from '../../api/manager'
import { daysUntil, isPastDue } from '../../api/tasks'
import { buttonClass } from '../../components/ui/buttonClass'
import { MetaList } from '../../components/ui/MetaList'
import { PageTitle } from '../../components/ui/PageTitle'
import { statusDot } from '../../components/ui/statusStyles'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { dDayText, formatDue } from '../../lib/format'
import { TIME_ZONE, toDate } from '../../lib/time'
import { usePageTitle } from '../../lib/usePageTitle'

const today = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, month: 'long', day: 'numeric', weekday: 'long' })

// A08 담당자 대시보드: 지금 할 일(검토 시작) → 진행 중 요청의 진행 상황
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
  return (
    <>
      <ReviewCard review={data.review} />
      <section aria-labelledby={`${id}-requests`} className="flex flex-col gap-4">
        <h2 id={`${id}-requests`} className="m-0 text-title-2">
          진행 중인 요청
        </h2>
        {data.requests.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-lg bg-surface px-6 py-8">
            <p className="m-0 text-ink-3">진행 중인 요청이 없어요.</p>
            <Link to="/manager/requests/new" className={buttonClass({ size: 'default' })}>
              요청 만들기
            </Link>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {data.requests.map((r) => (
              <RequestProgress key={r.requestId} r={r} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

// 기다린 시간: 3시간째, 2일째
function waitedText(iso: string) {
  const hours = Math.max(0, Math.floor((Date.now() - toDate(iso).getTime()) / 3_600_000))
  return hours < 24 ? `${Math.max(1, hours)}시간째` : `${Math.floor(hours / 24)}일째`
}

// 지금 할 일: 검토 대기 건수와 가장 오래 기다린 제출부터 여는 버튼
function ReviewCard({ review }: { review: ManagerDashboard['review'] }) {
  const has = review.waiting > 0 && review.oldestSubmissionId !== null
  return (
    <section aria-label="검토 대기" className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
      <div className="flex flex-col gap-1">
        <span className="text-label text-ink-2">검토 대기</span>
        {has ? (
          <>
            <span className="text-number tabular-nums">
              {review.waiting}
              <span className="ml-0.5 text-body font-normal text-ink-3">건</span>
            </span>
            <MetaList
              className="text-caption text-ink-3"
              items={[
                review.resubmitted > 0 && `보완 후 다시 제출 ${review.resubmitted}건 포함`,
                review.oldestSubmittedAt && `가장 오래된 제출 ${waitedText(review.oldestSubmittedAt)} 기다리는 중`,
              ]}
            />
          </>
        ) : (
          <span className="text-body text-ink-3">검토할 제출이 없어요.</span>
        )}
      </div>
      {has && (
        <Link to={`/manager/submissions/${review.oldestSubmissionId}`} className={buttonClass({ variant: 'primary', size: 'md', className: 'md:self-center' })}>
          검토 시작
        </Link>
      )}
    </section>
  )
}

const segments = [
  { key: 'confirmed', label: '확인 완료', dot: 'bg-success-dot' },
  { key: 'waiting', label: '검토 대기', dot: 'bg-info-dot' },
  { key: 'revisionRequired', label: '보완 필요', dot: 'bg-warning-dot' },
] as const

// 요청 하나의 진행 상황: 막대(확인 완료, 검토 대기, 보완 필요, 나머지는 미제출) + 숫자 + 미제출 바로가기
function RequestProgress({ r }: { r: DashboardRequest }) {
  const dDay = daysUntil(r.closesAt)
  const overdue = isPastDue(r.closesAt)
  const pct = (n: number) => (r.targetCount ? (n / r.targetCount) * 100 : 0)
  const done = r.targetCount - r.notSubmitted
  return (
    <li className="flex flex-col gap-4 rounded-lg bg-surface px-6 py-5 md:px-8">
      <Link
        to={`/manager/requests/${r.requestId}`}
        className="group flex items-start justify-between gap-4 text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body-strong group-hover:underline">{r.title}</span>
          <MetaList
            className="text-caption text-ink-3 tabular-nums"
            items={[
              `마감 ${formatDue(r.closesAt)}`,
              <span key="d" className={cn((overdue || dDay <= 3) && 'font-semibold text-danger-text')}>
                {dDayText(dDay, overdue)}
              </span>,
            ]}
          />
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-caption text-ink-3 tabular-nums">
          <span>
            제출 <span className="text-body-strong text-ink">{done}</span> / {r.targetCount}명
          </span>
          <span>{Math.round(pct(done))}%</span>
        </div>
        {/* 화면 낭독기는 아래 숫자 목록을 읽으므로 막대는 숨긴다 */}
        <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-surface-sunken">
          {segments.map((s) => (
            <span key={s.key} className={s.dot} style={{ width: `${pct(r[s.key])}%` }} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-caption text-ink-2 tabular-nums">
          {segments.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
              {s.label} {r[s.key]}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('size-1.5 rounded-full', statusDot('NOT_SUBMITTED'))} />
            미제출 {r.notSubmitted}
          </li>
        </ul>
        {r.notSubmitted > 0 && (
          <Link
            to={`/manager/requests/${r.requestId}?status=NOT_SUBMITTED`}
            className={buttonClass({ variant: 'ghost', size: 'compact', className: '-mx-3 self-start sm:mx-0 sm:self-auto' })}
          >
            미제출 {r.notSubmitted}명 보기
          </Link>
        )}
      </div>
    </li>
  )
}
