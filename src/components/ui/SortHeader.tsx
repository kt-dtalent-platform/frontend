import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { nextSort, type Sort } from '../../lib/sort'

type Props = { label: string; sortKey: string; sort: Sort; onSort: (next: Sort) => void; className?: string; disabled?: boolean; align?: 'start' | 'end' }

// 목록 머리의 열 이름. 누르면 그 열로 정렬한다.
// align='end': 오른쪽 정렬 열(숫자, 날짜). 화살표를 글자 왼쪽에 둬서 글자 끝이 값의 끝과 맞는다
export function SortHeader({ label, sortKey, sort, onSort, className, disabled, align = 'start' }: Props) {
  const dir = sort?.key === sortKey ? sort.dir : null
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
  const state = dir === 'asc' ? '오름차순으로 정렬됨' : dir === 'desc' ? '내림차순으로 정렬됨' : '정렬 안 됨'
  return (
    <span className={className}>
      <button
        type="button"
        // disabled를 쓰면 누른 버튼이 바로 비활성이 되어 포커스가 사라진다. 불러오는 동안은 누름만 무시한다
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onSort(nextSort(sort, sortKey))}
        aria-label={`${label}, ${state}`}
        className={cn(
          // 바탕 없이 글자색과 화살표로만 상태를 보인다. 표 머리 글자 줄 높이를 그대로 둬서 행 높이가 바뀌지 않게 한다
          'group inline-flex cursor-pointer items-center gap-1 rounded-xs text-caption hover:text-ink aria-disabled:cursor-default',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          dir ? 'font-semibold text-ink' : 'text-ink-3',
          align === 'end' && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon size={14} strokeWidth={2} aria-hidden className={cn(!dir && 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')} />
      </button>
    </span>
  )
}
