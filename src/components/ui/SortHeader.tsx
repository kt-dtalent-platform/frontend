import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { nextSort, type Sort } from '../../lib/sort'

type Props = { label: string; sortKey: string; sort: Sort; onSort: (next: Sort) => void; className?: string; disabled?: boolean }

// 목록 머리의 열 이름. 누르면 그 열로 정렬한다
export function SortHeader({ label, sortKey, sort, onSort, className, disabled }: Props) {
  const dir = sort?.key === sortKey ? sort.dir : null
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
  const state = dir === 'asc' ? '오름차순으로 정렬됨' : dir === 'desc' ? '내림차순으로 정렬됨' : '정렬 안 됨'
  return (
    <span className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSort(nextSort(sort, sortKey))}
        aria-label={`${label}, ${state}`}
        className={cn(
          'group -mx-1.5 inline-flex h-control-compact cursor-pointer items-center gap-1 rounded-sm px-1.5 text-caption hover:bg-control-tonal-hover hover:text-ink disabled:cursor-default',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          dir ? 'font-semibold text-ink' : 'text-ink-3',
        )}
      >
        {label}
        <Icon size={14} strokeWidth={2} aria-hidden className={cn(!dir && 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')} />
      </button>
    </span>
  )
}
