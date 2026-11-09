import { delay, http, HttpResponse } from 'msw'
import type { CreateRequestBody } from '../api/manager'
import type { ScholarCreate, ScholarUpdate } from '../api/scholars'
import type { Answers } from '../api/submissions'
import { addFile, canChangeFile, fieldOf, fileOwner, getForm, now, removeFile, requestOfSubmission, saveDraft, submit, taskList } from './db'
import { cohorts, createRequest, managerDashboard, publishRequest, requestDetail, requestList, templates, updateRequest } from './manager'
import { fail, ok } from './respond'
import { createScholar, scholarDetail, scholarList, updateScholar } from './scholars'
import { exportCsv, review, submissionDetail, submissionList } from './review'

const BASE = '/v1'

const ME = {
  SCHOLAR: { id: 101, name: '홍길동', email: 'hong@kt.com', role: 'SCHOLAR', cohort: { id: 6, name: '6기' }, accessiblePrograms: null },
  MANAGER: { id: 7, name: '정지은', email: 'admin@kt.com', role: 'MANAGER', cohort: null, accessiblePrograms: [{ id: 1, name: 'KT 디지털인재장학' }] },
} as const

// 목업 토큰에 역할을 담아 /me가 맞는 사람을 돌려주게 한다
const roleOf = (request: Request) =>
  request.headers.get('Authorization')?.includes('manager') ? 'MANAGER' : request.headers.get('Authorization') ? 'SCHOLAR' : null

const unauthorized = (path: string) => fail(path, 401, 'UNAUTHORIZED', '인증 정보가 없거나 만료되었습니다')

