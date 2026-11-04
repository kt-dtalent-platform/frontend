// design/tokens.json(디자인 시스템과 같은 파일)을 읽어 src/styles/tokens.css를 만든다.
// 토큰을 바꿀 때는 tokens.json만 고치고 `npm run tokens`를 실행한다.
import { readFileSync, writeFileSync } from 'node:fs'

const src = new URL('../design/tokens.json', import.meta.url)
const out = new URL('../src/styles/tokens.css', import.meta.url)
const t = JSON.parse(readFileSync(src, 'utf8'))

const colors = Object.fromEntries(t.color.tokens.map((c) => [c.name, c.value]))
const resolve = (v) => {
  const m = /^\{(.+)\}$/.exec(v)
  return m ? resolve(colors[m[1]]) : v
}

const lines = []
const add = (name, value) => lines.push(`  --${name}: ${value};`)

lines.push('  --color-*: initial;', '  --color-transparent: transparent;', '  --color-current: currentColor;')
for (const c of t.color.tokens) add(`color-${c.name}`, resolve(c.value))

lines.push('')
add('font-sans', t.type.families.sans)
for (const g of t.type.groups) {
  for (const s of g.styles) {
    add(`text-${s.name}`, s.fontSize)
    add(`text-${s.name}--line-height`, s.lineHeight)
    add(`text-${s.name}--font-weight`, String(s.fontWeight))
    if (s.letterSpacing) add(`text-${s.name}--letter-spacing`, s.letterSpacing)
  }
}

lines.push('', '  --radius-*: initial;')
for (const r of t.radius.tokens) add(r.name, r.value)

lines.push('', '  --shadow-*: initial;')
for (const s of t.shadow.tokens) add(s.name, s.value)

// 높이·폭: h-control-h, w-sidebar-w, max-w-page-form 처럼 쓴다.
lines.push('')
for (const s of t.size.tokens) {
  if (s.name.startsWith('page-')) add(`container-${s.name}`, s.value)
  else add(`spacing-${s.name}`, s.value)
}

const root = []
for (const z of t.zIndex.tokens) root.push(`  --${z.name}: ${z.value};`)
for (const s of t.spacing.tokens) root.push(`  --${s.name}: ${s.value};`)

const css = `/* 자동 생성 파일입니다. 직접 고치지 말고 design/tokens.json을 고친 뒤 npm run tokens를 실행하세요. */

@theme static {
${lines.join('\n')}
}

/* 간격은 Tailwind 기본(4px 단위)과 같아서 p-4 = 16px, gap-6 = 24px 처럼 쓴다.
   z-index는 z-(--z-dialog) 처럼 쓴다. */
:root {
${root.join('\n')}
}
`
writeFileSync(out, css)
console.log('tokens.css를 만들었습니다.')
