// 담당자 제출 현황·개별 검토 목업. 요청 목록(manager.ts)의 인원·건수에 맞춰 장학생별 제출을 만든다.
import type { SubmissionStatus } from '../api/types'
import type { Comparison, StatusFilter, SubmissionDetail, SubmissionRow } from '../api/review'
import { dueIn } from './db'
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
  const confirmed = Math.floor(req.submittedCount * 0.3)
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

export function submissionList(requestId: number, status: string | null, keyword: string, page: number, pageSize: number) {
  const req = rows().find((r) => r.id === requestId)
  if (!req) return null
  const all = withOverrides(baseRows(requestId))
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
    page_size: pageSize,
    total: filtered.length,
  }
}

// 검토 순서(이전·다음): 같은 요청에서 검토 대기인 제출
export function reviewQueue(requestId: number) {
  return withOverrides(baseRows(requestId))
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
    history: o?.history ?? [
      { from: 'DRAFT', to: row.status === 'RESUBMITTED' ? 'RESUBMITTED' : 'SUBMITTED', actorType: 'SCHOLAR', changedAt: row.submittedAt ?? dueIn(-1) },
    ],
    revisions: o?.revisions ?? [],
    version: o?.version ?? 2,
  }
}

function sample(code: string, i: number) {
  const files: SubmissionDetail['files'] = []
  const comparisons: Comparison[] = []
  let answers: SubmissionDetail['answers'] = {}
  if (code) {
    const gpa = (3 + ((i * 37) % 150) / 100).toFixed(2)
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
      originalName: `성적증명서_${i + 1}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: 320_000 + i * 1000,
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

export function exportCsv(requestId: number, status: string | null) {
  const list = submissionList(requestId, status, '', 1, 10_000)
  if (!list) return null
  const label: Record<string, string> = {
    NOT_SUBMITTED: '미제출',
    DRAFT: '작성 중',
    SUBMITTED: '검토 대기',
    RESUBMITTED: '검토 대기',
    REVISION_REQUIRED: '보완 필요',
    CONFIRMED: '확인 완료',
  }
  const lines = [
    ['이름', '기수', '제출상태', '제출일시'],
    ...list.items.map((r) => [r.scholarName, r.cohortName ?? '', label[r.status], r.submittedAt?.replace('T', ' ').slice(0, 16) ?? '']),
  ]
  // 엑셀에서 한글이 깨지지 않도록 BOM을 붙인 CSV(목업). 실제 서버는 xlsx를 준다
  return '﻿' + lines.map((l) => l.join(',')).join('\n')
}
