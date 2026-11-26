// 이메일 형식 검사. 서버(@Email)가 거절하는 꼴을 화면에서 먼저 막는다
// 앞부분: 64자 이하, 점으로 시작하거나 끝나지 않고 점이 연달아 있지 않음
// 뒷부분: 영문, 숫자, 하이픈으로 된 이름(하이픈으로 시작하거나 끝나지 않음)을 점으로 이은 도메인
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?'
export const EMAIL = new RegExp(`^[^@\\s.()<>[\\]:;,\\\\"]+(\\.[^@\\s.()<>[\\]:;,\\\\"]+)*@${LABEL}(\\.${LABEL})+$`)

export function isEmail(v: string) {
  const s = v.trim()
  return s.indexOf('@') <= 64 && EMAIL.test(s)
}
