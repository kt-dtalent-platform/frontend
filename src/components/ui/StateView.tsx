import { FileText, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '../../api/client'
import { Button } from './Button'

// 불러오는 중: 실제 내용과 비슷한 회색 덩어리
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse flex-col gap-3 rounded-lg bg-surface px-6 py-6 md:px-8">
          <div className="h-6 w-20 rounded-sm bg-gray-150" />
          <div className="h-6 w-2/3 rounded-sm bg-gray-150" />
          <div className="h-4 w-40 rounded-sm bg-gray-150" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, children, icon = <FileText size={24} strokeWidth={1.75} /> }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-surface px-8 py-12 text-center text-ink-3">
      <span aria-hidden>{icon}</span>
      <h2 className="m-0 mt-2 text-title-2 text-ink">{title}</h2>
      {children && <p className="m-0">{children}</p>}
    </div>
  )
}

// 실패: 무엇이 안 됐는지 + 다시 시도
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : '네트워크 연결을 확인하세요.'
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg bg-surface px-8 py-12 text-center">
      <h2 className="m-0 text-title-2">불러오지 못했어요</h2>
      <p className="m-0 text-ink-3">{message}</p>
      {onRetry && (
        <Button size="default" className="mt-4" onClick={onRetry}>
          <RefreshCw size={16} strokeWidth={2} aria-hidden />
          다시 시도
        </Button>
      )}
    </div>
  )
}

export function FullPageLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-ink-3" aria-busy="true">
      불러오는 중
    </div>
  )
}
