import type { ScholarStatus } from '../../api/scholars'
import { cn } from '../../lib/cn'

// 장학생 상태. 다른 상태 배지와 같은 모양(점 + 글자)
// 대부분인 재학은 회색 바탕에 파란 점, 예외인 중단만 주황 바탕(11/13)
// 휴학은 돌아올 재학생이라 재학과 같은 파란색을 쓰되 속이 빈 점으로 구분한다(11/17)
const styles: Record<ScholarStatus, { label: string; bg: string; text: string; dot: string }> = {
  ENROLLED: { label: '재학', bg: 'bg-neutral-bg', text: 'text-neutral-text', dot: 'bg-info-dot' },
  LEAVE: { label: '휴학', bg: 'bg-neutral-bg', text: 'text-neutral-text', dot: 'border border-info-dot' },
  COMPLETED: { label: '수료', bg: 'bg-neutral-bg', text: 'text-neutral-text', dot: 'bg-neutral-dot' },
  WITHDRAWN: { label: '중단', bg: 'bg-warning-bg', text: 'text-warning-text', dot: 'bg-warning-dot' },
}

// plain: 바탕 없이 점과 글자만. 휴대폰 명단 행 오른쪽처럼 아래에 회색 글자(수료 연도, 중단 사유)를 쌓을 때 쓴다.
// 상자와 맨 글자를 위아래로 쌓으면 둘이 따로 놀아 보여서, 그 자리는 글자끼리 쌓는다(Apple 목록 행의 오른쪽 글자와 같은 방식)
export function ScholarStatusBadge({ status, plain }: { status: ScholarStatus; plain?: boolean }) {
  // 모르는 값이 오면 명단이 깨지지 않게 값 그대로 회색으로 보인다
  const s = styles[status] ?? { label: status, bg: 'bg-neutral-bg', text: 'text-neutral-text', dot: 'bg-neutral-dot' }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap',
        plain ? 'text-label font-semibold' : 'h-badge-h rounded-sm px-2 text-overline tracking-normal',
        !plain && s.bg,
        s.text,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
