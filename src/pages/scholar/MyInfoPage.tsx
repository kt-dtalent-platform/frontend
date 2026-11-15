import { useState } from 'react'
import { useMe } from '../../api/auth'
import { PasswordChangeForm } from '../../components/form/PasswordChangeForm'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

// S04 내 정보: 오른쪽 위 이름을 누르면 온다(11/15 회의). 보기만 하고, 비밀번호만 바꿀 수 있다
export function MyInfoPage() {
  usePageTitle('내 정보')
  const me = useMe()
  const [changing, setChanging] = useState(false)
  const [changed, setChanged] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>내 정보</PageTitle>
      {me.isPending && <LoadingCards count={2} />}
      {me.isError && <ErrorState error={me.error} onRetry={() => me.refetch()} />}
      {me.data && (
        <>
          {changed && (
            <Banner tone="success" title="비밀번호를 바꿨어요">
              다음 로그인부터 새 비밀번호를 쓰세요.
            </Banner>
          )}
          <section aria-labelledby="my-info" className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-6 md:px-8">
            <div className="flex flex-col gap-1">
              <h2 id="my-info" className="m-0 text-title-2">
                기본 정보
              </h2>
              <p className="m-0 text-caption text-ink-3">바꿀 내용이 있으면 재단 담당자에게 알려 주세요.</p>
            </div>
            <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Item label="이름" value={me.data.name} />
              <Item label="이메일" value={me.data.email} />
              <Item label="기수" value={me.data.cohort?.name ?? null} />
              <Item label="학교" value={me.data.university ?? null} />
            </dl>
          </section>
          <section aria-labelledby="my-password" className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-6 md:px-8">
            <div className="flex items-center justify-between gap-4">
              <h2 id="my-password" className="m-0 text-title-2">
                비밀번호
              </h2>
              {!changing && (
                <Button size="compact" onClick={() => (setChanging(true), setChanged(false))}>
                  바꾸기
                </Button>
              )}
            </div>
            {changing && (
              <PasswordChangeForm
                email={me.data.email}
                mode="change"
                onCancel={() => setChanging(false)}
                onDone={() => (setChanging(false), setChanged(true))}
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className={cn('m-0 break-all', !value && 'text-ink-3')}>{value || '없음'}</dd>
    </div>
  )
}
