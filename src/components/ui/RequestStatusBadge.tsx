import type { RequestStatus } from '../../api/manager'
import { cn } from '../../lib/cn'

// 제출 요청의 상태. 장학생 제출 상태(StatusBadge)와 같은 모양(점 + 글자)을 쓴다.
const styles: Record<RequestStatus, { label: string; box: string; dot: string }> = {
  DRAFT: { label: '작성 중', box: 'bg-neutral-bg text-neutral-text', dot: 'bg-neutral-dot' },
  IN_PROGRESS: { label: '진행 중', box: 'bg-info-bg text-info-text', dot: 'bg-info-dot' },
  CLOSED: { label: '마감', box: 'border border-line text-neutral-text', dot: 'bg-neutral-dot' },
}

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const s = styles[status]
  return (
    <span className={cn('inline-flex h-badge-h items-center gap-1.5 rounded-sm px-2 text-overline tracking-normal', s.box, className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
