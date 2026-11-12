import { Check, Minus } from 'lucide-react'
import { useCallback, useEffect, useRef, type ComponentProps, type Ref } from 'react'
import { cn } from '../../lib/cn'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  // 일부만 고른 상태(표 머리의 "모두 고르기")
  indeterminate?: boolean
  ref?: Ref<HTMLInputElement>
}

// 체크박스. 브라우저 기본 모양은 Safari와 Chrome이 달라서 직접 그린다.
// 보이는 상자는 16px. 누르는 영역은 감싸는 label(행, 선택지 줄)이 넓혀 준다.
export function Checkbox({ indeterminate = false, className, ref, ...props }: Props) {
  const inner = useRef<HTMLInputElement | null>(null)
  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      inner.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )
  // indeterminate는 HTML 속성이 없어 DOM 값으로만 줄 수 있다
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <span className={cn('relative inline-flex size-4 shrink-0', className)}>
      <input
        ref={setRef}
        type="checkbox"
        className={cn(
          'peer m-0 size-4 cursor-pointer appearance-none rounded-xs border border-line-control bg-surface transition-colors',
          'checked:border-action checked:bg-action indeterminate:border-action indeterminate:bg-action',
          'hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'aria-invalid:border-danger-line',
          'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken checked:disabled:border-line checked:disabled:bg-line',
        )}
        {...props}
      />
      <Check
        size={12}
        strokeWidth={3}
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto hidden text-on-action peer-checked:block peer-indeterminate:hidden"
      />
      <Minus size={12} strokeWidth={3} aria-hidden className="pointer-events-none absolute inset-0 m-auto hidden text-on-action peer-indeterminate:block" />
    </span>
  )
}
