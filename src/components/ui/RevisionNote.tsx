import type { ReactNode } from 'react'

// 담당자가 남긴 보완 요청 내용. 경고 상자가 아니라 사람이 남긴 메모처럼 보이게 회색 바탕에 본문 색 글자로 둔다(11/17).
// 주황은 상태 배지(보완 필요)와 마감 D-n에만 쓴다. hint는 메모 아래 덧붙이는 안내(예: 표시된 항목만 고칠 수 있어요)
export function RevisionNote({ reason, hint }: { reason: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface-sunken px-4 py-3">
      <span className="text-caption text-ink-3">담당자 보완 요청</span>
      <p className="m-0 text-body text-ink">{reason}</p>
      {hint && <p className="m-0 text-caption text-ink-3">{hint}</p>}
    </div>
  )
}
