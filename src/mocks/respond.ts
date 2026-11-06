import { HttpResponse } from 'msw'

// 백엔드 공통 응답 모양을 그대로 흉내 낸다.
const meta = (path: string) => ({ timestamp: new Date().toISOString().slice(0, 19), path })

export function ok<T>(path: string, data: T) {
  return HttpResponse.json({ resultType: 'SUCCESS', success: { data }, error: null, meta: meta(path) })
}

export function fail(path: string, status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json({ resultType: 'FAIL', success: null, error: { code, message, details: details ?? null }, meta: meta(path) }, { status })
}
