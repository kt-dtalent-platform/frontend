import type { ChangeEvent } from 'react'

// 연락처: 입력칸에는 010-1234-5678 모양으로 보여 주고, 서버에는 숫자만 보낸다.
// 국내 번호는 0으로 시작하고 9~11자리(02-123-4567 ~ 010-1234-5678)

export const phoneDigits = (v: string) => v.replace(/\D/g, '')

export function isPhone(v: string) {
  const d = phoneDigits(v)
  return d.startsWith('0') && d.length >= 9 && d.length <= 11
}

export const PHONE_ERROR = '연락처는 0으로 시작하는 숫자 9~11자리로 입력하세요.'

// 11자리를 넘으면 자르지 않고 그대로 보여 줘서 확인 규칙이 오류로 알린다
export function formatPhone(v: string) {
  const d = phoneDigits(v)
  // 서울 지역번호 02는 앞자리가 둘
  const head = d.startsWith('02') ? 2 : 3
  if (d.length <= head) return d
  const rest = d.slice(head)
  // 가운데 자리: 남은 숫자가 8자리면 4자리(010-1234-5678), 아니면 3자리(010-123-4567)
  const mid = rest.length >= 8 ? 4 : 3
  if (rest.length <= mid) return `${d.slice(0, head)}-${rest}`
  return `${d.slice(0, head)}-${rest.slice(0, mid)}-${rest.slice(mid)}`
}

// 입력할 때마다 하이픈을 다시 넣는다. 가운데를 고쳐도 커서가 끝으로 튀지 않게, 커서 앞 숫자 개수로 자리를 되찾는다
const lastDigits = new WeakMap<HTMLInputElement, number>()

export function formatPhoneInput(e: ChangeEvent<HTMLInputElement>) {
  const el = e.target
  const caret = el.selectionStart ?? el.value.length
  const digitsBefore = phoneDigits(el.value.slice(0, caret)).length
  let digits = phoneDigits(el.value)
  // 하이픈 앞에서 Delete(앞으로 지우기)를 누르면 하이픈만 지워져 숫자가 그대로다. 그대로 두면 하이픈이 다시 생겨 지워지지 않으므로 뒤 숫자를 지운다
  const forward = (e.nativeEvent as InputEvent).inputType === 'deleteContentForward'
  if (forward && digits.length === lastDigits.get(el)) digits = digits.slice(0, digitsBefore) + digits.slice(digitsBefore + 1)
  lastDigits.set(el, digits.length)
  const next = formatPhone(digits)
  el.value = next
  let pos = 0
  for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++
  el.setSelectionRange(pos, pos)
}

// react-hook-form 등록 옵션. setValueAs로 폼 값도 화면과 같은 모양으로 둔다(Enter로 바로 제출해도 화면 값으로 확인)
export const phoneField = {
  setValueAs: (v: string) => formatPhone(v ?? ''),
  onChange: formatPhoneInput,
  validate: (v: string) => !v.trim() || isPhone(v) || PHONE_ERROR,
}
