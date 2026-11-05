import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useMe } from '../../api/auth'
import { Button } from './Button'

// 상단 바 오른쪽: 이름 · 소속 + 로그아웃
export function UserMenu() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  if (!me) return null
  const sub = me.cohort?.name ?? '담당자'

  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-ink-3">
        <span className="font-semibold text-ink-2">{me.name}</span> · {sub}
      </span>
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
