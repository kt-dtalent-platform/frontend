import type { SubmissionStatus } from '../../api/types'
import { cn } from '../../lib/cn'
import { submissionStatusStyles as styles } from './statusStyles'

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  // 모르는 값이 오면 회색으로 원래 값을 보여 준다
  const s = styles[status] ?? { label: status, box: 'bg-neutral-bg text-neutral-text', dot: 'bg-neutral-dot' }
  return (
    <span className={cn('inline-flex h-badge-h items-center gap-1.5 rounded-sm px-2 text-overline tracking-normal', s.box, className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
