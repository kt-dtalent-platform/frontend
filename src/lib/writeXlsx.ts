import { strToU8, zipSync } from 'fflate'

// 글자만 담은 최소한의 .xlsx를 만든다(시트 하나).
// 모든 칸을 글자(inlineStr)로 넣어 엑셀이 수식(=, +, -, @로 시작)이나 숫자(앞자리 0)로 바꾸지 않는다
export function writeXlsx(rows: string[][], widths: number[] = []): Blob {
  const esc = (v: string) =>
    v
      // XML에 넣을 수 없는 제어 문자는 뺀다
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  const col = (i: number) => String.fromCharCode(65 + i) // 열은 26개 이하만 쓴다
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''
  const data = rows
    .map(
      (r, y) =>
        `<row r="${y + 1}">${r.map((v, x) => `<c r="${col(x)}${y + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`,
    )
    .join('')
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  const ns = 'http://schemas.openxmlformats.org'
  const files = {
    '[Content_Types].xml': `${xml}<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `${xml}<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${xml}<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${xml}<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${xml}<worksheet xmlns="${ns}/spreadsheetml/2006/main">${cols}<sheetData>${data}</sheetData></worksheet>`,
  }
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
  return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// 만든 파일을 내려받게 한다. Safari도 a[download]를 지원한다
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  // 바로 지우면 Safari에서 내려받기가 끊기거나 파일 이름을 잃을 수 있어 조금 뒤에 지운다
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}
