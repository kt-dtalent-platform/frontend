import { useEffect, useRef } from 'react'

// 짧은 결과 알림. 화면 아래 가운데에 한 줄로 떴다가 3초 뒤 사라진다.
// 다 끝난 일을 알리는 데만 쓴다. 사용자가 읽고 무언가 해야 하는 안내는 Banner를 쓴다.
// 알림 영역(role=status)은 늘 그려 두고 글자만 바꾼다. 처음부터 글자가 든 영역은 Safari VoiceOver가 읽지 않을 때가 있다
export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => close.current(), 3000)
    return () => clearTimeout(t)
  }, [message])
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-8 z-(--z-toast) flex justify-center px-4">
      {message && <p className="m-0 rounded-md bg-ink px-4 py-3 text-label text-surface shadow-pop">{message}</p>}
    </div>
  )
}
