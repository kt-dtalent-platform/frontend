import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmDialog } from '../ui/ConfirmDialog'

// 저장하지 않은 내용이 있으면 창 닫기·새로고침(브라우저 경고)과 화면 이동(확인 창)을 한 번 묻는다.
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // 예전 Safari·Chrome용
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname)

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="저장하지 않고 나가기"
      confirmLabel="저장하지 않고 나가기"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    >
      저장하지 않은 내용은 사라져요.
    </ConfirmDialog>
  )
}
