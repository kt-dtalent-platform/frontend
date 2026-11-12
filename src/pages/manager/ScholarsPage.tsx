import { ChevronDown, Download, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useMe } from '../../api/auth'
import { useCohorts } from '../../api/manager'
import { ApiError } from '../../api/client'
import { downloadFile } from '../../api/review'
import { scholarExportColumns, useChangeScholarsStatus, useScholars, withdrawalText, type ScholarItem, type ScholarStatus } from '../../api/scholars'
import { fieldBase, fieldBorder } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { ExportDialog, type ExportChoice } from '../../components/ui/ExportDialog'
import { Pagination } from '../../components/ui/Pagination'
import { buttonClass } from '../../components/ui/buttonClass'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { ScholarStatusBadge } from '../../components/ui/ScholarStatusBadge'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { Tag } from '../../components/ui/Tag'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'
import { MetaList } from '../../components/ui/MetaList'
import { ScholarStatusDialog } from './ScholarStatusDialog'

const statuses: { value: ScholarStatus | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'ENROLLED', label: '재학' },
  { value: 'COMPLETED', label: '수료' },
  { value: 'WITHDRAWN', label: '중단' },
]

type Notice = { title: string; body: string }

// A05 장학생 명단: 상태, 기수, 이름(이메일) 찾기, 여러 명 골라 상태 바꾸기, 내보내기. 행을 누르면 상세
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
  const cohorts = useCohorts(me.data?.accessiblePrograms?.[0]?.id)
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

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const loadingNext = query.isPlaceholderData

  // 여러 명 고르기: 이 쪽에 보이는 장학생 중에서. 필터나 쪽을 바꾸면 비운다
  const [picked, setPicked] = useState<number[]>([])
  const [listKey, setListKey] = useState(params.toString())
  const [bulkDone, setBulkDone] = useState<number | null>(null)
  const bulk = useChangeScholarsStatus()
  if (listKey !== params.toString()) {
    setListKey(params.toString())
    setPicked([])
    // 다른 목록으로 옮기면 지난 결과 안내도 지운다
    setBulkDone(null)
    if (!bulk.isIdle) bulk.reset()
  }
  // 다음 쪽을 불러오는 동안 남아 있는 이전 행은 고를 수 없게 하고, 지금 쪽에 보이는 사람만 센다
  const pageIds = loadingNext ? [] : (data?.items.map((x) => x.id) ?? [])
  const sel = picked.filter((id) => pageIds.includes(id))
  const allPicked = pageIds.length > 0 && pageIds.every((x) => sel.includes(x))
  // 고른 사람이 모두 같은 기수면 그 선발 연도부터 수료 연도를 보여 준다
  const pickedCohorts = [...new Set(data?.items.filter((x) => sel.includes(x.id)).map((x) => x.cohortName) ?? [])]
  const pickedCohort = pickedCohorts.length === 1 ? pickedCohorts[0] : ''
  const [bulkOpen, setBulkOpen] = useState(false)

  // 내보내기: 기수 필터는 그대로 걸고, 상태와 열은 대화상자에서 고른다
  const cohortName = cohorts.data?.find((c) => c.id === cohortId)?.name ?? null
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const onExport = async (choice: ExportChoice) => {
    setExporting(true)
    setExportError(false)
    try {
      await downloadFile('/scholars/export', choice, 'scholars.xlsx', cohortId ? { cohortId: String(cohortId) } : {})
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
      setExportOpen(false)
    }
  }

  // 없는 쪽 번호(?page=99 등)면 마지막 쪽으로
  useEffect(() => {
    if (!data || query.isPlaceholderData || page <= lastPage) return
    const p = new URLSearchParams(params)
    if (lastPage > 1) p.set('page', String(lastPage))
    else p.delete('page')
    setParams(p, { replace: true })
  }, [data, query.isPlaceholderData, page, lastPage, params, setParams])

  // 목록에 대한 보조 행동이라 테두리 없는 버튼(11/12)
  const exportButton = (
    <Button size="default" variant="ghost" disabled={!data || data.total === 0} onClick={() => (setExportError(false), setExportOpen(true))}>
      <Download size={16} strokeWidth={2} aria-hidden />
      내보내기
    </Button>
  )

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
        {/* 휴대폰: 내보내기는 상태 칩 줄 오른쪽에 */}
        <div className="flex items-center justify-between gap-2">
          <FilterChips label="장학생 상태" items={statuses} value={status} onChange={(v) => set({ status: v })} />
          <div className="md:hidden">{exportButton}</div>
        </div>
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
              aria-label="이름 또는 이메일로 찾기"
              placeholder="이름, 이메일"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={cn(fieldBase, 'h-control-default pl-9', fieldBorder(false))}
            />
          </div>
          <div className="hidden md:block">{exportButton}</div>
        </div>
      </div>

      {query.isPending && <LoadingCards count={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {bulkDone !== null && bulkDone > 0 && (
        <Banner tone="success" title={`${bulkDone}명의 상태를 바꿨어요`}>
          바뀐 상태가 명단에 반영됐어요.
        </Banner>
      )}
      {bulk.isError && !bulkOpen && (
        <Banner tone="danger" title="상태를 바꾸지 못했어요">
          {bulk.error instanceof ApiError ? bulk.error.message : '잠시 뒤 다시 시도하세요.'}
        </Banner>
      )}
      {exportError && (
        <Banner tone="danger" title="파일을 만들지 못했어요">
          잠시 후 다시 내보내세요.
        </Banner>
      )}
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
              {/* 표 머리: 인원 수 또는 고른 인원과 할 일 */}
              <div className="flex min-h-control-h items-center gap-4 border-b border-line-subtle px-6">
                <input
                  type="checkbox"
                  aria-label="이 쪽 장학생 모두 고르기"
                  className="size-5 shrink-0 accent-action"
                  disabled={loadingNext}
                  checked={allPicked}
                  ref={(el) => {
                    if (el) el.indeterminate = sel.length > 0 && !allPicked
                  }}
                  onChange={(e) => setPicked(e.target.checked ? pageIds : [])}
                />
                {sel.length > 0 ? (
                  <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-2">
                    <span className="mr-2 text-label tabular-nums">{sel.length}명 고름</span>
                    <Button size="compact" onClick={() => (bulk.reset(), setBulkDone(null), setBulkOpen(true))}>
                      상태 바꾸기
                    </Button>
                    <Button size="compact" variant="ghost" onClick={() => setPicked([])}>
                      고르기 해제
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* 휴대폰: 열 이름이 없어 인원 수만. PC: 열 이름을 두고 인원 수는 오른쪽 끝 */}
                    <span className="flex-1 text-caption text-ink-3 tabular-nums md:hidden">
                      <span className="text-label text-ink">{data.total}</span>명
                    </span>
                    <span aria-hidden className="hidden w-40 text-caption text-ink-3 md:block">
                      이름
                    </span>
                    <span aria-hidden className="hidden w-28 text-caption text-ink-3 md:block">
                      기수
                    </span>
                    <span aria-hidden className="hidden w-44 text-caption text-ink-3 md:block">
                      학교
                    </span>
                    <span aria-hidden className="hidden w-56 text-caption text-ink-3 md:block">
                      상태
                    </span>
                    <span aria-hidden className="hidden flex-1 text-caption text-ink-3 md:block">
                      이메일
                    </span>
                    <span className="hidden text-caption text-ink-3 tabular-nums md:block">
                      <span className="text-label text-ink">{data.total}</span>명
                    </span>
                  </>
                )}
              </div>
              <ul className="m-0 list-none p-0">
                {data.items.map((s) => (
                  <Row
                    key={s.id}
                    s={s}
                    disabled={loadingNext}
                    picked={sel.includes(s.id)}
                    onPick={(on) => setPicked((p) => (on ? [...p, s.id] : p.filter((x) => x !== s.id)))}
                  />
                ))}
              </ul>
            </div>
            <Pagination page={page} lastPage={lastPage} disabled={loadingNext} onChange={(p) => set({ page: p })} />
          </div>
        ))}

      {bulkOpen && (
        <ScholarStatusDialog
          open
          title={`${sel.length}명 상태 바꾸기`}
          s={{ status: 'ENROLLED', completedYear: null, withdrawalReason: null, withdrawalReasonDetail: null }}
          cohortName={pickedCohort}
          busy={bulk.isPending}
          onCancel={() => setBulkOpen(false)}
          onSubmit={(body) =>
            bulk.mutate(
              { ...body, scholarIds: sel },
              {
                onSuccess: (r) => (setBulkOpen(false), setBulkDone(r.updated), setPicked([])),
                onError: () => setBulkOpen(false),
              },
            )
          }
        />
      )}
      {exportOpen && data && (
        <ExportDialog
          open
          title="장학생 명단 내보내기"
          total={status || keyword ? undefined : data.total}
          note={[cohortName && `${cohortName}만 내보내요.`, keyword && '이름, 이메일 검색은 적용하지 않아요.'].filter(Boolean).join(' ') || undefined}
          scopes={statuses.slice(1).map((x) => ({ value: x.value!, label: x.label }))}
          initialScopes={status ? [status] : []}
          columnGroups={scholarExportColumns}
          busy={exporting}
          onCancel={() => setExportOpen(false)}
          onSubmit={(c) => void onExport(c)}
        />
      )}
    </div>
  )
}

