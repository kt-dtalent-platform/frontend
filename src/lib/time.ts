// 서버 시간은 UTC로 온다(끝에 Z, 백엔드 #43). 화면에는 한국 시간으로 보여 주고, 보낼 때는 다시 UTC로 바꾼다.
// 기기 시간대와 상관없이 같게 보이도록 시간대를 직접 지정한다.
export const TIME_ZONE = 'Asia/Seoul'

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

// 시간대 표시가 없는 옛 형식은 한국 시간으로 본다
const hasZone = (iso: string) => /(?:[zZ]|[+-]\d\d:?\d\d)$/.test(iso)
export const toDate = (iso: string) => new Date(hasZone(iso) ? iso : `${iso}+09:00`)

// UTC 문자열 → 한국 날짜(YYYY-MM-DD)와 시각(HH:mm:ss)
export function kstParts(iso: string | Date) {
  const d = typeof iso === 'string' ? toDate(iso) : iso
  const p = Object.fromEntries(partsFormat.formatToParts(d).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` }
}

// 한국 날짜와 시각 → 서버로 보낼 UTC 문자열(초 단위, 끝에 Z)
export function kstToUtc(date: string, time: string) {
  const t = time.length === 5 ? `${time}:00` : time
  return new Date(`${date}T${t}+09:00`).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// 한국 날짜 기준 오늘(YYYY-MM-DD)
export const kstToday = () => kstParts(new Date()).date

// 두 한국 날짜(YYYY-MM-DD) 사이 일 수
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
