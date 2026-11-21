import type { ScholarStatus } from '../../api/scholars'
import { cn } from '../../lib/cn'

// 장학생 상태. 다른 상태 배지와 같은 모양(점 + 글자)
// 대부분인 재학은 회색 바탕에 파란 점, 예외인 중단만 주황 바탕(11/13)
// 휴학은 돌아올 재학생이라 재학과 같은 파란색을 쓰되 속이 빈 점으로 구분한다(11/17)
const styles: Record<ScholarStatus, { label: string; box: string; dot: string }> = {
  ENROLLED: { label: '재학', box: 'bg-neutral-bg text-neutral-text', dot: 'bg-info-dot' },
  LEAVE: { label: '휴학', box: 'bg-neutral-bg text-neutral-text', dot: 'border border-info-dot' },
  COMPLETED: { label: '수료', box: 'bg-neutral-bg text-neutral-text', dot: 'bg-neutral-dot' },
  WITHDRAWN: { label: '중단', box: 'bg-warning-bg text-warning-text', dot: 'bg-warning-dot' },
}

export function ScholarStatusBadge({ status }: { status: ScholarStatus }) {
  // 모르는 값이 오면 명단이 깨지지 않게 값 그대로 회색으로 보인다
  const s = styles[status] ?? { label: status, box: 'bg-neutral-bg text-neutral-text', dot: 'bg-neutral-dot' }
  return (
    <span className={cn('inline-flex h-badge-h shrink-0 items-center gap-1.5 rounded-sm px-2 text-overline tracking-normal whitespace-nowrap', s.box)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
