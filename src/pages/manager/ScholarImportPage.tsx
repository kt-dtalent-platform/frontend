import { CircleCheck, ChevronLeft, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useBulkCreateScholars } from '../../api/scholars'
import { CohortField } from '../../components/form/CohortField'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { FilterChips } from '../../components/ui/FilterChips'
import { PageTitle } from '../../components/ui/PageTitle'
import { useToast } from '../../components/ui/useToast'
import { cn } from '../../lib/cn'
import { appUrl } from '../../lib/env'
import { MAX_ROWS, parseScholarSheet, type ImportRow, type Key } from '../../lib/scholarImport'
import { usePageTitle } from '../../lib/usePageTitle'

const TEMPLATE = appUrl('/templates/scholar-import.xlsx')
const FILE_INPUT = 'scholar-import-file'

// 미리보기 열. 파일에 있는 값을 모두 보여 줘서 등록 전에 눈으로 확인하게 한다
const COLUMNS: { key: Key; label: string; width: string }[] = [
  { key: 'name', label: '이름', width: 'w-1/8' },
  { key: 'email', label: '이메일', width: 'w-1/4' },
  { key: 'university', label: '학교', width: 'w-1/5' },
  { key: 'phone', label: '연락처', width: 'w-1/8' },
  { key: 'major', label: '전공', width: 'w-1/8' },
  { key: 'studentNo', label: '학번', width: '' },
]

