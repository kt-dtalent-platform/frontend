import { useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { submissionKey, type SubmissionForm, type UploadedFile } from './submissions'

// 파일 올리기 3단계: 업로드 주소 발급 → 저장소(S3)에 직접 PUT → 업로드 완료 처리
// 담당 정윤 · 백엔드 구현 없음(노션 명세서 모양을 임시로 씀, 확인 필요)

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
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  const allowed = rule?.allowedExtensions?.map((e) => e.toLowerCase())
  if (allowed?.length && !allowed.includes(ext)) {
    return `${allowed.map((e) => e.toUpperCase()).join(', ')} 파일만 올릴 수 있어요.`
  }
  if (rule?.maxSizeMb && file.size > rule.maxSizeMb * 1024 * 1024) {
    return `${rule.maxSizeMb}MB 이하 파일만 올릴 수 있어요. 이 파일은 ${(file.size / 1024 / 1024).toFixed(1)}MB예요.`
  }
  return null
}

export function uploadErrorText(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (code === 'FORM_INVALID') return '형식이 맞지 않는 항목을 먼저 고친 뒤 올리세요.'
  if (code === 'INVALID_EXTENSION') return '올릴 수 없는 파일 형식이에요.'
  if (code === 'FILE_TOO_LARGE') return '파일이 너무 커요.'
  if (code === 'FILE_COUNT_EXCEEDED') return '더 올릴 수 없어요. 기존 파일을 지운 뒤 올리세요.'
  if (code === 'FILE_MISMATCH' || code === 'UPLOAD_NOT_FOUND') return '파일 확인에 실패했어요. 다시 올려 주세요.'
  return '올리지 못했어요. 연결을 확인하고 다시 시도하세요.'
}
