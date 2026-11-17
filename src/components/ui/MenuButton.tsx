import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/cn'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass'

export type MenuItem = { to: string; label: string; description?: string }

// 누르면 고를 수 있는 항목이 펼쳐지는 버튼(메뉴 버튼). 같은 일을 하는 방법이 여럿일 때 버튼 하나로 묶는다
// 예: 장학생 등록 → 한 명 / 엑셀로 여러 명(Carbon Menu button: 같은 무게의 만들기 방법을 한곳에)
// 접근성: WAI-ARIA menu button 패턴. 버튼에서 ↓↑로 열고, 위아래 화살표·Home·End로 옮기고, Esc로 닫으면 버튼으로 돌아간다
// placement: 화면 아래에 있는 버튼이면 위로 펼친다
export function MenuButton({
  label,
  icon,
  items,
  variant = 'primary',
  size = 'compact',
  placement = 'bottom',
}: {
  label: string
  icon?: ReactNode
  items: MenuItem[]
  variant?: ButtonVariant
  size?: ButtonSize
  placement?: 'top' | 'bottom'
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  // 열릴 때 초점을 둘 항목(버튼에서 ↑를 누르면 마지막 항목)
  const [start, setStart] = useState<'first' | 'last'>('first')
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // 열리면 첫 항목(또는 마지막 항목)으로 초점을 옮긴다
  useEffect(() => {
    if (open) itemRefs.current[start === 'first' ? 0 : items.length - 1]?.focus()
  }, [open, start, items.length])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (setStart('first'), setOpen((o) => !o))}
        // APG 메뉴 버튼: ↓는 첫 항목, ↑는 마지막 항목으로 열린다
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          setStart(e.key === 'ArrowDown' ? 'first' : 'last')
          setOpen(true)
        }}
        className={buttonClass({ variant, size })}
      >
        {icon}
        {label}
        <ChevronDown size={16} strokeWidth={2} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      <ul
        id={id}
        role="menu"
        aria-label={label}
        hidden={!open}
        onKeyDown={(e) => {
          const i = itemRefs.current.findIndex((el) => el === document.activeElement)
          if (e.key === 'Escape') {
            e.preventDefault()
            close()
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const step = e.key === 'ArrowDown' ? 1 : -1
            itemRefs.current[(i + step + items.length) % items.length]?.focus()
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault()
            itemRefs.current[e.key === 'Home' ? 0 : items.length - 1]?.focus()
          } else if (e.key === 'Tab') setOpen(false)
        }}
        className={cn(
          'absolute right-0 z-(--z-popover) m-0 w-64 list-none rounded-md bg-surface p-1 shadow-pop',
          placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
        )}
      >
        {items.map((item, i) => (
          <li key={item.to} role="none">
            <Link
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              role="menuitem"
              // 항목은 화살표로만 옮겨 다닌다(Tab 순서에서 뺀다)
              tabIndex={-1}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex flex-col gap-0.5 rounded-sm px-3 py-2 text-ink no-underline outline-none hover:bg-control-tonal-hover focus-visible:bg-control-tonal-hover"
            >
              <span className="text-label">{item.label}</span>
              {item.description && <span className="text-caption text-ink-3">{item.description}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
