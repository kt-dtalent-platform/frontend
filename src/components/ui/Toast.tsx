import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ToastContext, type Show } from './useToast'

// 완료 알림(토스트). 끝난 일을 한 줄로 알리고 4초 뒤 사라진다(11/15).
// - 쓰는 곳: 저장, 바꾸기, 등록, 공개처럼 결과가 화면에 바로 보이는 일. 읽고 행동해야 하는 안내와 실패는 Banner
// - 한 번에 하나. 새 알림이 오면 바꿔 끼운다
// - 위치: 본문 가운데 아래(PC 24px, 휴대폰 16px + 홈 막대 높이). 담당자 화면은 왼쪽 메뉴를 뺀 본문 기준
// - 크기: 휴대폰은 양옆 16px을 뺀 전체 폭, PC는 글자 길이만큼(최대 560px). 높이 48px 안팎
// - PC에서 마우스를 올려 두는 동안은 사라지지 않는다(터치는 멈추지 않음)
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
  // 시간이 다 되면 0.1초 동안 흐려진 뒤 닫는다(나갈 때는 들어올 때보다 짧게)
  const [leaving, setLeaving] = useState(false)
  // 새 알림이 오면 멈춤과 나가는 중을 푼다(바뀌는 사이에는 mouseleave가 오지 않는다)
  const [shownId, setShownId] = useState(toast?.id)
  if (shownId !== toast?.id) {
    setShownId(toast?.id)
    setPaused(false)
    setLeaving(false)
  }
  useEffect(() => {
    if (!toast || paused) return
    const t = setTimeout(() => setLeaving(true), DURATION)
    return () => clearTimeout(t)
  }, [toast, paused])
  // 페이드가 끝났다는 신호(animationend)가 오지 않아도(애니메이션이 취소되거나 탭이 가려진 경우) 닫히게 한다
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => close.current(), 300)
    return () => clearTimeout(t)
  }, [leaving])

  return (
    <div role="status" className="toast-host pointer-events-none fixed inset-x-0 z-(--z-toast) flex justify-center px-4">
      {toast && (
        <p
          key={toast.id}
          onPointerEnter={(e) => e.pointerType === 'mouse' && !leaving && setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onAnimationEnd={(e) => e.animationName === 'fade-out' && close.current()}
          className={cn(
            'pointer-events-none m-0 w-full md:pointer-events-auto',
            leaving ? 'animate-fade-out' : 'animate-toast-in',
            'rounded-md bg-ink px-5 py-3 text-body text-surface shadow-pop md:w-auto md:max-w-toast-max-w',
          )}
        >
          {toast.message}
        </p>
      )}
    </div>
  )
}
