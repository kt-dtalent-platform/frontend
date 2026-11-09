// 목업 데이터. 응답 모양은 백엔드 조회 결과(KT-16 TaskRow, KT-17 SubmissionFormData)를 따른다.
// 임시 저장한 값은 sessionStorage에 남겨 새로고침해도 다시 보이게 한다.
import type { Answers, RawSubmissionForm } from '../api/submissions'
import type { SubmissionStatus } from '../api/types'

const DAY = 24 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

// 오늘 기준 n일 뒤 23:59:59 (서버처럼 시간대 없는 형식)
export function dueIn(days: number) {
  const d = new Date(Date.now() + days * DAY)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59:59`
}

export function now() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
  return [31, 35, 28].find((id) => current(id).exists && current(id).id === submissionId)
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
  if (!form || form.request.status === 'CLOSED') return false
  const status = form.submission?.status ?? 'NOT_SUBMITTED'
  if (status === 'SUBMITTED' || status === 'RESUBMITTED' || status === 'CONFIRMED') return false
  return status !== 'REVISION_REQUIRED' || !!form.revision?.fieldKeys.includes(fieldKey)
}

export function fileOwner(fileId: number) {
  for (const id of [31, 35, 28]) {
    const file = current(id).files.find((f) => f.id === fileId)
    if (file) return { requestId: id, fieldKey: file.fieldKey }
  }
  return undefined
}

export function removeFile(fileId: number) {
  for (const id of [31, 35, 28]) {
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
    }),
  }
}

// 장학생 홍길동(2026년 선발)의 제출 요청. MVP는 성적증명서 제출만 다룬다.
// 31: 보완 필요, 35: 미제출, 28: 확인 완료
const gradeFields: RawSubmissionForm['fields'] = [
  { fieldKey: 'gpa', label: '학기 평점', fieldType: 'NUMBER', required: true, validation: { min: 0, max: 4.5 } },
  {
    fieldKey: 'gpa_scale',
    label: '만점 기준',
    fieldType: 'SELECT_ONE',
    required: true,
    options: ['4.5', '4.3'],
    helpText: '학교 성적증명서에 적힌 만점을 고르세요.',
  },
  { fieldKey: 'credits', label: '이수 학점', fieldType: 'NUMBER', required: true, validation: { min: 0, max: 30 } },
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
    35: {
      request: {
        id: 35,
        title: '2026학년도 여름학기 성적증명서 제출',
        description: '여름 계절학기를 들은 경우 성적증명서를 올려 주세요.',
        requestDueAt: dueIn(10),
        status: 'IN_PROGRESS',
      },
      fields: gradeFields,
      submission: null,
      files: [],
      revision: null,
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

export function taskList() {
  return [31, 35, 28].map((id) => {
    const f = getForm(id)!
    return {
      requestId: id,
      title: f.request.title,
      requestDueAt: f.request.requestDueAt,
      status: f.submission?.status ?? 'NOT_SUBMITTED',
      revisionReason: f.revision?.reason ?? null,
    }
  })
}
