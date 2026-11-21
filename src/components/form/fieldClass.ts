// 입력칸 공통 모양. 손가락으로 쓰는 기기는 늘 16px(아이폰 Safari는 16px보다 작은 칸을 누르면 확대한다. 가로로 눕혀 768px을 넘어도 마찬가지),
// 마우스로 쓰는 넓은 화면(md:pointer-fine)만 본문 14px.
// 포커스 선은 칸 테두리 자리에 겹쳐 그린다. 칸 밖으로 커지지 않아 아래 도움말과 닿지 않는다
export const fieldBase =
  'w-full rounded-md border bg-surface px-4 text-input-touch text-ink outline-hidden md:pointer-fine:text-body hover:border-line-control focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:outline-focus disabled:bg-surface-sunken'
export const fieldControl = `${fieldBase} h-control-h`
// 목록 위 필터 줄(기수 고르기, 찾기). 칩과 같은 32px, 테두리 없이 칩과 같은 연한 바탕.
// 폼 입력칸은 외곽선, 필터 줄은 바탕으로 나눠서 필터가 폼처럼 무거워 보이지 않게 한다(11/12)
export const filterField =
  'h-control-compact w-full rounded-md bg-control-tonal px-3 text-input-touch text-ink outline-hidden placeholder:text-ink-3 hover:bg-control-tonal-hover md:pointer-fine:text-body focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus'
export const fieldBorder = (invalid: boolean) => (invalid ? 'border-danger-line' : 'border-line-input')
