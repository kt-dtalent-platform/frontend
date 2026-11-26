import { sortRows } from './sort'
// 장학생 목업. 응답 모양은 백엔드 KT-10~13 기준. 등록·수정은 sessionStorage에 남긴다.
import type { AccountStatus, ScholarCreate, ScholarDetail, ScholarItem, ScholarUpdate, StatusChange, StatusInfo, WithdrawalReason } from '../api/scholars'
import { now } from './db'
import { cohorts } from './manager'

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황']
const GIVEN = ['민서', '서준', '하은', '도윤', '지우', '시우', '서연', '예준', '하린', '주원', '지호', '수아', '건우', '유나', '현우', '채원']
const SCHOOLS = ['한양대학교', '서울과학기술대학교', '부산대학교', '경북대학교', '충남대학교', '전남대학교']
const MAJORS = ['컴퓨터공학과', '전자공학과', '산업공학과', '데이터사이언스학과', '경영학과']

// studentNo: 등록할 때 받은 학번. 처음부터 있는 목업 줄은 없어서 내보낼 때 id로 만든다
type Row = Omit<ScholarDetail, 'bankAccount'> & { accountStatus: AccountStatus; phone: string | null; studentNo?: string | null }
const KEY = 'kt-dtalent:mock-scholars'
// 기수는 요청 만들기 목업과 같은 목록을 쓴다

