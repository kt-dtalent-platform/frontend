import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  open: boolean
  title: string
  children: ReactNode
  submitLabel: string // 제목과 같은 동사
  busy?: boolean
  onSubmit: () => void
  onCancel: () => void
}

// 디자인 시스템 › Dialog 중 짧은 입력을 받는 대화상자. 열리면 첫 입력칸에 포커스.
export function FormDialog({ open, title, children, submitLabel, busy, onSubmit, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      d.querySelector<HTMLElement>('input, textarea, select')?.focus()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!busy) onSubmit()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // 브라우저가 다른 이유로 닫아도(예: 폼 method=dialog) 열림 상태를 맞춘다
      onClose={() => open && onCancel()}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      className="mx-4 my-auto w-auto max-w-dialog-w rounded-lg bg-surface p-0 text-ink shadow-dialog backdrop:bg-scrim md:mx-auto md:w-full"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="m-0 text-title-2">
          {title}
        </h2>
        {children}
        <div className="mt-2 flex justify-end gap-2">
          <Button size="default" disabled={busy} onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" variant="primary" size="default" disabled={busy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
