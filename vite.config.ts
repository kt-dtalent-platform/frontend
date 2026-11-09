import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    // msw: 개발 서버에서 /mockServiceWorker.js를 내려준다. 목업 켜기는 src/main.tsx.
    plugins: [react(), tailwindcss(), msw({ mode: 'worker-only' })],
    server: {
      // 개발 서버가 /v1 요청을 로컬 백엔드로 넘긴다. 브라우저는 같은 주소로 보내는 셈이라 CORS가 필요 없다.
      // 목업이 켜져 있으면 브라우저 안에서 MSW가 먼저 답하므로 여기까지 오지 않는다.
      proxy: {
        // /v1로 시작하는 API 요청만 넘긴다(/v1abc 같은 화면 주소는 넘기지 않게)
        '^/v1/': { target: env.VITE_BACKEND_ORIGIN || 'http://localhost:8080', changeOrigin: true },
      },
    },
  }
})
