import { LogOut, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useMe } from '../../api/auth'
import { Button } from './Button'

// 상단 바 오른쪽: 이름, 소속 + 로그아웃. 장학생은 이름을 누르면 내 정보로 간다(11/15)
export function UserMenu() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  if (!me) return null
  const sub = me.cohort?.name ?? '담당자'
  const label = (
    <>
      <span className="font-semibold text-ink-2">{me.name}</span>
      <span>{sub}</span>
    </>
  )

  return (
    <div className="flex items-center gap-2">
      {me.role === 'SCHOLAR' ? (
        <Link
          to="/me"
          className="inline-flex h-control-compact items-center gap-2 rounded-md px-2 text-caption whitespace-nowrap text-ink-3 no-underline hover:bg-control-tonal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {/* 좁은 화면에서는 이름 대신 아이콘만 둬서 로고와 겹치지 않게 한다 */}
          <UserRound size={16} strokeWidth={2} aria-hidden className="sm:hidden" />
          <span className="sr-only sm:not-sr-only sm:inline-flex sm:gap-2">{label}</span>
          <span className="sr-only">내 정보</span>
        </Link>
      ) : (
        <span className="hidden gap-2 text-caption whitespace-nowrap text-ink-3 sm:inline-flex">{label}</span>
      )}
      <Button
        size="compact"
        variant="ghost"
        // 주소 이동이라 작성 중인 화면이면 먼저 "저장하지 않고 나가기"를 묻는다
        onClick={() => navigate('/logout')}
      >
        <LogOut size={16} strokeWidth={2} aria-hidden />
        로그아웃
      </Button>
    </div>
  )
}
