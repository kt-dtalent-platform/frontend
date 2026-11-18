import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'
import { Button } from './Button'
import { currentOpener, returnFocus } from '../../lib/focusReturn'

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

  // 닫히면 연 버튼으로 포커스를 돌려준다. 조건부로 그려 화면에서 빠질 때도 같다(Chrome, Safari는 이때 돌려주지 않음).
  // Safari는 누른 버튼에 포커스를 주지 않아 마지막으로 누른 요소로 대신한다(lib/focusReturn)
  const opener = useRef<HTMLElement | null>(open ? currentOpener() : null)
  useEffect(
    () => () => {
      const d = ref.current
      if (d) returnFocus(d, opener.current)
      else if (opener.current?.isConnected) opener.current.focus()
    },
    [],
  )

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      opener.current ??= currentOpener()
      d.showModal()
      d.querySelector<HTMLElement>('input, textarea, select')?.focus()
    } else if (!open && d.open) {
      d.close()
      returnFocus(d, opener.current)
      opener.current = null
    }
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // body로 뺀(포털) 대화상자도 React 이벤트는 부모 폼으로 올라간다. 바깥 폼이 같이 제출되지 않게 막는다
    e.stopPropagation()
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
      className="mx-4 my-auto w-auto max-w-dialog-w rounded-lg bg-surface p-0 text-ink shadow-dialog backdrop:bg-scrim open:animate-dialog-in backdrop:animate-fade-in md:mx-auto md:w-full"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="m-0 text-title-2">
          {title}
        </h2>
        {children}
        {/* 내용이 길어 대화상자가 스크롤되면(휴대폰) 버튼은 아래에 붙어 있게 한다 */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 flex justify-end gap-2 bg-surface px-6 pt-3 pb-6">
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
