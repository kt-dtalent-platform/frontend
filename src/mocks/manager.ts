// 담당자 화면 목업. 모양은 노션 명세서(옛 자료)에서 MVP 범위만 가져왔다(확인 필요).
import type { Cohort, CreateRequestBody, ManagerDashboard, RequestRow, RequestTemplate } from '../api/manager'
import { dueIn } from './db'

const opened = (days: number) => dueIn(-days).replace('23:59:59', '09:00:00')

// 진행 중 4, 작성 중 2, 마감 17 → 전체 23건(쪽 넘김 확인용). MVP는 성적증명서 제출만 다룬다.
// 마감된 요청: 선발 연도별로 그 해부터 들은 학기만 만든다(같은 기수에 같은 학기 요청이 두 번 나오지 않게)
const TERMS = ['1학기', '여름학기', '2학기', '겨울학기']
function pastRequests(count: number) {
  const out: { title: string; cohortName: string }[] = []
  // 2025학년도 2학기부터 거꾸로
  for (let k = 0; out.length < count && k < 40; k++) {
    const idx = 2025 * 4 + 2 - k
    const year = Math.floor(idx / 4)
    const term = TERMS[idx % 4]
    for (const sel of [2026, 2025, 2024, 2023]) {
      // 선발 전 해 2학기 성적까지는 받는다고 본다
      if (year < sel - 1 || (year === sel - 1 && idx % 4 < 2)) continue
      if (out.length < count) out.push({ title: `${year}학년도 ${term} 성적증명서 제출`, cohortName: `${sel}년 선발` })
    }
  }
  return out
}

export function rows(): RequestRow[] {
  const live: RequestRow[] = [
    {
      id: 31,
      title: '2026학년도 1학기 성적증명서 제출',
      templateCode: 'GRADE_CERTIFICATE',
      cohortName: '2026년 선발',
      status: 'IN_PROGRESS',
      opensAt: opened(5),
      closesAt: dueIn(2),
      targetCount: 47,
      submittedCount: 32,
      revisionCount: 3,
    },
    {
      id: 36,
      title: '2026학년도 1학기 성적증명서 제출 (2025년 선발)',
      templateCode: 'GRADE_CERTIFICATE',
      cohortName: '2025년 선발',
      status: 'IN_PROGRESS',
      opensAt: opened(8),
      closesAt: dueIn(0),
      targetCount: 47,
      submittedCount: 40,
      revisionCount: 2,
    },
    {
      id: 35,
      title: '2026학년도 여름학기 성적증명서 제출',
      templateCode: 'GRADE_CERTIFICATE',
      cohortName: null,
      status: 'IN_PROGRESS',
      opensAt: opened(3),
      closesAt: dueIn(10),
      targetCount: 94,
      submittedCount: 20,
      revisionCount: 1,
    },
    {
      id: 39,
      title: '2025학년도 2학기 성적증명서 추가 제출',
      templateCode: 'GRADE_CERTIFICATE',
      cohortName: '2025년 선발',
      status: 'IN_PROGRESS',
      opensAt: opened(10),
      closesAt: dueIn(-1),
      targetCount: 12,
      submittedCount: 10,
      revisionCount: 0,
    },
    {
      id: 40,
      title: '2026학년도 2학기 성적증명서 제출',
      templateCode: 'GRADE_CERTIFICATE',
      cohortName: '2026년 선발',
      status: 'DRAFT',
      opensAt: null,
      closesAt: null,
      targetCount: 0,
      submittedCount: 0,
      revisionCount: 0,
    },
    {
      id: 41,
      title: '2026학년도 겨울학기 성적증명서 제출',
      templateCode: null,
      cohortName: '2025년 선발',
      status: 'DRAFT',
      opensAt: null,
      closesAt: dueIn(30),
      targetCount: 47,
      submittedCount: 0,
      revisionCount: 0,
    },
  ]
  const past = pastRequests(17)
  const closed: RequestRow[] = Array.from({ length: 17 }, (_, i) => ({
    id: 27 - i,
    title: past[i].title,
    templateCode: 'GRADE_CERTIFICATE',
    cohortName: past[i].cohortName,
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
        { cohortName: '2025년 선발', count: 47 },
        { cohortName: '2026년 선발', count: 47 },
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
