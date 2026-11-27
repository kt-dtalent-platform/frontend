// 목업 데이터. 응답 모양은 백엔드 조회 결과(KT-16 TaskRow, KT-17 SubmissionFormData)를 따른다.
// 임시 저장한 값은 sessionStorage에 남겨 새로고침해도 다시 보이게 한다.
import type { Answers, RawSubmissionForm } from '../api/submissions'
import type { SubmissionStatus } from '../api/types'
import { daysBetween, kstParts, kstToday, kstToUtc } from '../lib/time'

const DAY = 24 * 60 * 60 * 1000

// 오늘(한국 날짜) 기준 n일 뒤 23:59:59 한국 시간을 서버처럼 UTC(끝에 Z)로
export function dueIn(days: number) {
  return kstToUtc(kstParts(new Date(Date.now() + days * DAY)).date, '23:59:59')
}

export function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

type MockFile = RawSubmissionForm['files'][number]
type Saved = Record<
  number,
  {
    answers: Answers
    status: SubmissionStatus
    version: number
    id: number
    files?: MockFile[]
    submittedAt?: string
  }
>
const KEY = 'kt-dtalent:mock-submissions'

function load(): Saved {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}

function persist(saved: Saved) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // 저장소를 못 쓰면 이번 요청에만 반영된다
  }
}

// 지금 상태(기본값 + 저장된 변경)를 한 덩어리로
function current(requestId: number) {
  const saved = load()[requestId]
  const base = forms()[requestId]
  return {
    id: saved?.id ?? base.submission?.id ?? 500 + requestId,
    answers: saved?.answers ?? base.submission?.answers ?? {},
    status: saved?.status ?? base.submission?.status ?? ('NOT_SUBMITTED' as SubmissionStatus),
    version: saved?.version ?? base.submission?.version ?? 0,
    files: saved?.files ?? base.files,
    submittedAt: saved?.submittedAt,
    exists: !!(saved || base.submission),
  }
}

function write(requestId: number, next: Omit<ReturnType<typeof current>, 'exists'>) {
  const saved = load()
  saved[requestId] = next
  persist(saved)
  return next
}

export function saveDraft(requestId: number, answers: Answers) {
  const prev = current(requestId)
  return write(requestId, {
    ...prev,
    answers,
    status: prev.status === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'DRAFT',
    version: prev.version + 1,
  })
}

export function requestOfSubmission(submissionId: number) {
  return [40, 31, 28, 27].find((id) => current(id).exists && current(id).id === submissionId)
}

export function fieldOf(requestId: number, fieldKey: string) {
  return forms()[requestId].fields.find((f) => f.fieldKey === fieldKey)
}

export function addFile(requestId: number, file: MockFile) {
  const prev = current(requestId)
  write(requestId, { ...prev, files: [...prev.files, file] })
}

// 파일을 바꿀 수 있는지: 검토 대기·확인 완료·마감이면 안 되고, 보완 필요면 보완 요청된 항목만
export function canChangeFile(requestId: number, fieldKey: string) {
  const form = getForm(requestId)
  if (!form) return false
  const status = form.submission?.status ?? 'NOT_SUBMITTED'
  // 마감된 요청은 보완 항목만(백엔드 #131)
  if (form.request.status === 'CLOSED' && status !== 'REVISION_REQUIRED') return false
  if (status === 'SUBMITTED' || status === 'RESUBMITTED' || status === 'CONFIRMED') return false
  return status !== 'REVISION_REQUIRED' || !!form.revision?.fieldKeys.includes(fieldKey)
}

export function fileOwner(fileId: number) {
  for (const id of [40, 31, 28, 27]) {
    const file = current(id).files.find((f) => f.id === fileId)
    if (file) return { requestId: id, fieldKey: file.fieldKey }
  }
  return undefined
}

export function removeFile(fileId: number) {
  for (const id of [40, 31, 28, 27]) {
    const prev = current(id)
    if (prev.files.some((f) => f.id === fileId)) {
      write(id, { ...prev, files: prev.files.filter((f) => f.id !== fileId) })
      return id
    }
  }
  return undefined
}

// 제출: 필수 항목을 모두 모아 검사한다(서버처럼 하나씩 끊지 않음)
export function submit(requestId: number, answers: Answers, resubmit: boolean) {
  const prev = current(requestId)
  const form = forms()[requestId]
  const merged = resubmit ? { ...prev.answers, ...answers } : answers
  const editable = resubmit ? (form.revision?.fieldKeys ?? []) : form.fields.map((f) => f.fieldKey)
  const fieldErrors = form.fields
    .filter((f) => f.required && editable.includes(f.fieldKey))
    .filter((f) =>
      f.fieldType === 'FILE'
        ? !prev.files.some((x) => x.fieldKey === f.fieldKey && x.uploadStatus === 'UPLOADED')
        : merged[f.fieldKey] === null || merged[f.fieldKey] === undefined || merged[f.fieldKey] === '',
    )
    .map((f) => ({ key: f.fieldKey, message: '필수 항목입니다' }))
  if (fieldErrors.length) return { fieldErrors }
  return {
    saved: write(requestId, {
      ...prev,
      answers: merged,
      status: resubmit ? 'RESUBMITTED' : 'SUBMITTED',
      version: prev.version + 1,
      submittedAt: now(),
    }),
  }
}

