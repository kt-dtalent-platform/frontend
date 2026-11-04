import type { ReactNode } from 'react'
import { KtSquare } from './KtSquare'

export function PageTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 flex items-center gap-3 text-title-1">
        <KtSquare />
        {children}
      </h1>
      {description && <p className="m-0 pl-5 text-caption text-ink-3">{description}</p>}
    </div>
  )
}
