import { unzipSync, strFromU8 } from 'fflate'

// .xlsx의 첫 시트를 칸 값의 2차원 배열로 읽는다. 일괄 등록 양식처럼 글자와 숫자만 있는 표를 위한 작은 리더.
// xlsx는 zip 안의 XML이다: xl/sharedStrings.xml(글자 모음), xl/worksheets/sheetN.xml(칸).
// 빈 줄도 자리를 지켜서 배열 순서가 엑셀 줄 번호와 맞는다(data[0]이 1번째 줄)
export function readXlsx(buffer: ArrayBuffer): (string | number | boolean | null)[][] {
  const files = unzipSync(new Uint8Array(buffer), { filter: (f) => (f.name.startsWith('xl/') && f.name.endsWith('.xml')) || f.name.endsWith('.rels') })
  const xml = (name: string) => (files[name] ? new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml') : null)
  const sheetPath = firstSheetPath(xml)
  const sheet = xml(sheetPath)
  if (!sheet) throw new Error('시트를 찾지 못함')

  const shared = Array.from(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? []).map(textOf)
  const out: (string | number | boolean | null)[][] = []
  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r')) - 1
    const cells: (string | number | boolean | null)[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const col = colIndex(c.getAttribute('r') ?? '')
      const type = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? null
      let value: string | number | boolean | null = null
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
