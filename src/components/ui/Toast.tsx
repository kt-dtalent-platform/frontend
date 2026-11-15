import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Show } from './useToast'

// 완료 알림(토스트). 끝난 일을 한 줄로 알리고 4초 뒤 사라진다(11/15).
// - 쓰는 곳: 저장, 바꾸기, 등록, 공개처럼 결과가 화면에 바로 보이는 일. 읽고 행동해야 하는 안내와 실패는 Banner
// - 한 번에 하나. 새 알림이 오면 바꿔 끼운다
// - 위치: 본문 가운데 아래(PC 24px, 휴대폰 16px + 홈 막대 높이). 담당자 화면은 왼쪽 메뉴를 뺀 본문 기준
// - 크기: 휴대폰은 양옆 16px을 뺀 전체 폭, PC는 글자 길이만큼(최대 560px). 높이 48px 안팎
// - 마우스를 올리거나 키보드로 들어가 있는 동안은 사라지지 않는다
// - 알림 영역(role=status)은 늘 그려 두고 글자만 바꾼다. 처음부터 글자가 든 영역은 Safari VoiceOver가 읽지 않을 때가 있다
const DURATION = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const show = useCallback<Show>((message) => setToast({ id: Date.now(), message }), [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastHost toast={toast} onClose={() => setToast(null)} />
    </ToastContext.Provider>
  )
}

function ToastHost({ toast, onClose }: { toast: { id: number; message: string } | null; onClose: () => void }) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!toast || paused) return
    const t = setTimeout(() => close.current(), DURATION)
    return () => clearTimeout(t)
  }, [toast, paused])

  return (
    <div role="status" className="toast-host pointer-events-none fixed inset-x-0 z-(--z-toast) flex justify-center px-4 lg:left-(--content-left)">
      {toast && (
        <p
          key={toast.id}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="pointer-events-auto m-0 w-full rounded-md bg-ink px-5 py-3 text-body text-surface shadow-pop md:w-auto md:max-w-toast-max-w"
        >
          {toast.message}
        </p>
      )}
    </div>
  )
}
