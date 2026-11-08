import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

// 상태와 별개인 표시(마감 지남, 보완 요청 항목 등). 점 없는 작은 태그.
const tones = {
  danger: 'bg-danger-bg text-danger-text',
  warning: 'bg-warning-bg text-warning-text',
  neutral: 'bg-neutral-bg text-neutral-text',
}

export function Tag({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cn('inline-flex h-tag-h items-center rounded-sm px-2 text-overline tracking-normal', tones[tone])}>{children}</span>
}
