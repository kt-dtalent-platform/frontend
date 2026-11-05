import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

// 개발 중이고 VITE_USE_MOCK=false가 아니면 목업을 켠다. 배포 빌드에는 들어가지 않는다.
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === 'false') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass' })
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
