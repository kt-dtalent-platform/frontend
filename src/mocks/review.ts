// 담당자 제출 현황·개별 검토 목업. 요청 목록(manager.ts)의 인원·건수에 맞춰 장학생별 제출을 만든다.
import type { SubmissionStatus } from '../api/types'
import type { Comparison, StatusFilter, SubmissionDetail, SubmissionRow } from '../api/review'
import type { ManagerDashboard } from '../api/manager'
import { kstParts } from '../lib/time'
import { rows } from './manager'

// 입력 항목(요청 만들기 템플릿과 같은 값). MVP는 성적증명서 제출만 다룬다.
const templates = [
  {
    code: 'GRADE_CERTIFICATE',
    fields: [
      { fieldKey: 'gpa', label: '학기 평점', fieldType: 'NUMBER' },
      { fieldKey: 'gpa_scale', label: '만점 기준', fieldType: 'SELECT_ONE' },
      { fieldKey: 'credits', label: '이수 학점', fieldType: 'NUMBER' },
      { fieldKey: 'transcript', label: '성적증명서', fieldType: 'FILE' },
      { fieldKey: 'note', label: '전달할 내용', fieldType: 'TEXTAREA' },
    ],
  },
]

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황']
const GIVEN = ['민서', '서준', '하은', '도윤', '지우', '시우', '서연', '예준', '하린', '주원', '지호', '수아', '건우', '유나', '현우', '채원']
const name = (i: number) => SURNAMES[(i * 7) % SURNAMES.length] + GIVEN[(i * 5 + Math.floor(i / 16)) % GIVEN.length]

