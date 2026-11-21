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
  // 선택지: 저장되는 값(value)과 화면에 보이는 이름(label). 백엔드 KT-17
  options?: { value: string; label: string }[] | null
  helpText?: string | null
}

export type AnswerValue = string | number | boolean | string[] | null
export type Answers = Record<string, AnswerValue>

// GET /me/submissions/{requestId} · 백엔드 KT-17 기준
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

// PUT /me/submissions/{requestId}/draft · 백엔드 구현 전이라 노션 명세서 모양을 임시로 쓴다(확인 필요)
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

// 제출: POST /me/submissions/{requestId}/submit
// 보완 후 다시 제출: POST .../resubmit. 보완 요청된 항목만 보낸다.
// 둘 다 백엔드 구현 없음(노션 명세서 모양을 임시로 씀, 확인 필요)
export type SubmitResult = {
  submissionId: number
  status: SubmissionStatus
  submittedAt?: string
  resubmittedAt?: string
  completionMessage?: string | null
  version?: number
}

// 문서 분석(OCR, 백엔드 #101). 제출과 재제출이 끝난 뒤에 부른다.
// 서버는 부르는 순간 저장된 입력값과 비교하고, 입력값이 나중에 바뀌면 그 결과를 검토 화면에 주지 않는다.
// 그래서 파일을 올릴 때가 아니라 입력값이 정해진 제출 뒤에 부른다. 서버가 스스로 다시 분석하지는 않는다.
// 비교하는 입력값은 gpa, gpa_scale, credits로 서버에 고정돼 있다. 이 값이 없는 요청은 부르지 않는다.
// 다시 부르면 이전 결과는 무효라 성적증명서 칸의 마지막 파일 하나만 부른다. 장학생 화면은 결과를 기다리지 않는다.
const COMPARED_KEYS = ['gpa', 'gpa_scale', 'credits']

function analyzedFileField(fields: FormField[]) {
  const files = fields.filter((f) => f.fieldType === 'FILE')
  return files.find((f) => f.fieldKey === 'transcript') ?? (files.length === 1 ? files[0] : undefined)
}

function requestAnalysis(form: SubmissionForm, submissionId: number) {
  if (!form.fields.some((f) => COMPARED_KEYS.includes(f.fieldKey))) return
  const field = analyzedFileField(form.fields)
  if (!field) return
  // 재제출에서 성적증명서도 비교 값도 고치지 않았으면 지난 결과가 그대로 맞다
  const changed = form.editableFieldKeys.some((k) => k === field.fieldKey || COMPARED_KEYS.includes(k))
  if (!changed) return
  const file = form.files.filter((f) => f.fieldKey === field.fieldKey).at(-1)
  if (!file) return
  api(`/submissions/${submissionId}/files/${file.id}/analysis`, { method: 'POST' }).catch((err) => console.warn('문서 분석 요청 실패', err))
}

export function useSubmit(requestId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ resubmit, ...body }: { answers: Answers; version: number; resubmit: boolean }) =>
      api<SubmitResult>(`/me/submissions/${requestId}/${resubmit ? 'resubmit' : 'submit'}`, { method: 'POST', body }),
    onSuccess: (result) => {
      const prev = queryClient.getQueryData<SubmissionForm>(submissionKey(requestId))
      if (prev) requestAnalysis(prev, result.submissionId)
      // 다시 불러오기 전에도 바로 잠기도록 상태와 수정 가능 항목을 먼저 바꾼다
      queryClient.setQueryData<SubmissionForm>(submissionKey(requestId), (prev) => (prev ? { ...prev, status: result.status, editableFieldKeys: [] } : prev))
      // 버전 등 나머지는 서버 값으로 다시 불러온다
      queryClient.invalidateQueries({ queryKey: submissionKey(requestId) })
      queryClient.invalidateQueries({ queryKey: ['me', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['me', 'submissions', 'history'] })
    },
  })
}
