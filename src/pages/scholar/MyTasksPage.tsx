import { useState } from 'react'
import { ChevronRight, Inbox } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useMySubmissionHistory, useMyTasks, type MyTask, type SubmissionHistory } from '../../api/tasks'
import { FilterChips } from '../../components/ui/FilterChips'
import { MetaList } from '../../components/ui/MetaList'
import { PageTitle } from '../../components/ui/PageTitle'
import { RevisionNote } from '../../components/ui/RevisionNote'
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
  // 카드가 차례로 나타나는 모션은 화면에 처음 들어올 때만. 칩을 바꿀 때는 움직이지 않는다(자주 하는 조작)
  const [firstView] = useState(view)
  const [switched, setSwitched] = useState(false)
  if (!switched && view !== firstView) setSwitched(true)
  const tasks = useMyTasks()
  // 끝난 일은 내 제출 이력에서 가져온다(마감된 요청도 포함). 해야 할 일에 있는 요청은 뺀다(보완 필요)
  const history = useMySubmissionHistory()
  usePageTitle('내 할 일')
  const todo = tasks.data?.filter((t) => !t.done) ?? []
  const todoIds = new Set(todo.map((t) => t.requestId))
  const done = tasks.data && history.data ? history.data.filter((h) => !todoIds.has(h.requestId)) : undefined
  const doneCount = done?.length
  const counts = { TODO: tasks.data ? todo.length : undefined, DONE: doneCount }
  const loading = tasks.isPending || (view === 'DONE' && history.isPending)
  const failed = tasks.error ?? (view === 'DONE' ? history.error : null)
  const empty = !failed && (view === 'DONE' ? doneCount === 0 : tasks.data && todo.length === 0)

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>내 할 일</PageTitle>

      <FilterChips
        label="할 일 나누기"
        items={views.map((v) => ({ value: v.key, label: v.label, count: counts[v.key] }))}
        value={view}
        onChange={(key) => setParams(key === 'DONE' ? { view: 'done' } : {}, { replace: true })}
      />

      {loading && !failed && <LoadingCards />}
      {failed && <ErrorState error={failed} onRetry={() => (void tasks.refetch(), void history.refetch())} />}
      {empty && (
        <EmptyState title={view === 'TODO' ? '지금 해야 할 일이 없어요' : '아직 끝낸 일이 없어요'} icon={<Inbox size={24} strokeWidth={1.75} />}>
          {view === 'TODO' ? '새 요청이 열리면 여기에 보여요.' : '제출하면 여기에서 결과를 볼 수 있어요.'}
        </EmptyState>
      )}
      {!failed && view === 'TODO' && todo.length > 0 && (
        <ul className={cn('m-0 flex list-none flex-col gap-3 p-0', !switched && 'stagger-in')}>
          {todo.map((task) => (
            <li key={task.requestId}>
              <TaskCard task={task} />
            </li>
          ))}
        </ul>
      )}
      {!failed && view === 'DONE' && done && done.length > 0 && (
        <ul className={cn('m-0 flex list-none flex-col gap-3 p-0', !switched && 'stagger-in')}>
          {done.map((h) => (
            <li key={h.requestId}>
              <DoneCard item={h} />
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
            <span>마감 {formatDue(task.dueAt)}</span>
            {!done && <span className={cn((late || soon) && 'font-semibold text-warning-text')}>{dDayText(task.dDay, task.overdue)}</span>}
          </p>
        </div>
        <ChevronRight size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
      </div>
      {task.revisionReason && (
        <div className="mt-5 border-t border-line-subtle pt-4">
          <RevisionNote reason={task.revisionReason} />
        </div>
      )}
    </Link>
  )
}

// 끝난 일: 마감 대신 제출한 때와 확인된 때를 보여 준다
function DoneCard({ item }: { item: SubmissionHistory }) {
  return (
    <Link to={`/tasks/${item.requestId}`} className="group block rounded-lg bg-surface px-6 py-6 text-ink no-underline hover:bg-surface-hover md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            {item.purged && <Tag tone="neutral">서류 보관 기간 지남</Tag>}
          </div>
          <h2 className="m-0 text-title-2">{item.title}</h2>
          <MetaList
            items={[`제출 ${formatDue(item.submittedAt)}`, item.confirmedAt && `확인 ${formatDue(item.confirmedAt)}`]}
            className="flex text-caption text-ink-3 tabular-nums"
          />
        </div>
        <ChevronRight size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
      </div>
    </Link>
  )
}
