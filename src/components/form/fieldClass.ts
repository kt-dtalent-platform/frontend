// 입력칸 공통 모양. 모바일은 16px(iOS 확대 방지), md 이상은 본문 14px.
export const fieldBase =
  'w-full rounded-md border bg-surface px-4 text-input-touch text-ink outline-none md:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-surface-sunken'
export const fieldControl = `${fieldBase} h-control-h`
// 목록 위 필터 줄(기수 고르기, 찾기). 칩과 같은 32px, 테두리 없이 칩과 같은 연한 바탕.
// 폼 입력칸은 외곽선, 필터 줄은 바탕으로 나눠서 필터가 폼처럼 무거워 보이지 않게 한다(11/12)
export const filterField =
  'h-control-compact w-full rounded-md bg-control-tonal px-3 text-input-touch text-ink outline-none placeholder:text-ink-3 hover:bg-control-tonal-hover md:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
export const fieldBorder = (invalid: boolean) => (invalid ? 'border-danger-line' : 'border-line-control')
