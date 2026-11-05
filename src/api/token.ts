// 액세스 토큰은 메모리에만 둔다. localStorage에 두면 페이지의 다른 스크립트가 읽을 수 있다.
// 새로고침 후 로그인 유지(리프레시 토큰을 HttpOnly 쿠키로 받을지)는 백엔드와 정한다(11/9 주).
let accessToken: string | null = null

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token
  },
}
