// 장학생 목업. 응답 모양은 백엔드 KT-10~13 기준. 등록·수정은 sessionStorage에 남긴다.
import type { AccountStatus, ScholarCreate, ScholarDetail, ScholarItem, ScholarUpdate, StatusChange, StatusInfo, WithdrawalReason } from '../api/scholars'
import { now } from './db'
import { cohorts } from './manager'

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황']
const GIVEN = ['민서', '서준', '하은', '도윤', '지우', '시우', '서연', '예준', '하린', '주원', '지호', '수아', '건우', '유나', '현우', '채원']
const SCHOOLS = ['한국대학교', '서울과학기술대학교', '부산대학교', '경북대학교', '충남대학교', '전남대학교']
const MAJORS = ['컴퓨터공학과', '전자공학과', '산업공학과', '데이터사이언스학과', '경영학과']

type Row = ScholarDetail & { accountStatus: AccountStatus; phone: string | null }
const KEY = 'kt-dtalent:mock-scholars'
// 기수는 요청 만들기 목업과 같은 목록을 쓴다

function base(): Row[] {
  return Array.from({ length: 94 }, (_, i) => {
    const cohort = i < 47 ? cohorts[0] : cohorts[1]
    // 2025년 선발 일부는 수료, 몇 명은 중단(사유를 돌아가며)
    const reasons: WithdrawalReason[] = ['GRADE_NOT_MET', 'VOLUNTARY', 'DOUBLE_BENEFIT', 'OTHER']
    const st: StatusInfo =
      i % 23 === 5 || i % 31 === 7
        ? {
            status: 'WITHDRAWN',
            completedYear: null,
            withdrawalReason: reasons[i % 4],
            withdrawalReasonDetail: reasons[i % 4] === 'OTHER' ? '연락 두절로 재단과 협의 후 중단' : null,
          }
        : cohort.id === 5 && i % 9 === 3
          ? { status: 'COMPLETED', completedYear: 2026, withdrawalReason: null, withdrawalReasonDetail: null }
          : { status: 'ENROLLED', completedYear: null, withdrawalReason: null, withdrawalReasonDetail: null }
    return {
      id: 1000 + i,
      name: SURNAMES[(i * 7) % 16] + GIVEN[(i * 5 + Math.floor(i / 16)) % 16],
      email: `scholar${String(i + 1).padStart(3, '0')}@example.com`,
      phone: `010-${String(2000 + i).padStart(4, '0')}-${String(5000 + i * 7).slice(-4)}`,
      maskedPhone: `010-****-${String(5000 + i * 7).slice(-4)}`,
      university: SCHOOLS[i % SCHOOLS.length],
      major: MAJORS[i % MAJORS.length],
      cohort: { id: cohort.id, name: cohort.name },
      ...st,
      accountStatus: i % 19 === 4 ? 'LOCKED' : i % 13 === 6 ? 'INACTIVE' : 'ACTIVE',
    }
  })
}

function load(): { created: Row[]; edits: Record<number, ScholarUpdate & Partial<StatusInfo>> } {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{"created":[],"edits":{}}')
  } catch {
    return { created: [], edits: {} }
  }
}
function save(s: ReturnType<typeof load>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 저장소를 못 쓰면 이번 응답에만 반영
  }
}

const mask = (phone: string | null) => (phone ? phone.replace(/^(\d{3})-?(\d{3,4})-?(\d{4})$/, '$1-****-$3') : null)

function all(): Row[] {
  const s = load()
  return [...s.created, ...base()].map((r) => {
    const e = s.edits[r.id]
    if (!e) return r
    const phone = e.phone ?? r.phone
    return { ...r, ...e, phone, maskedPhone: mask(phone) }
  })
}

export function scholarList(q: URLSearchParams) {
  const cohortId = Number(q.get('cohortId')) || null
  const status = q.get('status')
  const keyword = q.get('keyword') ?? ''
  const page = Math.max(1, Number(q.get('page') ?? 1))
  const size = Number(q.get('page_size') ?? 20)
  const list = all().filter(
    (r) => (!cohortId || r.cohort.id === cohortId) && (!status || r.status === status) && (!keyword || r.name.includes(keyword) || r.email.includes(keyword)),
  )
  const items: ScholarItem[] = list.slice((page - 1) * size, page * size).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    maskedPhone: r.maskedPhone,
    cohortName: r.cohort.name,
    university: r.university,
    status: r.status,
    completedYear: r.completedYear,
    withdrawalReason: r.withdrawalReason,
    withdrawalReasonDetail: r.withdrawalReasonDetail,
    accountStatus: r.accountStatus,
  }))
  return { items, page, pageSize: size, total: list.length }
}

export function scholarDetail(id: number): ScholarDetail | null {
  const r = all().find((x) => x.id === id)
  if (!r) return null
  const { accountStatus: _a, phone: _p, ...detail } = r
  return detail
}

export function updateScholar(id: number, body: ScholarUpdate) {
  if (!all().some((r) => r.id === id)) return null
  const s = load()
  s.edits[id] = { ...s.edits[id], ...body }
  save(s)
  return { id, updatedAt: now() }
}

export function changeScholarStatus(id: number, body: StatusChange) {
  if (!all().some((r) => r.id === id)) return null
  const s = load()
  s.edits[id] = { ...s.edits[id], ...body }
  save(s)
  return { id, updatedAt: now() }
}

export function createScholar(body: ScholarCreate) {
  if (all().some((r) => r.email === body.email)) return { error: 'DUPLICATE_EMAIL' as const }
  const cohort = cohorts.find((c) => c.id === body.cohortId)
  if (!cohort) return { error: 'COHORT_NOT_FOUND' as const }
  const s = load()
  const id = 5000 + s.created.length
  s.created.unshift({
    id,
    name: body.name,
    email: body.email,
    phone: body.phone,
    maskedPhone: mask(body.phone),
    university: body.university ?? '',
    major: body.major,
    cohort: { id: cohort.id, name: cohort.name },
    status: 'ENROLLED',
    completedYear: null,
    withdrawalReason: null,
    withdrawalReasonDetail: null,
    accountStatus: 'INACTIVE',
  })
  save(s)
  return { id }
}
