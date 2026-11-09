import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

// 짧은 정보 여러 개를 구분 기호 없이 간격으로 나눠 한 줄에 놓는다. 좁으면 다음 줄로 넘어간다.
// oneLine: 줄을 넘기지 않고 마지막 항목을 말줄임(…)으로 자른다(목록 행처럼 높이를 맞춰야 할 때)
export function MetaList({ items, className, oneLine }: { items: ReactNode[]; className?: string; oneLine?: boolean }) {
  const shown = items.filter((x) => x !== null && x !== undefined && x !== false && x !== '')
  if (shown.length === 0) return null
  return (
    <span className={cn('inline-flex items-baseline gap-x-3 gap-y-0.5', oneLine ? 'max-w-full min-w-0 flex-nowrap' : 'flex-wrap', className)}>
      {shown.map((x, i) => (
        <span key={i} className={cn(oneLine && (i === shown.length - 1 ? 'min-w-0 truncate' : 'shrink-0'))}>
          {x}
        </span>
      ))}
    </span>
  )
}
