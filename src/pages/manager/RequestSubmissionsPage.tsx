import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Download, FileWarning, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  downloadExport,
  submissionExportColumns,
  useExtendDeadline,
  useRequestSubmissions,
  useTargetDeadline,
  type StatusFilter,
  type SubmissionRow,
} from '../../api/review'
import { daysUntil, isPastDue } from '../../api/tasks'
import { TIME_ZONE, kstParts, kstToUtc, kstToday, toDate } from '../../lib/time'
import { ApiError } from '../../api/client'
import { FormDialog } from '../../components/ui/FormDialog'
import { LabeledField } from '../../components/form/LabeledField'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { useToast } from '../../components/ui/useToast'
import { filterField } from '../../components/form/fieldClass'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { SortHeader } from '../../components/ui/SortHeader'
import { parseSort, sortParam, type Sort } from '../../lib/sort'
import { ExportDialog, type ExportChoice } from '../../components/ui/ExportDialog'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { RowNote } from '../../components/ui/RowNote'
import { cn } from '../../lib/cn'
import { useChangeKey } from '../../lib/useChangeKey'
import { dDayText, formatDue } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { MetaList } from '../../components/ui/MetaList'
import { errorText } from '../../api/errorText'

const filters: { value: StatusFilter | null; label: string; empty: string }[] = [
  { value: null, label: '전체', empty: '대상 장학생이 없어요.' },
  { value: 'NOT_SUBMITTED', label: '미제출', empty: '모두 제출했어요.' },
  { value: 'WAITING', label: '검토 대기', empty: '검토할 제출이 없어요.' },
  { value: 'REVISION_REQUIRED', label: '보완 필요', empty: '보완 요청 중인 제출이 없어요.' },
  { value: 'CONFIRMED', label: '확인 완료', empty: '아직 확인 완료한 제출이 없어요.' },
]

