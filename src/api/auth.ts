import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { tokenStore } from './token'
import type { Role } from './types'

// POST /auth/login · 담당 승완 · FE 연동: Mock
export type LoginBody = { email: string; password: string }
export type LoginResult = { accessToken: string; refreshToken: string; role: Role; name: string }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginBody) => api<LoginResult>('/auth/login', { method: 'POST', body }),
    onSuccess: (data) => {
      tokenStore.set(data.accessToken)
      // 다른 계정으로 로그인하면 이전 계정의 내 정보·할 일이 남지 않게 지운다.
      queryClient.removeQueries({ queryKey: ['me'] })
    },
  })
}
