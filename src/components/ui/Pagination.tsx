import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

// 쪽 번호(페이지네이션). 가운데에 두고 칸 수를 늘 7개로 유지한다(MUI 페이지네이션과 같은 규칙).
// - 7쪽 이하: 전부 보인다(1 2 3 4 5)
// - 그보다 많으면: 처음, 끝, 지금 쪽 앞뒤 한 쪽. 앞뒤 끝에 붙으면 다섯 칸을 채운다(1 2 3 4 5 … 10, 1 … 5 6 7 … 10)
// - 말줄임표는 두 쪽 이상을 줄일 때만 쓴다. 한 쪽만 숨겨질 자리면 그 번호를 보인다
// 쪽을 옮겨도 칸 수가 같아 화살표와 번호 위치가 흔들리지 않는다
function pages(current: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const start = Math.max(Math.min(current - 1, last - 4), 3)
  const end = Math.min(Math.max(current + 1, 5), last - 2)
  const out: (number | '…')[] = [1, start > 3 ? '…' : 2]
  for (let p = start; p <= end; p++) out.push(p)
  out.push(end < last - 2 ? '…' : last - 1, last)
  return out
}

export function Pagination({ page, lastPage, disabled, onChange }: { page: number; lastPage: number; disabled?: boolean; onChange: (page: number) => void }) {
  if (lastPage <= 1) return null
  return (
    <nav aria-label="페이지" className="flex items-center justify-center gap-1 tabular-nums">
      <Button size="compact" variant="ghost" aria-label="이전 페이지" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
      </Button>
      {pages(page, lastPage).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} aria-hidden className="inline-flex h-control-compact min-w-control-compact items-center justify-center text-ink-3">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`${p}쪽`}
            aria-current={p === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => p !== page && onChange(p)}
            className={cn(
              'h-control-compact min-w-control-compact rounded-md px-2 text-body disabled:cursor-not-allowed',
              // 지금 쪽은 옅은 회색 바탕 + 굵은 글자. 검은 칸은 화면 맨 아래에서 가장 눈에 띄어 주요 버튼처럼 보였다(11/15)
              p === page
                ? 'bg-control-tonal font-semibold text-ink'
                : 'text-ink-3 hover:bg-control-tonal-hover hover:text-ink disabled:text-ink-disabled disabled:hover:bg-transparent',
            )}
          >
            {p}
          </button>
        ),
      )}
      <Button size="compact" variant="ghost" aria-label="다음 페이지" disabled={disabled || page >= lastPage} onClick={() => onChange(page + 1)}>
        <ChevronRight size={16} strokeWidth={2} aria-hidden />
      </Button>
    </nav>
  )
}
