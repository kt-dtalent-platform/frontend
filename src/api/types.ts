// 백엔드 공통 응답 형식 (backend KT-8)
export type ApiEnvelope<T> =
  | { resultType: 'SUCCESS'; success: { data: T }; error: null; meta: ApiMeta }
  | { resultType: 'FAIL'; success: null; error: ApiErrorBody; meta: ApiMeta }

export type ApiMeta = { timestamp: string; path: string }

export type ApiErrorBody = {
  code: string
  message: string
  details?: unknown
}

export type Role = 'MANAGER' | 'SCHOLAR'

export type SubmissionStatus =
  | 'NOT_SUBMITTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVISION_REQUIRED'
  | 'CONFIRMED'
