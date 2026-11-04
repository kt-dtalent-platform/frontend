import type { ApiEnvelope, ApiErrorBody } from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

// 공통 응답을 풀어서 data만 돌려준다. 실패면 ApiError를 던진다.
export async function api<T>(path: string, { body, headers, ...init }: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('accessToken')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!json) {
    throw new ApiError(res.status, { code: 'NETWORK_ERROR', message: '서버 응답을 읽지 못했습니다.' })
  }
  if (json.resultType === 'FAIL') {
    throw new ApiError(res.status, json.error)
  }
  return json.success.data
}
