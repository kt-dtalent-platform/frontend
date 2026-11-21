import { useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from './client'
import { errorText } from './errorText'
import { submissionKey, type SubmissionForm, type UploadedFile } from './submissions'

// 파일 올리기 3단계: 업로드 주소 발급 → 저장소(S3)에 직접 PUT → 업로드 완료 처리

type Presign = { fileId: number; uploadUrl: string; expiresAt: string }
type Completed = {
  fileId: number
  uploadStatus: 'UPLOADED'
  sizeBytes: number
}

// 저장소에 직접 올린다. 진행률을 보여 주려고 fetch 대신 XMLHttpRequest를 쓴다.
function putToStorage(url: string, file: File, contentType: string, onProgress: (ratio: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError('STORAGE_FAILED')))
    xhr.onerror = () => reject(new UploadError('NETWORK_ERROR'))
    xhr.onabort = () => reject(new UploadError('ABORTED'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

export class UploadError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = 'UploadError'
    this.code = code
  }
}

// 성적증명서 칸에 올린 파일은 바로 문서 분석(OCR)을 요청한다(백엔드 #101).
// 결과는 담당자 검토 화면의 analysis로 본다. 장학생 화면은 기다리지 않고, 실패해도 올리기는 끝난 것으로 둔다.
// 칸 이름 transcript는 백엔드 테스트와 목업 기준(실제 템플릿 값은 확인 필요)
const ANALYZED_FIELD = 'transcript'

function requestAnalysis(submissionId: number, fileId: number) {
  api(`/submissions/${submissionId}/files/${fileId}/analysis`, { method: 'POST' }).catch((err) => console.warn('문서 분석 요청 실패', err))
}

export function useFileActions(requestId: number) {
  const queryClient = useQueryClient()
  const key = submissionKey(requestId)

  const setFiles = (update: (files: UploadedFile[]) => UploadedFile[]) =>
    queryClient.setQueryData<SubmissionForm>(key, (prev) => (prev ? { ...prev, files: update(prev.files) } : prev))

  async function upload(args: { submissionId: number; fieldKey: string; file: File; onProgress: (ratio: number) => void; signal: AbortSignal }) {
    const { submissionId, fieldKey, file, onProgress, signal } = args
    const contentType = file.type || 'application/octet-stream'
    const p = await api<Presign>(`/submissions/${submissionId}/files/presign`, {
      method: 'POST',
      body: { fieldKey, fileName: file.name, contentType, size: file.size },
      signal,
    })
    await putToStorage(p.uploadUrl, file, contentType, onProgress, signal)
    const done = await api<Completed>(`/submissions/${submissionId}/files/${p.fileId}/complete`, { method: 'POST', signal })
    const uploaded: UploadedFile = {
      id: done.fileId,
      fieldKey,
      originalName: file.name,
      sizeBytes: done.sizeBytes,
    }
    setFiles((files) => [...files, uploaded])
    if (fieldKey === ANALYZED_FIELD) requestAnalysis(submissionId, uploaded.id)
    return uploaded
  }

  async function remove(fileId: number) {
    await api<null>(`/files/${fileId}`, { method: 'DELETE' })
    setFiles((files) => files.filter((f) => f.id !== fileId))
  }

  return { upload, remove }
}

// 올리기 전에 화면에서 먼저 확인한다(서버도 다시 확인함).
export function checkFile(file: File, rule: { allowedExtensions?: string[]; maxSizeMb?: number } | null | undefined) {
  // jpg와 jpeg는 같은 형식으로 본다
  const norm = (e: string) => (e.toLowerCase() === 'jpeg' ? 'jpg' : e.toLowerCase())
  const ext = file.name.includes('.') ? norm(file.name.split('.').pop()!) : ''
  const allowed = rule?.allowedExtensions?.map(norm)
  if (allowed?.length && !allowed.includes(ext)) {
    return `${allowed.map((e) => e.toUpperCase()).join(', ')} 파일만 올릴 수 있어요.`
  }
  if (rule?.maxSizeMb && file.size > rule.maxSizeMb * 1024 * 1024) {
    return `${rule.maxSizeMb}MB 이하 파일만 올릴 수 있어요. 이 파일은 ${(file.size / 1024 / 1024).toFixed(1)}MB예요.`
  }
  return null
}

export function uploadErrorText(error: unknown) {
  if (error instanceof ApiError) return errorText(error)
  const code = (error as { code?: string } | null)?.code
  if (code === 'FORM_INVALID') return '형식이 맞지 않는 항목을 먼저 고친 뒤 올리세요.'
  // 저장소(S3)로 바로 올리는 단계의 실패
  if (code === 'STORAGE_FAILED') return '저장소가 파일을 받지 않았어요. 다시 올리세요.'
  return '올리지 못했어요. 인터넷 연결을 확인하고 다시 올리세요.'
}
