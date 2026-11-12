// 백엔드 공통 응답 형식 (backend KT-8)
export type ApiEnvelope<T> =
  { resultType: 'SUCCESS'; success: { data: T }; error: null; meta: ApiMeta } | { resultType: 'FAIL'; success: null; error: ApiErrorBody; meta: ApiMeta }

export type ApiMeta = { timestamp: string; path: string }

export type ApiErrorBody = {
  code: string
  message: string
  details?: unknown
}

export type Role = 'MANAGER' | 'SCHOLAR'

// backend submissions.status + 행이 없으면 NOT_SUBMITTED (V1__create_initial_schema.sql)
export type SubmissionStatus = 'NOT_SUBMITTED' | 'DRAFT' | 'SUBMITTED' | 'REVISION_REQUIRED' | 'RESUBMITTED' | 'CONFIRMED'

// 장학생 쪽에서 할 일이 끝난 상태(검토는 담당자 몫)
export const isDone = (s: SubmissionStatus) => s === 'SUBMITTED' || s === 'RESUBMITTED' || s === 'CONFIRMED'

// GET /me
export type Me = {
  id: number
  name: string
  email: string
  role: Role
  cohort: { id: number; name: string } | null
  accessiblePrograms: { id: number; name: string }[] | null
}

// 검증 실패 시 error.details. 지금 백엔드(INVALID_REQUEST)는 항목 이름 목록(string[])을 준다.
// 명세서의 { fieldErrors: [{ key, message }] } 모양도 같이 받는다.
export type FieldError = { key: string; message: string }

export function fieldErrorsOf(details: unknown): FieldError[] {
  if (Array.isArray(details)) {
    return details.filter((d): d is string => typeof d === 'string').map((key) => ({ key, message: '형식을 확인하세요.' }))
  }
  const list = (details as { fieldErrors?: FieldError[] } | null)?.fieldErrors
  return Array.isArray(list) ? list : []
}
