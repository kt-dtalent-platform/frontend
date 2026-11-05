// 날짜·마감 표시. 서버 시간 문자열(시간대 없음)을 그대로 현지 시각으로 읽는다.
const dateTime = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const time = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

export const formatDue = (iso: string) => dateTime.format(new Date(iso))
export const formatTime = (iso: string) => time.format(new Date(iso))

export function dDayText(dDay: number, overdue = dDay < 0) {
  if (dDay === 0) return overdue ? '오늘 마감 지남' : '오늘 마감'
  return dDay > 0 ? `D-${dDay}` : `${-dDay}일 지남`
}