function Row({ s, picked, disabled, onPick }: { s: ScholarItem; picked: boolean; disabled: boolean; onPick: (on: boolean) => void }) {
  // 상태 칸 옆 설명: 수료는 연도, 중단은 사유(기타는 "기타"로 짧게)
  const note = s.status === 'COMPLETED' && s.completedYear ? `${s.completedYear}년 수료` : s.status === 'WITHDRAWN' ? withdrawalText(s, true) : null
  return (
    <li className={cn('flex items-center gap-4 border-b border-line-subtle pl-6 last:border-b-0', picked && 'bg-surface-hover')}>
      <input
        type="checkbox"
        aria-label={`${s.name} 고르기`}
        className="size-5 shrink-0 accent-action"
        checked={picked}
        disabled={disabled}
        onChange={(e) => onPick(e.target.checked)}
      />
      <Link
        to={`/manager/scholars/${s.id}`}
        className="group flex min-w-0 flex-1 flex-col gap-1 py-3 pr-6 text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:min-h-row-h md:flex-row md:items-center md:gap-4 md:py-2"
      >
        <span className="flex min-w-0 items-center gap-2 md:w-40">
          <span className="truncate text-body-strong group-hover:underline">{s.name}</span>
          {s.accountStatus === 'LOCKED' && <Tag tone="danger">잠김</Tag>}
          {s.accountStatus === 'INACTIVE' && <Tag tone="neutral">로그인 전</Tag>}
          <span className="ml-auto shrink-0 md:hidden">
            <ScholarStatusBadge status={s.status} />
          </span>
        </span>
        {/* 휴대폰: 이름 줄 오른쪽에 상태, 아래에 기수와 학교 */}
        <MetaList oneLine items={[s.cohortName, note, s.university]} className="flex text-caption text-ink-3 md:hidden" />
        <span className="hidden truncate text-ink-2 md:block md:w-28">{s.cohortName}</span>
        <span className="hidden truncate text-ink-2 md:block md:w-44">{s.university}</span>
        <span className="hidden min-w-0 items-center gap-2 md:flex md:w-56">
          <ScholarStatusBadge status={s.status} />
          {note && <span className="truncate text-caption text-ink-3">{note}</span>}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-caption text-ink-3 md:block">{s.email}</span>
      </Link>
    </li>
  )
}
