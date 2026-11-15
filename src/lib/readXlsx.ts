import { unzipSync, strFromU8 } from 'fflate'

// .xlsx의 첫 시트를 칸 값의 2차원 배열로 읽는다. 일괄 등록 양식처럼 글자와 숫자만 있는 표를 위한 작은 리더.
// xlsx는 zip 안의 XML이다: xl/sharedStrings.xml(글자 모음), xl/worksheets/sheetN.xml(칸).
// 빈 줄도 자리를 지켜서 배열 순서가 엑셀 줄 번호와 맞는다(data[0]이 1번째 줄)
// 압축을 풀기 전에 크기를 본다. 양식 500명은 수백 KB라 넉넉히 잡고, 압축 폭탄처럼 큰 파일은 거절한다
const MAX_ENTRY = 20 * 1024 * 1024
const MAX_TOTAL = 40 * 1024 * 1024

type Cell = string | number | boolean | null

export function readXlsx(buffer: ArrayBuffer): Cell[][] {
  const zip = new Uint8Array(buffer)
  let total = 0
  // 필요한 파일만, 정해진 크기 안에서 푼다
  const unzip = (want: (name: string) => boolean) =>
    unzipSync(zip, {
      filter: (f) => {
        if (!want(f.name)) return false
        total += f.originalSize
        if (f.originalSize > MAX_ENTRY || total > MAX_TOTAL) throw new Error('파일이 너무 큼')
        return true
      },
    })
  const toXml = (bytes: Uint8Array | undefined) => (bytes ? new DOMParser().parseFromString(strFromU8(bytes), 'application/xml') : null)

  // 1) 워크북 목록으로 첫 시트 경로를 찾고 2) 그 시트와 글자 모음만 푼다(다른 시트는 풀지 않는다)
  const meta = unzip((n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels')
  const sheetPath = firstSheetPath((n) => toXml(meta[n]))
  const files = unzip((n) => n === sheetPath || n === 'xl/sharedStrings.xml')
  const sheet = toXml(files[sheetPath])
  if (!sheet) throw new Error('시트를 찾지 못함')

  const shared = Array.from(toXml(files['xl/sharedStrings.xml'])?.getElementsByTagName('si') ?? []).map(textOf)
  const out: Cell[][] = []
  // 줄 번호(r)나 칸 주소(r)가 없는 파일도 있다. 없으면 앞 줄, 앞 칸 다음으로 본다
  let nextRow = 0
  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const rAttr = Number(row.getAttribute('r'))
    const r = rAttr > 0 ? rAttr - 1 : nextRow
    nextRow = r + 1
    const cells: Cell[] = []
    let nextCol = 0
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r')
      const col = ref ? colIndex(ref) : nextCol
      nextCol = col + 1
      const type = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? null
      let value: Cell = null
      if (type === 's') value = v === null ? null : (shared[Number(v)] ?? null)
      else if (type === 'inlineStr') value = textOf(c.getElementsByTagName('is')[0])
      else if (type === 'str' || type === 'e') value = v
      else if (type === 'b') value = v === '1'
      else if (v !== null) value = Number(v)
      cells[col] = value
    }
    out[r] = Array.from(cells, (x) => x ?? null)
  }
  return Array.from(out, (x) => x ?? [])
}

// 워크북의 첫 번째 시트 파일 경로. 못 찾으면 sheet1
function firstSheetPath(xml: (name: string) => Document | null) {
  const id = xml('xl/workbook.xml')?.getElementsByTagName('sheet')[0]?.getAttribute('r:id')
  const rel = Array.from(xml('xl/_rels/workbook.xml.rels')?.getElementsByTagName('Relationship') ?? []).find((x) => x.getAttribute('Id') === id)
  const target = rel?.getAttribute('Target')
  if (!target) return 'xl/worksheets/sheet1.xml'
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`
}

// 글자 칸: 서식이 섞이면 <r><t>로 나뉘므로 모든 <t>를 이어 붙인다(발음 표기 <rPh>는 뺀다)
function textOf(node: Element | undefined) {
  if (!node) return null
  return Array.from(node.getElementsByTagName('t'))
    .filter((t) => t.parentElement?.tagName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('')
}

// "AB12" → 27(0부터)
function colIndex(ref: string) {
  let n = 0
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
