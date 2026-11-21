import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Item<T> = { value: T; label: string; count?: number }

// 목록을 나누는 칩 묶음(내 할 일, 요청 관리). 누른 칩은 aria-pressed로 알린다.
export function FilterChips<T>({ label, items, value, onChange }: { label: string; items: Item<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -my-1 flex min-w-0 gap-2 overflow-x-auto py-1">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              // 고르지 않은 칩도 버튼처럼 테두리 없이 연한 바탕(11/12)
              'press h-control-compact shrink-0 rounded-full px-3 text-label-sm whitespace-nowrap',
              active ? 'bg-action text-on-action' : 'bg-control-tonal text-ink hover:bg-control-tonal-hover active:bg-control-tonal-active',
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
