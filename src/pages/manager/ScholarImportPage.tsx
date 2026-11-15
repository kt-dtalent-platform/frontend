import { ChevronLeft, Download, FileSpreadsheet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMe } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useCohorts } from '../../api/manager'
import { useBulkCreateScholars } from '../../api/scholars'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { LabeledField, SelectBox } from '../../components/form/LabeledField'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { PageTitle } from '../../components/ui/PageTitle'
import { useToast } from '../../components/ui/useToast'
import { cn } from '../../lib/cn'
import { appUrl } from '../../lib/env'
import { MAX_ROWS, parseScholarSheet, type ImportRow } from '../../lib/scholarImport'
import { usePageTitle } from '../../lib/usePageTitle'

const TEMPLATE = appUrl('/templates/scholar-import.xlsx')

// A07 장학생 일괄 등록(11/15). 양식 엑셀을 고르면 화면에서 바로 읽어 줄마다 검사하고,
// 문제가 없을 때만 명단을 백엔드로 보낸다. 엑셀 읽기(fflate로 압축 풀기)는 파일을 고를 때만 불러온다
export function ScholarImportPage() {
  usePageTitle('엑셀로 장학생 등록')
  const navigate = useNavigate()
  const toast = useToast()
  const me = useMe()
  const cohorts = useCohorts(me.data?.accessiblePrograms?.[0]?.id)
  const bulk = useBulkCreateScholars()
  const fileRef = useRef<HTMLInputElement>(null)

  const [cohort, setCohort] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [cohortError, setCohortError] = useState<string | null>(null)
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

  const onFile = async (file: File | undefined) => {
    if (!file) return
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
        // 이미 등록된 이메일을 해당 줄에 표시한다
        const taken = new Set((err.details as string[]).map((e) => String(e).toLowerCase()))
        setRows((prev) => prev.map((r) => (taken.has(r.email.toLowerCase()) ? { ...r, errors: [...r.errors, '이미 등록된 이메일이에요'] } : r)))
        setServerError(`이미 등록된 이메일이 ${taken.size}개 있어요. 그 줄을 지우거나 고친 뒤 파일을 다시 올려 주세요.`)
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
      <PageTitle description="양식에 명단을 채워 올리면 한 번에 등록해요. 계정은 등록할 때 만들어져요.">엑셀로 장학생 등록</PageTitle>

      <section className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-8 md:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          <LabeledField label="기수" required error={cohortError ?? undefined}>
            {(p) => (
              <SelectBox>
                <select
                  {...p}
                  value={cohort}
                  onChange={(e) => (setCohort(e.target.value), setCohortError(null))}
                  className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(!!cohortError))}
                >
                  <option value="">기수 선택</option>
                  {cohorts.data?.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </SelectBox>
            )}
          </LabeledField>
          <div className="flex flex-col gap-2">
            <span className="text-label text-ink">명단 파일</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                id="import-file"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <label htmlFor="import-file" className={cn(buttonClass({ variant: 'secondary', size: 'md' }), 'cursor-pointer', busy && 'pointer-events-none')}>
                <FileSpreadsheet size={16} strokeWidth={2} aria-hidden />
                {fileName ? '다른 파일 고르기' : '파일 고르기'}
              </label>
              <a href={TEMPLATE} download="장학생-일괄등록-양식.xlsx" className={buttonClass({ variant: 'ghost', size: 'md' })}>
                <Download size={16} strokeWidth={2} aria-hidden />
                양식 받기
              </a>
            </div>
            <p className="m-0 text-caption text-ink-3" aria-live="polite">
              {reading ? '파일을 읽는 중' : fileName ? fileName : `양식 파일(.xlsx)에 이름, 이메일, 학교를 채워 주세요. 한 번에 ${MAX_ROWS}명까지.`}
            </p>
          </div>
        </div>
      </section>

      {fileError && (
        <Banner tone="warning" title="파일을 확인해 주세요">
          {fileError}
        </Banner>
      )}
      {serverError && (
        <Banner tone="warning" title="등록하지 못했어요">
          {serverError}
        </Banner>
      )}

      {rows.length > 0 && (
        <section aria-labelledby="preview" className="flex flex-col rounded-lg bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-subtle px-6 py-4 md:px-8">
            <h2 id="preview" className="m-0 text-title-2">
              미리보기
            </h2>
            <p className="m-0 text-ink-2">
              <span className="tabular-nums">{rows.length}명</span>
              {bad.length > 0 && <span className="ml-2 text-warning-text tabular-nums">확인할 줄 {bad.length}개</span>}
            </p>
          </div>
          <ul className="m-0 list-none p-0">
            <li aria-hidden className="hidden h-control-default items-center gap-4 border-b border-line-subtle px-6 text-caption text-ink-3 md:flex md:px-8">
              <span className="w-12 text-right">줄</span>
              <span className="w-28">이름</span>
              <span className="w-56">이메일</span>
              <span className="w-44">학교</span>
              <span className="w-32">연락처</span>
              <span className="flex-1">확인</span>
            </li>
            {rows.map((r) => (
              <PreviewRow key={r.line} r={r} />
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          {bad.length > 0 && <p className="m-0 text-caption text-ink-3 md:mr-auto">확인할 줄을 엑셀에서 고친 뒤 파일을 다시 올려 주세요.</p>}
          <div className="flex flex-col-reverse gap-2 md:flex-row">
            <Link to="/manager/scholars" className={buttonClass({ variant: 'secondary', size: 'md' })}>
              취소
            </Link>
            <Button variant="primary" size="md" disabled={busy || bad.length > 0} onClick={() => void submit()}>
              {bulk.isPending ? '등록하는 중' : `${rows.length}명 등록하기`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewRow({ r }: { r: ImportRow }) {
  const bad = r.errors.length > 0
  return (
    <li className="flex flex-col gap-1 border-b border-line-subtle px-6 py-3 last:border-b-0 md:min-h-row-h md:flex-row md:items-center md:gap-4 md:px-8 md:py-2">
      <span className="hidden text-right text-caption text-ink-3 tabular-nums md:block md:w-12">{r.line}</span>
      {/* 휴대폰: 이름 줄에 엑셀 줄 번호, 아래에 이메일과 학교 */}
      <span className="flex min-w-0 items-center gap-2 md:w-28">
        <span className={cn('truncate text-body-strong', !r.name && 'text-ink-3')}>{r.name || '이름 없음'}</span>
        <span className="text-caption text-ink-3 tabular-nums md:hidden">{r.line}번째 줄</span>
      </span>
      <span className={cn('min-w-0 truncate md:w-56', r.email ? 'text-ink-2' : 'text-ink-3')}>{r.email || '이메일 없음'}</span>
      <span className={cn('min-w-0 truncate md:w-44', r.university ? 'text-ink-2' : 'text-ink-3')}>{r.university || '학교 없음'}</span>
      <span className="hidden truncate text-ink-2 tabular-nums md:block md:w-32">{r.phone ?? '–'}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        {bad ? (
          <span className="text-caption text-warning-text">{r.errors.join(', ')}</span>
        ) : (
          <span className="hidden text-caption text-ink-3 md:inline">문제 없음</span>
        )}
      </span>
    </li>
  )
}
