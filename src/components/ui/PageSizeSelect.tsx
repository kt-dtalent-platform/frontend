import { ChevronDown } from 'lucide-react'
import { filterField } from '../form/fieldClass'
import { cn } from '../../lib/cn'

// 한 쪽에 몇 줄씩 볼지 고르는 칸. 목록 아래 쪽 번호 오른쪽에 둔다(MUI, Ant Design 표와 같은 자리)
// unit은 세는 말(명, 건). 고르면 첫 쪽으로 돌아간다(부르는 쪽에서 처리)
export function PageSizeSelect({
  value,
  options,
  unit,
  disabled,
  onChange,
}: {
  value: number
  options: readonly number[]
  unit: string
  disabled?: boolean
  onChange: (size: number) => void
}) {
  return (
    <div className="relative w-36">
      <select
        aria-label="한 쪽에 보일 수"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(filterField, 'appearance-none pr-8')}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
            {unit}씩 보기
          </option>
        ))}
      </select>
      <ChevronDown size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
}
