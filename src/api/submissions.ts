import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { isDone, type SubmissionStatus } from './types'

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
    maxFiles?: number // 없으면 1개로 본다(확인 필요)
  } | null
  // DB(request_fields)에는 options·help_text가 있지만 백엔드 조회 결과에는 아직 없다(확인 필요)
  options?: string[] | null
  helpText?: string | null
}

export type AnswerValue = string | number | boolean | string[] | null
export type Answers = Record<string, AnswerValue>

// GET /me/submissions/{requestId} · 담당 정윤 · 백엔드 PR #26(KT-17) 기준
// 백엔드 조회 결과(SubmissionFormData)를 그대로 받는다. 응답 모양이 확정되면 이 타입과 toForm만 고친다.
export type RawSubmissionForm = {
  request: { id: number; title: string; description: string | null; requestDueAt: string; status: 'IN_PROGRESS' | 'CLOSED' }
  fields: FormField[]
  submission: { id: number; status: SubmissionStatus; answers: Answers; version: number } | null
  files: { id: number; fieldKey: string; originalName: string; uploadStatus: 'PENDING' | 'UPLOADED' | 'DELETED' }[]
  revision: { id: number; reason: string; fieldKeys: string[] } | null
}

export type UploadedFile = { id: number; fieldKey: string; originalName: string; sizeBytes?: number }

// 화면에서 쓰는 모양
export type SubmissionForm = {
  request: { id: number; title: string; description: string | null; dueAt: string; closed: boolean }
  fields: FormField[]
  submissionId: number | null
  status: SubmissionStatus
  answers: Answers
  files: UploadedFile[]
  editableFieldKeys: string[] // 수정 가능한 항목. 백엔드가 주지 않아 상태로 계산한다
  revision: { reason: string } | null
  version: number
}

export function toForm(raw: RawSubmissionForm): SubmissionForm {
  const status = raw.submission?.status ?? 'NOT_SUBMITTED'
  const closed = raw.request.status === 'CLOSED'
  const allKeys = raw.fields.map((f) => f.fieldKey)
  const editableFieldKeys = closed || isDone(status) ? [] : status === 'REVISION_REQUIRED' ? (raw.revision?.fieldKeys ?? []) : allKeys
  return {
    request: {
      id: raw.request.id,
      title: raw.request.title,
      description: raw.request.description,
      dueAt: raw.request.requestDueAt,
      closed,
    },
    fields: raw.fields,
    submissionId: raw.submission?.id ?? null,
    status,
    answers: raw.submission?.answers ?? {},
    files: raw.files.filter((f) => f.uploadStatus === 'UPLOADED').map(({ id, fieldKey, originalName }) => ({ id, fieldKey, originalName })),
    editableFieldKeys,
    revision: raw.revision ? { reason: raw.revision.reason } : null,
    version: raw.submission?.version ?? 0,
  }
}

export const submissionKey = (requestId: number) => ['me', 'submissions', requestId] as const

export function useSubmissionForm(requestId: number) {
  return useQuery({
    queryKey: submissionKey(requestId),
    queryFn: async () => toForm(await api<RawSubmissionForm>(`/me/submissions/${requestId}`)),
  })
}

// PUT /me/submissions/{requestId}/draft · 담당 정윤 · 백엔드 구현 없음(명세서 기준 임시, 확인 필요)
export type DraftResult = { submissionId: number; status: SubmissionStatus; savedAt: string; version: number }

export function useSaveDraft(requestId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { answers: Answers; version: number }) => api<DraftResult>(`/me/submissions/${requestId}/draft`, { method: 'PUT', body }),
    onSuccess: (result, { answers }) => {
      // 다시 불러오지 않고 저장한 값과 새 버전을 그대로 반영한다.
      queryClient.setQueryData<SubmissionForm>(submissionKey(requestId), (prev) =>
        prev ? { ...prev, answers, status: result.status, submissionId: result.submissionId, version: result.version } : prev,
      )
      queryClient.invalidateQueries({ queryKey: ['me', 'tasks'] })
    },
  })
}

// 제출: POST /me/submissions/{requestId}/submit (정윤)
// 보완 후 다시 제출: POST .../resubmit (승완). 보완 요청된 항목만 보낸다.
// 둘 다 백엔드 구현 없음(노션 명세서 모양을 임시로 씀, 확인 필요)
export type SubmitResult = {
  submissionId: number
  status: SubmissionStatus
  submittedAt?: string
  resubmittedAt?: string
  completionMessage?: string | null
  version?: number
}

export function useSubmit(requestId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ resubmit, ...body }: { answers: Answers; version: number; resubmit: boolean }) =>
      api<SubmitResult>(`/me/submissions/${requestId}/${resubmit ? 'resubmit' : 'submit'}`, { method: 'POST', body }),
    onSuccess: () => {
      // 상태·버전·잠금이 모두 바뀌므로 서버 값으로 다시 불러온다
      queryClient.invalidateQueries({ queryKey: submissionKey(requestId) })
      queryClient.invalidateQueries({ queryKey: ['me', 'tasks'] })
    },
  })
}
