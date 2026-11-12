import { useState } from 'react'
import { FormDialog } from './FormDialog'

export type ExportOption = { value: string; label: string; count?: number }
export type ExportColumn = { key: string; label: string; required?: boolean; default?: boolean }
export type ExportChoice = { all: boolean; scopes: string[]; columns: string[] }

// 엑셀 내보내기 설정(재단 요청 11/10): 범위(전체 또는 고른 상태)와 넣을 열을 고른다.
// 요청 제출 현황과 장학생 명단이 같이 쓴다.
export function ExportDialog({
  open,
  title,
  total,
  scopes,
  initialScopes,
  columnGroups,
  note,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean
  title: string
  total?: number // 모르면 비운다
  scopes: ExportOption[]
  initialScopes: string[] // 비어 있으면 전체
  columnGroups: { label: string; columns: ExportColumn[] }[]
  note?: string // 범위에 함께 걸리는 조건(예: 기수 필터)
  busy: boolean
  onCancel: () => void
  onSubmit: (choice: ExportChoice) => void
}) {
  const [all, setAll] = useState(initialScopes.length === 0)
  const [picked, setPicked] = useState<string[]>(initialScopes)
  const [columns, setColumns] = useState(() => columnGroups.flatMap((g) => g.columns.filter((c) => c.required || c.default).map((c) => c.key)))
  const [tried, setTried] = useState(false)
  const scopeError = tried && !all && picked.length === 0 ? '내보낼 상태를 하나 이상 고르세요.' : null
  // 상태별 인원을 모르면(장학생 명단) 버튼에 인원을 쓰지 않는다
  const known = all ? total !== undefined : scopes.every((s) => s.count !== undefined)
  const count = all ? (total ?? 0) : scopes.filter((s) => picked.includes(s.value)).reduce((n, s) => n + (s.count ?? 0), 0)
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v))

  return (
    <FormDialog
      open={open}
      title={title}
      submitLabel={busy ? '만드는 중' : known ? `${count}명 내보내기` : '내보내기'}
      busy={busy}
      onCancel={onCancel}
      onSubmit={() => {
        setTried(true)
        if (!all && picked.length === 0) return
        onSubmit({ all, scopes: all ? [] : picked, columns: columnGroups.flatMap((g) => g.columns.map((c) => c.key)).filter((k) => columns.includes(k)) })
      }}
    >
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-1 p-0 text-label">범위</legend>
        {note && <p className="m-0 mb-1 text-caption text-ink-3">{note}</p>}
        <label className="flex min-h-control-default items-center gap-3">
          <input type="radio" name="export-scope" className="size-5 accent-action" checked={all} onChange={() => setAll(true)} />
          전체 {total !== undefined && <span className="text-ink-3 tabular-nums">{total}명</span>}
        </label>
        <label className="flex min-h-control-default items-center gap-3">
          <input type="radio" name="export-scope" className="size-5 accent-action" checked={!all} onChange={() => setAll(false)} />
          상태 고르기
        </label>
        {!all && (
          <div className="flex flex-col gap-1 pl-8">
            {scopes.map((s) => (
              <label key={s.value} className="flex min-h-control-default items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-action"
                  checked={picked.includes(s.value)}
                  aria-invalid={!!scopeError}
                  onChange={(e) => setPicked((p) => toggle(p, s.value, e.target.checked))}
                />
                {s.label}
                {s.count !== undefined && <span className="text-ink-3 tabular-nums">{s.count}명</span>}
              </label>
            ))}
            {scopeError && <p className="m-0 text-caption text-danger-text">{scopeError}</p>}
          </div>
        )}
      </fieldset>

      {columnGroups.map((g) => (
        <fieldset key={g.label} className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-1 p-0 text-label">{g.label}</legend>
          <div className="grid grid-cols-2 gap-x-4">
            {g.columns.map((c) => (
              <label key={c.key} className="flex min-h-control-default items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-action"
                  checked={columns.includes(c.key)}
                  disabled={c.required}
                  onChange={(e) => setColumns((list) => toggle(list, c.key, e.target.checked))}
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="m-0 text-caption text-ink-3">엑셀 파일(.xlsx)로 받아요. 고른 순서와 상관없이 위 순서대로 열이 들어가요.</p>
    </FormDialog>
  )
}
