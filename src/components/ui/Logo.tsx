import { KtSquare } from './KtSquare'

// 자체 제작 임시 로고. 재단 확인 후 교체.
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-label font-extrabold tracking-tight text-ink">
      KT 디지털인재장학생
      <KtSquare />
    </span>
  )
}