// 장학생 홍길동(2026년 선발)의 제출 요청. MVP는 성적증명서 제출만 다룬다.
// 40: 새로 제출할 요청(아직 안 냄), 31: 보완 필요, 28: 확인 완료
const gradeFields: RawSubmissionForm['fields'] = [
  { fieldKey: 'gpa', label: '학기 평점', fieldType: 'NUMBER', required: true, validation: { min: 0, max: 4.5 }, helpText: '예: 3.85' },
  {
    fieldKey: 'gpa_scale',
    label: '만점 기준',
    fieldType: 'SELECT_ONE',
    required: true,
    options: [
      { value: '4.5', label: '4.5' },
      { value: '4.3', label: '4.3' },
    ],
    helpText: '성적증명서에 적힌 평점 만점을 고르세요.',
  },
  {
    fieldKey: 'credits',
    label: '취득 학점 (F 제외)',
    fieldType: 'NUMBER',
    required: true,
    unit: '학점',
    validation: { min: 0, max: 30 },
    helpText: '예: 18학점을 들었고 3학점이 F면 15',
  },
  {
    fieldKey: 'transcript',
    label: '성적증명서',
    fieldType: 'FILE',
    required: true,
    validation: { allowedExtensions: ['pdf', 'jpg', 'png'], maxSizeMb: 10 },
  },
  { fieldKey: 'note', label: '전달할 내용', fieldType: 'TEXTAREA', required: false, validation: { maxLength: 500 } },
]

function forms(): Record<number, RawSubmissionForm> {
  return {
    40: {
      request: {
        id: 40,
        title: '2026학년도 2학기 성적증명서 제출',
        description: '2학기 성적을 입력하고 성적증명서를 올려 주세요.',
        requestDueAt: dueIn(21),
        status: 'IN_PROGRESS',
      },
      fields: gradeFields,
      submission: null,
      files: [],
      revision: null,
    },
    31: {
      request: {
        id: 31,
        title: '2026학년도 1학기 성적증명서 제출',
        description: '1학기 성적을 입력하고 성적증명서를 올려 주세요.',
        requestDueAt: dueIn(2),
        status: 'IN_PROGRESS',
      },
      fields: gradeFields,
      submission: { id: 501, status: 'REVISION_REQUIRED', answers: { gpa: 3.92, gpa_scale: '4.5', credits: 18, note: null }, version: 4 },
      files: [{ id: 9001, fieldKey: 'transcript', originalName: '성적증명서_2026-1.jpg', uploadStatus: 'UPLOADED' }],
      revision: { id: 71, reason: '성적증명서 사진이 흐려 평점이 보이지 않습니다. 원본 PDF로 다시 올려 주세요.', fieldKeys: ['transcript', 'gpa'] },
    },
    // 마감된 요청인데 보완 요청을 받은 경우(마감 뒤에도 보완 항목은 다시 낼 수 있다)
    27: {
      request: { id: 27, title: '2025학년도 1학기 성적증명서 제출', description: null, requestDueAt: dueIn(-40), status: 'CLOSED' },
      fields: gradeFields,
      submission: { id: 470, status: 'REVISION_REQUIRED', answers: { gpa: 3.71, gpa_scale: '4.5', credits: 18, note: null }, version: 3 },
      files: [{ id: 7001, fieldKey: 'transcript', originalName: '성적증명서_2025-1.pdf', uploadStatus: 'UPLOADED' }],
      revision: { id: 61, reason: '성적증명서의 평점과 입력한 평점이 달라요. 성적증명서를 확인하고 평점을 고쳐 주세요.', fieldKeys: ['gpa'] },
    },
    28: {
      request: { id: 28, title: '2025학년도 2학기 성적증명서 제출', description: null, requestDueAt: dueIn(-15), status: 'CLOSED' },
      fields: gradeFields,
      submission: { id: 480, status: 'CONFIRMED', answers: { gpa: 3.82, gpa_scale: '4.5', credits: 19, note: null }, version: 3 },
      files: [{ id: 8001, fieldKey: 'transcript', originalName: '성적증명서_2025-2.pdf', uploadStatus: 'UPLOADED' }],
      revision: null,
    },
  }
}

export function getForm(requestId: number): RawSubmissionForm | undefined {
  const base = forms()[requestId]
  if (!base) return undefined
  const saved = load()[requestId]
  if (!saved) return base
  const { files, ...submission } = saved
  // 보완 후 다시 제출하면 보완 요청은 끝난 것으로 본다
  const revision = saved.status === 'REVISION_REQUIRED' ? base.revision : null
  return { ...base, submission, files: files ?? base.files, revision }
}

// 백엔드처럼 진행 중인 요청과, 마감됐지만 보완 요청을 받은 요청(마감된 나머지는 내 제출 이력에서 본다)
export function taskList() {
  return [40, 31, 28, 27]
    .filter((id) => {
      const f = getForm(id)!
      return f.request.status === 'IN_PROGRESS' || f.submission?.status === 'REVISION_REQUIRED'
    })
    .map((id) => {
      const f = getForm(id)!
      return {
        requestId: id,
        title: f.request.title,
        dueAt: f.request.requestDueAt,
        dDay: daysBetween(kstToday(), kstParts(f.request.requestDueAt).date),
        status: f.submission?.status ?? 'NOT_SUBMITTED',
        revisionReason: f.revision?.reason ?? null,
      }
    })
}

// GET /me/submissions: 작성 중을 뺀 내 제출, 최근 제출 순. 기본 데이터의 제출 시각은 마감 며칠 전으로 둔다
export function submissionHistory() {
  const saved = load()
  return [40, 31, 28, 27]
    .map((id) => ({ id, form: getForm(id)! }))
    .filter(({ form }) => form.submission && form.submission.status !== 'DRAFT')
    .map(({ id, form }) => ({
      requestId: id,
      title: form.request.title,
      status: form.submission!.status,
      submittedAt: saved[id]?.submittedAt ?? (id === 28 ? dueIn(-18) : id === 27 ? dueIn(-42) : dueIn(-3)),
      confirmedAt: form.submission!.status === 'CONFIRMED' ? dueIn(-12) : null,
      purged: false,
    }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}
