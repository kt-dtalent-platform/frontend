// 담당자 화면 목업. 모양은 노션 명세서(옛 자료)에서 MVP 범위만 가져왔다(확인 필요).
import type { Cohort, CreateRequestBody, RequestRow, RequestTemplate } from '../api/manager'
import { dueIn } from './db'

const opened = (days: number) => dueIn(-days).replace('23:59:59', '09:00:00')

// 성적은 기수와 상관없이 학기마다 전원에게 한 번 받는다(11/12). 계절학기, 추가 제출은 두지 않는다.
// 진행 중 1, 작성 중 1, 마감 2. 2026년 선발은 2026학년도부터 받는다.
export function rows(): RequestRow[] {
  const base = { templateCode: 'GRADE_CERTIFICATE', cohortName: null }
  const list: RequestRow[] = [
    {
      ...base,
      id: 31,
      title: '2026학년도 1학기 성적증명서 제출',
      status: 'IN_PROGRESS',
      opensAt: opened(12),
      closesAt: dueIn(2),
      targetCount: 94,
      submittedCount: 72,
      revisionCount: 5,
    },
    {
      ...base,
      id: 40,
      title: '2026학년도 2학기 성적증명서 제출',
      status: 'DRAFT',
      opensAt: null,
      closesAt: null,
      targetCount: 0,
      submittedCount: 0,
      revisionCount: 0,
    },
    {
      ...base,
      id: 28,
      title: '2025학년도 2학기 성적증명서 제출',
      status: 'CLOSED',
      opensAt: opened(120),
      closesAt: dueIn(-100),
      targetCount: 47,
      submittedCount: 47,
      revisionCount: 0,
    },
    {
      ...base,
      id: 27,
      title: '2025학년도 1학기 성적증명서 제출',
      status: 'CLOSED',
      opensAt: opened(290),
      closesAt: dueIn(-270),
      targetCount: 47,
      submittedCount: 46,
      revisionCount: 0,
    },
  ]
  // 수정·공개한 내용을 미리 만든 행에도 덮어쓴다
  const ed = edits()
  return [...created(), ...list].map((r) => (ed[r.id] ? { ...r, ...ed[r.id].row } : r))
}

export function requestList(status: string | null, page: number, pageSize: number) {
  const all = rows().filter((r) => !status || r.status === status)
  const p = Math.max(1, page)
  return { items: all.slice((p - 1) * pageSize, p * pageSize), page: p, pageSize, total: all.length }
}

// ── 요청 만들기 목업 ──

export const templates: RequestTemplate[] = [
  {
    id: 1,
    code: 'GRADE_CERTIFICATE',
    name: '성적증명서 제출',
    fields: [
      { fieldKey: 'gpa', label: '학기 평점', fieldType: 'NUMBER', required: true },
      { fieldKey: 'gpa_scale', label: '만점 기준', fieldType: 'SELECT_ONE', required: true },
      { fieldKey: 'credits', label: '이수 학점', fieldType: 'NUMBER', required: true },
      { fieldKey: 'transcript', label: '성적증명서', fieldType: 'FILE', required: true },
    ],
  },
]

export const cohorts: Cohort[] = [
  { id: 5, name: '2025년 선발', startedOn: '2025-03-01', endedOn: null, scholarCount: 47 },
  { id: 6, name: '2026년 선발', startedOn: '2026-03-01', endedOn: null, scholarCount: 47 },
]

const KEY = 'kt-dtalent:mock-created-requests'
const BODIES = 'kt-dtalent:mock-created-request-bodies'

function bodies(): Record<number, CreateRequestBody> {
  try {
    return JSON.parse(sessionStorage.getItem(BODIES) ?? '{}') as Record<number, CreateRequestBody>
  } catch {
    return {}
  }
}

function saveBody(id: number, body: CreateRequestBody) {
  try {
    sessionStorage.setItem(BODIES, JSON.stringify({ ...bodies(), [id]: body }))
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만
  }
}

function created(): RequestRow[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as RequestRow[]
  } catch {
    return []
  }
}

function saveCreated(list: RequestRow[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 보인다
  }
}

export function createRequest(body: CreateRequestBody) {
  const list = created()
  const id = 100 + list.length
  const cohort = cohorts.find((c) => c.id === body.cohortId)
  const row: RequestRow = {
    id,
    title: body.title,
    templateCode: templates.find((t) => t.id === body.templateId)?.code ?? null,
    cohortName: cohort?.name ?? null,
    status: 'DRAFT',
    opensAt: null,
    closesAt: body.closesAt,
    targetCount: 0,
    submittedCount: 0,
    revisionCount: 0,
  }
  saveCreated([row, ...list])
  saveBody(id, body)
  return { id, status: row.status, fields: templates.find((t) => t.id === body.templateId)?.fields ?? [] }
}

export function publishRequest(id: number) {
  const row = rows().find((r) => r.id === id)
  if (!row) return { error: 'NOT_FOUND' as const }
  if (row.status !== 'DRAFT') return { error: 'INVALID_STATE_TRANSITION' as const }
  const targetCount = row.cohortName ? (cohorts.find((c) => c.name === row.cohortName)?.scholarCount ?? 0) : cohorts.reduce((n, c) => n + c.scholarCount, 0)
  const publishedAt = new Date().toISOString().slice(0, 19)
  patch(id, { row: { status: 'IN_PROGRESS', targetCount, opensAt: publishedAt } })
  return { status: 'IN_PROGRESS' as const, targetCount, publishedAt }
}

// ── 작성 중 요청 열기·고치기 목업 ──

type Edit = { row: Partial<RequestRow>; body?: CreateRequestBody }
const EDITS = 'kt-dtalent:mock-request-edits'

function edits(): Record<number, Edit> {
  try {
    return JSON.parse(sessionStorage.getItem(EDITS) ?? '{}') as Record<number, Edit>
  } catch {
    return {}
  }
}

function patch(id: number, e: Edit) {
  const all = edits()
  const prev = all[id] ?? { row: {} }
  all[id] = { row: { ...prev.row, ...e.row }, body: e.body ?? prev.body }
  try {
    sessionStorage.setItem(EDITS, JSON.stringify(all))
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만
  }
}

export function requestDetail(id: number) {
  const row = rows().find((r) => r.id === id)
  if (!row) return null
  // 고친 적이 없으면 목록 행에서 만들어 낸다
  const body: CreateRequestBody = edits()[id]?.body ??
    bodies()[id] ?? {
      programId: 1,
      cohortId: cohorts.find((c) => c.name === row.cohortName)?.id ?? null,
      templateId: templates.find((t) => t.code === row.templateCode)?.id ?? 0,
      title: row.title,
      description: null,
      academicYear: 2026,
      semester: '2',
      closesAt: row.closesAt?.slice(0, 19) ?? '',
      completionMessage: null,
    }
  return { id, status: row.status, ...body, templateId: body.templateId || null }
}

export function updateRequest(id: number, body: CreateRequestBody) {
  const row = rows().find((r) => r.id === id)
  if (!row) return { error: 'NOT_FOUND' as const }
  if (row.status !== 'DRAFT') return { error: 'INVALID_STATE_TRANSITION' as const }
  patch(id, {
    row: {
      title: body.title,
      templateCode: templates.find((t) => t.id === body.templateId)?.code ?? null,
      cohortName: cohorts.find((c) => c.id === body.cohortId)?.name ?? null,
      closesAt: body.closesAt,
    },
    body,
  })
  return { id, status: row.status }
}
