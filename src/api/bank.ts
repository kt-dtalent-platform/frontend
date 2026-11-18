import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// 장학금 받을 계좌. 백엔드 KT-49(#77)
// GET /v1/me/bank-account: 장학생 본인만. 계좌번호는 뒤 4자리만 온다(****5678). 등록 전이면 null
// PATCH /v1/me/bank-account: 은행, 계좌번호, 예금주를 함께 보낸다. 서버가 공백과 -를 빼고 저장한다
export type MyBankAccount = { bankName: string; maskedAccountNumber: string; accountHolder: string }
export type BankAccountInput = { bankName: string; accountNumber: string; accountHolder: string }

const key = ['me', 'bank-account']

export function useMyBankAccount() {
  return useQuery({ queryKey: key, queryFn: () => api<MyBankAccount | null>('/me/bank-account') })
}

export function useUpdateMyBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: BankAccountInput) => api<{ updatedAt: string }>('/me/bank-account', { method: 'PATCH', body }),
    // 보낸 본문에 전체 계좌번호가 있어 끝난 요청 기록을 캐시에 남기지 않는다
    gcTime: 0,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  })
}

// 은행 선택지. 입력 실수(국민, KB, 국민은행)를 막으려고 직접 쓰지 않고 고른다.
// 예전에 저장한 이름이 목록에 없으면 화면에서 선택지에 하나 더 붙인다
export const banks = [
  'KB국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  'NH농협은행',
  'IBK기업은행',
  '카카오뱅크',
  '토스뱅크',
  '케이뱅크',
  'SC제일은행',
  '한국씨티은행',
  'iM뱅크',
  '부산은행',
  '경남은행',
  '광주은행',
  '전북은행',
  '제주은행',
  'Sh수협은행',
  'KDB산업은행',
  '우체국',
  '새마을금고',
  '신협',
  '지역농축협',
  '산림조합',
  '저축은행',
]
