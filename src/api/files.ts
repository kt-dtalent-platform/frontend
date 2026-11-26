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

export function useFileActions(requestId: number) {
  const queryClient = useQueryClient()
  const key = submissionKey(requestId)

  const setFiles = (update: (files: UploadedFile[]) => UploadedFile[]) =>
    queryClient.setQueryData<SubmissionForm>(key, (prev) => (prev ? { ...prev, files: update(prev.files) } : prev))

  // 이 파일의 자리가 다시 불러온 멈춘 파일 목록에 들어와 있으면 뺀다(끝났거나 지웠으므로)
  const dropStalled = (fileId: number) =>
    queryClient.setQueryData<SubmissionForm>(key, (prev) => (prev ? { ...prev, stalledFiles: prev.stalledFiles.filter((f) => f.id !== fileId) } : prev))
  const keepStalled = (file: UploadedFile) =>
    queryClient.setQueryData<SubmissionForm>(key, (prev) =>
      prev && !prev.stalledFiles.some((f) => f.id === file.id) ? { ...prev, stalledFiles: [...prev.stalledFiles, file] } : prev,
    )

  async function upload(args: {
    submissionId: number
    fieldKey: string
    file: File
    onProgress: (ratio: number) => void
    signal: AbortSignal
    onFileId?: (fileId: number) => void
  }) {
    const { submissionId, fieldKey, file, onProgress, signal, onFileId } = args
    const contentType = file.type || 'application/octet-stream'
    const p = await api<Presign>(`/submissions/${submissionId}/files/presign`, {
      method: 'POST',
      body: { fieldKey, fileName: file.name, contentType, size: file.size },
      signal,
    })
    onFileId?.(p.fileId)
    let done: Completed
    try {
      await putToStorage(p.uploadUrl, file, contentType, onProgress, signal)
      done = await api<Completed>(`/submissions/${submissionId}/files/${p.fileId}/complete`, { method: 'POST', signal })
    } catch (err) {
      // 주소를 받을 때 서버가 잡아 둔 자리(PENDING)도 파일 개수에 들어간다.
      // 지우지 않으면 1개짜리 칸은 서버가 치울 때(24시간)까지 다시 올릴 수 없다.
      // 지우기가 끝난 뒤에 실패를 알려야 바로 [다시 시도]해도 개수에 걸리지 않는다. 취소 신호와는 따로 보낸다
      // 지우기도 실패하면(예: 연결 끊김) 서버에 남은 자리를 업로드 실패 목록에 넣어, 화면의 X와 제출 전 확인이 다룰 수 있게 한다
      const removed = await api<null>(`/files/${p.fileId}`, { method: 'DELETE' }).then(
        () => true,
        () => false,
      )
      if (removed) dropStalled(p.fileId)
      else keepStalled({ id: p.fileId, fieldKey, originalName: file.name })
      throw err
    }
    const uploaded: UploadedFile = {
      id: done.fileId,
      fieldKey,
      originalName: file.name,
      sizeBytes: done.sizeBytes,
    }
    setFiles((files) => [...files, uploaded])
    dropStalled(p.fileId)
    return uploaded
  }

  // 올린 파일과 올리다 멈춘 파일 모두 같은 API로 지운다. 지운 뒤의 최신 폼을 돌려준다
  async function remove(fileId: number) {
    await api<null>(`/files/${fileId}`, { method: 'DELETE' })
    queryClient.setQueryData<SubmissionForm>(key, (prev) =>
      prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId), stalledFiles: prev.stalledFiles.filter((f) => f.id !== fileId) } : prev,
    )
    return queryClient.getQueryData<SubmissionForm>(key)
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
    // 안내는 서버가 정한 이름 그대로(jpg와 jpeg를 합친 목록으로 쓰면 JPG가 두 번 나온다)
    const names = [...new Set(rule!.allowedExtensions!.map((e) => e.toUpperCase()))]
    return `${names.join(', ')} 파일만 올릴 수 있어요.`
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
  // 저장소(S3)로 바로 올리는 단계의 실패와 연결 끊김
  return '업로드에 실패했어요.'
}
