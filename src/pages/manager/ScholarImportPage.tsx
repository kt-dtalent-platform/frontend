import { CircleAlert, CircleCheck, ChevronLeft, Download, FileSpreadsheet } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
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
  { key: 'name', label: '이름', width: 'w-24' },
  { key: 'email', label: '이메일', width: 'w-60' },
  { key: 'university', label: '학교', width: 'w-48' },
  { key: 'phone', label: '연락처', width: 'w-32' },
  { key: 'major', label: '전공', width: 'w-36' },
  { key: 'studentNo', label: '학번', width: 'w-28' },
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
              <FileSpreadsheet size={24} strokeWidth={1.75} className="text-ink-3" aria-hidden />
              <span className="text-label text-ink">{reading ? '파일을 읽는 중' : '파일을 여기에 끌어다 놓거나 눌러서 고르세요'}</span>
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
                  <span className="font-semibold text-warning-text tabular-nums">{bad.length}줄</span>을 고쳐야 등록할 수 있어요. 엑셀에서 고친 뒤 파일을 다시
                  올려 주세요.
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
              <col className="w-14" />
              <col className="w-12" />
              {COLUMNS.map((c) => (
                <col key={c.key} className={c.width} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line-subtle text-left text-caption text-ink-3">
                <th scope="col" className="py-2 pl-8 font-normal">
                  <span className="sr-only">상태</span>
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">
                  줄
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="py-2 pr-4 font-normal">
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

// 칸 값. 문제가 있는 칸은 주황 글자, 빈 필수 칸은 "비어 있음"
function Cell({ r, k }: { r: ImportRow; k: Key }) {
  const value = r[k]
  const issue = issueOf(r, k)
  if (!value) return <span className={issue ? 'text-warning-text' : 'text-ink-3'}>{issue ? '비어 있음' : '–'}</span>
  return <span className={cn('block truncate', issue ? 'font-semibold text-warning-text' : k === 'name' ? 'text-ink' : 'text-ink-2')}>{value}</span>
}

function PreviewRow({ r }: { r: ImportRow }) {
  const bad = r.errors.length > 0
  return (
    <>
      <tr className={cn('align-middle', !bad && 'border-b border-line-subtle last:border-b-0')}>
        <td className="py-2.5 pl-8">{bad && <CircleAlert size={16} strokeWidth={2} className="text-warning-text" aria-label="고칠 줄" />}</td>
        <td className="py-2.5 pr-4 text-right text-caption text-ink-3 tabular-nums">{r.line}</td>
        {COLUMNS.map((c) => (
          <td key={c.key} className={cn('py-2.5 pr-4', (c.key === 'phone' || c.key === 'studentNo') && 'tabular-nums')}>
            <Cell r={r} k={c.key} />
          </td>
        ))}
      </tr>
      {bad && (
        // 고칠 이유는 줄 바로 아래에 본문 색으로(색은 아이콘과 문제 칸에만)
        <tr className="border-b border-line-subtle">
          <td />
          <td />
          <td colSpan={COLUMNS.length} className="pr-8 pb-3 text-caption text-ink-2">
            {r.errors.map((e) => e.message).join(', ')}
          </td>
        </tr>
      )}
    </>
  )
}

function PreviewCard({ r }: { r: ImportRow }) {
  const bad = r.errors.length > 0
  return (
    <li className="flex flex-col gap-1 border-b border-line-subtle px-6 py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        {bad && <CircleAlert size={16} strokeWidth={2} className="shrink-0 text-warning-text" aria-label="고칠 줄" />}
        <span className="min-w-0 truncate text-body-strong">
          <Cell r={r} k="name" />
        </span>
        <span className="ml-auto shrink-0 text-caption text-ink-3 tabular-nums">{r.line}번째 줄</span>
      </div>
      <Cell r={r} k="email" />
      <Cell r={r} k="university" />
      {bad && <p className="m-0 text-caption text-ink-2">{r.errors.map((e) => e.message).join(', ')}</p>}
    </li>
  )
}
