import { mockOn } from '../lib/env'
// 토큰 보관. 배포 환경에서는 메모리에만 둔다(페이지의 다른 스크립트가 읽지 못하게).
// 개발 서버에서 목업을 쓸 때만 새로고침해도 로그인이 유지되도록 sessionStorage에 둔다.
// 실제 새로고침 후 로그인 유지는 리프레시 토큰 방식이 정해지면 바꾼다(백엔드 확인 필요).
type Tokens = { accessToken: string; refreshToken: string }

const KEY = 'kt-dtalent:mock-tokens'
const persist = mockOn

let tokens: Tokens | null = null
if (persist) {
  try {
    const saved = sessionStorage.getItem(KEY)
    tokens = saved ? (JSON.parse(saved) as Tokens) : null
  } catch {
    tokens = null
  }
}

export const tokenStore = {
  access: () => tokens?.accessToken ?? null,
  refresh: () => tokens?.refreshToken ?? null,
  set: (next: Tokens | null) => {
    tokens = next
    if (!persist) return
    try {
      if (next) sessionStorage.setItem(KEY, JSON.stringify(next))
      else sessionStorage.removeItem(KEY)
    } catch {
      // 저장소를 못 쓰는 환경이면 메모리만 쓴다
    }
  },
}
