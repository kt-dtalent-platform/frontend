import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useMe } from '../../api/auth'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

// S04 내 정보: 오른쪽 위 이름을 누르면 온다(11/15 회의). 정보는 보기만, 비밀번호는 따로 화면에서 바꾼다
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
          <section aria-label="기본 정보" className="rounded-lg bg-surface px-6 py-2 md:px-8">
            <dl className="m-0">
              <Item label="이름" value={me.data.name} />
              <Item label="이메일" value={me.data.email} />
              <Item label="기수" value={me.data.cohort?.name ?? null} />
              <Item label="학교" value={me.data.university ?? null} />
            </dl>
          </section>
          <Link
            to="/me/password"
            className="group flex min-h-row-h items-center justify-between rounded-lg bg-surface px-6 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:px-8"
          >
            비밀번호 변경
            <ChevronRight size={20} strokeWidth={1.75} className="text-ink-3 group-hover:text-ink" aria-hidden />
          </Link>
        </>
      )}
    </div>
  )
}

// 이름과 값을 한 줄에. 휴대폰에서도 한 줄로 읽히게 이름 칸 폭을 고정한다
function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-line-subtle py-4 last:border-b-0">
      <dt className="w-16 shrink-0 text-ink-3">{label}</dt>
      <dd className={cn('m-0 min-w-0 break-all', !value && 'text-ink-3')}>{value || '없음'}</dd>
    </div>
  )
}
