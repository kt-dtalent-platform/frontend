import { useMutation } from '@tanstack/react-query'
import { api } from './client'
import type { Role } from './types'

// POST /auth/login · 담당 승완 · FE 연동: Mock
export type LoginBody = { email: string; password: string }
export type LoginResult = { accessToken: string; refreshToken: string; role: Role; name: string }

export function useLogin() {
  return useMutation({
    mutationFn: (body: LoginBody) => api<LoginResult>('/auth/login', { method: 'POST', body }),
    onSuccess: (data) => {
      // 토큰 보관 방식은 백엔드와 정한 뒤 바꾼다(11/9 주).
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
    },
  })
}
