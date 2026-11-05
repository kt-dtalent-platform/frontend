import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { tokenStore } from './token'
import type { Me, Role } from './types'

// POST /auth/login · 담당 승완 · FE 연동: Mock
export type LoginBody = { email: string; password: string }
export type LoginResult = { accessToken: string; refreshToken: string; role: Role; name: string }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginBody) => api<LoginResult>('/auth/login', { method: 'POST', body }),
    onSuccess: ({ accessToken, refreshToken }) => {
      tokenStore.set({ accessToken, refreshToken })
      // 다른 계정으로 로그인하면 이전 계정의 내 정보·할 일이 남지 않게 지운다.
      queryClient.removeQueries({ queryKey: ['me'] })
    },
  })
}

// GET /me · 담당 승완 · FE 연동: Mock
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/me'),
    enabled: tokenStore.access() !== null,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

// POST /auth/logout · 담당 승완 · FE 연동: Mock
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const refreshToken = tokenStore.refresh()
      if (refreshToken) await api<null>('/auth/logout', { method: 'POST', body: { refreshToken } })
    },
    // 서버 응답과 상관없이 이 브라우저에서는 로그아웃한다.
    onSettled: () => {
      tokenStore.set(null)
      queryClient.clear()
    },
  })
}

// PATCH /me/password · 담당 승완 · 백엔드 미정, 경로·필드 확인 필요 · FE 연동: Mock
export type PasswordChange = { currentPassword: string; newPassword: string }

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PasswordChange) => api<null>('/me/password', { method: 'PATCH', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export const roleHome = (role: Role) => (role === 'MANAGER' ? '/manager' : '/tasks')