function base(): Row[] {
  return Array.from({ length: 94 }, (_, i) => {
    const cohort = i < 47 ? cohorts[0] : cohorts[1]
    // 2025년 선발 일부는 수료, 몇 명은 휴학, 몇 명은 중단(사유를 돌아가며)
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
          : i % 13 === 6
            ? { status: 'LEAVE', completedYear: null, withdrawalReason: null, withdrawalReasonDetail: null }
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
      accountStatus: i % 19 === 4 ? 'LOCKED' : 'ACTIVE',
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
    const row = e ? { ...r, ...e, phone: e.phone ?? r.phone, maskedPhone: mask(e.phone ?? r.phone) } : r
    // 백엔드처럼 중단된 장학생은 계정을 사용 중지로 맞춘다(중단을 풀면 다시 사용)
    const accountStatus: AccountStatus = row.status === 'WITHDRAWN' ? 'INACTIVE' : row.accountStatus === 'INACTIVE' ? 'ACTIVE' : row.accountStatus
    return { ...row, accountStatus }
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
  const statusOrder = ['ENROLLED', 'LEAVE', 'COMPLETED', 'WITHDRAWN']
  // 기본 순서는 백엔드와 같게 등록 순(ORDER BY u.id). 새로 등록한 장학생은 맨 뒤
  list.sort((a, b) => a.id - b.id)
  const sorted = sortRows(list, q.get('sort'), {
    name: (r) => r.name,
    cohort: (r) => r.cohort.name,
    university: (r) => r.university,
    status: (r) => statusOrder.indexOf(r.status),
    email: (r) => r.email,
  })
  const items: ScholarItem[] = sorted.slice((page - 1) * size, page * size).map((r) => ({
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

// 요청 공개 대상 수: 재학이면서 사용 중지가 아닌 장학생(백엔드 공개 대상 조건과 같게)
export const enrolledCount = (cohortId: number) =>
  all().filter((x) => x.cohort.id === cohortId && x.status === 'ENROLLED' && x.accountStatus !== 'INACTIVE').length

// 계정 상태(로그인 안내 메일 목업이 쓴다)
export const accountStatusOf = (id: number) => all().find((x) => x.id === id)?.accountStatus ?? null

export function scholarDetail(id: number): ScholarDetail | null {
  const r = all().find((x) => x.id === id)
  if (!r) return null
  const { phone: _p, ...detail } = r
  // 목업 계좌: 넷 중 하나는 아직 등록 안 함
  const bankAccount =
    r.id % 4 === 0
      ? null
      : { bankName: ['KB국민은행', '신한은행', '카카오뱅크'][r.id % 3], accountNumber: String(1002000000000 + r.id * 7919), accountHolder: r.name }
  return { ...detail, phone: r.phone ? r.phone.replace(/\D/g, '') : null, bankAccount }
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
    studentNo: body.studentNo,
    cohort: { id: cohort.id, name: cohort.name },
    status: 'ENROLLED',
    completedYear: null,
    withdrawalReason: null,
    withdrawalReasonDetail: null,
    accountStatus: 'ACTIVE', // 백엔드도 등록하면 바로 ACTIVE(첫 로그인 때 비밀번호 변경)
  })
  save(s)
  // 백엔드처럼 임시 비밀번호를 이 응답에서 한 번만 준다. 목업 로그인은 temp로 시작하는 비밀번호를 첫 로그인으로 본다
  const temporaryPassword = `temp${String(1000 + (id % 9000)).padStart(4, '0')}`
  return { id, accountStatus: 'ACTIVE' as const, temporaryPassword }
}

// 목업 명단 내보내기: 고른 상태, 기수, 열만 담은 CSV. 실제 서버는 xlsx
export function exportScholarsCsv(statuses: string[], cohortId: number | null, columns: string[]) {
  const label: Record<string, string> = { ENROLLED: '재학', LEAVE: '휴학', COMPLETED: '수료', WITHDRAWN: '중단' }
  const reason: Record<string, string> = {
    ACADEMIC_STATUS: '학적 변동/상실',
    DOUBLE_BENEFIT: '이중 수혜',
    GRADE_NOT_MET: '성적 미충족',
    ACTIVITY_NOT_MET: '활동 요건 미충족',
    VOLUNTARY: '자발적 포기',
  }
  const account: Record<string, string> = { ACTIVE: '사용 중', INACTIVE: '사용 중지', LOCKED: '잠김' }
  const cell: Record<string, [string, (r: Row) => string]> = {
    name: ['이름', (r) => r.name],
    cohort: ['기수', (r) => r.cohort.name],
    university: ['학교', (r) => r.university],
    major: ['학과', (r) => r.major ?? ''],
    studentNo: ['학번', (r) => r.studentNo ?? String(20230000 + r.id)],
    email: ['이메일', (r) => r.email],
    phone: ['연락처', (r) => r.phone ?? ''],
    status: ['상태', (r) => label[r.status] ?? r.status],
    completedYear: ['수료 연도', (r) => (r.completedYear ? String(r.completedYear) : '')],
    withdrawalReason: ['중단 사유', (r) => (r.withdrawalReason === 'OTHER' ? '기타' : r.withdrawalReason ? reason[r.withdrawalReason] : '')],
    withdrawalReasonDetail: ['중단 상세 사유', (r) => r.withdrawalReasonDetail ?? ''],
    accountStatus: ['로그인 상태', (r) => account[r.accountStatus]],
  }
  const keys = columns.filter((k) => cell[k])
  const rowsOut = all().filter((r) => (statuses.length === 0 || statuses.includes(r.status)) && (!cohortId || r.cohort.id === cohortId))
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return '\uFEFF' + [keys.map((k) => cell[k][0]), ...rowsOut.map((r) => keys.map((k) => esc(cell[k][1](r))))].map((l) => l.join(',')).join('\n')
}

// 일괄 등록: 하나라도 문제가 있으면 아무도 등록하지 않는다(백엔드 #92와 같음). 임시 비밀번호는 목업용 가짜 값
export function createScholarsBulk(cohortId: number, list: Omit<ScholarCreate, 'cohortId'>[]) {
  if (!cohorts.find((c) => c.id === cohortId)) return { error: 'COHORT_NOT_FOUND' as const }
  // 보낸 명단 안에서 같은 이메일이 있어도 아무도 등록하지 않는다
  const seen = new Set<string>()
  const repeated = list.filter((r) => {
    const k = r.email.toLowerCase()
    if (seen.has(k)) return true
    seen.add(k)
    return false
  })
  if (repeated.length) return { error: 'DUPLICATE_EMAIL' as const, emails: repeated.map((r) => r.email) }
  const existing = new Set(all().map((r) => r.email.toLowerCase()))
  const dup = list.filter((r) => existing.has(r.email.toLowerCase())).map((r) => r.email)
  if (dup.length) return { error: 'DUPLICATE_EMAIL' as const, emails: dup }
  const items = list.map((r, i) => {
    const made = createScholar({ ...r, cohortId })
    const id = ('id' in made && made.id) || 0
    // 서버처럼 엑셀 줄 번호(머리글이 1줄이라 첫 사람이 2)
    return { row: i + 2, id, email: r.email, temporaryPassword: `temp${String(1000 + ((id * 7919) % 9000))}` }
  })
  return { created: list.length, items }
}
