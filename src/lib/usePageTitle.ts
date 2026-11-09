import { useEffect } from 'react'

// 브라우저 탭 제목. 화면마다 "화면 이름 - KT디지털인재장학생"
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} - KT디지털인재장학생` : 'KT디지털인재장학생'
  }, [title])
}
