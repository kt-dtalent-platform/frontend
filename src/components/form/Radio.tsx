import type { ComponentProps, Ref } from 'react'
import { cn } from '../../lib/cn'

type Props = Omit<ComponentProps<'input'>, 'type'> & { ref?: Ref<HTMLInputElement> }

// 라디오 버튼. Checkbox와 같은 이유로 직접 그린다(Safari와 Chrome 모양 통일).
// 원 16px, 고르면 action 테두리 안에 점. 누르는 영역은 감싸는 label이 넓혀 준다.
export function Radio({ className, ref, ...props }: Props) {
  return (
    <span className={cn('relative inline-flex size-4 shrink-0', className)}>
      <input
        ref={ref}
        type="radio"
        className={cn(
          'peer m-0 size-4 cursor-pointer appearance-none rounded-full border border-line-control bg-surface transition-colors',
          'checked:border-action hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'aria-invalid:border-danger-line disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken',
        )}
        {...props}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 m-auto hidden size-2 rounded-full bg-action peer-checked:block peer-disabled:bg-line" />
    </span>
  )
}
