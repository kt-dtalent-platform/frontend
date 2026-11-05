import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useMe } from '../../api/auth'
import { useCohortOptions, useScholars, type ScholarItem, type ScholarStatus } from '../../api/scholars'
import { fieldBase, fieldBorder } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { ScholarStatusBadge } from '../../components/ui/ScholarStatusBadge'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { Tag } from '../../components/ui/Tag'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

const statuses: { value: ScholarStatus | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'ENROLLED', label: '재학' },
  { value: 'LEAVE', label: '휴학' },
  { value: 'GRADUATED', label: '졸업' },
  { value: 'WITHDRAWN', label: '중단' },
]

type Notice = { title: string; body: string }

// A05 장학생 명단: 기수·상태·이름(이메일) 찾기, 행을 누르면 상세
export function ScholarsPage() {
  usePageTitle('장학생')
  const [params, setParams] = useSearchParams()
  const status = (statuses.find((s) => s.value === params.get('status'))?.value ?? null) as ScholarStatus | null
  const cohortId = Number(params.get('cohort')) || null
  const keyword = params.get('q') ?? ''
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const [typed, setTyped] = useState(keyword)
  // 뒤로 가기·메뉴 링크로 주소의 검색어가 바뀌면 입력칸도 맞춘다(안 맞추면 지운 검색어가 다시 들어간다)
  const [seen, setSeen] = useState(keyword)
  if (seen !== keyword) {
    setSeen(keyword)
    setTyped(keyword)
  }
  const me = useMe()
  const cohorts = useCohortOptions(me.data?.accessiblePrograms?.[0]?.id)
  const query = useScholars({ cohortId, status, keyword, page })
  const data = query.data

  // 등록에서 넘어온 결과 안내를 한 번만 보여 준다
  const location = useLocation()
  const navigate = useNavigate()
  const [notice] = useState(() => (location.state as { notice?: Notice } | null)?.notice)
  useEffect(() => {
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])

  const set = (next: { status?: ScholarStatus | null; cohort?: number | null; q?: string; page?: number }) => {
    const p = new URLSearchParams()
    const s = next.status === undefined ? status : next.status
    const c = next.cohort === undefined ? cohortId : next.cohort
    const q = next.q ?? keyword
    if (s) p.set('status', s)
    if (c) p.set('cohort', String(c))
    if (q) p.set('q', q)
    if ((next.page ?? 1) > 1) p.set('page', String(next.page))
    setParams(p, { replace: true })
  }

  // 이름 찾기: 입력을 멈추고 0.3초 뒤에 찾는다
  useEffect(() => {
    if (typed === keyword) return
    const t = setTimeout(() => {
      const p = new URLSearchParams(params)
      if (typed) p.set('q', typed)
      else p.delete('q')
      p.delete('page')
      setParams(p, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [typed, keyword, params, setParams])

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const loadingNext = query.isPlaceholderData

  // 없는 쪽 번호(?page=99 등)면 마지막 쪽으로
  useEffect(() => {
    if (!data || query.isPlaceholderData || page <= lastPage) return
    const p = new URLSearchParams(params)
    if (lastPage > 1) p.set('page', String(lastPage))
    else p.delete('page')
    setParams(p, { replace: true })
  }, [data, query.isPlaceholderData, page, lastPage, params, setParams])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>장학생</PageTitle>
        <Link to="/manager/scholars/new" className={buttonClass({ variant: 'primary', size: 'default' })}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          장학생 등록
        </Link>
      </div>

      {notice && (
        <Banner tone="success" title={notice.title}>
          {notice.body}
        </Banner>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterChips label="장학생 상태" items={statuses} value={status} onChange={(v) => set({ status: v })} />
        <div className="grid grid-cols-2 gap-2 md:flex md:w-auto">
          <div className="relative md:w-36">
            <select
              aria-label="기수"
              value={cohortId ? String(cohortId) : ''}
              onChange={(e) => set({ cohort: Number(e.target.value) || null })}
              className={cn(fieldBase, 'h-control-default appearance-none pr-10', fieldBorder(false))}
            >
              <option value="">전체 기수</option>
              {(cohorts.data ?? []).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" aria-hidden />
          </div>
          <div className="relative md:w-56">
            <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              aria-label="이름·이메일로 찾기"
              placeholder="이름·이메일"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={cn(fieldBase, 'h-control-default pl-9', fieldBorder(false))}
            />
          </div>
        </div>
      </div>

      {query.isPending && <LoadingCards count={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {data &&
        (data.items.length === 0 ? (
          loadingNext ? (
            <LoadingCards count={2} />
          ) : (
            <EmptyState title={keyword ? `'${keyword}'에 맞는 장학생이 없어요` : '조건에 맞는 장학생이 없어요'}>
              {keyword ? '이름이나 이메일을 다시 확인하세요.' : undefined}
            </EmptyState>
          )
        ) : (
          <div className={cn('flex flex-col gap-4', loadingNext && 'opacity-60')} aria-busy={loadingNext}>
            <div className="overflow-hidden rounded-lg bg-surface">
              <div aria-hidden className="hidden h-control-default items-center gap-4 border-b border-line-subtle px-6 text-caption text-ink-3 md:flex">
                <span className="flex-1">이름</span>
                <span className="w-56">이메일</span>
                <span className="w-40">상태</span>
                <span className="w-5" />
              </div>
              <ul className="m-0 list-none p-0">
                {data.items.map((s) => (
                  <Row key={s.id} s={s} />
                ))}
              </ul>
            </div>
            {data.total > data.page_size && (
              <nav aria-label="페이지" className="flex items-center justify-end gap-3 text-caption text-ink-3 tabular-nums">
                <span>
                  {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} / 전체 {data.total}명
                </span>
                <Button size="compact" aria-label="이전 페이지" disabled={loadingNext || page <= 1} onClick={() => set({ page: page - 1 })}>
                  <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                </Button>
                <Button size="compact" aria-label="다음 페이지" disabled={loadingNext || page >= lastPage} onClick={() => set({ page: page + 1 })}>
                  <ChevronRight size={16} strokeWidth={2} aria-hidden />
                </Button>
              </nav>
            )}
          </div>
        ))}
    </div>
  )
}

function Row({ s }: { s: ScholarItem }) {
  return (
    <li className="border-b border-line-subtle last:border-b-0">
      <Link
        to={`/manager/scholars/${s.id}`}
        className="group flex flex-col gap-2 px-6 py-4 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:min-h-row-h md:flex-row md:items-center md:gap-4 md:py-3"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-strong">{s.name}</span>
          <span className="truncate text-caption text-ink-3">{[s.cohortName, s.university].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="truncate text-caption text-ink-3 md:w-56 md:text-body md:text-ink-2">{s.email}</span>
        <span className="flex flex-wrap items-center gap-2 md:w-40">
          <ScholarStatusBadge status={s.status} />
          {s.accountStatus === 'LOCKED' && <Tag tone="danger">로그인 잠김</Tag>}
          {s.accountStatus === 'INACTIVE' && <Tag tone="neutral">로그인 전</Tag>}
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="hidden shrink-0 text-ink-3 group-hover:text-ink md:block" aria-hidden />
      </Link>
    </li>
  )
}
