import type { ReactNode } from 'react'

// 담당자가 남긴 보완 요청 내용(11/17). 경고 상자 대신 사람이 남긴 메모처럼 이름표 + 본문 글자로만 둔다.
// 카드 안에 또 바탕색 상자를 넣지 않는다(카드 안 카드). 카드 안에서는 부르는 쪽이 구분선으로 나눈다.
// 주황은 상태 배지(보완 필요)와 마감 D-n에만 쓴다. hint는 메모 아래 덧붙이는 안내
export function RevisionNote({ reason, hint }: { reason: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-ink-3">담당자 보완 요청</span>
      <p className="m-0 text-body text-ink">{reason}</p>
      {hint && <p className="m-0 text-caption text-ink-3">{hint}</p>}
    </div>
  )
}
