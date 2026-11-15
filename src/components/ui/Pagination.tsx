import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

// 쪽 번호(페이지네이션). 가운데에 두고, 쪽이 많으면 처음, 끝, 지금 쪽 앞뒤만 보인다(1 … 4 5 6 … 12)
function pages(current: number, last: number) {
  const out: (number | '…')[] = []
  for (let p = 1; p <= last; p++) {
    if (p === 1 || p === last || Math.abs(p - current) <= 1) out.push(p)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
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
