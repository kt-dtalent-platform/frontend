import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'

export type FieldA11y = { id: string; 'aria-invalid': boolean; 'aria-required'?: boolean; 'aria-describedby'?: string }

// 라벨 + 입력칸 + 도움말/오류. 입력칸에 id·aria 속성을 넘겨준다.
export function LabeledField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: (props: FieldA11y) => ReactNode
}) {
  const id = useId()
  const describedBy = [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {required && <RequiredMark />}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-required': required || undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="m-0 text-caption text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="m-0 text-caption text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}

export function RequiredMark() {
  return (
    <>
      <span className="ml-0.5 text-kt-red-text" aria-hidden>
        *
      </span>
      <span className="sr-only">(필수)</span>
    </>
  )
}

// 기본 select 오른쪽에 펼침 아이콘
export function SelectBox({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
}