export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }
    if (password.length < 8) {
      return fail('/v1/auth/login', 401, 'LOGIN_FAILED', '이메일 또는 비밀번호가 올바르지 않습니다')
    }
    const role = email.startsWith('admin') ? 'MANAGER' : 'SCHOLAR'
    return ok('/v1/auth/login', {
      accessToken: `mock-access-${role.toLowerCase()}`,
      refreshToken: `mock-refresh-${role.toLowerCase()}`,
      role,
      name: ME[role].name,
    })
  }),

  http.post(`${BASE}/auth/logout`, () => ok('/v1/auth/logout', null)),

  http.get(`${BASE}/me`, ({ request }) => {
    const role = roleOf(request)
    return role ? ok('/v1/me', ME[role]) : unauthorized('/v1/me')
  }),

  http.get(`${BASE}/me/tasks`, ({ request }) => {
    if (!roleOf(request)) return unauthorized('/v1/me/tasks')
    // 백엔드 필터: TODO(미제출·작성 중·보완 필요) / ALL
    const filter = new URL(request.url).searchParams.get('status') ?? 'TODO'
    const todo = (s: string) => s === 'NOT_SUBMITTED' || s === 'DRAFT' || s === 'REVISION_REQUIRED'
    const items = taskList()
      .filter((t) => filter === 'ALL' || todo(t.status))
      .sort((a, b) => a.requestDueAt.localeCompare(b.requestDueAt))
    return ok('/v1/me/tasks', { items })
  }),

  http.get(`${BASE}/me/submissions/:requestId`, ({ params, request }) => {
    const path = `/v1/me/submissions/${params.requestId}`
    if (!roleOf(request)) return unauthorized(path)
    const form = getForm(Number(params.requestId))
    return form ? ok(path, form) : fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없거나 아직 공개되지 않았습니다.')
  }),

  http.put(`${BASE}/me/submissions/:requestId/draft`, async ({ params, request }) => {
    const id = Number(params.requestId)
    const path = `/v1/me/submissions/${id}/draft`
    if (!roleOf(request)) return unauthorized(path)
    const form = getForm(id)
    if (!form) return fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
    const body = (await request.json()) as { answers: Answers; version: number }
    const status = form.submission?.status ?? 'NOT_SUBMITTED'
    if (form.request.status === 'CLOSED' || ['SUBMITTED', 'RESUBMITTED', 'CONFIRMED'].includes(status)) {
      return fail(path, 422, 'SUBMISSION_LOCKED', '이미 제출했거나 마감된 요청입니다')
    }
    if (body.version !== (form.submission?.version ?? 0)) {
      return fail(path, 409, 'VERSION_CONFLICT', '다른 탭에서 수정되었습니다')
    }
    const saved = saveDraft(id, body.answers)
    return ok(path, { submissionId: saved.id, status: saved.status, savedAt: now(), version: saved.version })
  }),

  // 파일 1단계: 업로드 주소 발급. 진짜 S3 대신 목업 주소(/mock-s3/{fileId})를 준다.
  http.post(`${BASE}/submissions/:submissionId/files/presign`, async ({ params, request }) => {
    const sid = Number(params.submissionId)
    const path = `/v1/submissions/${sid}/files/presign`
    if (!roleOf(request)) return unauthorized(path)
    const requestId = requestOfSubmission(sid)
    if (!requestId) return fail(path, 404, 'RESOURCE_NOT_FOUND', '제출을 찾을 수 없습니다')
    const body = (await request.json()) as {
      fieldKey: string
      fileName: string
      contentType: string
      size: number
    }
    const rule = fieldOf(requestId, body.fieldKey)?.validation
    const raw = body.fileName.split('.').pop()?.toLowerCase() ?? ''
    const ext = raw === 'jpeg' ? 'jpg' : raw
    if (rule?.allowedExtensions && !rule.allowedExtensions.includes(ext)) return fail(path, 400, 'INVALID_EXTENSION', '허용되지 않은 파일 형식입니다')
    if (rule?.maxSizeMb && body.size > rule.maxSizeMb * 1024 * 1024) return fail(path, 413, 'FILE_TOO_LARGE', '허용 용량을 초과했습니다')
    const fileId = 9000 + Math.floor(Math.random() * 100000)
    pendingUploads.set(fileId, {
      requestId,
      fieldKey: body.fieldKey,
      originalName: body.fileName,
      size: body.size,
    })
    return ok(path, {
      fileId,
      uploadUrl: `${location.origin}/mock-s3/${fileId}`,
      expiresAt: now(),
    })
  }),

  // 파일 2단계: 저장소에 직접 올리기(목업). 진행률이 보이게 조금 늦춘다.
  http.put('*/mock-s3/:fileId', async () => {
    await delay(900)
    return new HttpResponse(null, { status: 200 })
  }),

  // 파일 3단계: 업로드 완료 처리
  http.post(`${BASE}/submissions/:submissionId/files/:fileId/complete`, ({ params, request }) => {
    const fileId = Number(params.fileId)
    const path = `/v1/submissions/${params.submissionId}/files/${fileId}/complete`
    if (!roleOf(request)) return unauthorized(path)
    const p = pendingUploads.get(fileId)
    if (!p) return fail(path, 400, 'UPLOAD_NOT_FOUND', 'S3에 파일이 존재하지 않습니다')
    pendingUploads.delete(fileId)
    if (!canChangeFile(p.requestId, p.fieldKey)) return fail(path, 422, 'FILE_LOCKED', '확인 중이거나 보완 요청되지 않은 항목의 파일은 바꿀 수 없습니다')
    addFile(p.requestId, {
      id: fileId,
      fieldKey: p.fieldKey,
      originalName: p.originalName,
      uploadStatus: 'UPLOADED',
    })
    return ok(path, { fileId, uploadStatus: 'UPLOADED', sizeBytes: p.size })
  }),

  http.delete(`${BASE}/files/:fileId`, ({ params, request }) => {
    const path = `/v1/files/${params.fileId}`
    if (!roleOf(request)) return unauthorized(path)
    const owner = fileOwner(Number(params.fileId))
    if (!owner) return fail(path, 404, 'RESOURCE_NOT_FOUND', '파일을 찾을 수 없습니다')
    if (!canChangeFile(owner.requestId, owner.fieldKey))
      return fail(path, 422, 'FILE_LOCKED', '확인 중이거나 보완 요청되지 않은 항목의 파일은 삭제할 수 없습니다')
    return removeFile(Number(params.fileId)) ? ok(path, null) : fail(path, 404, 'RESOURCE_NOT_FOUND', '파일을 찾을 수 없습니다')
  }),

  // 제출 / 보완 후 다시 제출
  ...(['submit', 'resubmit'] as const).map((kind) =>
    http.post(`${BASE}/me/submissions/:requestId/${kind}`, async ({ params, request }) => {
      const id = Number(params.requestId)
      const path = `/v1/me/submissions/${id}/${kind}`
      if (!roleOf(request)) return unauthorized(path)
      const form = getForm(id)
      if (!form) return fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
      const status = form.submission?.status ?? 'NOT_SUBMITTED'
      if (kind === 'resubmit' && status !== 'REVISION_REQUIRED') return fail(path, 422, 'NOT_IN_REVISION', '보완 요청 상태가 아닙니다')
      if (kind === 'submit' && (form.request.status === 'CLOSED' || ['SUBMITTED', 'RESUBMITTED', 'CONFIRMED', 'REVISION_REQUIRED'].includes(status))) {
        return fail(path, 422, 'SUBMISSION_LOCKED', '이미 제출했거나 마감된 요청입니다')
      }
      const body = (await request.json()) as {
        answers: Answers
        version: number
      }
      if (body.version !== (form.submission?.version ?? 0)) return fail(path, 409, 'VERSION_CONFLICT', '제출 상태가 변경되었습니다')
      if (kind === 'resubmit' && Object.keys(body.answers).some((k) => !form.revision?.fieldKeys.includes(k))) {
        return fail(path, 400, 'FIELD_NOT_EDITABLE', '보완 요청되지 않은 항목은 수정할 수 없습니다')
      }
      const result = submit(id, body.answers, kind === 'resubmit')
      if ('fieldErrors' in result)
        return fail(path, 400, 'VALIDATION_ERROR', '입력값을 확인해주세요.', {
          fieldErrors: result.fieldErrors,
        })
      const at = now()
      return ok(
        path,
        kind === 'submit'
          ? {
              submissionId: result.saved.id,
              status: 'SUBMITTED',
              submittedAt: at,
              completionMessage: '제출이 완료되었습니다. 확인 후 안내드리겠습니다.',
            }
          : {
              submissionId: result.saved.id,
              status: 'RESUBMITTED',
              resubmittedAt: at,
              version: result.saved.version,
            },
      )
    }),
  ),

  // 담당자: 대시보드, 요청 목록
  http.get(`${BASE}/dashboard/manager`, ({ request }) => {
    const path = '/v1/dashboard/manager'
    const role = roleOf(request)
    if (!role) return unauthorized(path)
    if (role !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    return ok(path, managerDashboard())
  }),

  http.get(`${BASE}/requests`, async ({ request }) => {
    const path = '/v1/requests'
    const role = roleOf(request)
    if (!role) return unauthorized(path)
    if (role !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '접근 권한이 없는 프로그램입니다')
    await delay(250)
    const q = new URL(request.url).searchParams
    return ok(path, requestList(q.get('status'), Number(q.get('page') ?? 1), Number(q.get('page_size') ?? 20)))
  }),

  // 담당자: 요청별 제출 현황, 내보내기, 제출 상세, 확인 완료·보완 요청
  http.get(`${BASE}/requests/:requestId/submissions`, async ({ params, request }) => {
    const path = `/v1/requests/${params.requestId}/submissions`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '접근 권한이 없는 요청입니다')
    await delay(200)
    const q = new URL(request.url).searchParams
    const data = submissionList(Number(params.requestId), q.get('status'), q.get('keyword') ?? '', Number(q.get('page') ?? 1), Number(q.get('page_size') ?? 20))
    return data ? ok(path, data) : fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
  }),

  http.get(`${BASE}/requests/:requestId/export`, ({ params, request }) => {
    const path = `/v1/requests/${params.requestId}/export`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '접근 권한이 없는 요청입니다')
    const csv = exportCsv(Number(params.requestId), new URL(request.url).searchParams.get('status'))
    if (!csv) return fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="request_${params.requestId}.csv"; filename*=UTF-8''${encodeURIComponent(`제출현황_${params.requestId}.csv`)}`,
      },
    })
  }),

  http.get(`${BASE}/submissions/:submissionId`, async ({ params, request }) => {
    const path = `/v1/submissions/${params.submissionId}`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '접근 권한이 없는 제출입니다')
    await delay(200)
    const d = submissionDetail(Number(params.submissionId))
    return d ? ok(path, d) : fail(path, 404, 'SUBMISSION_NOT_FOUND', '제출을 찾을 수 없습니다')
  }),

  ...(['confirm', 'revision'] as const).map((action) =>
    http.post(`${BASE}/submissions/:submissionId/${action}`, async ({ params, request }) => {
      const path = `/v1/submissions/${params.submissionId}/${action}`
      if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '접근 권한이 없는 제출입니다')
      const body = (await request.json()) as { version: number; fieldKeys?: string[]; reason?: string; dueAt?: string | null }
      if (action === 'revision' && (!body.fieldKeys?.length || !body.reason?.trim())) {
        return fail(
          path,
          400,
          'INVALID_REQUEST',
          '입력값을 확인해주세요.',
          [!body.fieldKeys?.length && 'fieldKeys', !body.reason?.trim() && 'reason'].filter(Boolean),
        )
      }
      await delay(300)
      const r = review(Number(params.submissionId), action, body)
      if ('error' in r) {
        if (r.error === 'NOT_FOUND') return fail(path, 404, 'SUBMISSION_NOT_FOUND', '제출을 찾을 수 없습니다')
        if (r.error === 'VERSION_CONFLICT') return fail(path, 409, 'VERSION_CONFLICT', '제출 내용이 변경되었습니다')
        return fail(path, 422, 'INVALID_STATE_TRANSITION', '검토 대기 상태에서만 처리할 수 있습니다')
      }
      return ok(path, r)
    }),
  ),

  // 요청 만들기: 템플릿, 기수, 만들기, 공개
  http.get(`${BASE}/request-templates`, ({ request }) => {
    const path = '/v1/request-templates'
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    return ok(path, { items: templates })
  }),

  http.get(`${BASE}/programs/:programId/cohorts`, ({ params, request }) => {
    const path = `/v1/programs/${params.programId}/cohorts`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    if (Number(params.programId) !== 1) return fail(path, 404, 'PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.')
    return ok(path, { items: cohorts })
  }),

  http.post(`${BASE}/requests`, async ({ request }) => {
    const path = '/v1/requests'
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    const body = (await request.json()) as CreateRequestBody
    const bad = [!body.title?.trim() && 'title', !body.templateId && 'templateId', !body.closesAt && 'closesAt'].filter(Boolean)
    if (bad.length) return fail(path, 400, 'INVALID_REQUEST', '입력값을 확인해주세요.', bad)
    await delay(300)
    return ok(path, createRequest(body))
  }),

  http.get(`${BASE}/requests/:requestId`, async ({ params, request }) => {
    const path = `/v1/requests/${params.requestId}`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    await delay(250)
    const d = requestDetail(Number(params.requestId))
    return d ? ok(path, d) : fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
  }),

  http.patch(`${BASE}/requests/:requestId`, async ({ params, request }) => {
    const path = `/v1/requests/${params.requestId}`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    const body = (await request.json()) as CreateRequestBody
    const bad = [!body.title?.trim() && 'title', !body.templateId && 'templateId', !body.closesAt && 'closesAt'].filter(Boolean)
    if (bad.length) return fail(path, 400, 'INVALID_REQUEST', '입력값을 확인해주세요.', bad)
    await delay(300)
    const r = updateRequest(Number(params.requestId), body)
    if ('error' in r) {
      return r.error === 'NOT_FOUND'
        ? fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
        : fail(path, 422, 'INVALID_STATE_TRANSITION', '작성 중인 요청만 고칠 수 있습니다')
    }
    return ok(path, r)
  }),

  http.post(`${BASE}/requests/:requestId/publish`, async ({ params, request }) => {
    const path = `/v1/requests/${params.requestId}/publish`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    await delay(300)
    const result = publishRequest(Number(params.requestId))
    if ('error' in result) {
      return result.error === 'NOT_FOUND'
        ? fail(path, 404, 'REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다')
        : fail(path, 422, 'INVALID_STATE_TRANSITION', '작성 중인 요청만 공개할 수 있습니다')
    }
    return ok(path, result)
  }),

  // 담당자: 장학생 명단·상세·수정·등록, 기수 목록
  http.get(`${BASE}/scholars`, async ({ request }) => {
    const path = '/v1/scholars'
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    await delay(200)
    return ok(path, scholarList(new URL(request.url).searchParams))
  }),

  http.get(`${BASE}/scholars/:scholarId`, ({ params, request }) => {
    const path = `/v1/scholars/${params.scholarId}`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    const d = scholarDetail(Number(params.scholarId))
    return d ? ok(path, d) : fail(path, 404, 'SCHOLAR_NOT_FOUND', '장학생을 찾을 수 없습니다.')
  }),

  http.patch(`${BASE}/scholars/:scholarId`, async ({ params, request }) => {
    const path = `/v1/scholars/${params.scholarId}`
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    const body = (await request.json()) as ScholarUpdate
    if (!Object.keys(body).length) return fail(path, 400, 'INVALID_REQUEST', '수정할 필드의 문자열 값을 전달해야 합니다.')
    await delay(250)
    const r = updateScholar(Number(params.scholarId), body)
    return r ? ok(path, r) : fail(path, 404, 'SCHOLAR_NOT_FOUND', '장학생을 찾을 수 없습니다.')
  }),

  http.post(`${BASE}/scholars`, async ({ request }) => {
    const path = '/v1/scholars'
    if (roleOf(request) !== 'MANAGER') return fail(path, 403, 'FORBIDDEN', '담당자 권한이 필요합니다')
    const body = (await request.json()) as ScholarCreate
    const bad = [
      !body.cohortId && 'cohortId',
      !body.name?.trim() && 'name',
      !/^[^@\s]+@[^@\s]+$/.test(body.email ?? '') && 'email',
      !body.birthDate && 'birthDate',
    ].filter(Boolean)
    if (bad.length) return fail(path, 400, 'INVALID_REQUEST', '입력값을 확인해주세요.', bad)
    await delay(300)
    const r = createScholar(body)
    if ('error' in r)
      return r.error === 'DUPLICATE_EMAIL'
        ? fail(path, 409, 'DUPLICATE_EMAIL', '이미 등록된 이메일입니다.')
        : fail(path, 404, 'COHORT_NOT_FOUND', '기수를 찾을 수 없습니다.')
    return ok(path, r)
  }),
]

// 발급만 하고 아직 완료 처리 안 된 파일(서버의 PENDING 행 역할)
const pendingUploads = new Map<number, { requestId: number; fieldKey: string; originalName: string; size: number }>()
