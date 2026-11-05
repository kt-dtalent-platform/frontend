// 입력칸 공통 모양. 모바일은 16px(iOS 확대 방지), md 이상은 본문 14px.
export const fieldBase =
  'w-full rounded-md border bg-surface px-4 text-input-touch text-ink outline-none md:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-surface-sunken'
export const fieldControl = `${fieldBase} h-control-h`
export const fieldBorder = (invalid: boolean) => (invalid ? 'border-danger-line' : 'border-line-control')
