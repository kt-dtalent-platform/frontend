import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useLogout, useMe } from '../../api/auth'
import { Button } from './Button'

// 상단 바 오른쪽: 이름 · 소속 + 로그아웃
export function UserMenu() {
  const { data: me } = useMe()
  const logout = useLogout()
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
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
      >
        <LogOut size={16} strokeWidth={2} aria-hidden />
        로그아웃
      </Button>
    </div>
  )
}
