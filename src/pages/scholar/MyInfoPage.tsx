import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useMe } from '../../api/auth'
import { useMyBankAccount } from '../../api/bank'
import { PageTitle } from '../../components/ui/PageTitle'
import { buttonClass } from '../../components/ui/buttonClass'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

// S04 내 정보: 오른쪽 위 이름을 누르면 온다(11/15 회의). 정보는 보기만, 비밀번호와 계좌는 [변경]을 눌러 따로 화면에서 바꾼다
export function MyInfoPage() {
  usePageTitle('내 정보')
  const me = useMe()
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>내 정보</PageTitle>
      {me.isPending && <LoadingCards count={2} />}
      {me.isError && <ErrorState error={me.error} onRetry={() => me.refetch()} />}
      {me.data && (
        <>
          <section aria-labelledby="info-title" className="flex flex-col gap-2">
            <h2 id="info-title" className="m-0 text-title-2">
              기본 정보
            </h2>
            <div className="rounded-lg bg-surface px-6 py-2 md:px-8">
              <dl className="m-0">
                <Item label="이름" value={me.data.name} />
                <Item label="이메일" value={me.data.email} />
                <Item label="기수" value={me.data.cohort?.name ?? null} />
                <Item label="학교" value={me.data.university ?? null} />
                {/* 비밀번호는 값 대신 작은 [변경] 버튼만. 큰 줄 버튼은 눈에 너무 띄었다(11/17) */}
                <Item
                  label="비밀번호"
                  value={
                    <>
                      <span aria-hidden>••••••••</span>
                      <span className="sr-only">설정됨</span>
                    </>
                  }
                  action={
                    <Link to="/me/password" aria-label="비밀번호 변경" className={buttonClass({ variant: 'secondary', size: 'compact' })}>
                      변경
                    </Link>
                  }
                />
              </dl>
            </div>
          </section>
          <BankSection />
        </>
      )}
    </div>
  )
}

// 장학금 받을 계좌. 기본 정보와 나란히 놓인 두 번째 묶음이다(안에 넣지 않는다).
// 계좌번호는 서버가 뒤 4자리만 준다. 바꿀 때는 번호를 처음부터 다시 적는다
function BankSection() {
  const bank = useMyBankAccount()
  const a = bank.data
  const action = (
    <Link to="/me/bank-account" aria-label={a ? '계좌 변경' : '계좌 등록'} className={buttonClass({ variant: 'secondary', size: 'compact' })}>
      {a ? '변경' : '등록'}
    </Link>
  )
  return (
    <section aria-labelledby="bank-title" className="flex flex-col gap-2">
      <h2 id="bank-title" className="m-0 text-title-2">
        장학금 받을 계좌
      </h2>
      {bank.isPending && <LoadingCards count={1} />}
      {bank.isError && <ErrorState error={bank.error} onRetry={() => bank.refetch()} />}
      {bank.isSuccess && (
        <div className="rounded-lg bg-surface px-6 py-2 md:px-8">
          <dl className="m-0">
            {a ? (
              <>
                <Item label="은행" value={a.bankName} />
                <Item label="계좌번호" value={<span className="tabular-nums">{a.maskedAccountNumber}</span>} action={action} />
                <Item label="예금주" value={a.accountHolder} />
              </>
            ) : (
              <Item label="계좌" value={null} action={action} />
            )}
          </dl>
        </div>
      )}
    </section>
  )
}

// 이름과 값을 한 줄에. 휴대폰에서도 한 줄로 읽히게 이름 칸 폭을 고정한다
// action: 값 오른쪽 끝에 두는 작은 버튼(비밀번호 변경)
// dl 안 줄에는 dt와 dd만 둔다: 버튼은 dd 안에
function Item({ label, value, action }: { label: string; value: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-row-h items-center gap-4 border-b border-line-subtle py-3 last:border-b-0">
      <dt className="w-20 shrink-0 text-ink-3">{label}</dt>
      <dd className={cn('m-0 flex min-w-0 flex-1 items-center justify-between gap-3 break-all', !value && 'text-ink-3')}>
        <span className="min-w-0">{value || '없음'}</span>
        {action}
      </dd>
    </div>
  )
}
