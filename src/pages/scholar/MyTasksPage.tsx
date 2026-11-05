import { ChevronRight } from 'lucide-react'
import { useMyTasks } from '../../api/tasks'
import { PageTitle } from '../../components/ui/PageTitle'
import { StatusBadge } from '../../components/ui/StatusBadge'

const dateFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// S01 내 할 일. 지금은 목록이 목업과 연결되는지만 확인하는 단계.
export function MyTasksPage() {
  const { data, isPending, isError, refetch } = useMyTasks('ALL')

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>내 할 일</PageTitle>

      {isPending && <p className="text-caption text-ink-3">불러오는 중</p>}
      {isError && (
        <button type="button" onClick={() => refetch()} className="self-start text-label underline">
          목록을 불러오지 못했어요. 다시 시도
        </button>
      )}

      {data && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.items.map((task) => (
            <li key={task.requestId} className="rounded-lg border border-line bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                  <StatusBadge status={task.status} className="self-start" />
                  <h2 className="m-0 text-title-2">{task.title}</h2>
                  <p className="m-0 text-caption text-ink-3 tabular-nums">
                    마감 {dateFmt.format(new Date(task.dueAt))}
                    {task.dDay >= 0 && ` · D-${task.dDay}`}
                  </p>
                </div>
                <ChevronRight size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-ink-3" aria-hidden />
              </div>
              {task.revisionReason && (
                <p className="m-0 mt-4 rounded-md bg-warning-bg px-4 py-3 text-label font-normal text-warning-text">
                  {task.revisionReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
