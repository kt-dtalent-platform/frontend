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

type Saved = Record<number, { answers: Answers; status: SubmissionStatus; version: number; id: number }>
const KEY = 'kt-dtalent:mock-submissions'

function load(): Saved {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}

export function saveDraft(requestId: number, answers: Answers) {
  const saved = load()
  const base = forms()[requestId].submission
  const prev = saved[requestId] ?? base
  const next = {
    id: prev?.id ?? 500 + requestId,
    answers,
    status: (prev?.status === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'DRAFT') as SubmissionStatus,
    version: (prev?.version ?? 0) + 1,
  }
  saved[requestId] = next
  try {
    sessionStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // 저장소를 못 쓰면 이번 요청에만 반영된다
  }
  return next
}

// 31: 보완 필요(교통비), 35: 미제출(성적 증빙), 28: 확인 완료
function forms(): Record<number, RawSubmissionForm> {
  return {
    31: {
      request: { id: 31, title: '10월 행사 교통비 증빙', description: '10/5 행사 참석 교통비 영수증을 제출해 주세요.', requestDueAt: dueIn(2), status: 'IN_PROGRESS' },
      fields: [
        { fieldKey: 'used_on', label: '이용일자', fieldType: 'DATE', required: true },
        { fieldKey: 'method', label: '교통수단', fieldType: 'SELECT_ONE', required: true, options: ['KTX', '고속버스', '항공', '기타'] },
        { fieldKey: 'amount', label: '금액(원)', fieldType: 'NUMBER', required: true, validation: { min: 0, max: 300000 } },
        { fieldKey: 'receipt', label: '영수증', fieldType: 'FILE', required: true, validation: { allowedExtensions: ['jpg', 'png', 'pdf'], maxSizeMb: 10 } },
      ],
      submission: { id: 501, status: 'REVISION_REQUIRED', answers: { used_on: '2026-10-05', method: 'KTX', amount: 48600 }, version: 4 },
      files: [{ id: 9001, fieldKey: 'receipt', originalName: 'ktx_receipt.jpg', uploadStatus: 'UPLOADED' }],
      revision: { id: 71, reason: '영수증 이미지가 흐려 금액이 보이지 않습니다.', fieldKeys: ['receipt', 'amount'] },
    },
    35: {
      request: {
        id: 35,
        title: '2학기 지속심사 서류 제출',
        description: '직전 학기 성적을 입력하고 성적증명서를 올려 주세요. 평점은 F 과목을 포함한 전체 평균입니다.',
        requestDueAt: dueIn(10),
        status: 'IN_PROGRESS',
      },
      fields: [
        { fieldKey: 'semester', label: '학기', fieldType: 'SELECT_ONE', required: true, options: ['2026-1학기', '2025-2학기'] },
        { fieldKey: 'gpa', label: '직전 학기 평점', fieldType: 'NUMBER', required: true, validation: { min: 0, max: 4.5 }, helpText: 'F 과목을 포함한 평균을 소수 둘째 자리까지 입력하세요.' },
        { fieldKey: 'gpa_scale', label: '만점 기준', fieldType: 'SELECT_ONE', required: true, options: ['4.5', '4.3'], helpText: '학교 성적증명서에 적힌 만점을 고르세요.' },
        { fieldKey: 'credits', label: '이수 학점', fieldType: 'NUMBER', required: true, validation: { min: 0, max: 30 } },
        { fieldKey: 'has_f', label: 'F 과목이 있어요', fieldType: 'CHECKBOX', required: false },
        { fieldKey: 'transcript', label: '성적증명서', fieldType: 'FILE', required: true, validation: { allowedExtensions: ['pdf'], maxSizeMb: 10 } },
        { fieldKey: 'note', label: '전달할 내용', fieldType: 'TEXTAREA', required: false, validation: { maxLength: 500 } },
      ],
      submission: null,
      files: [],
      revision: null,
    },
    28: {
      request: { id: 28, title: '1학기 성적 증빙', description: null, requestDueAt: dueIn(-15), status: 'CLOSED' },
      fields: [
        { fieldKey: 'gpa', label: '직전 학기 평점', fieldType: 'NUMBER', required: true },
        { fieldKey: 'gpa_scale', label: '만점 기준', fieldType: 'SELECT_ONE', required: true, options: ['4.5', '4.3'] },
      ],
      submission: { id: 480, status: 'CONFIRMED', answers: { gpa: 3.82, gpa_scale: '4.5' }, version: 3 },
      files: [],
      revision: null,
    },
  }
}

export function getForm(requestId: number): RawSubmissionForm | undefined {
  const base = forms()[requestId]
  if (!base) return undefined
  const saved = load()[requestId]
  return saved ? { ...base, submission: saved } : base
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
