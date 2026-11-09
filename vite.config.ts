import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // 앱이 올라갈 경로. GitHub Pages 미리보기는 /frontend/ (워크플로에서 VITE_BASE로 넘김)
  base: process.env.VITE_BASE || '/',
  // msw: 개발 서버에서 /mockServiceWorker.js를 내려준다. 목업 켜기는 src/main.tsx.
  plugins: [react(), tailwindcss(), msw({ mode: 'worker-only' })],
})