type Override = { status: SubmissionStatus; version: number; revisions: SubmissionDetail['revisions']; history: SubmissionDetail['history'] }
const KEY = 'kt-dtalent:mock-reviews'
function overrides(): Record<number, Override> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<number, Override>
  } catch {
    return {}
  }
}
function saveOverride(id: number, o: Override) {
  const all = overrides()
  all[id] = o
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // 저장소를 못 쓰면 이번 응답에만 반영
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const minutesAgo = (m: number) => {
  const d = new Date(Date.now() - m * 60_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

// 요청 하나의 장학생별 기본 상태: 확인 완료 → 보완 필요 → 검토 대기(일부 재제출) → 미제출 순으로 나눈다
function baseRows(requestId: number): (SubmissionRow & { index: number })[] {
  const req = rows().find((r) => r.id === requestId)
  if (!req || req.targetCount === 0) return []
  // 마감한 요청은 보완 중인 건 말고 모두 확인을 마친 것으로 둔다
  const confirmed = req.status === 'CLOSED' ? req.submittedCount - req.revisionCount : Math.floor(req.submittedCount * 0.3)
  const revision = req.revisionCount
  const waiting = Math.max(0, req.submittedCount - confirmed - revision)
  return Array.from({ length: req.targetCount }, (_, i) => {
    const status: SubmissionStatus =
      i < confirmed
        ? 'CONFIRMED'
        : i < confirmed + revision
          ? 'REVISION_REQUIRED'
          : i < confirmed + revision + waiting
            ? i % 6 === 0
              ? 'RESUBMITTED'
              : 'SUBMITTED'
            : i % 5 === 0
              ? 'DRAFT'
              : 'NOT_SUBMITTED'
    const submitted = status !== 'NOT_SUBMITTED' && status !== 'DRAFT'
    return {
      index: i,
      scholarId: 1000 + i,
      scholarName: name(i + requestId),
      cohortName: req.cohortName ?? (i % 2 ? '2025년 선발' : '2026년 선발'),
      university: SCHOOLS[i % SCHOOLS.length],
      // 상세 화면의 평점과 같은 값(sample 참고). 제출 전이면 없음
      gpa: submitted ? Number(gpaOf(i)) : null,
      gpaScale: submitted ? '4.5' : null,
      submissionId: status === 'NOT_SUBMITTED' ? null : requestId * 1000 + i,
      status,
      submittedAt: submitted ? minutesAgo(60 * (i + 1) + requestId) : null,
      late: submitted && i % 9 === 4,
      hasInputError: submitted && i % 11 === 3,
    }
  })
}

function withOverrides(list: ReturnType<typeof baseRows>) {
  const o = overrides()
  return list.map((r) => (r.submissionId && o[r.submissionId] ? { ...r, status: o[r.submissionId].status } : r))
}

const matches = (s: SubmissionStatus, f: StatusFilter) =>
  f === 'NOT_SUBMITTED' ? s === 'NOT_SUBMITTED' || s === 'DRAFT' : f === 'WAITING' ? s === 'SUBMITTED' || s === 'RESUBMITTED' : s === f

// 목록 기본 순서(프론트 제안, 백엔드 확인 필요): 담당자가 손댈 순서대로
// 검토 대기(오래 기다린 제출 먼저) → 보완 필요 → 미제출 → 확인 완료
const rank = (s: SubmissionStatus) =>
  s === 'SUBMITTED' || s === 'RESUBMITTED' ? 0 : s === 'REVISION_REQUIRED' ? 1 : s === 'NOT_SUBMITTED' || s === 'DRAFT' ? 2 : 3
function ordered(list: ReturnType<typeof baseRows>) {
  return [...list].sort((a, b) => rank(a.status) - rank(b.status) || (a.submittedAt ?? '').localeCompare(b.submittedAt ?? '') || a.index - b.index)
}

export function submissionList(requestId: number, status: string | null, keyword: string, page: number, pageSize: number) {
  const req = rows().find((r) => r.id === requestId)
  if (!req) return null
  const all = ordered(withOverrides(baseRows(requestId)))
  const summary = {
    target: all.length,
    notSubmitted: all.filter((r) => matches(r.status, 'NOT_SUBMITTED')).length,
    submitted: all.filter((r) => matches(r.status, 'WAITING')).length,
    revisionRequired: all.filter((r) => r.status === 'REVISION_REQUIRED').length,
    confirmed: all.filter((r) => r.status === 'CONFIRMED').length,
  }
  const filtered = all.filter((r) => !status || matches(r.status, status as StatusFilter)).filter((r) => !keyword || r.scholarName.includes(keyword))
  const p = Math.max(1, page)
  return {
    request: { id: req.id, title: req.title, cohortName: req.cohortName, closesAt: req.closesAt },
    summary,
    items: filtered.slice((p - 1) * pageSize, p * pageSize).map(({ index: _i, ...r }) => r),
    page: p,
    pageSize,
    total: filtered.length,
  }
}

// 검토 순서(이전·다음): 같은 요청에서 검토 대기인 제출
export function reviewQueue(requestId: number) {
  return ordered(withOverrides(baseRows(requestId)))
    .filter((r) => matches(r.status, 'WAITING'))
    .map((r) => r.submissionId!)
}

export function submissionDetail(id: number): SubmissionDetail | null {
  const requestId = Math.floor(id / 1000)
  const req = rows().find((r) => r.id === requestId)
  const row = baseRows(requestId).find((r) => r.submissionId === id)
  if (!req || !row) return null
  const o = overrides()[id]
  const template = templates.find((t) => t.code === req.templateCode) ?? templates[0]
  const i = row.index
  const { answers, files, comparisons } = sample(template.code, i)
  const mismatch = comparisons.some((c) => c.result !== 'MATCH')
  return {
    id,
    requestId,
    requestTitle: req.title,
    scholar: { id: row.scholarId, name: row.scholarName, cohortName: row.cohortName ?? null },
    status: o?.status ?? row.status,
    submittedAt: row.submittedAt,
    late: !!row.late,
    fields: template.fields.map(({ fieldKey, label, fieldType }) => ({ fieldKey, label, fieldType })),
    answers,
    files,
    analysis: comparisons.length
      ? { overallResult: mismatch ? (comparisons.some((c) => c.result === 'UNREADABLE') ? 'UNREADABLE' : 'MISMATCH') : 'MATCH', comparisons }
      : null,
    history: o?.history ?? baseHistory(row),
    // 미리 만든 보완 필요 제출에도 보완 요청 기록을 둔다(검토 화면 안내가 비지 않게)
    revisions:
      o?.revisions ??
      (row.status === 'REVISION_REQUIRED'
        ? [
            {
              fieldKeys: ['gpa', 'transcript'],
              reason: '성적증명서의 평점과 입력한 평점이 달라요. 직전 학기 평점을 다시 확인해 주세요.',
              dueAt: null,
              resolvedAt: null,
            },
          ]
        : []),
    version: o?.version ?? 2,
  }
}

// 미리 만든 상태에 맞는 처리 이력. 확인 완료, 보완 필요인데 담당자 처리 기록이 없으면 이상해 보인다
function baseHistory(row: ReturnType<typeof baseRows>[number]): SubmissionDetail['history'] {
  const submittedAt = row.submittedAt ?? minutesAgo(24 * 60)
  // 제출 30분 뒤 처리(지금보다 늦지 않게). minutesAgo와 같은 형식
  const ago = Math.max(0, (Date.now() - new Date(submittedAt).getTime()) / 60_000 - 30)
  const later = minutesAgo(Math.round(ago))
  const first = { from: 'DRAFT', to: row.status === 'RESUBMITTED' ? 'RESUBMITTED' : 'SUBMITTED', actorType: 'SCHOLAR', changedAt: submittedAt } as const
  if (row.status === 'CONFIRMED') return [first, { from: 'SUBMITTED', to: 'CONFIRMED', actorType: 'MANAGER', changedAt: later }]
  if (row.status === 'REVISION_REQUIRED') return [first, { from: 'SUBMITTED', to: 'REVISION_REQUIRED', actorType: 'MANAGER', changedAt: later }]
  return [first]
}

const SCHOOLS = ['한국대학교', '서울과학기술대학교', '부산대학교', '경북대학교', '충남대학교', '전남대학교']
const gpaOf = (i: number) => (3 + ((i * 37) % 150) / 100).toFixed(2)

function sample(code: string, i: number) {
  const files: SubmissionDetail['files'] = []
  const comparisons: Comparison[] = []
  let answers: SubmissionDetail['answers'] = {}
  if (code) {
    const gpa = gpaOf(i)
    const read = i % 4 === 1 ? (Number(gpa) - 0.2).toFixed(2) : gpa
    answers = {
      gpa: Number(gpa),
      gpa_scale: '4.5',
      credits: 15 + (i % 7),
      note: i % 3 === 0 ? '재수강 과목이 포함되어 있습니다.' : null,
    }
    files.push({
      id: 90000 + i,
      fieldKey: 'transcript',
      // 사진으로 찍어 올린 경우와 PDF를 섞는다
      originalName: i % 3 === 0 ? `성적증명서_${i + 1}.png` : `성적증명서_${i + 1}.pdf`,
      contentType: i % 3 === 0 ? 'image/png' : 'application/pdf',
      sizeBytes: (i % 3 === 0 ? 1_400_000 : 320_000) + i * 1000,
    })
    comparisons.push(
      {
        field: 'gpa',
        label: '평점',
        entered: gpa,
        extracted: i % 7 === 2 ? null : read,
        result: i % 7 === 2 ? 'UNREADABLE' : read === gpa ? 'MATCH' : 'MISMATCH',
      },
      { field: 'gpa_scale', label: '만점 기준', entered: '4.5', extracted: '4.5', result: 'MATCH' },
      { field: 'credits', label: '이수 학점', entered: String(15 + (i % 7)), extracted: String(15 + (i % 7)), result: 'MATCH' },
    )
  }
  return { answers, files, comparisons }
}

export function review(id: number, action: 'confirm' | 'revision', body: { version: number; fieldKeys?: string[]; reason?: string; dueAt?: string | null }) {
  const d = submissionDetail(id)
  if (!d) return { error: 'NOT_FOUND' as const }
  if (body.version !== d.version) return { error: 'VERSION_CONFLICT' as const }
  if (!['SUBMITTED', 'RESUBMITTED'].includes(d.status)) return { error: 'INVALID_STATE_TRANSITION' as const }
  const now = minutesAgo(0)
  const status: SubmissionStatus = action === 'confirm' ? 'CONFIRMED' : 'REVISION_REQUIRED'
  saveOverride(id, {
    status,
    version: d.version + 1,
    revisions:
      action === 'revision'
        ? [...d.revisions, { fieldKeys: body.fieldKeys ?? [], reason: body.reason ?? '', dueAt: body.dueAt ?? null, resolvedAt: null }]
        : d.revisions,
    history: [...d.history, { from: d.status, to: status, actorType: 'MANAGER', changedAt: now }],
  })
  return { status }
}

// 목업 내보내기: 고른 상태(쉼표로 여러 개)와 열만 담은 CSV. 실제 서버는 xlsx를 준다(확인 필요)
export function exportCsv(requestId: number, statuses: string[], columns: string[]) {
  const all = submissionList(requestId, null, '', 1, 10_000)
  if (!all) return null
  const items = all.items.filter((r) => statuses.length === 0 || statuses.some((st) => matches(r.status, st as StatusFilter)))
  const label: Record<string, string> = {
    NOT_SUBMITTED: '미제출',
    DRAFT: '작성 중',
    SUBMITTED: '검토 대기',
    RESUBMITTED: '검토 대기',
    REVISION_REQUIRED: '보완 필요',
    CONFIRMED: '확인 완료',
  }
  const kst = (iso: string | null) => (iso ? `${kstParts(iso).date} ${kstParts(iso).time.slice(0, 5)}` : '')
  const cell: Record<string, [string, (r: (typeof items)[number], i: number) => string]> = {
    name: ['이름', (r) => r.scholarName],
    cohort: ['기수', (r) => r.cohortName ?? ''],
    university: ['학교', (r) => r.university ?? ''],
    major: ['학과', (_r, i) => ['컴퓨터공학과', '전자공학과', '산업공학과'][i % 3]],
    studentNo: ['학번', (r) => String(20230000 + r.scholarId)],
    email: ['이메일', (r) => `scholar${r.scholarId}@example.com`],
    phone: ['연락처', (r) => `010-0000-${String(r.scholarId).slice(-4)}`],
    status: ['제출 상태', (r) => label[r.status]],
    submittedAt: ['제출 일시', (r) => kst(r.submittedAt)],
    gpa: ['평점', (r) => (r.gpa != null ? r.gpa.toFixed(2) : '')],
    gpaScale: ['만점 기준', (r) => r.gpaScale ?? ''],
    credits: ['이수 학점', (r, i) => (r.gpa != null ? String(15 + (i % 7)) : '')],
    revisionReason: ['보완 사유', (r) => (r.status === 'REVISION_REQUIRED' ? '성적증명서가 흐려 다시 올려 주세요' : '')],
  }
  const keys = columns.filter((k) => cell[k])
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [keys.map((k) => cell[k][0]), ...items.map((r, i) => keys.map((k) => esc(cell[k][1](r, i))))]
  // 엑셀에서 한글이 깨지지 않도록 BOM을 붙인 CSV(목업). 실제 서버는 xlsx를 준다
  return '﻿' + lines.map((l) => l.join(',')).join('\n')
}

// 대시보드: 진행 중 요청의 상태별 인원과 검토 대기 중 가장 오래된 제출
export function managerDashboard(): ManagerDashboard {
  const live = rows()
    .filter((r) => r.status === 'IN_PROGRESS' && r.closesAt)
    .sort((a, b) => a.closesAt!.localeCompare(b.closesAt!))
  const requests = live.map((r) => {
    const s = submissionList(r.id, null, '', 1, 1)!.summary
    return {
      requestId: r.id,
      title: r.title,
      closesAt: r.closesAt!,
      targetCount: s.target,
      confirmed: s.confirmed,
      waiting: s.submitted,
      revisionRequired: s.revisionRequired,
      notSubmitted: s.notSubmitted,
    }
  })
  const waiting = live
    .flatMap((r) => withOverrides(baseRows(r.id)).filter((w) => matches(w.status, 'WAITING')))
    .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))
  return {
    review: {
      waiting: waiting.length,
      resubmitted: waiting.filter((w) => w.status === 'RESUBMITTED').length,
      oldestSubmissionId: waiting[0]?.submissionId ?? null,
      oldestSubmittedAt: waiting[0]?.submittedAt ?? null,
    },
    requests,
  }
}
