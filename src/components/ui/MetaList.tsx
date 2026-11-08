import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

// 짧은 정보 여러 개를 구분 기호 없이 간격으로 나눠 한 줄에 놓는다. 좁으면 다음 줄로 넘어간다.
export function MetaList({ items, className }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter((x) => x !== null && x !== undefined && x !== false && x !== '')
  if (shown.length === 0) return null
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-3 gap-y-0.5', className)}>
      {shown.map((x, i) => (
        <span key={i}>{x}</span>
      ))}
    </span>
  )
}
