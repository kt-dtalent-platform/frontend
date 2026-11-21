import { ArrowRightLeft, Ban, ChevronDown, Download, Lock, Mail, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMe } from '../../api/auth'
import { useCohorts } from '../../api/manager'
import { downloadFile } from '../../api/review'
import {
  scholarExportColumns,
  SCHOLAR_PAGE_SIZES,
  scholarStatuses,
  useChangeScholarsStatus,
  useScholars,
  withdrawalText,
  type ScholarItem,
  type ScholarStatus,
} from '../../api/scholars'
import { filterField } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { ExportDialog, type ExportChoice } from '../../components/ui/ExportDialog'
import { MenuButton } from '../../components/ui/MenuButton'
import { Pagination } from '../../components/ui/Pagination'
import { PageSizeSelect } from '../../components/ui/PageSizeSelect'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { ScholarStatusBadge } from '../../components/ui/ScholarStatusBadge'
import { SortHeader } from '../../components/ui/SortHeader'
import { parseSort, sortParam, type Sort } from '../../lib/sort'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { RowNote } from '../../components/ui/RowNote'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'
import { MetaList } from '../../components/ui/MetaList'
import { ScholarStatusDialog } from './ScholarStatusDialog'
import { LoginNoticeDialog } from './LoginNoticeDialog'
import { sentText } from '../../api/loginNotices'
import { Checkbox } from '../../components/form/Checkbox'
import { useToast } from '../../components/ui/useToast'
import { errorText } from '../../api/errorText'

const statuses: { value: ScholarStatus | null; label: string }[] = [{ value: null, label: '전체' }, ...scholarStatuses]

// 열 이름으로 정렬할 수 있는 열. 서버 정렬 키 이름은 백엔드 확인 필요
const sortKeys = ['name', 'cohort', 'university', 'status', 'email'] as const

