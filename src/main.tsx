import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'
import { basePath, mockOn } from './lib/env'

// 개발 중이고 VITE_USE_MOCK=false가 아니면 목업을 켠다. 미리보기 사이트 빌드(VITE_DEMO=true)에서도 켠다.
// 일반 배포 빌드에는 들어가지 않는다.
async function enableMocking() {
  if (!mockOn) return
  const { worker } = await import('./mocks/browser')
  // 앱이 하위 경로(/frontend/)에 올라가도 같은 경로의 워커 파일을 쓴다
  await worker.start({ onUnhandledFrame: 'bypass', serviceWorker: { url: `${basePath}mockServiceWorker.js` } })
}

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// 목업을 못 켜도 화면은 띄운다(이때 API 호출은 실제 주소로 간다).
enableMocking()
  .catch((error: unknown) => console.error('목업을 켜지 못했습니다.', error))
  .finally(render)
