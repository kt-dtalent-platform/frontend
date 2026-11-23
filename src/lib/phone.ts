import type { ChangeEvent } from 'react'

// 연락처: 입력칸에는 010-1234-5678 모양으로 보여 주고, 서버에는 숫자만 보낸다.
// 국내 번호는 0으로 시작하고 9~11자리(02-123-4567 ~ 010-1234-5678)

export const phoneDigits = (v: string) => v.replace(/\D/g, '')

export function isPhone(v: string) {
  const d = phoneDigits(v)
  return d.startsWith('0') && d.length >= 9 && d.length <= 11
}

export const PHONE_ERROR = '연락처는 0으로 시작하는 숫자 9~11자리로 입력하세요.'

export function formatPhone(v: string) {
  const d = phoneDigits(v).slice(0, 11)
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
export function formatPhoneInput(e: ChangeEvent<HTMLInputElement>) {
  const el = e.target
  const caret = el.selectionStart ?? el.value.length
  const digitsBefore = phoneDigits(el.value.slice(0, caret)).length
  const next = formatPhone(el.value)
  el.value = next
  let pos = 0
  for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++
  el.setSelectionRange(pos, pos)
}
