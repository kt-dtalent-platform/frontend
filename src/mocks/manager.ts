// 담당자 화면 목업. 모양은 노션 명세서(옛 자료)에서 MVP 범위만 가져왔다(확인 필요).
import type { Cohort, CreateRequestBody, ManagerDashboard, RequestRow, RequestTemplate } from '../api/manager'
import { dueIn } from './db'

const opened = (days: number) => dueIn(-days).replace('23:59:59', '09:00:00')

// 진행 중 6, 작성 중 2, 마감 17 → 전체 25건(페이지 넘김 확인용)
export function rows(): RequestRow[] {
  const live: RequestRow[] = [
    {
      id: 31,
      title: '10월 행사 교통비 증빙',
      templateCode: 'TRANSPORT_CLAIM',
      cohortName: '6기',
      status: 'IN_PROGRESS',
      opensAt: opened(5),
      closesAt: dueIn(2),
      targetCount: 47,
      submittedCount: 32,
      revisionCount: 3,
    },
    {
      id: 35,
      title: '2학기 지속심사 서류 제출',
      templateCode: 'GRADE_CERTIFICATE',
      cohortName: '6기',
      status: 'IN_PROGRESS',
      opensAt: opened(3),
      closesAt: dueIn(10),
      targetCount: 47,
      submittedCount: 12,
      revisionCount: 0,
    },
    {
      id: 36,
      title: '2학기 지속심사 서류 제출',
      templateCode: 'GRADE_CERTIFICATE',
      cohortName: '5기',
      status: 'IN_PROGRESS',
      opensAt: opened(3),
      closesAt: dueIn(10),
      targetCount: 47,
      submittedCount: 20,
      revisionCount: 1,
    },
    {
      id: 37,
      title: '멘토링 활동 보고서',
      templateCode: null,
      cohortName: '5기',
      status: 'IN_PROGRESS',
      opensAt: opened(8),
      closesAt: dueIn(0),
      targetCount: 47,
      submittedCount: 40,
      revisionCount: 2,
    },
    {
      id: 38,
      title: '11월 정기 모임 참석 확인',
      templateCode: null,
      cohortName: null,
      status: 'IN_PROGRESS',
      opensAt: opened(1),
      closesAt: dueIn(5),
      targetCount: 94,
      submittedCount: 51,
      revisionCount: 0,
    },
    {
      id: 39,
      title: '재학증명서 제출',
      templateCode: null,
      cohortName: '6기',
      status: 'IN_PROGRESS',
      opensAt: opened(10),
      closesAt: dueIn(-1),
      targetCount: 47,
      submittedCount: 45,
      revisionCount: 0,
    },
    {
      id: 40,
      title: '12월 행사 교통비 증빙',
      templateCode: 'TRANSPORT_CLAIM',
      cohortName: '6기',
      status: 'DRAFT',
      opensAt: null,
      closesAt: null,
      targetCount: 0,
      submittedCount: 0,
      revisionCount: 0,
    },
    {
      id: 41,
      title: '겨울방학 활동 계획서',
      templateCode: null,
      cohortName: '5기',
      status: 'DRAFT',
      opensAt: null,
      closesAt: dueIn(30),
      targetCount: 47,
      submittedCount: 0,
      revisionCount: 0,
    },
  ]
  const closed: RequestRow[] = Array.from({ length: 17 }, (_, i) => ({
    id: 27 - i,
    title: i % 2 ? `${9 - Math.floor(i / 2)}월 행사 교통비 증빙` : `${i + 1}차 활동 보고서`,
    templateCode: i % 2 ? 'TRANSPORT_CLAIM' : null,
    cohortName: i % 3 ? '5기' : '6기',
    status: 'CLOSED',
    opensAt: opened(40 + i * 7),
    closesAt: dueIn(-(30 + i * 7)),
    targetCount: 47,
    submittedCount: 47 - (i % 4),
    revisionCount: 0,
  }))
  // 수정·공개한 내용을 미리 만든 행에도 덮어쓴다
  const ed = edits()
  return [...created(), ...live, ...closed].map((r) => (ed[r.id] ? { ...r, ...ed[r.id].row } : r))
}

export function requestList(status: string | null, page: number, pageSize: number) {
  const all = rows().filter((r) => !status || r.status === status)
  const p = Math.max(1, page)
  return { items: all.slice((p - 1) * pageSize, p * pageSize), page: p, page_size: pageSize, total: all.length }
}

export function managerDashboard(): ManagerDashboard {
  const live = rows().filter((r) => r.status === 'IN_PROGRESS')
  const soon = live
    .filter((r) => r.closesAt && new Date(r.closesAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.closesAt!.localeCompare(b.closesAt!))
  return {
    today: { unreviewedSubmissions: 14, resubmitted: 3 },
    tasks: {
      closingSoon: soon.map((r) => ({
        requestId: r.id,
        title: r.title,
        closesAt: r.closesAt!,
        notSubmitted: r.targetCount - r.submittedCount,
        targetCount: r.targetCount,
      })),
    },
    overview: {
      scholarCount: 94,
      byCohort: [
        { cohortName: '5기', count: 47 },
        { cohortName: '6기', count: 47 },
      ],
      inProgressRequests: live.length,
    },
  }
}

// ── 요청 만들기 목업 ──

export const templates: RequestTemplate[] = [
  {
    id: 1,
    code: 'GRADE_CERTIFICATE',
    name: '성적 증빙',
    fields: [
      { fieldKey: 'semester', label: '학기', fieldType: 'SELECT_ONE', required: true },
      { fieldKey: 'gpa', label: '직전 학기 평점', fieldType: 'NUMBER', required: true },
      { fieldKey: 'gpa_scale', label: '만점 기준', fieldType: 'SELECT_ONE', required: true },
      { fieldKey: 'credits', label: '이수 학점', fieldType: 'NUMBER', required: true },
      { fieldKey: 'transcript', label: '성적증명서', fieldType: 'FILE', required: true },
    ],
  },
  {
    id: 3,
    code: 'TRANSPORT_CLAIM',
    name: '교통비 증빙',
    fields: [
      { fieldKey: 'used_on', label: '이용일자', fieldType: 'DATE', required: true },
      { fieldKey: 'method', label: '교통수단', fieldType: 'SELECT_ONE', required: true },
      { fieldKey: 'amount', label: '금액', fieldType: 'NUMBER', required: true },
      { fieldKey: 'receipt', label: '영수증', fieldType: 'FILE', required: true },
    ],
  },
  {
    id: 4,
    code: 'ENROLLMENT_CERT',
    name: '재학증명서',
    fields: [{ fieldKey: 'certificate', label: '재학증명서', fieldType: 'FILE', required: true }],
  },
]

export const cohorts: Cohort[] = [
  { id: 5, name: '5기', startedOn: '2025-03-01', endedOn: null, scholarCount: 47 },
  { id: 6, name: '6기', startedOn: '2026-03-01', endedOn: null, scholarCount: 47 },
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