// A07 장학생 일괄 등록(11/15). 양식 엑셀을 고르면 화면에서 바로 읽어 칸마다 검사하고,
// 문제가 없을 때만 명단을 백엔드로 보낸다. 엑셀 읽기(fflate로 압축 풀기)는 파일을 고를 때만 불러온다
export function ScholarImportPage() {
  usePageTitle('장학생 일괄 등록')
  const navigate = useNavigate()
  const toast = useToast()
  const bulk = useBulkCreateScholars()
  const fileRef = useRef<HTMLInputElement>(null)

  const [cohort, setCohort] = useState('')
  const [cohortError, setCohortError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [onlyBad, setOnlyBad] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  // 등록이 끝나면 이탈 확인을 끈 뒤(다음 렌더) 명단으로 옮긴다
  useEffect(() => {
    if (done === null) return
    toast(`${done}명을 등록했어요`)
    navigate('/manager/scholars', { replace: true })
  }, [done, navigate, toast])

  const bad = rows.filter((r) => r.errors.length > 0)
  const shown = onlyBad ? bad : rows
  const busy = reading || bulk.isPending || done !== null

  const readFile = async (file: File | undefined) => {
    if (!file || busy) return
    setFileName(file.name)
    setRows([])
    setFileError(null)
    setServerError(null)
    setOnlyBad(false)
    if (!/\.xlsx$/i.test(file.name)) return setFileError('엑셀(.xlsx) 파일만 올릴 수 있어요. 양식 파일을 받아 쓰세요.')
    setReading(true)
    try {
      const { readXlsx } = await import('../../lib/readXlsx')
      const result = parseScholarSheet(readXlsx(await file.arrayBuffer()))
      if (result.fileError) setFileError(result.fileError)
      else {
        setRows(result.rows)
        // 확인할 줄이 있으면 그 줄부터 보여 준다
        setOnlyBad(result.rows.some((r) => r.errors.length > 0))
      }
    } catch {
      setFileError('파일을 읽지 못했어요. 엑셀에서 다시 저장한 뒤 올려 주세요.')
    } finally {
      setReading(false)
      // 같은 파일을 고쳐서 다시 골라도 읽히게 비운다
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void readFile(e.dataTransfer.files[0])
  }

  const submit = async () => {
    if (!cohort) return setCohortError('기수를 고르세요.')
    setServerError(null)
    try {
      const r = await bulk.mutateAsync({
        cohortId: Number(cohort),
        scholars: rows.map(({ name, email, phone, university, major, studentNo }) => ({ name, email, phone, university, major, studentNo })),
      })
      setDone(r.created)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_EMAIL' && Array.isArray(err.details)) {
        // 이미 등록된 이메일을 해당 칸에 표시하고 그 줄만 보이게 한다
        const taken = new Set((err.details as unknown[]).map((x) => String(x).toLowerCase()))
        setRows((prev) =>
          prev.map((r): ImportRow =>
            taken.has(r.email.toLowerCase()) ? { ...r, errors: [...r.errors, { field: 'email', message: '이미 등록된 이메일이에요' }] } : r,
          ),
        )
        setOnlyBad(true)
      } else setServerError(err instanceof ApiError ? err.message : '잠시 뒤 다시 시도하세요.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-page-wide flex-col gap-6">
      <UnsavedChangesGuard when={rows.length > 0 && done === null} />
      <Link to="/manager/scholars" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        장학생
      </Link>
      <PageTitle description="양식에 명단을 채워 올리면 여러 명을 한 번에 등록해요. 등록하면 장학생 계정이 만들어져요.">장학생 일괄 등록</PageTitle>

      <section className="flex flex-col gap-6 rounded-lg bg-surface px-6 py-6 md:px-8">
        <div className="md:max-w-page-narrow">
          <CohortField value={cohort} onChange={(v) => (setCohort(v), setCohortError(null))} error={cohortError ?? undefined} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={FILE_INPUT} className="text-label text-ink">
              명단 파일
            </label>
            <a href={TEMPLATE} download="장학생-일괄등록-양식.xlsx" className={buttonClass({ variant: 'ghost', size: 'compact' })}>
              <Download size={16} strokeWidth={2} aria-hidden />
              양식 받기
            </a>
          </div>
          <input
            ref={fileRef}
            id={FILE_INPUT}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy}
            aria-describedby={fileError ? `${FILE_INPUT}-error` : undefined}
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
          {rows.length > 0 ? (
            // 읽은 뒤: 파일 한 줄로 접는다
            <div className="flex min-h-control-h items-center gap-3 rounded-md bg-surface-sunken px-4">
              <FileSpreadsheet size={20} strokeWidth={1.75} className="shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{fileName}</span>
              <span className="shrink-0 text-caption text-ink-3 tabular-nums">{rows.length}명</span>
              <label htmlFor={FILE_INPUT} className={cn(buttonClass({ variant: 'ghost', size: 'compact' }), 'cursor-pointer', busy && 'pointer-events-none')}>
                다른 파일
              </label>
            </div>
          ) : (
            // 읽기 전: 끌어다 놓거나 눌러서 고르는 칸
            <label
              htmlFor={FILE_INPUT}
              onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center transition-colors',
                fileError ? 'border-danger-line' : 'border-line-control',
                dragOver ? 'bg-control-tonal' : 'hover:bg-control-tonal',
              )}
            >
              <Upload size={24} strokeWidth={1.75} className="text-ink-3" aria-hidden />
              <span className="text-label text-ink">
                {reading ? (
                  '파일을 읽는 중'
                ) : (
                  <>
                    {/* 휴대폰은 끌어다 놓을 수 없어서 고르기만 안내 */}
                    <span className="md:hidden">눌러서 파일을 고르세요</span>
                    <span className="hidden md:inline">파일을 여기에 끌어다 놓거나 눌러서 고르세요</span>
                  </>
                )}
              </span>
              <span className="text-caption text-ink-3">양식의 이름, 이메일, 학교는 꼭 채워 주세요. 한 번에 {MAX_ROWS}명까지 올릴 수 있어요.</span>
            </label>
          )}
          {fileError && (
            <p id={`${FILE_INPUT}-error`} className="m-0 text-caption text-danger-text">
              {fileError}
            </p>
          )}
        </div>
      </section>

      {serverError && (
        <Banner tone="danger" title="등록하지 못했어요">
          {serverError}
        </Banner>
      )}

      {rows.length > 0 && (
        <section aria-labelledby="preview" className="flex flex-col rounded-lg bg-surface">
          <div className="flex flex-col gap-3 border-b border-line-subtle px-6 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="flex flex-col gap-1">
              <h2 id="preview" className="m-0 text-title-2">
                미리보기
              </h2>
              {bad.length > 0 ? (
                <p className="m-0 text-caption text-ink-2">
                  <span className="font-semibold text-ink tabular-nums">{bad.length}줄</span>을 엑셀에서 고친 뒤 다시 올려 주세요.
                  <span className="hidden md:inline"> 표시된 칸에 마우스를 올리면 이유가 보여요.</span>
                </p>
              ) : (
                <p className="m-0 inline-flex items-center gap-1 text-caption text-ink-2">
                  <CircleCheck size={16} strokeWidth={2} className="text-success-text" aria-hidden />
                  {rows.length}명 모두 등록할 수 있어요
                </p>
              )}
            </div>
            {bad.length > 0 && (
              <FilterChips
                label="보기"
                value={onlyBad}
                onChange={setOnlyBad}
                items={[
                  { value: true, label: '고칠 줄', count: bad.length },
                  { value: false, label: '전체', count: rows.length },
                ]}
              />
            )}
          </div>

          {/* PC: 표 */}
          <table className="hidden w-full table-fixed border-collapse md:table">
            <colgroup>
              <col className="w-20" />
              {COLUMNS.map((c) => (
                <col key={c.key} className={c.width} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line-subtle text-left text-caption text-ink-3">
                <th scope="col" className="py-3 pr-4 pl-8 font-normal">
                  줄
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-4 py-3 font-normal last:pr-8">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <PreviewRow key={r.line} r={r} />
              ))}
            </tbody>
          </table>

          {/* 휴대폰: 카드 목록 */}
          <ul className="m-0 list-none p-0 md:hidden">
            {shown.map((r) => (
              <PreviewCard key={r.line} r={r} />
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Link to="/manager/scholars" className={buttonClass({ variant: 'secondary', size: 'md' })}>
            취소
          </Link>
          <Button variant="primary" size="md" disabled={busy || bad.length > 0} onClick={() => void submit()}>
            {bulk.isPending ? '등록하는 중' : `${rows.length}명 등록하기`}
          </Button>
        </div>
      )}
    </div>
  )
}

const issueOf = (r: ImportRow, key: Key) => r.errors.some((e) => e.field === key)

// 칸 값. 빈 칸은 "–", 빈 필수 칸은 "비어 있음"
function Value({ r, k }: { r: ImportRow; k: Key }) {
  const value = r[k]
  if (!value) return <>{issueOf(r, k) ? '비어 있음' : '–'}</>
  return <>{value}</>
}

// 표 칸. 문제가 있는 칸만 옅은 주황 바탕으로 표시한다(글자는 본문 색).
// 이유는 마우스를 올리거나 키보드로 오면 칸 위에 작은 말풍선으로. 줄 높이는 늘 같다(Flatfile, OneSchema 같은 가져오기 화면의 칸 단위 표시)
function Cell({ r, k }: { r: ImportRow; k: Key }) {
  const tipId = useId()
  const issues = r.errors.filter((e) => e.field === k)
  if (issues.length === 0)
    return (
      <span className={cn('block truncate', !r[k] ? 'text-ink-3' : k === 'name' ? 'text-ink' : 'text-ink-2')}>
        <Value r={r} k={k} />
      </span>
    )
  return (
    <span
      tabIndex={0}
      aria-describedby={tipId}
      className="group relative -mx-2 flex min-w-0 items-center rounded-sm bg-danger-bg px-2 text-ink outline-none focus-visible:outline-2 focus-visible:outline-focus"
    >
      <span className={cn('truncate', !r[k] && 'text-danger-text')}>
        <Value r={r} k={k} />
      </span>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-(--z-popover) mb-2 hidden rounded-sm bg-ink px-2 py-1 text-caption whitespace-nowrap text-surface shadow-pop group-hover:block group-focus-visible:block"
      >
        {issues.map((e) => e.message).join(', ')}
      </span>
    </span>
  )
}

function PreviewRow({ r }: { r: ImportRow }) {
  const bad = r.errors.length > 0
  return (
    <tr className="border-b border-line-subtle last:border-b-0">
      {/* 고칠 줄은 줄 번호 앞에 작은 빨간 점 하나만. 문제 칸은 연한 빨강 바탕(표 계산 프로그램과 가져오기 도구에서 흔한 방식) */}
      <td className="py-3 pr-4 pl-8 text-caption text-ink-3 tabular-nums">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className={cn('size-1.5 rounded-full', bad ? 'bg-danger-text' : 'bg-transparent')} />
          {r.line}
          {bad && <span className="sr-only">고칠 줄</span>}
        </span>
      </td>
      {COLUMNS.map((c) => (
        <td key={c.key} className={cn('px-4 py-3 last:pr-8', (c.key === 'phone' || c.key === 'studentNo') && 'tabular-nums')}>
          <Cell r={r} k={c.key} />
        </td>
      ))}
    </tr>
  )
}

// 휴대폰: 표 대신 카드. 값이 있거나 고칠 칸을 이름과 함께 보이고, 말풍선 대신 이유를 카드 안에 적는다
// 오류 표시는 입력 폼과 같은 말: 문제 값과 이유를 빨간 글자로(바탕색 상자는 두지 않는다)
function PreviewCard({ r }: { r: ImportRow }) {
  const bad = r.errors.length > 0
  return (
    <li className="flex flex-col gap-2 border-b border-line-subtle px-6 py-4 last:border-b-0">
      <div className="flex items-center gap-2">
        {bad && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-danger-text" />}
        <span className={cn('min-w-0 truncate text-body-strong', issueOf(r, 'name') && 'text-danger-text')}>
          <Value r={r} k="name" />
        </span>
        <span className="ml-auto shrink-0 text-caption text-ink-3 tabular-nums">
          {r.line}번째 줄{bad && <span className="sr-only">, 고칠 줄</span>}
        </span>
      </div>
      <dl className="m-0 flex flex-col gap-1 text-caption">
        {/* 값이 있거나 고칠 칸만 보여서 카드를 짧게 한다 */}
        {COLUMNS.filter((c) => c.key !== 'name' && (r[c.key] || issueOf(r, c.key))).map((c) => (
          <div key={c.key} className="flex gap-3">
            <dt className="w-12 shrink-0 text-ink-3">{c.label}</dt>
            <dd className={cn('m-0 min-w-0 truncate', issueOf(r, c.key) ? 'text-danger-text' : 'text-ink-2')}>
              <Value r={r} k={c.key} />
            </dd>
          </div>
        ))}
      </dl>
      {bad && <p className="m-0 text-caption text-danger-text">{r.errors.map((e) => e.message).join(', ')}</p>}
    </li>
  )
}
