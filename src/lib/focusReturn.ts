// 대화상자를 닫은 뒤 포커스를 돌려줄 곳.
// 맥 Safari는 버튼을 눌러도 그 버튼에 포커스를 주지 않아(document.activeElement가 body), 브라우저가 돌려줄 곳을 모른다.
// 그래서 마지막으로 누른 버튼이나 링크를 기억해 두었다가 대신 쓴다
let lastPressed: HTMLElement | null = null

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => {
      // 버튼이 아닌 곳을 누르면 비운다(예전에 누른 버튼으로 포커스가 튀지 않게)
      lastPressed = e.target instanceof Element ? e.target.closest<HTMLElement>('button, a[href], [tabindex]') : null
    },
    true,
  )
}

// 닫은 대화상자 안이나 body에 포커스가 남아 있으면 연 요소로 돌려준다
export function returnFocus(dialog: HTMLDialogElement, opener: HTMLElement | null) {
  const active = document.activeElement
  if (opener?.isConnected && (active === document.body || dialog.contains(active))) opener.focus()
}

export function currentOpener(): HTMLElement | null {
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) return active
  // 닫힌 대화상자 안의 버튼(취소 등)은 돌아갈 곳이 아니다
  return lastPressed?.isConnected && !lastPressed.closest('dialog:not([open])') ? lastPressed : null
}
