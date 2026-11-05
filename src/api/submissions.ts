import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { SubmissionStatus } from './types'

// 항목 입력 방식 (backend request_fields.field_type)
export type FieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT_ONE' | 'SELECT_MULTI' | 'CHECKBOX' | 'FILE'

export type FormField = {
  fieldKey: string
  label: string
  fieldType: FieldType
  required: boolean
  validation?: {
    min?: number
    max?: number
    maxLength?: number
    allowedExtensions?: string[]
    maxSizeMb?: number
  } | null
  // options·helpText는 DB에는 있지만 명세서 응답 예시에는 없다(확인 필요)
  options?: string[] | null
  helpText?: string | null
}

export type AnswerValue = string | number | boolean | string[] | null
export type Answers = Record<string, AnswerValue>

// GET /me/submissions/{requestId} · 담당 정윤 · FE 연동: Mock
export type SubmissionForm = {
  request: { id: number; title: string; description: string | null; dueAt: string; privacyNotice: string | null }
  fields: FormField[]
  submissionId: number | null
  status: SubmissionStatus
  answers: Answers
  files: { id: number; fieldKey: string; originalName: string }[]
  editableFieldKeys: string[]
  revision: { reason: string; dueAt: string } | null
  version: number
}

export const submissionKey = (requestId: number) => ['me', 'submissions', requestId] as const

export function useSubmissionForm(requestId: number) {
  return useQuery({
    queryKey: submissionKey(requestId),
    queryFn: () => api<SubmissionForm>(`/me/submissions/${requestId}`),
  })
}

// PUT /me/submissions/{requestId}/draft · 담당 정윤 · FE 연동: Mock
export type DraftResult = { submissionId: number; status: SubmissionStatus; savedAt: string; version: number }

export function useSaveDraft(requestId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { answers: Answers; version: number }) =>
      api<DraftResult>(`/me/submissions/${requestId}/draft`, { method: 'PUT', body }),
    onSuccess: (result, { answers }) => {
      // 다시 불러오지 않고 저장한 값과 새 버전을 그대로 반영한다.
      queryClient.setQueryData<SubmissionForm>(submissionKey(requestId), (prev) =>
        prev ? { ...prev, answers, status: result.status, submissionId: result.submissionId, version: result.version } : prev,
      )
      queryClient.invalidateQueries({ queryKey: ['me', 'tasks'] })
    },
  })
}
