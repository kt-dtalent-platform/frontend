import { Link } from 'react-router'
import { KtSquare } from './KtSquare'

// 자체 제작 임시 로고. 재단 확인 후 교체. to가 있으면 첫 화면으로 가는 링크.
export function Logo({ to }: { to?: string }) {
  const body = (
    <>
      KT 디지털인재장학생
      <KtSquare />
    </>
  )
  const cls = 'inline-flex items-center gap-2 text-label font-extrabold tracking-tight text-ink no-underline'
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  )
}
