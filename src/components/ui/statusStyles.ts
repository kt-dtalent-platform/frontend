import type { SubmissionStatus } from '../../api/types'

// 점 + 글자. 미제출만 빈 점(모양으로도 구분).
export const submissionStatusStyles: Record<SubmissionStatus, { label: string; box: string; dot: string }> = {
  NOT_SUBMITTED: { label: '미제출', box: 'border border-line text-neutral-text', dot: 'border-[1.5px] border-neutral-dot' },
  DRAFT: { label: '작성 중', box: 'bg-neutral-bg text-neutral-text', dot: 'bg-neutral-dot' },
  SUBMITTED: { label: '검토 대기', box: 'bg-info-bg text-info-text', dot: 'bg-info-dot' },
  // 재제출도 담당자 검토를 기다리는 상태라 같은 이름으로 보인다(백엔드 확인 필요)
  RESUBMITTED: { label: '검토 대기', box: 'bg-info-bg text-info-text', dot: 'bg-info-dot' },
  REVISION_REQUIRED: { label: '보완 필요', box: 'bg-warning-bg text-warning-text', dot: 'bg-warning-dot' },
  CONFIRMED: { label: '확인 완료', box: 'bg-success-bg text-success-text', dot: 'bg-success-dot' },
}

// 상태 점만 따로 쓸 때(대시보드 범례)
export const statusDot = (status: SubmissionStatus) => submissionStatusStyles[status].dot
