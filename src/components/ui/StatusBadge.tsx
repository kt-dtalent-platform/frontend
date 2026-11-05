import type { SubmissionStatus } from '../../api/types'
import { cn } from '../../lib/cn'

// 점 + 글자. 미제출만 빈 점(모양으로도 구분).
const styles: Record<SubmissionStatus, { label: string; box: string; dot: string }> = {
  NOT_SUBMITTED: { label: '미제출', box: 'border border-line text-neutral-text', dot: 'border-[1.5px] border-neutral-dot' },
  DRAFT: { label: '작성 중', box: 'bg-neutral-bg text-neutral-text', dot: 'bg-neutral-dot' },
  SUBMITTED: { label: '검토 대기', box: 'bg-info-bg text-info-text', dot: 'bg-info-dot' },
  REVISION_REQUIRED: { label: '보완 필요', box: 'bg-warning-bg text-warning-text', dot: 'bg-warning-dot' },
  CONFIRMED: { label: '확인 완료', box: 'bg-success-bg text-success-text', dot: 'bg-success-dot' },
}

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const s = styles[status]
  return (
    <span
      className={cn('inline-flex h-badge-h items-center gap-1.5 rounded-sm px-2 text-overline tracking-normal', s.box, className)}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
