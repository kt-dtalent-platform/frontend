import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { tokenStore } from '../api/token'
import { ToastProvider } from '../components/ui/Toast'
import { appUrl } from '../lib/env'

// 401(로그인 만료, 재발급도 실패)이면 토큰을 지우고 로그인 화면으로 보낸다.
function onAuthExpired(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401 || error.staleSession) return
  // 요청하는 쪽(api)이 이미 재발급을 해 보고도 401이면 다시 로그인해야 한다.
  // 재발급이 401이면 토큰은 이미 지워져 있으므로 로그인 여부로 거르지 않는다(거르면 [다시 시도] 화면에 남는다)
  tokenStore.clear()
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
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
