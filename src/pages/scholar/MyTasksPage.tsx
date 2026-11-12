import { ChevronRight, Inbox } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useMyTasks, type MyTask } from '../../api/tasks'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tag } from '../../components/ui/Tag'
import { cn } from '../../lib/cn'
import { dDayText, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'

const views = [
  { key: 'TODO', label: '해야 할 일' },
  { key: 'DONE', label: '끝난 일' },
] as const

// S01 내 할 일
export function MyTasksPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'done' ? 'DONE' : 'TODO'
  const { data, isPending, isError, error, refetch } = useMyTasks()
  usePageTitle('내 할 일')
  const todo = data?.filter((t) => !t.done) ?? []
  const done = data?.filter((t) => t.done) ?? []
  const items = view === 'DONE' ? done : todo
  const counts = { TODO: todo.length, DONE: done.length }

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>내 할 일</PageTitle>

      <FilterChips
        label="할 일 나누기"
        items={views.map((v) => ({ value: v.key, label: v.label, count: data ? counts[v.key] : undefined }))}
        value={view}
        onChange={(key) => setParams(key === 'DONE' ? { view: 'done' } : {}, { replace: true })}
      />

      {isPending && <LoadingCards />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && items.length === 0 && (
        <EmptyState title={view === 'TODO' ? '지금 해야 할 일이 없어요' : '아직 끝낸 일이 없어요'} icon={<Inbox size={24} strokeWidth={1.75} />}>
          {view === 'TODO' ? '새 요청이 열리면 여기에 보여요.' : '제출하면 여기에서 결과를 볼 수 있어요.'}
        </EmptyState>
      )}
      {data && items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((task) => (
            <li key={task.requestId}>
              <TaskCard task={task} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: MyTask }) {
  const { done } = task
  const late = !done && task.overdue
  const soon = !done && !task.overdue && task.dDay <= 3

  return (
    <Link to={`/tasks/${task.requestId}`} className="group block rounded-lg bg-surface px-6 py-6 text-ink no-underline hover:bg-surface-hover md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            {late && <Tag tone="warning">마감 지남</Tag>}
          </div>
          <h2 className="m-0 text-title-2">{task.title}</h2>
          <p className="m-0 flex gap-3 text-caption text-ink-3 tabular-nums">
            <span>마감 {formatDue(task.requestDueAt)}</span>
            {!done && <span className={cn((late || soon) && 'font-semibold text-warning-text')}>{dDayText(task.dDay, task.overdue)}</span>}
          </p>
        </div>
        <ChevronRight size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
      </div>
      {task.revisionReason && (
        <div className="mt-4 flex flex-col gap-1 rounded-md bg-warning-bg px-4 py-3 text-warning-text">
          <span className="font-semibold">보완 사유</span>
          <span>{task.revisionReason}</span>
        </div>
      )}
    </Link>
  )
}
