import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

// 색은 바탕, 아이콘, 제목에만. 설명 글은 본문 색(ink-2)으로 둬서 긴 글이 전부 색 글자로 보이지 않게 한다(11/15)
const tones: Record<string, { box: string; accent: string; icon: LucideIcon; role: 'status' | 'alert' }> = {
  warning: { box: 'bg-warning-bg', accent: 'text-warning-text', icon: CircleAlert, role: 'status' },
  danger: { box: 'bg-danger-bg', accent: 'text-danger-text', icon: TriangleAlert, role: 'alert' },
  info: { box: 'bg-info-bg', accent: 'text-info-text', icon: Info, role: 'status' },
  success: { box: 'bg-success-bg', accent: 'text-success-text', icon: CircleCheck, role: 'status' },
}

type Props = { tone: 'warning' | 'danger' | 'info' | 'success'; title: ReactNode; children?: ReactNode; action?: ReactNode }

// 화면 위쪽에 두는 안내. 제목 한 줄 + 설명 + (있으면) 행동 버튼.
export function Banner({ tone, title, children, action }: Props) {
  const t = tones[tone]
  const Icon = t.icon
  return (
    <div role={t.role} className={cn('flex items-start gap-3 rounded-md p-4', t.box)}>
      <Icon size={20} strokeWidth={1.75} className={cn('mt-px shrink-0', t.accent)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn('m-0 font-bold', t.accent)}>{title}</p>
        {children && <div className="mt-1 text-ink-2">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
