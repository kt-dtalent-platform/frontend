import type { ScholarStatus } from '../../api/scholars'
import { cn } from '../../lib/cn'

// 장학생 상태. 다른 상태 배지와 같은 모양(점 + 글자)
const styles: Record<ScholarStatus, { label: string; box: string; dot: string }> = {
  ENROLLED: { label: '재학', box: 'bg-info-bg text-info-text', dot: 'bg-info-dot' },
  LEAVE: { label: '휴학', box: 'bg-warning-bg text-warning-text', dot: 'bg-warning-dot' },
  GRADUATED: { label: '졸업', box: 'bg-neutral-bg text-neutral-text', dot: 'bg-neutral-dot' },
  WITHDRAWN: { label: '중단', box: 'border border-line text-neutral-text', dot: 'bg-neutral-dot' },
}

export function ScholarStatusBadge({ status }: { status: ScholarStatus }) {
  const s = styles[status]
  return (
    <span className={cn('inline-flex h-badge-h items-center gap-1.5 rounded-sm px-2 text-overline tracking-normal', s.box)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
