import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useLogout } from '../api/auth'
import { FullPageLoading } from '../components/ui/StateView'

// 로그아웃은 주소 이동으로 처리한다. 그래야 작성 중인 화면이 "저장하지 않고 나가기"를 먼저 물을 수 있다.
export function LogoutPage() {
  const logout = useLogout()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // 개발 모드에서 effect가 두 번 도는 것 방지
    started.current = true
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }, [logout, navigate])

  return <FullPageLoading />
}