// A05 장학생 명단: 상태, 기수, 이름(이메일) 찾기, 여러 명 골라 상태 바꾸기, 내보내기. 행을 누르면 상세
export function ScholarsPage() {
  usePageTitle('장학생')
  const [params, setParams] = useSearchParams()
  const status = (statuses.find((s) => s.value === params.get('status'))?.value ?? null) as ScholarStatus | null
  const cohortId = Number(params.get('cohort')) || null
  const keyword = params.get('q') ?? ''
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const sort = parseSort(params.get('sort'), sortKeys)
  // 한 쪽에 보일 수(?size=50). 목록에 없는 값이면 기본 20
  const pageSize = SCHOLAR_PAGE_SIZES.find((n) => n === Number(params.get('size'))) ?? SCHOLAR_PAGE_SIZES[0]
  const [typed, setTyped] = useState(keyword)
  // 뒤로 가기·메뉴 링크로 주소의 검색어가 바뀌면 입력칸도 맞춘다(안 맞추면 지운 검색어가 다시 들어간다)
  const [seen, setSeen] = useState(keyword)
  if (seen !== keyword) {
    setSeen(keyword)
    setTyped(keyword)
  }
  const me = useMe()
  const cohorts = useCohorts(me.data?.accessiblePrograms?.[0]?.id)
  const query = useScholars({ cohortId, status, keyword, page, pageSize, sort })
  const data = query.data

  const toast = useToast()

  const set = (next: { status?: ScholarStatus | null; cohort?: number | null; q?: string; page?: number; size?: number; sort?: Sort }) => {
    const p = new URLSearchParams()
    const s = next.status === undefined ? status : next.status
    const c = next.cohort === undefined ? cohortId : next.cohort
    const q = next.q ?? keyword
    if (s) p.set('status', s)
    if (c) p.set('cohort', String(c))
    if (q) p.set('q', q)
    const o = sortParam(next.sort === undefined ? sort : next.sort)
    if (o) p.set('sort', o)
    const z = next.size ?? pageSize
    if (z !== SCHOLAR_PAGE_SIZES[0]) p.set('size', String(z))
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
  const bulk = useChangeScholarsStatus()
  if (listKey !== params.toString()) {
    setListKey(params.toString())
    setPicked([])
    if (!bulk.isIdle) bulk.reset()
  }
  // 다음 쪽을 불러오는 동안 남아 있는 이전 행은 고를 수 없게 하고, 지금 쪽에 보이는 사람만 센다
  const pageIds = loadingNext ? [] : (data?.items.map((x) => x.id) ?? [])
  const sel = picked.filter((id) => pageIds.includes(id))
  const allPicked = pageIds.length > 0 && pageIds.every((x) => sel.includes(x))
  // 고른 사람이 모두 같은 기수면 그 선발 연도부터 수료 연도를 보여 준다
  const pickedCohorts = [...new Set(data?.items.filter((x) => sel.includes(x.id)).map((x) => x.cohortName) ?? [])]
  const pickedCohort = pickedCohorts.length === 1 ? pickedCohorts[0] : ''
  const [noticeOpen, setNoticeOpen] = useState(false)
  // 보내지 못한 장학생 중 담당자가 손봐야 하는 사람(로그인할 수 없는 계정 등). 이미 비밀번호를 바꿨거나 이미 보낸 사람은 할 일이 없어 인원만 토스트로
  const [noticeIssues, setNoticeIssues] = useState<{ name: string; code: 'ACCOUNT_DISABLED' | 'SCHOLAR_NOT_FOUND' }[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)

  // 내보내기: 기수 필터는 그대로 걸고, 상태와 열은 대화상자에서 고른다
  const cohortName = cohorts.data?.find((c) => c.id === cohortId)?.name ?? null
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)
  const onExport = async (choice: ExportChoice) => {
    setExporting(true)
    setExportError(null)
    try {
      await downloadFile('/scholars/export', choice, 'scholars.xlsx', cohortId ? { cohortId: String(cohortId) } : {})
    } catch (err) {
      setExportError(err)
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
    // 휴대폰은 상태 칩 다섯 개와 한 줄에 놓으려고 아이콘만(이름은 화면 읽기용으로 남긴다)
    <Button
      size="compact"
      variant="ghost"
      className="max-md:w-control-compact max-md:px-0"
      disabled={!data || data.total === 0}
      onClick={() => (setExportError(null), setExportOpen(true))}
    >
      <Download size={16} strokeWidth={2} aria-hidden />
      <span className="max-md:sr-only">내보내기</span>
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* 인원 수는 제목 옆에. 따로 한 줄을 쓰지 않아 필터와 목록 사이가 고르다. 필터를 고르면 그 결과 수 */}
      <PageTitle>
        장학생
        {data && <span className="ml-2 text-ink-3 tabular-nums">{data.total}</span>}
      </PageTitle>

      {/* 필터와 목록은 한 묶음: 필터 줄 사이 12px, 필터와 목록 사이 16px */}
      <div className="flex flex-col gap-4">
        {/* 칩은 늘 한 줄. 폭이 모자라면(1280px 미만) 기수, 찾기, 내보내기를 아랫줄로 */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* 휴대폰: 내보내기는 상태 칩 줄 오른쪽에 */}
          <div className="flex items-center justify-between gap-2">
            <FilterChips label="장학생 상태" items={statuses} value={status} onChange={(v) => set({ status: v })} />
            <div className="md:hidden">{exportButton}</div>
          </div>
          {/* 기수는 '2025년 선발'이 들어가는 만큼만, 남는 폭은 찾기 칸에 */}
          <div className="flex gap-2">
            <div className="relative w-36 shrink-0 md:w-32">
              <select
                aria-label="기수"
                value={cohortId ? String(cohortId) : ''}
                onChange={(e) => set({ cohort: Number(e.target.value) || null })}
                className={cn(filterField, 'appearance-none pr-8')}
              >
                <option value="">전체 기수</option>
                {(cohorts.data ?? []).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-3" aria-hidden />
            </div>
            <div className="relative min-w-0 flex-1 md:w-72 md:flex-none">
              <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                type="search"
                aria-label="이름 또는 이메일로 찾기"
                placeholder="이름, 이메일"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={cn(filterField, 'pl-8')}
              />
            </div>
            <div className="hidden md:ml-auto md:block xl:ml-0">{exportButton}</div>
          </div>
        </div>

        {query.isPending && <LoadingCards count={3} />}
        {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
        {bulk.isError && !bulkOpen && (
          <Banner tone="danger" title="상태를 바꾸지 못했어요">
            {errorText(bulk.error)}
          </Banner>
        )}
        {noticeIssues.length > 0 && (
          <Banner
            tone="warning"
            title={`${noticeIssues.length}명에게는 로그인 안내를 보내지 못했어요`}
            action={
              <Button size="compact" variant="ghost" onClick={() => setNoticeIssues([])}>
                닫기
              </Button>
            }
          >
            {/* 이유마다 할 일이 달라 따로 적는다 */}
            {(['ACCOUNT_DISABLED', 'SCHOLAR_NOT_FOUND'] as const).map((code) => {
              const names = noticeIssues.filter((i) => i.code === code).map((i) => i.name)
              if (!names.length) return null
              return (
                <p key={code} className="m-0">
                  {names.join(', ')}:{' '}
                  {code === 'ACCOUNT_DISABLED'
                    ? '이용이 중단됐거나 잠긴 계정이에요. 잠긴 계정은 시간이 지나면 풀려요.'
                    : '명단에서 지워진 장학생이에요. 새로고침해서 확인하세요.'}
                </p>
              )
            })}
          </Banner>
        )}
        {exportError != null && (
          <Banner tone="danger" title="파일을 만들지 못했어요">
            {errorText(exportError)}
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
            <div className={cn('flex animate-fade-in flex-col gap-4 transition-opacity', loadingNext && 'opacity-60')} aria-busy={loadingNext}>
              <div className="overflow-hidden rounded-lg bg-surface">
                {/* 표 머리: 인원 수 또는 고른 인원과 할 일 */}
                <div className="flex h-control-default items-center gap-4 border-b border-line-subtle px-6">
                  {/* 상자는 16px, 누르는 영역은 줄 높이만큼 */}
                  <label className="-mx-3 flex cursor-pointer items-center gap-3 self-stretch px-3">
                    <Checkbox
                      aria-label="이 쪽 장학생 모두 고르기"
                      disabled={loadingNext}
                      checked={allPicked}
                      indeterminate={sel.length > 0 && !allPicked}
                      onChange={(e) => setPicked(e.target.checked ? pageIds : [])}
                    />
                    {/* 휴대폰은 열 이름이 없어 무엇을 고르는 상자인지 글로 */}
                    {sel.length === 0 && (
                      <span aria-hidden className="text-caption text-ink-2 md:hidden">
                        모두 고르기
                      </span>
                    )}
                  </label>
                  {sel.length > 0 ? (
                    <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
                      {/* 고른 동안 열 제목 자리를 같은 높이로 바꾼다(행이 밀리지 않게).
                          위계: 고른 수(굵게) | 할 일(아이콘과 글자) ... 해제(맨 오른쪽, 흐리게).
                          px-1: 가로로 밀리는 줄이 포커스 테두리 양끝을 자르지 않게. 휴대폰은 할 일을 아이콘만(이름은 낭독기에 남김) */}
                      <span className="shrink-0 text-label tabular-nums">{sel.length}명 고름</span>
                      <span aria-hidden className="mx-2 h-4 w-px shrink-0 bg-line" />
                      <Button size="compact" variant="ghost" className="shrink-0 px-2" onClick={() => (bulk.reset(), setBulkOpen(true))}>
                        <ArrowRightLeft size={16} strokeWidth={2} aria-hidden />
                        <span className="max-md:sr-only">상태 바꾸기</span>
                      </Button>
                      <Button size="compact" variant="ghost" className="shrink-0 px-2" onClick={() => setNoticeOpen(true)}>
                        <Mail size={16} strokeWidth={2} aria-hidden />
                        <span className="max-md:sr-only">로그인 안내 보내기</span>
                      </Button>
                      <Button size="compact" variant="ghost" className="ml-auto shrink-0 px-2 text-ink-3" onClick={() => setPicked([])}>
                        <X size={16} strokeWidth={2} aria-hidden />
                        <span className="max-md:sr-only">고르기 해제</span>
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* 열 순서: 누구 → 상태 → 소속 → 연락처 → 비고 */}
                      <SortHeader
                        label="이름"
                        sortKey="name"
                        sort={sort}
                        onSort={(o) => set({ sort: o })}
                        disabled={loadingNext}
                        className="hidden min-w-0 flex-1 md:block xl:w-40 xl:flex-none xl:shrink-0"
                      />
                      <SortHeader
                        label="상태"
                        sortKey="status"
                        sort={sort}
                        onSort={(o) => set({ sort: o })}
                        disabled={loadingNext}
                        className="hidden w-48 shrink-0 md:block"
                      />
                      <SortHeader
                        label="기수"
                        sortKey="cohort"
                        sort={sort}
                        onSort={(o) => set({ sort: o })}
                        disabled={loadingNext}
                        className="hidden w-28 shrink-0 xl:block"
                      />
                      <SortHeader
                        label="학교"
                        sortKey="university"
                        sort={sort}
                        onSort={(o) => set({ sort: o })}
                        disabled={loadingNext}
                        className="hidden min-w-0 shrink grow-0 basis-44 xl:block"
                      />
                      <SortHeader
                        label="이메일"
                        sortKey="email"
                        sort={sort}
                        onSort={(o) => set({ sort: o })}
                        disabled={loadingNext}
                        className="hidden min-w-0 flex-1 xl:block"
                      />
                      <span className="hidden w-24 shrink-0 text-caption text-ink-3 md:block">비고</span>
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
            </div>
          ))}
      </div>

      {/* 목록 아래: 쪽 번호는 가운데, 몇 명씩 보기와 장학생 등록은 오른쪽. 휴대폰은 위아래로
          장학생 등록은 1년에 한 번쯤이라 위가 아닌 아래에 둔다(11/17). 한 명 / 엑셀로 여러 명을 메뉴 하나로 묶는다
          같은 줄의 칸과 버튼은 높이를 32px(compact)로 맞춘다(Ant Design 쪽 번호와 같은 규칙) */}
      {/* 등록 메뉴는 목록을 불러오는 중이거나 오류여도 보인다. 흐림은 쪽 번호와 몇 명씩 보기에만
          PC: 왼쪽 빈 칸과 오른쪽 묶음이 같은 몫을 나눠 쪽 번호가 가운데. 좁으면 오른쪽 묶음이 자리를 먼저 차지해 겹치지 않는다 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="hidden md:block md:flex-1 md:basis-0" />
        <div className={cn('self-center', loadingNext && 'opacity-60')}>
          {data && data.items.length > 0 && <Pagination page={page} lastPage={lastPage} disabled={loadingNext} onChange={(p) => set({ page: p })} />}
        </div>
        <div className="flex items-center justify-end gap-2 md:flex-1 md:basis-0">
          {data && data.total > SCHOLAR_PAGE_SIZES[0] && (
            <div className={cn(loadingNext && 'opacity-60')}>
              <PageSizeSelect value={pageSize} options={SCHOLAR_PAGE_SIZES} unit="명" disabled={loadingNext} onChange={(n) => set({ size: n })} />
            </div>
          )}
          <MenuButton
            label="장학생 등록"
            icon={<Plus size={16} strokeWidth={2} aria-hidden />}
            placement="top"
            items={[
              { to: '/manager/scholars/new', label: '한 명 등록', description: '이름, 이메일, 학교를 직접 적어요' },
              { to: '/manager/scholars/import', label: '엑셀로 여러 명 등록', description: '양식에 채운 명단을 올려요' },
            ]}
          />
        </div>
      </div>

      {noticeOpen && (
        <LoginNoticeDialog
          scholarIds={sel}
          who={`${sel.length}명`}
          reissue={false}
          onClose={() => setNoticeOpen(false)}
          onSent={(r) => {
            setNoticeOpen(false)
            toast(sentText(r))
            const names = new Map(data?.items.map((x) => [x.id, x.name]))
            setNoticeIssues(
              r.items
                .filter((i) => i.status === 'SKIPPED' && (i.errorCode === 'ACCOUNT_DISABLED' || i.errorCode === 'SCHOLAR_NOT_FOUND'))
                .map((i) => ({ name: names.get(i.scholarId) ?? `${i.scholarId}번`, code: i.errorCode as 'ACCOUNT_DISABLED' | 'SCHOLAR_NOT_FOUND' })),
            )
            setPicked([])
          }}
        />
      )}
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
                onSuccess: (r) => (setBulkOpen(false), r.updated > 0 && toast(`${r.updated}명의 상태를 바꿨어요`), setPicked([])),
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
  // 비고: 계정 상태. INACTIVE는 백엔드에서 로그인할 수 없는 계정(ACCOUNT_DISABLED). 로그인 전이라는 뜻이 아니다
  const notes =
    s.accountStatus === 'LOCKED' ? (
      <RowNote icon={Lock} tone="warning">
        잠김
      </RowNote>
    ) : s.accountStatus === 'INACTIVE' ? (
      <RowNote icon={Ban}>사용 중지</RowNote>
    ) : null
  return (
    // 마우스를 올리면 고르기 칸까지 줄 전체를 같은 회색으로(요청 관리 목록과 같게)
    <li className={cn('flex items-center gap-4 border-b border-line-subtle pl-6 last:border-b-0 hover:bg-surface-hover', picked && 'bg-surface-hover')}>
      <label className="-mx-3 flex cursor-pointer items-center self-stretch px-3">
        <Checkbox aria-label={`${s.name} 고르기`} checked={picked} disabled={disabled} onChange={(e) => onPick(e.target.checked)} />
      </label>
      <Link
        to={`/manager/scholars/${s.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 py-3 pr-6 text-ink no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:min-h-row-h md:py-2"
      >
        {/* 휴대폰: 이름 줄 오른쪽에 상태, 아래에 기수와 학교, 그 아래에 상태 설명과 비고 */}
        <span className="flex min-w-0 flex-1 flex-col gap-1 md:hidden">
          <span className="flex items-center justify-between gap-3">
            <span className="truncate text-body-strong">{s.name}</span>
            <ScholarStatusBadge status={s.status} />
          </span>
          <MetaList oneLine items={[s.cohortName, s.university]} className="flex text-caption text-ink-3" />
          {(note || notes) && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3">
              {note && <span>{note}</span>}
              {notes}
            </span>
          )}
        </span>

        {/* PC. 좁은 PC(기수, 학교 열이 없는 폭)는 이름 아래에 기수와 학교. 잘린 글자는 마우스를 올리면 전부 보인다 */}
        <span className="hidden min-w-0 flex-1 flex-col gap-0.5 md:flex xl:w-40 xl:flex-none xl:shrink-0">
          <span className="truncate text-body-strong">{s.name}</span>
          <span className="min-w-0 text-caption text-ink-3 xl:hidden" title={[s.cohortName, s.university].filter(Boolean).join(' ') || undefined}>
            <MetaList oneLine items={[s.cohortName, s.university]} className="flex" />
          </span>
        </span>
        {/* 상태 설명(수료 연도, 중단 사유)은 배지 옆 회색 글자. 칩으로 만들지 않는다 */}
        <span className="hidden w-48 shrink-0 items-center gap-2 md:flex">
          <ScholarStatusBadge status={s.status} />
          {note && (
            <span className="truncate text-caption text-ink-3" title={note}>
              {note}
            </span>
          )}
        </span>
        <span className="hidden w-28 shrink-0 truncate text-ink-2 xl:block">{s.cohortName}</span>
        <span className="hidden min-w-0 shrink grow-0 basis-44 truncate text-ink-2 xl:block" title={s.university ?? undefined}>
          {s.university}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-ink-2 xl:block" title={s.email}>
          {s.email}
        </span>
        <span className="hidden w-24 shrink-0 flex-col items-start gap-0.5 md:flex">{notes}</span>
      </Link>
    </li>
  )
}
