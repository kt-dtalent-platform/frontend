import type { NoticeItem, NoticeResult, Sender } from '../api/loginNotices'
import { accountStatusOf } from './scholars'

// 목업 로그인 안내 메일(백엔드 KT-60 모양). 이 브라우저 메모리에만 둔다.
// 보낸 뒤 2초쯤 지나면 보냄(SENT)으로 바뀐다. id가 7로 나누어떨어지는 장학생은 실패, 처음부터 있던 장학생 중 5로 나누어떨어지면 이미 비밀번호를 바꾼 장학생으로 친다
// 보내는 사람은 새로고침해도 남도록 이 브라우저에 저장한다(저장소를 못 쓰면 메모리에만)
const SENDER = 'kt-dtalent:mock-notice-sender'
let sender: Sender | null = (() => {
  try {
    const raw = localStorage.getItem(SENDER)
    return raw ? (JSON.parse(raw) as Sender) : null
  } catch {
    return null
  }
})()
const notices = new Map<number, NoticeItem>()

export const getSender = () => sender
export function setSender(s: Sender) {
  sender = s
  try {
    localStorage.setItem(SENDER, JSON.stringify(s))
  } catch {
    // 메모리에만 둔다
  }
  return s
}

export function noticeStatus(ids: number[]): NoticeItem[] {
  return ids.flatMap((id) => {
    const n = notices.get(id)
    return n ? [n] : []
  })
}

export function sendNotices(ids: number[], reissue: boolean): NoticeResult | 'MAIL_UNAVAILABLE' {
  if (!sender) return 'MAIL_UNAVAILABLE'
  const items: NoticeItem[] = []
  for (const id of [...ids].sort((a, b) => a - b)) {
    const before = notices.get(id)
    let error: string | null = null
    const account = accountStatusOf(id)
    if (!account) error = 'SCHOLAR_NOT_FOUND'
    // 백엔드처럼 사용 중(ACTIVE)이 아니면(사용 중지, 잠김) 보내지 않는다
    else if (account !== 'ACTIVE') error = 'ACCOUNT_DISABLED'
    else if (id < 1100 && id % 5 === 0 && !reissue) error = 'PASSWORD_ALREADY_CHANGED'
    else if (before && (before.status === 'PENDING' || before.status === 'SENDING')) error = 'ALREADY_QUEUED'
    else if (before?.status === 'SENT' && !reissue) error = 'ALREADY_SENT'
    if (error) {
      items.push({ scholarId: id, status: 'SKIPPED', errorCode: error })
      continue
    }
    const item: NoticeItem = { scholarId: id, status: 'PENDING', errorCode: null }
    notices.set(id, item)
    items.push(item)
    setTimeout(
      () => notices.set(id, id % 7 === 0 ? { scholarId: id, status: 'FAILED', errorCode: 'SMTP_ERROR' } : { scholarId: id, status: 'SENT', errorCode: null }),
      2000,
    )
  }
  return { queued: items.filter((i) => i.status === 'PENDING').length, items }
}
