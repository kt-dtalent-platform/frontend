import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// 로그인 안내 메일(백엔드 KT-60, 머지 전). 담당자만.
// 등록만으로는 메일이 나가지 않는다. 담당자가 장학생을 골라 보낸다(최대 500명).
// 보낼 때마다 서버가 새 임시 비밀번호(12자)를 만들어 메일에 넣는다. 그래서 보내면 등록 결과 화면이나 안내 파일의 비밀번호는 더 쓸 수 없다.
// 응답은 접수(202)이고, 실제 결과는 상태 조회로 본다. SENT는 메일 서버가 받았다는 뜻이고 받은편지함 도착을 보장하지 않는다
export type Sender = { fromAddress: string; senderName: string }
export type NoticeStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
export type NoticeItem = { scholarId: number; status: NoticeStatus; errorCode: string | null }
export type NoticeResult = { queued: number; items: NoticeItem[] }

const senderKey = ['manager', 'login-notice-sender']
const statusKey = (ids: number[]) => ['manager', 'login-notices', ids.join(',')]

// GET /scholars/login-notices/sender → 아직 정하지 않았으면 null
export function useNoticeSender() {
  return useQuery({ queryKey: senderKey, queryFn: () => api<Sender | null>('/scholars/login-notices/sender') })
}

// PUT /scholars/login-notices/sender. 메일 서버가 허용한 주소여야 한다
export function useSaveNoticeSender() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Sender) => api<Sender>('/scholars/login-notices/sender', { method: 'PUT', body }),
    onSuccess: (s) => queryClient.setQueryData(senderKey, s),
  })
}

// POST /scholars/login-notices {scholarIds, reissue}. reissue=false(처음 보내기)는 이미 보냈거나 비밀번호를 바꾼 장학생을 건너뛴다.
// reissue=true(다시 보내기)는 비밀번호를 바꾼 장학생도 새 임시 비밀번호로 바꾼다
export function useSendNotices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { scholarIds: number[]; reissue: boolean }) => api<NoticeResult>('/scholars/login-notices', { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['manager', 'login-notices'] }),
  })
}

// GET /scholars/login-notices?scholarIds=1,2 → 한 번이라도 보낸 장학생만 들어 있다.
// 보내는 중이면 몇 초마다 다시 읽는다(서버는 한 번에 25명씩 처리)
export function useNoticeStatus(ids: number[]) {
  return useQuery({
    queryKey: statusKey(ids),
    queryFn: () => api<NoticeItem[]>(`/scholars/login-notices?scholarIds=${ids.join(',')}`),
    enabled: ids.length > 0,
    refetchInterval: (q) => (q.state.data?.some((i) => i.status === 'PENDING' || i.status === 'SENDING') ? 5000 : false),
  })
}

// 건너뛴 이유를 화면 문구로
export function skipText(code: string | null) {
  switch (code) {
    case 'PASSWORD_ALREADY_CHANGED':
      return '이미 비밀번호를 바꿈'
    case 'ALREADY_SENT':
      return '이미 보냄'
    case 'ALREADY_QUEUED':
      return '보내는 중'
    case 'REISSUE_REQUIRED':
      return '임시 비밀번호 다시 보내기 필요'
    case 'ACCOUNT_DISABLED':
      return '로그인할 수 없는 계정'
    case 'SCHOLAR_NOT_FOUND':
      return '없는 장학생'
    default:
      return '건너뜀'
  }
}

// 상세 화면의 상태 문구
export function noticeText(item: NoticeItem | undefined) {
  if (!item) return '보낸 적 없음'
  if (item.status === 'PENDING' || item.status === 'SENDING') return '보내는 중'
  if (item.status === 'SENT') return '보냄'
  if (item.status === 'SKIPPED') return skipText(item.errorCode)
  return item.errorCode === 'DELIVERY_UNKNOWN' ? '보냈는지 확인 안 됨' : '보내지 못함'
}

// 접수 결과를 토스트 한 줄로: "3명에게 보내는 중이에요. 1명은 건너뛰었어요(이미 비밀번호를 바꿈)"
export function sentText(r: NoticeResult) {
  const skipped = r.items.filter((i) => i.status === 'SKIPPED')
  const reasons = [...new Set(skipped.map((i) => skipText(i.errorCode)))].join(', ')
  if (!r.queued) return `보낼 장학생이 없어요(${reasons})`
  const head = `${r.queued}명에게 보내는 중이에요`
  return skipped.length ? `${head}. ${skipped.length}명은 건너뛰었어요(${reasons})` : head
}
