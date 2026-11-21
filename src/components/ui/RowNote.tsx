import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

// 목록 행의 비고 한 줄(마감 후, 서류와 다름, 잠김 같은 보조 표시).
// 바탕을 칠하지 않고 아이콘과 작은 글자로만 둔다. 행에서 바탕이 있는 건 상태 배지 하나뿐이라 눈이 상태부터 간다
export function RowNote({ icon: Icon, tone = 'neutral', children }: { icon: LucideIcon; tone?: 'neutral' | 'warning'; children: ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 text-caption whitespace-nowrap', tone === 'warning' ? 'text-warning-text' : 'text-ink-3')}>
      <Icon size={14} strokeWidth={2} aria-hidden />
      {children}
    </span>
  )
}
