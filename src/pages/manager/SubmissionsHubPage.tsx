import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useRequests } from '../../api/manager'
import { PageTitle } from '../../components/ui/PageTitle'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'
import { RequestMeta } from './RequestSubmissionsPage'

// 메뉴 "제출 현황": 진행 중인 요청을 골라 그 요청의 제출 현황으로 들어간다
export function SubmissionsHubPage() {
  usePageTitle('제출 현황')
  const query = useRequests({ status: 'IN_PROGRESS', page: 1 })
  const items = query.data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageTitle description="진행 중인 요청">제출 현황</PageTitle>
      {query.isPending && <LoadingCards count={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && items.length === 0 && <EmptyState title="진행 중인 요청이 없어요">요청을 공개하면 여기에서 제출을 확인할 수 있어요.</EmptyState>}
      {items.length > 0 && (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg bg-surface p-0">
          {items.map((r) => (
            <li key={r.id} className="border-b border-line-subtle last:border-b-0">
              <Link
                to={`/manager/requests/${r.id}`}
                className="group flex items-center gap-4 px-6 py-4 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body-strong">{r.title}</span>
                  <span className="text-caption text-ink-3 tabular-nums">
                    <RequestMeta cohortName={r.cohortName} closesAt={r.closesAt} />
                  </span>
                </span>
                <span className="shrink-0 text-right text-caption text-ink-3 tabular-nums">
                  제출 <span className="text-body text-ink">{r.submittedCount}</span> / {r.targetCount}
                  {r.revisionCount > 0 && <span className={cn('block font-semibold text-warning-text')}>보완 필요 {r.revisionCount}</span>}
                </span>
                <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
