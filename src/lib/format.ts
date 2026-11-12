import { TIME_ZONE, toDate } from './time'

// 날짜와 마감 표시. 서버의 UTC 시간을 한국 시간으로 보여 준다.
const dateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const time = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false })

export const formatDue = (iso: string) => dateTime.format(toDate(iso))
export const formatTime = (iso: string) => time.format(toDate(iso))

// 파일 크기: 1.8MB, 320KB
export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

export function dDayText(dDay: number, overdue = dDay < 0) {
  if (dDay === 0) return overdue ? '오늘 마감 지남' : '오늘 마감'
  return dDay > 0 ? `D-${dDay}` : `${-dDay}일 지남`
}
