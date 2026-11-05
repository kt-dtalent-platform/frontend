import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  open: boolean
  title: string // 행동 이름
  children: ReactNode // 무엇이 바뀌는지 한두 줄
  confirmLabel: string // 제목과 같은 동사
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

// 디자인 시스템 › Dialog. 브라우저 기본 <dialog>를 써서 포커스 가두기와 Esc 닫기를 맡긴다.
// 열리면 취소 버튼에 포커스(입력칸이 없을 때), 닫히면 브라우저가 이전 포커스로 돌려준다.
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = '취소', onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Esc로 닫으면 취소로 처리
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      // 바깥(뒤 배경)을 누르면 취소
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      className="mx-4 my-auto w-auto max-w-dialog-w rounded-lg md:mx-auto md:w-full bg-surface p-0 text-ink shadow-dialog backdrop:bg-scrim"
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 id={titleId} className="m-0 text-title-2">
          {title}
        </h2>
        <p id={bodyId} className="m-0 text-body text-ink-2">
          {children}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
