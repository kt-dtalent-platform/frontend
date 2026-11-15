import type { ScholarCreate } from '../api/scholars'
import { PHONE } from '../api/scholars'

// 장학생 일괄 등록 엑셀을 읽어 줄마다 검사한다(11/15: 프론트가 읽고 백엔드에는 명단만 보낸다)
// 양식: public/templates/scholar-import.xlsx. 첫 줄은 열 이름, 둘째 줄부터 한 사람씩

export const MAX_ROWS = 500
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export type ImportRow = Omit<ScholarCreate, 'cohortId'> & {
  line: number // 엑셀 줄 번호(제목 줄이 1)
  errors: string[]
}

type Key = 'name' | 'email' | 'university' | 'phone' | 'major' | 'studentNo'

// 열 이름은 순서와 상관없이 찾는다. *, (필수), 띄어쓰기는 무시
const HEADERS: Record<Key, string[]> = {
  name: ['이름', '성명'],
  email: ['이메일', '메일', '이메일주소'],
  university: ['학교', '대학교', '학교명', '대학'],
  phone: ['연락처', '전화번호', '휴대폰', '휴대전화'],
  major: ['전공', '학과'],
  studentNo: ['학번'],
}
const REQUIRED: Key[] = ['name', 'email', 'university']
const LABEL: Record<Key, string> = { name: '이름', email: '이메일', university: '학교', phone: '연락처', major: '전공', studentNo: '학번' }

const norm = (v: unknown) =>
  String(v ?? '')
    .replace(/\(필수\)|\*/g, '')
    .replace(/\s/g, '')

// 셀 값을 글자로. 숫자로 저장된 연락처는 앞의 0이 빠져 있어 다시 붙인다(1012345678 → 01012345678)
function text(v: unknown, key: Key): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number' && key === 'phone') {
    const s = String(v)
    return s.startsWith('1') && s.length >= 9 ? `0${s}` : s
  }
  if (v instanceof Date) return ''
  return String(v).trim()
}

export type ParseResult = { rows: ImportRow[]; fileError: null } | { rows: []; fileError: string }

export function parseScholarSheet(data: unknown[][]): ParseResult {
  const header = data[0] ?? []
  const col = {} as Record<Key, number>
  for (const key of Object.keys(HEADERS) as Key[]) col[key] = header.findIndex((h) => HEADERS[key].includes(norm(h)))
  const missing = REQUIRED.filter((k) => col[k] < 0)
  if (missing.length)
    return { rows: [], fileError: `${missing.map((k) => LABEL[k]).join(', ')} 열을 찾지 못했어요. 양식 파일의 첫 줄(열 이름)을 지우지 말고 쓰세요.` }

  const rows: ImportRow[] = []
  data.slice(1).forEach((cells, i) => {
    const get = (k: Key) => (col[k] < 0 ? '' : text(cells[col[k]], k))
    const values = {
      name: get('name'),
      email: get('email'),
      university: get('university'),
      phone: get('phone'),
      major: get('major'),
      studentNo: get('studentNo'),
    }
    // 완전히 빈 줄은 건너뛴다
    if (Object.values(values).every((v) => !v)) return
    rows.push({
      line: i + 2,
      name: values.name,
      email: values.email,
      university: values.university,
      phone: values.phone || null,
      major: values.major || null,
      studentNo: values.studentNo || null,
      errors: [],
    })
  })
  if (rows.length === 0) return { rows: [], fileError: '명단이 비어 있어요. 둘째 줄부터 한 사람씩 적어 주세요.' }
  if (rows.length > MAX_ROWS) return { rows: [], fileError: `한 번에 ${MAX_ROWS}명까지 올릴 수 있어요. 파일을 나눠 주세요. (지금 ${rows.length}명)` }

  const seen = new Map<string, number>()
  for (const r of rows) {
    const e = r.errors
    if (!r.name) e.push('이름이 비어 있어요')
    else if (r.name.length > 50) e.push('이름은 50자까지 쓸 수 있어요')
    if (!r.email) e.push('이메일이 비어 있어요')
    else if (!EMAIL.test(r.email)) e.push('이메일 형식이 아니에요')
    else {
      const key = r.email.toLowerCase()
      const first = seen.get(key)
      if (first) e.push(`${first}번째 줄과 이메일이 같아요`)
      else seen.set(key, r.line)
    }
    if (!r.university) e.push('학교가 비어 있어요')
    else if (r.university.length > 100) e.push('학교는 100자까지 쓸 수 있어요')
    if (r.phone && !PHONE.test(r.phone)) e.push('연락처는 숫자와 -만 쓸 수 있어요')
    if (r.major && r.major.length > 100) e.push('전공은 100자까지 쓸 수 있어요')
    if (r.studentNo && r.studentNo.length > 30) e.push('학번은 30자까지 쓸 수 있어요')
  }
  return { rows, fileError: null }
}
