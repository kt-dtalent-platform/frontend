import { cn } from '../../lib/cn'

// KT 스퀘어: 로고 옆, 페이지 제목 앞, 현재 메뉴 앞, 토스트에만 쓴다.
export function KtSquare({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-kt-square shrink-0 rounded-xs bg-kt-red', className)} />
}
