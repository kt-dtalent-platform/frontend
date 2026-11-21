import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { tokenStore } from './token'
import type { Me, Role } from './types'

// POST /auth/login · FE 연동: Mock (모양은 백엔드 #29, #45 기준)
export type LoginBody = { email: string; password: string }
export type LoginResult = { accessToken: string; refreshToken: string; role: Role; name: string; passwordChangeRequired: boolean }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginBody) => api<LoginResult>('/auth/login', { method: 'POST', body }),
    onSuccess: ({ accessToken, refreshToken, passwordChangeRequired }) => {
      tokenStore.login({ accessToken, refreshToken, passwordChangeRequired })
      // 다른 계정으로 로그인하면 이전 계정의 내 정보·할 일이 남지 않게 지운다.
      queryClient.removeQueries({ queryKey: ['me'] })
    },
  })
}

// GET /me · FE 연동: Mock
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/me'),
    enabled: tokenStore.loggedIn(),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

// POST /auth/logout · 백엔드 #108. 리프레시 토큰을 서버에서 지운다
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const refreshToken = tokenStore.refresh()
      if (refreshToken) await api<null>('/auth/logout', { method: 'POST', body: { refreshToken } })
    },
    // 서버 응답과 상관없이 이 브라우저에서는 로그아웃한다.
    onSettled: () => {
      tokenStore.clear()
      queryClient.clear()
    },
  })
}

// PATCH /auth/password · 백엔드 #45, #108(바꾸면 이전 토큰이 모두 끊기고 새 쌍을 준다)
// 오류: 400 PASSWORD_MISMATCH(현재 비밀번호 틀림), SAME_AS_CURRENT(기존과 같음), INVALID_REQUEST(8~64자 아님)
export type PasswordChange = { currentPassword: string; newPassword: string }

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PasswordChange) =>
      api<{ passwordChangedAt: string; accessToken: string; refreshToken: string }>('/auth/password', { method: 'PATCH', body }),
    // 보낸 때의 로그인을 기억해 둔다. 응답 전에 로그아웃하고 다른 계정으로 들어왔으면 그 계정에 반영하지 않는다
    onMutate: () => ({ session: tokenStore.session() }),
    onSuccess: (data, _body, context) => {
      if (!context?.session || context.session !== tokenStore.session()) return
      // 새 토큰을 받지 못하면(예전 서버) 지금 토큰을 그대로 쓴다
      if (data.accessToken && data.refreshToken) tokenStore.rotate(data)
      tokenStore.passwordChanged()
      return queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export const roleHome = (role: Role) => (role === 'MANAGER' ? '/manager' : '/tasks')
