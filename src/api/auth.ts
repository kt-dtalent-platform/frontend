import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { tokenStore } from './token'
import type { Me, Role } from './types'

// POST /auth/login · 담당 승완 · FE 연동: Mock (모양은 백엔드 #29, #45 기준)
export type LoginBody = { email: string; password: string }
export type LoginResult = { accessToken: string; refreshToken?: string | null; role: Role; name: string; passwordChangeRequired: boolean }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginBody) => api<LoginResult>('/auth/login', { method: 'POST', body }),
    onSuccess: ({ accessToken, refreshToken, passwordChangeRequired }) => {
      tokenStore.set({ accessToken, refreshToken, passwordChangeRequired })
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

// POST /auth/logout · 백엔드에 아직 없음. 리프레시 토큰이 생기면 부른다 · FE 연동: Mock
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

// PATCH /auth/password · 담당 승완 · 백엔드 #45 · FE 연동: Mock
// 오류: 400 PASSWORD_MISMATCH(현재 비밀번호 틀림), SAME_AS_CURRENT(기존과 같음), INVALID_REQUEST(8~64자 아님)
export type PasswordChange = { currentPassword: string; newPassword: string }

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PasswordChange) => api<{ passwordChangedAt: string }>('/auth/password', { method: 'PATCH', body }),
    // 보낸 때의 로그인을 기억해 둔다. 응답 전에 로그아웃하고 다른 계정으로 들어왔으면 그 계정에 반영하지 않는다
    // (지금은 토큰 재발급이 없어 토큰으로 구분. 리프레시 토큰이 생기면 다시 확인 필요)
    onMutate: () => ({ token: tokenStore.access() }),
    onSuccess: (_data, _body, context) => {
      if (!context?.token || context.token !== tokenStore.access()) return
      tokenStore.passwordChanged()
      return queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export const roleHome = (role: Role) => (role === 'MANAGER' ? '/manager' : '/tasks')
