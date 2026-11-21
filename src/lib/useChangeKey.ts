import { useState } from 'react'

// 값이 바뀔 때마다 1씩 커지는 수. 목록 묶음의 key로 쓰면 새 결과가 올 때마다 나타나는 모션이 다시 돈다.
// 불러온 데이터는 내용이 같으면 같은 객체로 남아서(TanStack Query 구조 공유) 다시 불러와도 같은 결과면 움직이지 않는다
export function useChangeKey(value: unknown) {
  const [state, setState] = useState({ value, key: 0 })
  if (state.value !== value) {
    const next = { value, key: state.key + 1 }
    setState(next)
    return next.key
  }
  return state.key
}
