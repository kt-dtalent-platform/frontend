import { useEffect } from 'react'

// 짧은 결과 알림. 화면 아래 가운데에 한 줄로 떴다가 3초 뒤 사라진다.
// 다 끝난 일을 알리는 데만 쓴다. 사용자가 읽고 무언가 해야 하는 안내는 Banner를 쓴다
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [message, onClose])
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-8 z-(--z-toast) flex justify-center px-4">
      <p className="m-0 animate-[rise_.2s_ease-out] rounded-md bg-ink px-4 py-3 text-label text-surface shadow-pop">{message}</p>
    </div>
  )
}
