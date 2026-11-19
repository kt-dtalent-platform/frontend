import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

// 폼을 보냈는데 서버에서 실패했을 때 제출 버튼 가까이 두는 한 줄 오류.
// 입력칸, 버튼과 같은 크기의 상자로 만들지 않는다(또 하나의 입력칸처럼 보임). 화면 전체에 걸친 실패는 Banner.
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 flex gap-1.5 text-caption text-danger-text">
      <TriangleAlert size={16} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
