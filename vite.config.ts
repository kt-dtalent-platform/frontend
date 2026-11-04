import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // msw: 개발 서버에서 /mockServiceWorker.js를 내려준다. 목업 켜기는 src/main.tsx.
  plugins: [react(), tailwindcss(), msw({ mode: 'worker-only' })],
})