const submittedAt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// A01 제출 현황: 요청 하나의 대상 장학생 전원. 상태 칩, 이름 검색, 내보내기, 행을 누르면 개별 검토
export function RequestSubmissionsPage() {
  const requestId = Number(useParams().requestId)
  const [params, setParams] = useSearchParams()
  const status = (filters.find((f) => f.value === params.get('status'))?.value ?? null) as StatusFilter | null
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const keyword = params.get('q') ?? ''
  // 열 정렬(백엔드 #114). 기본 순서는 검토 대기, 보완 필요, 미제출, 확인 완료
  const sort = parseSort(params.get('sort'), ['name', 'cohort', 'university', 'status', 'gpa', 'submittedAt'])
  const [typed, setTyped] = useState(keyword)
  // 뒤로 가기 등으로 주소의 검색어가 바뀌면 입력칸도 맞춘다
  const [seen, setSeen] = useState(keyword)
  if (seen !== keyword) {
    setSeen(keyword)
    setTyped(keyword)
  }
  const query = useRequestSubmissions(requestId, { status, keyword, page, sort })
  const data = query.data
  // 필터, 쪽, 정렬로 새 결과가 오면 행 목록만 다시 나타난다(표 머리와 쪽 번호는 그대로라 키보드 포커스가 남는다). 같은 결과를 다시 불러오면 그대로
  const listKey = useChangeKey(data?.items)
  usePageTitle(data ? `${data.request.title} 제출 현황` : '제출 현황')

  const go = (next: { status?: StatusFilter | null; page?: number; q?: string; sort?: Sort }) => {
    const p = new URLSearchParams()
    const s = next.status === undefined ? status : next.status
    const q = next.q ?? keyword
    if (s) p.set('status', s)
    if (q) p.set('q', q)
    const o = sortParam(next.sort === undefined ? sort : next.sort)
    if (o) p.set('sort', o)
    if ((next.page ?? 1) > 1) p.set('page', String(next.page))
    setParams(p, { replace: true })
  }

  // 이름 검색: 입력을 멈추고 0.3초 뒤에 찾는다
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

  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)
  const filter = filters.find((f) => f.value === status)!
  const onExport = async (choice: ExportChoice) => {
    setExporting(true)
    setExportError(null)
    try {
      await downloadExport(requestId, choice)
      setExportOpen(false)
    } catch (err) {
      setExportOpen(false)
      setExportError(err)
    } finally {
      setExporting(false)
    }
  }

  const s = data?.summary
  const counts: Record<string, number | undefined> = s
    ? { all: s.target, NOT_SUBMITTED: s.notSubmitted, WAITING: s.submitted, REVISION_REQUIRED: s.revisionRequired, CONFIRMED: s.confirmed }
    : {}
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const loadingNext = query.isPlaceholderData

  // 없는 쪽(예: 마지막 쪽에서 모두 처리됨)이면 마지막 쪽으로
  useEffect(() => {
    if (!data || query.isPlaceholderData || page <= lastPage) return
    const p = new URLSearchParams(params)
    if (lastPage > 1) p.set('page', String(lastPage))
    else p.delete('page')
    setParams(p, { replace: true })
  }, [data, query.isPlaceholderData, page, lastPage, params, setParams])

  // 마감을 늘릴 장학생(미제출, 작성 중). 고르면 대화상자가 열린다.
  // 백엔드는 진행 중인 요청만 늘려 준다. 요청 상태는 제출 현황 응답에 함께 온다(백엔드 #114)
  const [extending, setExtending] = useState<{ scholarId: number; name: string } | null>(null)
  // 다른 요청으로 넘어가는 동안 이전 요청의 상태로 버튼을 보이지 않게, 이 요청의 응답일 때만 본다
  const canExtend = data?.request.id === requestId && data.request.status === 'IN_PROGRESS'

  return (
    <div className="flex flex-col gap-6">
      {extending && <ExtendDialog requestId={requestId} target={extending} onClose={() => setExtending(null)} />}
      <Link to="/manager/requests" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        요청 관리
      </Link>

      {query.isPending && <LoadingCards count={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {data && (
        <>
          <PageTitle description={<RequestMeta cohortName={data.request.cohortName} closesAt={data.request.closesAt} />}>{data.request.title}</PageTitle>
          {exportError != null && (
            <Banner tone="danger" title="파일을 만들지 못했어요">
              {errorText(exportError)}
            </Banner>
          )}
          {exportOpen && (
            <ExportDialog
              open
              title="제출 현황 내보내기"
              total={data.summary.target}
              scopes={filters.slice(1).map((f) => ({ value: f.value!, label: f.label, count: counts[f.value!] }))}
              initialScopes={status ? [status] : []}
              columnGroups={submissionExportColumns}
              busy={exporting}
              onCancel={() => setExportOpen(false)}
              onSubmit={(c) => void onExport(c)}
            />
          )}

          {/* 필터와 목록은 한 묶음: 필터 줄 사이 12px, 필터와 목록 사이 16px */}
          <div className="flex flex-col gap-4">
            {/* 칩은 늘 한 줄. 폭이 모자라면(1280px 미만) 찾기와 내보내기를 아랫줄로 */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <FilterChips
                label="제출 상태"
                items={filters.map((f) => ({ value: f.value, label: f.label, count: counts[f.value ?? 'all'] }))}
                value={status}
                onChange={(v) => go({ status: v })}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="relative w-full md:w-64">
                  <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" aria-hidden />
                  <input
                    type="search"
                    aria-label="이름으로 찾기"
                    placeholder="이름으로 찾기"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className={cn(filterField, 'pl-8')}
                  />
                </div>
                {/* 목록에 대한 보조 행동이라 테두리 없는 버튼으로 필터 옆에 둔다(11/12) */}
                <Button
                  size="compact"
                  variant="ghost"
                  disabled={exporting || data.summary.target === 0}
                  onClick={() => (setExportError(null), setExportOpen(true))}
                >
                  <Download size={16} strokeWidth={2} aria-hidden />
                  내보내기
                </Button>
              </div>
            </div>

            {data.items.length === 0 ? (
              loadingNext ? (
                <LoadingCards count={2} />
              ) : (
                <EmptyState title={keyword ? `'${keyword}'에 맞는 장학생이 없어요` : filter.empty}>
                  {keyword ? '이름을 다시 확인하세요.' : undefined}
                </EmptyState>
              )
            ) : (
              <div className={cn('flex animate-fade-in flex-col gap-4 transition-opacity', loadingNext && 'opacity-60')} aria-busy={loadingNext}>
                <div className="overflow-hidden rounded-lg bg-surface">
                  <div className="hidden h-control-default items-center gap-4 border-b border-line-subtle px-6 text-caption text-ink-3 md:flex">
                    {/* 열 순서: 누구 → 상태 → 소속 → 숫자 → 비고. 비고는 늘 맨 끝. 상태, 평점처럼 값 길이가 정해진 열은 가장 긴 값만큼만 둔다
                        정렬: 글자와 배지 열은 왼쪽, 숫자와 날짜 열은 오른쪽. 열 제목은 그 열의 값과 같은 쪽에 맞춘다 */}
                    <SortHeader
                      label="이름"
                      sortKey="name"
                      sort={sort}
                      onSort={(o) => go({ sort: o })}
                      disabled={loadingNext}
                      className="min-w-0 flex-1 xl:w-40 xl:flex-none xl:shrink-0"
                    />
                    <SortHeader label="상태" sortKey="status" sort={sort} onSort={(o) => go({ sort: o })} disabled={loadingNext} className="w-20 shrink-0" />
                    <SortHeader
                      label="기수"
                      sortKey="cohort"
                      sort={sort}
                      onSort={(o) => go({ sort: o })}
                      disabled={loadingNext}
                      className="hidden w-28 shrink-0 xl:block"
                    />
                    <SortHeader
                      label="학교"
                      sortKey="university"
                      sort={sort}
                      onSort={(o) => go({ sort: o })}
                      disabled={loadingNext}
                      className="hidden min-w-0 shrink grow-0 basis-72 xl:block"
                    />
                    {/* 넓은 PC: 글자 열은 왼쪽에, 숫자 열(평점, 제출 일시)은 오른쪽으로 */}
                    <span className="hidden flex-1 xl:block" />
                    <SortHeader
                      label="평점"
                      sortKey="gpa"
                      sort={sort}
                      onSort={(o) => go({ sort: o })}
                      disabled={loadingNext}
                      align="end"
                      className="w-20 shrink-0 text-right"
                    />
                    <SortHeader
                      label="제출 일시"
                      sortKey="submittedAt"
                      sort={sort}
                      onSort={(o) => go({ sort: o })}
                      disabled={loadingNext}
                      align="end"
                      className="w-32 shrink-0 text-right"
                    />
                    {/* 오른쪽 정렬 열(제출 일시) 다음에 왼쪽 정렬 열이 오면 글자끼리 붙어 보여서 16px을 더 띄운다(열 사이 32px) */}
                    <span className="w-28 shrink-0 pl-4">비고</span>
                    <span className="w-5 shrink-0" />
                  </div>
                  <ul key={listKey} className={cn('m-0 list-none p-0', listKey > 0 && 'animate-list-in')}>
                    {data.items.map((r) => (
                      <Row
                        key={r.scholarId}
                        row={r}
                        requestId={requestId}
                        onExtend={canExtend ? () => setExtending({ scholarId: r.scholarId, name: r.scholarName }) : undefined}
                      />
                    ))}
                  </ul>
                </div>
                <Pagination page={page} lastPage={lastPage} disabled={loadingNext} onChange={(p) => go({ page: p })} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function RequestMeta({ cohortName, closesAt }: { cohortName: string | null; closesAt: string | null }) {
  if (!closesAt) return <>{cohortName ?? '전체 기수'}</>
  const overdue = isPastDue(closesAt)
  const dDay = daysUntil(closesAt)
  return (
    <>
      <MetaList
        items={[
          cohortName ?? '전체 기수',
          `마감 ${formatDue(closesAt)}`,
          <span key="d" className={cn((overdue || dDay <= 3) && 'font-semibold text-warning-text')}>
            {dDayText(dDay, overdue)}
          </span>,
        ]}
      />
    </>
  )
}

function Row({ row, requestId, onExtend }: { row: SubmissionRow; requestId: number; onExtend?: () => void }) {
  // 비고: 마감 후, 서류와 다름. 상태와 섞지 않고 맨 끝 열에 둔다
  const notes =
    row.late || row.hasInputError ? (
      <>
        {row.late && <RowNote icon={Clock}>마감 후</RowNote>}
        {row.hasInputError && (
          <RowNote icon={FileWarning} tone="warning">
            서류와 다름
          </RowNote>
        )}
      </>
    ) : null
  const gpa =
    row.gpa != null ? (
      <>
        {row.gpa.toFixed(2)}
        {row.gpaScale && <span className="text-ink-3"> / {row.gpaScale}</span>}
      </>
    ) : null
  const submitted = row.submittedAt ? submittedAt.format(toDate(row.submittedAt)) : null
  const meta = [row.cohortName, row.university].filter(Boolean).join(' ')
  const body = (
    <>
      {/* 휴대폰: 왼쪽은 누구인지(이름, 기수와 학교), 오른쪽은 상태. 아랫줄에 평점, 제출 시각, 비고 */}
      <span className="flex min-w-0 flex-1 flex-col gap-2 md:hidden">
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-body-strong">{row.scholarName}</span>
            <MetaList oneLine items={[row.cohortName, row.university]} className="flex text-caption text-ink-3" />
          </span>
          <StatusBadge status={row.status} />
        </span>
        {(notes || gpa || submitted) && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-2 tabular-nums">
            {gpa && <span>평점 {gpa}</span>}
            {submitted && <span className="text-ink-3">제출 {submitted}</span>}
            {notes}
          </span>
        )}
      </span>

      {/* PC: 열마다 하나씩. 좁은 PC(기수, 학교 열이 없는 폭)는 이름 아래에 기수와 학교. 잘린 글자는 마우스를 올리면 전부 보인다 */}
      <span className="hidden min-w-0 flex-1 flex-col gap-0.5 md:flex xl:w-40 xl:flex-none xl:shrink-0">
        <span className="truncate text-body-strong">{row.scholarName}</span>
        <span className="min-w-0 text-caption text-ink-3 xl:hidden" title={meta || undefined}>
          <MetaList oneLine items={[row.cohortName, row.university]} className="flex" />
        </span>
      </span>
      <span className="hidden w-20 shrink-0 md:flex">
        <StatusBadge status={row.status} />
      </span>
      <span className="hidden w-28 shrink-0 truncate text-ink-2 xl:block">{row.cohortName ?? '–'}</span>
      <span className="hidden min-w-0 shrink grow-0 basis-72 truncate text-ink-2 xl:block" title={row.university ?? undefined}>
        {row.university ?? '–'}
      </span>
      <span className="hidden flex-1 xl:block" />
      <span className="hidden w-20 shrink-0 text-right tabular-nums md:block">{gpa ?? <span className="text-ink-3">–</span>}</span>
      <span className="hidden w-32 shrink-0 text-right text-ink-2 tabular-nums md:block">{submitted ?? '–'}</span>
      <span className="hidden w-28 shrink-0 flex-col items-start gap-0.5 pl-4 md:flex">{notes}</span>
    </>
  )
  const cls = 'flex items-center gap-3 px-6 py-4 md:min-h-row-h md:gap-4 md:py-2'
  return (
    <li className="border-b border-line-subtle last:border-b-0">
      {row.submissionId && row.status !== 'DRAFT' ? (
        <Link
          to={`/manager/submissions/${row.submissionId}`}
          state={{ requestId }}
          className={cn(
            cls,
            'group text-ink no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          )}
        >
          {body}
          <ChevronRight size={20} strokeWidth={1.75} className="hidden shrink-0 text-ink-3 group-hover:text-ink md:block" aria-hidden />
        </Link>
      ) : (
        // 미제출, 작성 중은 볼 내용이 없어 행을 누를 수 없다. 대신 이 장학생의 마감을 늘릴 수 있다
        <div className={cn(cls, 'text-ink')}>
          {body}
          {/* PC: 끝 칸은 화살표 칸과 같은 폭(20px). 버튼은 그 칸 가운데에 두고 넘쳐도 열 위치와 행 높이를 밀지 않는다 */}
          <span className="flex w-5 shrink-0 justify-center">
            {onExtend && (
              <Button size="compact" variant="ghost" aria-label={`${row.scholarName} 마감 연장`} title="마감 연장" onClick={onExtend}>
                <CalendarPlus size={16} strokeWidth={2} aria-hidden />
              </Button>
            )}
          </span>
        </div>
      )}
    </li>
  )
}

// 장학생 한 명의 마감 연장(백엔드 #78). 진행 중인 요청에서, 지금 마감보다 뒤인 시각으로만 늘릴 수 있다
function ExtendDialog({ requestId, target, onClose }: { requestId: number; target: { scholarId: number; name: string }; onClose: () => void }) {
  const toast = useToast()
  const deadline = useTargetDeadline(requestId, target.scholarId)
  const extend = useExtendDeadline(requestId, target.scholarId)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('23:59')
  // 어느 칸 때문인지 나눠 둔다. 서버 오류는 날짜 칸 아래에 보인다
  const [error, setError] = useState<{ field: 'date' | 'time'; message: string } | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const current = deadline.data?.dueAt ?? null

  // 오류가 난 칸으로 포커스를 옮겨 스크린 리더가 오류 문구를 읽게 한다
  const fail = (field: 'date' | 'time', message: string) => {
    setError({ field, message })
    ;(field === 'date' ? dateRef : timeRef).current?.focus()
  }

  const submit = async () => {
    if (!date) return fail('date', '날짜를 고르세요.')
    if (!time) return fail('time', '시각을 고르세요.')
    const dueAt = kstToUtc(date, time)
    if (current && Date.parse(dueAt) <= Date.parse(current)) return fail(kstParts(current).date === date ? 'time' : 'date', '지금 마감보다 뒤로 고르세요.')
    if (Date.parse(dueAt) <= Date.now()) return fail(kstToday() === date ? 'time' : 'date', '지금보다 뒤로 고르세요.')
    setError(null)
    try {
      await extend.mutateAsync(dueAt)
      toast(`${target.name} 님 마감을 ${formatDue(dueAt)}까지 늘렸어요`)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SUBMISSION_LOCKED') fail('date', '진행 중인 요청만 마감을 늘릴 수 있어요.')
      else fail('date', errorText(err))
    }
  }

  return (
    <FormDialog open title="마감 연장" submitLabel="마감 연장" busy={extend.isPending || deadline.isPending} onSubmit={() => void submit()} onCancel={onClose}>
      <p className="m-0 text-ink-2">
        {target.name} 님{deadline.isPending && <span className="text-ink-3">, 지금 마감 확인 중</span>}
        {current && (
          <>
            , 지금 마감 <span className="tabular-nums">{formatDue(current)}</span>
            {deadline.data && deadline.data.dueAt !== deadline.data.commonDueAt && <span className="text-ink-3"> (이미 늘림)</span>}
          </>
        )}
      </p>
      {deadline.isError && (
        <Banner tone="danger" title="지금 마감을 불러오지 못했어요">
          <Button size="compact" onClick={() => void deadline.refetch()}>
            다시 시도
          </Button>
        </Banner>
      )}
      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="새 마감일" required error={error?.field === 'date' ? error.message : undefined}>
          {(p) => (
            <input
              {...p}
              ref={dateRef}
              type="date"
              min={current ? kstParts(current).date : kstToday()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(fieldControl, fieldBorder(error?.field === 'date'))}
            />
          )}
        </LabeledField>
        <LabeledField label="시각" required error={error?.field === 'time' ? error.message : undefined}>
          {(p) => (
            <input
              {...p}
              ref={timeRef}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={cn(fieldControl, fieldBorder(error?.field === 'time'))}
            />
          )}
        </LabeledField>
      </div>
    </FormDialog>
  )
}
