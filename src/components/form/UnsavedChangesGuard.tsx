import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmDialog } from '../ui/ConfirmDialog'

// 저장하지 않은 내용이 있으면 창 닫기·새로고침(브라우저 경고)과 화면 이동(확인 창)을 한 번 묻는다.
// 저장이 아닌 경우(예: 한 번만 받을 수 있는 파일)는 제목, 본문, 버튼 이름을 바꿔 쓴다
type Props = { when: boolean; title?: string; message?: string; confirmLabel?: string }

export function UnsavedChangesGuard({ when, title = '저장하지 않고 나가기', message = '저장하지 않은 내용은 사라져요.', confirmLabel = title }: Props) {
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
      title={title}
      confirmLabel={confirmLabel}
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    >
      {message}
    </ConfirmDialog>
  )
}
