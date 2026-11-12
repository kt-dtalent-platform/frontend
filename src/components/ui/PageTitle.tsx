import type { ReactNode } from 'react'

// 화면 제목. KT 스퀘어는 로고와 메뉴 선택 표시에만 쓰고 제목에는 두지 않는다(11/12)
export function PageTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 text-title-1">{children}</h1>
      {description && <p className="m-0 text-caption text-ink-3">{description}</p>}
    </div>
  )
}
