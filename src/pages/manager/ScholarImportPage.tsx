import { ChevronLeft, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useBulkCreateScholars } from '../../api/scholars'
import { CohortField } from '../../components/form/CohortField'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { PageTitle } from '../../components/ui/PageTitle'
import { useToast } from '../../components/ui/useToast'
import { cn } from '../../lib/cn'
import { appUrl } from '../../lib/env'
import { MAX_ROWS, parseScholarSheet, type ImportRow, type Key } from '../../lib/scholarImport'
import { usePageTitle } from '../../lib/usePageTitle'

const TEMPLATE = appUrl('/templates/scholar-import.xlsx')
const FILE_INPUT = 'scholar-import-file'

// 등록할 명단 표의 열. 파일에 있는 값을 모두 보여 줘서 등록 전에 눈으로 확인하게 한다
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
  const [done, setDone] = useState<number | null>(null)

  // 등록이 끝나면 이탈 확인을 끈 뒤(다음 렌더) 명단으로 옮긴다
  useEffect(() => {
    if (done === null) return
    toast(`${done}명을 등록했어요`)
    navigate('/manager/scholars', { replace: true })
  }, [done, navigate, toast])

  const bad = rows.filter((r) => r.errors.length > 0)
  const busy = reading || bulk.isPending || done !== null

  const readFile = async (file: File | undefined) => {
    if (!file || busy) return
    setFileName(file.name)
    setRows([])
    setFileError(null)
    setServerError(null)
    if (!/\.xlsx$/i.test(file.name)) return setFileError('엑셀(.xlsx) 파일만 올릴 수 있어요. 양식 파일을 받아 쓰세요.')
    setReading(true)
    try {
      const { readXlsx } = await import('../../lib/readXlsx')
      const result = parseScholarSheet(readXlsx(await file.arrayBuffer()))
      if (result.fileError) setFileError(result.fileError)
      else setRows(result.rows)
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
        // 이미 등록된 이메일은 고칠 목록에 넣는다
        const taken = new Set((err.details as unknown[]).map((x) => String(x).toLowerCase()))
        setRows((prev) =>
          prev.map((r): ImportRow =>
            taken.has(r.email.toLowerCase()) ? { ...r, errors: [...r.errors, { field: 'email', message: '이미 등록된 이메일이에요' }] } : r,
          ),
        )
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

      {rows.length > 0 && (bad.length > 0 ? <IssueList rows={bad} total={rows.length} /> : <ReadyList rows={rows} />)}

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

const labelOf = (k: Key) => COLUMNS.find((c) => c.key === k)?.label ?? k

// 고칠 것이 있을 때: 고칠 목록만 보인다(11/17). 엑셀로 돌아가 위에서부터 고치기 좋게 문제 하나에 한 줄, 엑셀 줄 순서.
// 화면에서 고치는 도구(Flatfile 등)처럼 표에 칸 색칠을 하지 않고, 가져오기 결과 목록(HubSpot)처럼 줄, 항목, 값, 이유를 글로 적는다
function IssueList({ rows, total }: { rows: ImportRow[]; total: number }) {
  const issues = rows.flatMap((r) =>
    r.errors.map((e, i) => ({ id: `${r.line}-${i}`, line: r.line, label: labelOf(e.field), value: r[e.field], message: e.message })),
  )
  return (
    <section aria-labelledby="issues" className="flex flex-col rounded-lg bg-surface">
      <div className="flex flex-col gap-1 border-b border-line-subtle px-6 py-4 md:px-8">
        <h2 id="issues" className="m-0 text-title-2">
          <span className="tabular-nums">{rows.length}</span>줄을 고쳐야 해요
        </h2>
        <p className="m-0 text-caption text-ink-2">전체 {total}줄 중이에요. 엑셀에서 고친 뒤 다시 올려 주세요.</p>
      </div>

      {/* PC: 표 */}
      <table className="hidden w-full table-fixed border-collapse md:table">
        <colgroup>
          <col className="w-20" />
          <col className="w-28" />
          <col className="w-1/3" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-line-subtle text-left text-caption text-ink-3">
            <th scope="col" className="py-3 pr-4 pl-8 font-normal">
              줄
            </th>
            <th scope="col" className="px-4 py-3 font-normal">
              항목
            </th>
            <th scope="col" className="px-4 py-3 font-normal">
              적힌 값
            </th>
            <th scope="col" className="py-3 pr-8 pl-4 font-normal">
              고칠 점
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((x) => (
            <tr key={x.id} className="border-b border-line-subtle last:border-b-0">
              <td className="py-3 pr-4 pl-8 text-ink-2 tabular-nums">{x.line}</td>
              <td className="px-4 py-3 text-ink">{x.label}</td>
              <td className={cn('truncate px-4 py-3', x.value ? 'text-ink-2' : 'text-ink-3')}>{x.value || '빈칸'}</td>
              <td className="py-3 pr-8 pl-4 text-ink">{x.message}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 휴대폰: 목록 */}
      <ul className="m-0 list-none p-0 md:hidden">
        {issues.map((x) => (
          <li key={x.id} className="flex flex-col gap-1 border-b border-line-subtle px-6 py-4 last:border-b-0">
            <span className="text-caption text-ink-3 tabular-nums">
              {x.line}번째 줄 · {x.label}
            </span>
            <span className="text-body text-ink">{x.message}</span>
            <span className={cn('truncate text-caption', x.value ? 'text-ink-2' : 'text-ink-3')}>적힌 값: {x.value || '빈칸'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// 고칠 것이 없을 때: 등록할 명단. 장학생 명단과 같은 평범한 표
function ReadyList({ rows }: { rows: ImportRow[] }) {
  return (
    <section aria-labelledby="ready" className="flex flex-col rounded-lg bg-surface">
      <div className="flex flex-col gap-1 border-b border-line-subtle px-6 py-4 md:px-8">
        <h2 id="ready" className="m-0 text-title-2">
          <span className="tabular-nums">{rows.length}</span>명을 등록해요
        </h2>
        <p className="m-0 text-caption text-ink-2">이름과 이메일이 맞는지 한 번 더 보세요.</p>
      </div>

      {/* PC: 표 */}
      <table className="hidden w-full table-fixed border-collapse md:table">
        <colgroup>
          {COLUMNS.map((c) => (
            <col key={c.key} className={c.width} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line-subtle text-left text-caption text-ink-3">
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="px-4 py-3 font-normal first:pl-8 last:pr-8">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.line} className="border-b border-line-subtle last:border-b-0">
              {COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'truncate px-4 py-3 first:pl-8 last:pr-8',
                    c.key === 'name' ? 'text-ink' : r[c.key] ? 'text-ink-2' : 'text-ink-3',
                    (c.key === 'phone' || c.key === 'studentNo') && 'tabular-nums',
                  )}
                >
                  {r[c.key] || '–'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 휴대폰: 카드 목록. 이름 아래 값이 있는 칸만 */}
      <ul className="m-0 list-none p-0 md:hidden">
        {rows.map((r) => (
          <li key={r.line} className="flex flex-col gap-1 border-b border-line-subtle px-6 py-4 last:border-b-0">
            <span className="text-body-strong text-ink">{r.name}</span>
            <span className="truncate text-caption text-ink-2">{r.email}</span>
            <span className="truncate text-caption text-ink-3">{[r.university, r.major, r.studentNo, r.phone].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
