// 토큰 보관(백엔드 #108: 액세스 30분, 리프레시 14일이고 한 번 쓰면 새 쌍으로 바뀜).
// 액세스 토큰은 메모리에만 둔다(페이지의 다른 스크립트가 오래 쓸 수 있는 값을 읽지 못하게).
// 리프레시 토큰은 새로고침해도 로그인이 이어지도록 탭 저장소(sessionStorage)에 둔다. 탭을 닫으면 지워진다.
// passwordChangeRequired: 로그인 응답에만 온다. 임시 비밀번호로 들어왔는지 함께 둔다(새로고침해도 비밀번호 변경 화면으로).
// session: 로그인할 때마다 새로 만드는 값. 재발급으로 토큰이 바뀌어도 같은 로그인인지 가린다.
type Saved = { refreshToken: string; passwordChangeRequired: boolean; session: string }
type Tokens = { accessToken: string | null } & Saved

const KEY = 'kt-dtalent:session'

function load(): Tokens | null {
  try {
    const saved = sessionStorage.getItem(KEY)
    return saved ? { accessToken: null, ...(JSON.parse(saved) as Saved) } : null
  } catch {
    return null
  }
}

let tokens: Tokens | null = load()

function save(next: Tokens | null) {
  tokens = next
  try {
    if (next) {
      const { refreshToken, passwordChangeRequired, session } = next
      sessionStorage.setItem(KEY, JSON.stringify({ refreshToken, passwordChangeRequired, session } satisfies Saved))
    } else sessionStorage.removeItem(KEY)
  } catch {
    // 저장소를 못 쓰는 환경이면 메모리만 쓴다(새로고침하면 다시 로그인)
  }
}

export const tokenStore = {
  access: () => tokens?.accessToken ?? null,
  refresh: () => tokens?.refreshToken ?? null,
  session: () => tokens?.session ?? null,
  // 액세스 토큰이 없어도 리프레시 토큰이 있으면 로그인한 것으로 본다(새로고침 직후)
  loggedIn: () => tokens !== null,
  mustChangePassword: () => tokens?.passwordChangeRequired === true,
  login: (t: { accessToken: string; refreshToken: string; passwordChangeRequired: boolean }) =>
    save({ ...t, session: `${Date.now()}-${Math.random().toString(36).slice(2)}` }),
  // 재발급이나 비밀번호 변경으로 받은 새 쌍. 같은 로그인으로 이어 쓴다
  rotate: (t: { accessToken: string; refreshToken: string }) => {
    if (tokens) save({ ...tokens, ...t })
  },
  passwordChanged: () => {
    if (tokens) save({ ...tokens, passwordChangeRequired: false })
  },
  clear: () => save(null),
}
