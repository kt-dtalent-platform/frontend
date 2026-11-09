import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { tokenStore } from '../api/token'
import { appUrl } from '../lib/env'

// 401(로그인 만료)이면 토큰을 지우고 로그인 화면으로 보낸다.
function onAuthExpired(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return
  if (tokenStore.access() === null) return
  tokenStore.set(null)
  const login = appUrl('/login')
  if (window.location.pathname !== login) window.location.replace(login)
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: onAuthExpired }),
        defaultOptions: {
          queries: {
            // 권한·없음 같은 응답은 다시 시도해도 같으므로 바로 보여 준다
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
          mutations: { onError: onAuthExpired },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
