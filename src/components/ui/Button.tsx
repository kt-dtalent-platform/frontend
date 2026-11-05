import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary'
type Size = 'compact' | 'default' | 'md' | 'cta'

const variants: Record<Variant, string> = {
  // 주요 버튼은 화면에 하나.
  primary: 'bg-action text-on-action hover:bg-action-hover active:bg-gray-600',
  secondary: 'border border-line-control bg-surface text-ink hover:bg-gray-50 active:bg-gray-150',
}

const sizes: Record<Size, string> = {
  compact: 'h-control-compact px-3 text-label',
  default: 'h-control-default px-4 text-label',
  md: 'h-control-h px-5 text-label',
  cta: 'h-control-cta px-6 text-label',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap transition-colors',
        // 비활성은 흐리게(opacity) 하지 않고 회색 면으로 바꾼다.
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-150 disabled:text-ink-disabled',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
