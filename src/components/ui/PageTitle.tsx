import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

// 화면 제목. KT 스퀘어는 로고와 메뉴 선택 표시에만 쓰고 제목에는 두지 않는다(11/12)
export function PageTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {/* 설명이 없는 제목(목록 화면)은 버튼(40px)이 옆에 있든 없든 줄 높이 40px. 화면을 옮겨도 제목과 그 아래 필터의 위치가 같다.
          설명이 있는 제목은 설명과 붙어 있어야 해서 글자 높이 그대로 */}
      <h1 className={cn('m-0 text-title-1', !description && 'flex min-h-control-default items-center')}>{children}</h1>
      {description && <p className="m-0 text-caption text-ink-3">{description}</p>}
    </div>
  )
}
