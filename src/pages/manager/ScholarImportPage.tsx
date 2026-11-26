import { ChevronLeft, Download, FileSpreadsheet, Mail, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
import { useBulkCreateScholars } from '../../api/scholars'
import { CohortField } from '../../components/form/CohortField'
import { LoginNoticeDialog } from './LoginNoticeDialog'
import { sentText, useNoticeStatus, type NoticeResult } from '../../api/loginNotices'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonClass'
import { PageTitle } from '../../components/ui/PageTitle'
import { useToast } from '../../components/ui/useToast'
import { cn } from '../../lib/cn'
import { appUrl } from '../../lib/env'
import { KEYS, MAX_ROWS, parseScholarSheet, type ImportRow, type Key, type RowIssue } from '../../lib/scholarImport'
import { usePageTitle } from '../../lib/usePageTitle'
import { errorText } from '../../api/errorText'
import { phoneDigits } from '../../lib/phone'

const TEMPLATE = appUrl('/templates/scholar-import.xlsx')
const FILE_INPUT = 'scholar-import-file'

// 미리보기 표의 열. 폭은 내용 길이에 맞춘 비율(이메일, 학교가 가장 길다). 줄 번호 열만 고정 폭
// error: 고칠 줄 표(맨 끝 '고칠 점' 열이 남는 폭을 받는다), ready: 등록할 명단 표(이메일 열이 남는 폭을 받는다).
// 비율 합을 줄 번호 열(64px)과 남는 열이 들어갈 만큼 낮게 둬서 표가 카드 밖으로 넘치지 않게 한다. 표는 xl(1280px) 이상에서만, 그보다 좁으면 카드
const COLUMNS: { key: Key; label: string; error: string; ready: string }[] = [
  { key: 'name', label: '이름', error: 'w-1/12', ready: 'w-1/9' },
  { key: 'email', label: '이메일', error: 'w-1/5', ready: '' },
  { key: 'university', label: '학교', error: 'w-1/6', ready: 'w-1/5' },
  { key: 'phone', label: '연락처', error: 'w-1/9', ready: 'w-1/8' },
  { key: 'major', label: '전공', error: 'w-1/10', ready: 'w-1/8' },
  { key: 'studentNo', label: '학번', error: 'w-1/12', ready: 'w-1/9' },
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
  // 등록 결과(이름, 이메일, 임시 비밀번호). 화면 상태로만 들고 있다가 이 화면을 떠나면 사라진다
  const [created, setCreated] = useState<Account[] | null>(null)

  // 임시 비밀번호가 없는 응답이면(예전 서버) 이탈 확인을 끈 뒤(다음 렌더) 명단으로 옮긴다
  useEffect(() => {
    if (done === null || created) return
    toast(`${done}명을 등록했어요`)
    navigate('/manager/scholars', { replace: true })
  }, [done, created, navigate, toast])

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
        scholars: rows.map(({ name, email, phone, university, major, studentNo }) => ({
          name,
          email,
          phone: phone && phoneDigits(phone),
          university,
          major,
          studentNo,
        })),
      })
      // row는 보낸 명단 순서 + 1이라 그 줄의 이름을 붙인다
      const accounts = (r.items ?? [])
        .filter((it) => it.temporaryPassword)
        .map((it) => ({ id: it.id, name: rows[it.row - 1]?.name ?? '', email: it.email, password: it.temporaryPassword }))
      if (accounts.length) setCreated(accounts)
      bulk.reset()
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
      } else if (err instanceof ApiError && err.code === 'INVALID_REQUEST' && rowIssues(err.details, rows.length)) {
        // 서버가 거절한 칸을 그 줄에 표시한다. row는 엑셀 줄 번호(첫 사람이 2)
        const found = rowIssues(err.details, rows.length)!
        setRows((prev) => prev.map((r, i): ImportRow => (found.has(i) ? { ...r, errors: [...r.errors, ...found.get(i)!] } : r)))
      } else setServerError(errorText(err))
    }
  }

  // 메일을 접수한 장학생의 임시 비밀번호는 서버가 새로 만들어 쓸모가 없으므로 메모리에서도 지운다
  if (created)
    return <ImportResult accounts={created} onMailed={(ids) => setCreated((prev) => prev && prev.map((a) => (ids.has(a.id) ? { ...a, password: '' } : a)))} />

  return (
    <div className="mx-auto flex w-full max-w-page-wide flex-col gap-6">
      {/* 등록 요청 중에 나가면 서버는 계정을 만들지만 임시 비밀번호를 받을 화면이 없어진다. 그래서 따로 경고한다 */}
      <UnsavedChangesGuard
        when={rows.length > 0 && done === null}
        {...(bulk.isPending
          ? {
              title: '등록 중에 나가기',
              message: '지금 나가면 등록은 되지만 임시 비밀번호를 받을 수 없어요. 끝날 때까지 기다려 주세요.',
              confirmLabel: '그래도 나가기',
            }
          : {})}
      />
      <Link to="/manager/scholars" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        장학생
      </Link>
      <PageTitle description="양식에 명단을 채워 올리면 장학생 계정이 한 번에 만들어져요.">장학생 일괄 등록</PageTitle>

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

type Account = { id: number; name: string; email: string; password: string }

// 등록 결과. 로그인 안내는 메일로 보내는 것이 기본이다(백엔드 KT-60). 서버가 장학생마다 새 임시 비밀번호를 만들어 보낸다.
// 메일을 쓸 수 없을 때(메일 서버 미설정 등)만 안내 파일로 받아 직접 전달한다. 임시 비밀번호는 서버가 이 응답에서만 주므로 화면에 늘어놓지 않는다.
// 메일을 보내면 파일 속 비밀번호는 더 쓸 수 없어서 파일 받기를 숨긴다
function ImportResult({ accounts, onMailed }: { accounts: Account[]; onMailed: (ids: Set<number>) => void }) {
  usePageTitle('장학생 일괄 등록 완료')
  const toast = useToast()
  const top = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState(false)
  // 보낼 대상: 처음에는 전원, 실패한 사람을 다시 보낼 때는 그 사람들만
  const [mailing, setMailing] = useState<number[] | null>(null)
  const [mailed, setMailed] = useState<NoticeResult | null>(null)
  const result = useRef<HTMLDivElement>(null)
  // 등록 버튼이 사라지므로 결과 첫머리로 포커스를 옮겨 스크린 리더가 결과를 읽게 한다
  useEffect(() => top.current?.focus(), [])
  const ids = accounts.map((a) => a.id)
  const status = useNoticeStatus(mailed ? ids : [])

  // 파일 이름은 화면에 보여 준 것과 받은 것이 같아야 해서 한 번만 정한다
  const [fileName] = useState(() => {
    const d = new Date()
    return `장학생_로그인안내_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.xlsx`
  })

  const download = async () => {
    try {
      const { writeXlsx, saveBlob } = await import('../../lib/writeXlsx')
      const sheet = [['이름', '아이디(이메일)', '임시 비밀번호'], ...accounts.map((a) => [a.name, a.email, a.password])]
      saveBlob(writeXlsx(sheet, [12, 32, 26]), fileName)
      setSaved(true)
    } catch {
      toast('파일을 만들지 못했어요. 다시 눌러 주세요')
    }
  }

  // 보낸 뒤 진행: 보냄, 보내는 중, 실패, 건너뜀 인원. 건너뛴 사람은 상태 조회에 나오지 않아 접수 결과에서 센다
  const count = (pred: (s: string) => boolean) => status.data?.filter((i) => pred(i.status)).length ?? 0
  const skipped = mailed?.items.filter((i) => i.status === 'SKIPPED').length ?? 0
  const failed = (status.data ?? []).filter((i) => i.status === 'FAILED').map((i) => i.scholarId)
  const nameOf = (id: number) => accounts.find((a) => a.id === id)?.name ?? `${id}번`
  const progress = !mailed
    ? ''
    : status.data
      ? [
          `보냄 ${count((x) => x === 'SENT')}명`,
          `보내는 중 ${count((x) => x === 'PENDING' || x === 'SENDING')}명`,
          `실패 ${failed.length}명`,
          skipped ? `건너뜀 ${skipped}명` : '',
        ]
          .filter(Boolean)
          .join(', ')
      : sentText(mailed)

  const onSent = (r: NoticeResult) => {
    setMailing(null)
    // 아무도 접수되지 않았으면 비밀번호가 그대로 유효하므로 파일 받기를 남겨 둔다
    if (!r.queued) return toast(sentText(r))
    setMailed(r)
    onMailed(new Set(r.items.filter((i) => i.status === 'PENDING').map((i) => i.scholarId)))
    // 메일 보내기 버튼이 사라지므로 결과 문구로 포커스를 옮긴다
    requestAnimationFrame(() => result.current?.focus())
  }

  return (
    <div ref={top} tabIndex={-1} className="mx-auto flex w-full max-w-page-form flex-col gap-6 outline-none">
      <UnsavedChangesGuard
        // 메일을 보냈으면 묻지 않는다. 파일 받기를 눌러도 실제로 저장됐는지는 알 수 없어(Safari 다운로드 거부, 취소) 계속 묻는다
        when={!mailed || failed.length > 0}
        title={mailed ? '실패한 장학생을 두고 나가기' : saved ? '나가기' : '안내를 보내지 않고 나가기'}
        message={
          mailed
            ? '메일을 받지 못한 장학생은 지금 로그인할 수 없어요. 나가면 장학생 상세에서 다시 보내야 해요.'
            : saved
              ? '임시 비밀번호는 다시 볼 수 없어요. 파일이 저장됐는지 확인했나요?'
              : '아직 로그인 안내를 보내지 않았어요. 나가도 나중에 명단에서 골라 메일로 보낼 수 있어요.'
        }
        confirmLabel="나가기"
      />
      <PageTitle>{accounts.length}명을 등록했어요</PageTitle>

      {/* 메일: 기본 방법 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 rounded-lg bg-surface py-3 pr-3 pl-4">
          <Mail size={20} strokeWidth={2} className="shrink-0 text-ink-2" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">로그인 안내 메일</span>
            <span className="text-caption text-ink-3">아이디와 임시 비밀번호를 장학생마다 메일로 보내요</span>
          </div>
          {!mailed && (
            <Button size="compact" variant="primary" onClick={() => setMailing(ids)}>
              메일 보내기
            </Button>
          )}
        </div>
        {/* 처음부터 그려 두고 글만 바꿔야 스크린 리더가 바뀐 내용을 읽는다 */}
        <div ref={result} tabIndex={-1} className="flex flex-col gap-2 outline-none">
          <p role="status" className="m-0 text-caption text-ink-3 tabular-nums">
            {progress}
          </p>
          {failed.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-danger-text">보내지 못함: {failed.map(nameOf).join(', ')}</span>
              <Button size="compact" onClick={() => setMailing(failed)}>
                {failed.length}명 다시 보내기
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 파일: 메일을 쓸 수 없을 때. 메일을 보내면 비밀번호가 바뀌어 숨긴다 */}
      {!mailed && (
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-label text-ink-2">메일을 쓸 수 없을 때</h2>
          <div className="flex items-center gap-3 rounded-lg bg-surface py-3 pr-3 pl-4">
            <FileSpreadsheet size={20} strokeWidth={2} className="shrink-0 text-ink-2" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{fileName}</span>
              <span className="text-caption text-ink-3">이름, 아이디, 임시 비밀번호가 들어 있어요</span>
            </div>
            <Button size="compact" variant="secondary" aria-label={`${fileName} 받기`} onClick={() => void download()}>
              <Download size={16} strokeWidth={2} aria-hidden />
              받기
            </Button>
          </div>
          <p role="status" className="m-0 text-caption text-ink-3">
            {saved ? '전달한 뒤에는 파일을 지우세요.' : '이 화면을 떠나면 다시 받을 수 없어요.'}
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-end">
        <Link to="/manager/scholars" replace className={buttonClass({ variant: 'secondary', size: 'md' })}>
          명단으로
        </Link>
      </div>

      {mailing && <LoginNoticeDialog scholarIds={mailing} who={`${mailing.length}명`} reissue={false} onClose={() => setMailing(null)} onSent={onSent} />}
    </div>
  )
}

const issueOf = (r: ImportRow, k: Key) => r.errors.some((e) => e.field === k)

// 미리보기 표. 고칠 줄 표와 등록할 명단 표가 같이 쓴다(열 순서, 여백, 글자 크기가 같다)
// 고칠 줄 표: 문제 칸은 빨간 글자(빈 칸은 '빈칸'), 이유는 맨 끝 '고칠 점' 열에. 칸 바탕색과 말풍선은 쓰지 않는다(11/17)
function PreviewTable({ rows, mode }: { rows: ImportRow[]; mode: 'error' | 'ready' }) {
  const error = mode === 'error'
  return (
    <table className="hidden w-full table-fixed border-collapse xl:table">
      <colgroup>
        <col className="w-16" />
        {COLUMNS.map((c) => (
          <col key={c.key} className={error ? c.error : c.ready} />
        ))}
        {error && <col />}
      </colgroup>
      <thead>
        <tr className="border-b border-line-subtle text-left text-caption text-ink-3">
          <th scope="col" className="py-3 pr-2 pl-8 font-normal">
            줄
          </th>
          {COLUMNS.map((c) => (
            <th key={c.key} scope="col" className="px-4 py-3 font-normal last:pr-8">
              {c.label}
            </th>
          ))}
          {error && (
            <th scope="col" className="py-3 pr-8 pl-4 font-normal">
              고칠 점
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.line} className="border-b border-line-subtle align-top last:border-b-0">
            <td className="py-3 pr-2 pl-8 text-ink-3 tabular-nums">{r.line}</td>
            {COLUMNS.map((c) => {
              const bad = issueOf(r, c.key)
              const value = r[c.key]
              return (
                <td
                  key={c.key}
                  title={value || undefined}
                  className={cn(
                    'truncate px-4 py-3 last:pr-8',
                    bad ? 'text-danger-text' : !value ? 'text-ink-3' : c.key === 'name' ? 'text-ink' : 'text-ink-2',
                    (c.key === 'phone' || c.key === 'studentNo') && 'tabular-nums',
                  )}
                >
                  {value || (bad ? '빈칸' : '–')}
                </td>
              )
            })}
            {error && <td className="py-3 pr-8 pl-4 text-ink">{r.errors.map((e) => e.message).join(', ')}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// 휴대폰 카드. 이름과 엑셀 줄, 값이 있거나 고칠 칸을 이름표와 함께. 고칠 칸은 빨간 글자, 이유는 카드 아래
function PreviewCard({ r }: { r: ImportRow }) {
  const bad = r.errors.length > 0
  return (
    <li className="flex flex-col gap-2 border-b border-line-subtle px-6 py-4 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <span className={cn('min-w-0 truncate text-body-strong', issueOf(r, 'name') ? 'text-danger-text' : 'text-ink')}>{r.name || '이름 빈칸'}</span>
        <span className="ml-auto shrink-0 text-caption text-ink-3 tabular-nums">{r.line}번째 줄</span>
      </div>
      <dl className="m-0 flex flex-col gap-1 text-caption">
        {COLUMNS.filter((c) => c.key !== 'name' && (r[c.key] || issueOf(r, c.key))).map((c) => (
          <div key={c.key} className="flex gap-3">
            <dt className="w-12 shrink-0 text-ink-3">{c.label}</dt>
            <dd className={cn('m-0 min-w-0 truncate', issueOf(r, c.key) ? 'text-danger-text' : 'text-ink-2')}>{r[c.key] || '빈칸'}</dd>
          </div>
        ))}
      </dl>
      {bad && <p className="m-0 text-caption text-ink">{r.errors.map((e) => e.message).join(', ')}</p>}
    </li>
  )
}

// 고칠 것이 있을 때: 고칠 줄만 모든 열과 함께 보인다. 어느 칸이 문제인지 표에서 바로 보이게(11/17)
function IssueList({ rows, total }: { rows: ImportRow[]; total: number }) {
  return (
    <section aria-labelledby="issues" className="flex flex-col rounded-lg bg-surface">
      <div className="flex flex-col gap-1 border-b border-line-subtle px-6 py-4 md:px-8">
        <h2 id="issues" className="m-0 text-title-2">
          <span className="tabular-nums">{rows.length}</span>줄을 고쳐야 해요
        </h2>
        <p className="m-0 text-caption text-ink-2">전체 {total}줄 중 빨간 글자를 엑셀에서 고친 뒤 다시 올려 주세요.</p>
      </div>
      <PreviewTable rows={rows} mode="error" />
      <ul className="m-0 list-none p-0 xl:hidden">
        {rows.map((r) => (
          <PreviewCard key={r.line} r={r} />
        ))}
      </ul>
    </section>
  )
}

// 고칠 것이 없을 때: 등록할 명단
function ReadyList({ rows }: { rows: ImportRow[] }) {
  return (
    <section aria-labelledby="ready" className="flex flex-col rounded-lg bg-surface">
      <div className="flex flex-col gap-1 border-b border-line-subtle px-6 py-4 md:px-8">
        <h2 id="ready" className="m-0 text-title-2">
          <span className="tabular-nums">{rows.length}</span>명을 등록해요
        </h2>
        <p className="m-0 text-caption text-ink-2">이름과 이메일이 맞는지 한 번 더 보세요.</p>
      </div>
      <PreviewTable rows={rows} mode="ready" />
      <ul className="m-0 list-none p-0 xl:hidden">
        {rows.map((r) => (
          <PreviewCard key={r.line} r={r} />
        ))}
      </ul>
    </section>
  )
}

// 서버 형식 오류(INVALID_REQUEST)의 details: [{ row, field, message }]. 줄마다 고칠 점으로 바꾼다.
// 모르는 모양이거나 명단 밖 줄, 모르는 칸이 있으면 null(일반 오류 문구로 보여 준다)
const SERVER_ISSUE: Record<Key, string> = {
  name: '이름 형식이 맞지 않아요',
  email: '이메일 형식이 아니에요',
  university: '학교 이름 형식이 맞지 않아요',
  phone: '연락처는 0으로 시작하는 숫자 9~11자리예요',
  major: '전공 형식이 맞지 않아요',
  studentNo: '학번 형식이 맞지 않아요',
}
function rowIssues(details: unknown, count: number): Map<number, RowIssue[]> | null {
  if (!Array.isArray(details) || details.length === 0) return null
  const found = new Map<number, RowIssue[]>()
  for (const d of details) {
    const row = (d as { row?: unknown })?.row
    const field = (d as { field?: unknown })?.field
    const i = typeof row === 'number' ? row - 2 : -1
    if (i < 0 || i >= count || !KEYS.includes(field as Key)) return null
    const list = found.get(i) ?? []
    if (!list.some((x) => x.field === field)) list.push({ field: field as Key, message: SERVER_ISSUE[field as Key] })
    found.set(i, list)
  }
  return found
}
