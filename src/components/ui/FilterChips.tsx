import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Item<T> = { value: T; label: string; count?: number }

// 목록을 나누는 칩 묶음(내 할 일, 요청 관리). 누른 칩은 aria-pressed로 알린다.
export function FilterChips<T>({ label, items, value, onChange }: { label: string; items: Item<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'h-control-compact rounded-full border px-3 text-label',
              active ? 'border-action bg-action text-on-action' : 'border-line-control bg-surface text-ink hover:bg-surface-hover active:bg-surface-sunken',
            )}
          >
            {item.label}
            {item.count !== undefined && <Count>{item.count}</Count>}
          </button>
        )
      })}
    </div>
  )
}

const Count = ({ children }: { children: ReactNode }) => <span className="ml-1 tabular-nums opacity-70">{children}</span>
