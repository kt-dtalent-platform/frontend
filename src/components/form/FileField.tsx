import { FileText, Paperclip, RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { checkFile, uploadErrorText } from '../../api/files'
import type { FormField as Field, UploadedFile } from '../../api/submissions'
import { cn } from '../../lib/cn'
import { formatBytes } from '../../lib/format'
import { Button } from '../ui/Button'

export type FileHandlers = {
  upload: (fieldKey: string, file: File, onProgress: (ratio: number) => void, signal: AbortSignal) => Promise<unknown>
  remove: (fileId: number) => Promise<unknown>
  onBusyChange: (fieldKey: string, busy: boolean) => void
}

type Pending = {
  key: string
  file: File
  progress: number
  error: string | null
  controller: AbortController
}

type Props = {
  id: string
  field: Field
  files: UploadedFile[]
  editable: boolean
  invalid: boolean
  describedBy?: string
  handlers?: FileHandlers
}

// 첨부 파일 항목: 올린 파일 목록 + 올리는 중(진행률) + 실패(다시 시도) + 파일 첨부/끌어 놓기
export function FileField({ id, field, files, editable, invalid, describedBy, handlers }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState('') // 화면 낭독기에 알릴 결과
  const [pending, setPending] = useState<Pending[]>([])
  const [removing, setRemoving] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const rule = field.validation
  const maxFiles = rule?.maxFiles ?? 1
  const busy = pending.some((p) => !p.error)
  const full = files.length + pending.length >= maxFiles
  const accept = rule?.allowedExtensions?.flatMap((e) => (e.toLowerCase() === 'jpg' ? ['.jpg', '.jpeg'] : [`.${e}`])).join(',')
  const ruleText = [rule?.allowedExtensions?.join(', ').toUpperCase(), rule?.maxSizeMb && `${rule.maxSizeMb}MB 이하`].filter(Boolean).join(' · ')

  // 올리는 중이면 제출을 막도록 부모에게 알린다
  const { onBusyChange } = handlers ?? {}
  useEffect(() => {
    onBusyChange?.(field.fieldKey, busy)
  }, [busy, field.fieldKey, onBusyChange])

  // 화면을 떠나면 올리던 요청을 멈춘다
  const pendingRef = useRef(pending)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])
  useEffect(() => () => pendingRef.current.forEach((p) => p.controller.abort()), [])

  // 누른 버튼이 사라지면 포커스를 잃으므로 "파일 첨부"(없으면 항목 전체)로 옮긴다
  const refocus = () => requestAnimationFrame(() => (pickerRef.current ?? rootRef.current)?.focus())

  // 영역 밖에 파일을 놓으면 브라우저가 그 파일을 열어 버리므로 막는다
  useEffect(() => {
    if (!editable) return
    const stop = (e: globalThis.DragEvent) => e.preventDefault()
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [editable])

  const patch = (key: string, next: Partial<Pending>) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...next } : p)))
  const drop = (key: string) => setPending((list) => list.filter((p) => p.key !== key))

  async function start(item: Pending) {
    if (!handlers) return
    try {
      await handlers.upload(field.fieldKey, item.file, (progress) => patch(item.key, { progress }), item.controller.signal)
      drop(item.key)
      setLive(`${item.file.name}을(를) 올렸어요.`)
    } catch (error) {
      // 취소: 저장소 업로드(XHR) 중이면 ABORTED, 주소 발급·완료 처리(fetch) 중이면 AbortError
      if (item.controller.signal.aborted || (error as { name?: string }).name === 'AbortError') {
        drop(item.key)
        setLive(`${item.file.name} 올리기를 취소했어요.`)
        refocus()
        return
      }
      patch(item.key, { error: uploadErrorText(error) })
      setLive(`${item.file.name}을(를) 올리지 못했어요.`)
    }
  }

  function add(list: FileList | null) {
    setMessage(null)
    if (!list?.length) return
    const room = maxFiles - files.length - pending.length
    const picked = Array.from(list)
    if (picked.length > room) {
      setMessage(room <= 0 ? '더 올릴 수 없어요. 기존 파일을 지운 뒤 올리세요.' : `${room}개만 더 올릴 수 있어요.`)
      return
    }
    for (const file of picked) {
      const problem = checkFile(file, rule)
      if (problem) {
        setMessage(problem)
        return
      }
    }
    const items = picked.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      file,
      progress: 0,
      error: null,
      controller: new AbortController(),
    }))
    setPending((p) => [...p, ...items])
    items.forEach((item) => void start(item))
  }

  function retry(item: Pending) {
    const next = {
      ...item,
      progress: 0,
      error: null,
      controller: new AbortController(),
    }
    patch(item.key, next)
    void start(next)
    refocus()
  }

  async function removeUploaded(file: UploadedFile) {
    if (!handlers) return
    setMessage(null)
    setRemoving(file.id)
    try {
      await handlers.remove(file.id)
      setLive(`${file.originalName}을(를) 지웠어요.`)
      refocus()
    } catch {
      setMessage(`${file.originalName}을(를) 지우지 못했어요. 다시 시도하세요.`)
    } finally {
      setRemoving(null)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (editable && !full) add(e.dataTransfer.files)
  }

  return (
    <div ref={rootRef} tabIndex={-1} className="flex flex-col gap-2 outline-none">
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      {files.map((f) => (
        <div key={f.id} className="flex min-h-control-h items-center gap-2 rounded-md bg-surface-sunken pr-1 pl-4 text-ink-2">
          <FileText size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{f.originalName}</span>
          {f.sizeBytes !== undefined && <span className="shrink-0 text-caption text-ink-3 tabular-nums">{formatBytes(f.sizeBytes)}</span>}
          {editable && handlers && (
            <Button size="compact" variant="ghost" aria-label={`${f.originalName} 지우기`} disabled={removing === f.id} onClick={() => void removeUploaded(f)}>
              <X size={16} strokeWidth={2} aria-hidden />
            </Button>
          )}
        </div>
      ))}

      {pending.map((p) => (
        <div key={p.key} className={cn('flex flex-col gap-2 rounded-md px-4 py-3', p.error ? 'bg-danger-bg' : 'bg-surface-sunken')}>
          <div className="flex items-center gap-2">
            <FileText size={16} strokeWidth={2} className="shrink-0 text-ink-2" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-2">{p.file.name}</span>
            {!p.error && (
              <span className="shrink-0 text-caption text-ink-3 tabular-nums">{p.progress > 0 ? `${Math.round(p.progress * 100)}%` : '올리는 중'}</span>
            )}
            {p.error && (
              <Button size="compact" variant="ghost" onClick={() => retry(p)}>
                <RotateCw size={16} strokeWidth={2} aria-hidden />
                다시 시도
              </Button>
            )}
            <Button
              size="compact"
              variant="ghost"
              aria-label={p.error ? `${p.file.name} 목록에서 빼기` : `${p.file.name} 올리기 취소`}
              onClick={() => {
                if (p.error) {
                  drop(p.key)
                  refocus()
                } else p.controller.abort()
              }}
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </Button>
          </div>
          {p.error ? (
            <p className="m-0 text-caption text-danger-text" role="alert">
              {p.error}
            </p>
          ) : (
            <div
              role="progressbar"
              aria-label={`${p.file.name} 올리는 중`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(p.progress * 100)}
              className="h-1 overflow-hidden rounded-full bg-line-control"
            >
              <div className="h-full bg-action transition-all" style={{ width: `${Math.round(p.progress * 100)}%` }} />
            </div>
          )}
        </div>
      ))}

      {editable && handlers && !full && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          // 안쪽 버튼 위로 지나갈 때는 영역을 벗어난 게 아니므로 테두리를 유지한다
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragOver(false)}
          onDrop={onDrop}
          // 카드 안에 또 상자를 두지 않는다. 끌어 놓는 동안에만 테두리를 보여 준다
          className={cn('flex flex-wrap items-center gap-3 rounded-md', dragOver && 'outline-2 outline-offset-4 outline-line-control outline-dashed')}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            tabIndex={-1} // 보이지 않는 칸에 Tab이 멈추지 않게. 키보드는 아래 버튼으로 연다
            aria-hidden
            className="sr-only"
            onChange={(e) => {
              add(e.target.files)
              e.target.value = '' // 같은 파일을 다시 고를 수 있게
            }}
          />
          <Button
            ref={pickerRef}
            id={id}
            size="compact"
            // 점선: 아직 채우지 않은 자리라는 뜻. 입력칸(44px)보다 낮게 해 입력칸으로 보이지 않게 한다
            className={cn('border-dashed', invalid && 'border-danger-line')}
            aria-label={`${field.label} 파일 첨부`}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip size={16} strokeWidth={2} aria-hidden />
            파일 첨부
          </Button>
          <span className="text-caption text-ink-3">
            <span className="hidden md:inline">여기에 끌어 놓아도 돼요. </span>
            {ruleText}
          </span>
        </div>
      )}

      {editable && full && files.length > 0 && pending.length === 0 && (
        <p className="m-0 text-caption text-ink-3">다른 파일로 바꾸려면 지금 파일을 지운 뒤 올리세요.</p>
      )}
      {!editable && files.length === 0 && <div className="flex min-h-control-h items-center rounded-md bg-surface-sunken px-4 text-ink-2">올린 파일 없음</div>}
      {message && (
        <p className="m-0 text-caption text-danger-text" role="alert">
          {message}
        </p>
      )}
    </div>
  )
}
