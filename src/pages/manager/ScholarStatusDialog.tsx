import { useId, useState } from 'react'
import { withdrawalReasons, type ScholarStatus, type StatusChange, type StatusInfo, type WithdrawalReason } from '../../api/scholars'
import { fieldBase, fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { SelectBox } from '../../components/form/LabeledField'
import { FormDialog } from '../../components/ui/FormDialog'
import { cn } from '../../lib/cn'

const options: { value: ScholarStatus; label: string }[] = [
  { value: 'ENROLLED', label: '재학' },
  { value: 'COMPLETED', label: '수료' },
  { value: 'WITHDRAWN', label: '중단' },
]

// 수료 연도 선택지: 선발 연도부터 올해 + 2년까지. 기수 이름에서 선발 연도를 읽는다(예: 2025년 선발)
function yearOptions(cohortName: string) {
  const now = new Date().getFullYear()
  const from = Number(/(\d{4})/.exec(cohortName)?.[1]) || now - 3
  return Array.from({ length: Math.max(1, now + 2 - from + 1) }, (_, i) => from + i)
}

// 상태 바꾸기. 수료면 수료 연도, 중단이면 사유를 받는다(재단 요청 11/10)
// 한 명(상세)과 여러 명(명단에서 고르기)이 같이 쓴다. cohortName은 수료 연도 선택지의 시작 연도
export function ScholarStatusDialog({
  open,
  title = '상태 바꾸기',
  s,
  cohortName,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean
  title?: string
  s: StatusInfo
  cohortName: string
  busy: boolean
  onCancel: () => void
  onSubmit: (body: StatusChange) => void
}) {
  const years = yearOptions(cohortName)
  const [status, setStatus] = useState<ScholarStatus>(s.status)
  const [year, setYear] = useState(s.completedYear ? String(s.completedYear) : '')
  const [reason, setReason] = useState<WithdrawalReason | ''>(s.withdrawalReason ?? '')
  const [detail, setDetail] = useState(s.withdrawalReasonDetail ?? '')
  const [tried, setTried] = useState(false)
  const yearId = useId()
  const reasonId = useId()
  const detailId = useId()

  const yearError = tried && status === 'COMPLETED' && !year ? '수료 연도를 고르세요.' : null
  const reasonError = tried && status === 'WITHDRAWN' && !reason ? '중단 사유를 고르세요.' : null
  const detailError = tried && status === 'WITHDRAWN' && reason === 'OTHER' && !detail.trim() ? '사유를 입력하세요.' : null

  const submit = () => {
    setTried(true)
    if (status === 'COMPLETED' && !year) return
    if (status === 'WITHDRAWN' && (!reason || (reason === 'OTHER' && !detail.trim()))) return
    onSubmit({
      status,
      completedYear: status === 'COMPLETED' ? Number(year) : null,
      withdrawalReason: status === 'WITHDRAWN' && reason ? reason : null,
      withdrawalReasonDetail: status === 'WITHDRAWN' && reason === 'OTHER' ? detail.trim() : null,
    })
  }

  return (
    <FormDialog open={open} title={title} submitLabel="상태 바꾸기" busy={busy} onCancel={onCancel} onSubmit={submit}>
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-1 p-0 text-label">상태</legend>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-control-default items-center gap-3">
            <input type="radio" name="scholar-status" className="size-5 accent-action" checked={status === o.value} onChange={() => setStatus(o.value)} />
            {o.label}
          </label>
        ))}
      </fieldset>

      {status === 'COMPLETED' && (
        <div className="flex flex-col gap-2">
          <label htmlFor={yearId} className="text-label">
            수료 연도
          </label>
          <SelectBox>
            <select
              id={yearId}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-invalid={!!yearError}
              aria-describedby={yearError ? `${yearId}-error` : undefined}
              className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(!!yearError))}
            >
              <option value="">고르세요</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </SelectBox>
          {yearError && (
            <p id={`${yearId}-error`} className="m-0 text-caption text-danger-text">
              {yearError}
            </p>
          )}
        </div>
      )}

      {status === 'WITHDRAWN' && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={reasonId} className="text-label">
              중단 사유
            </label>
            <SelectBox>
              <select
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value as WithdrawalReason | '')}
                aria-invalid={!!reasonError}
                aria-describedby={reasonError ? `${reasonId}-error` : undefined}
                className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(!!reasonError))}
              >
                <option value="">고르세요</option>
                {withdrawalReasons.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </SelectBox>
            {reasonError && (
              <p id={`${reasonId}-error`} className="m-0 text-caption text-danger-text">
                {reasonError}
              </p>
            )}
          </div>
          {reason === 'OTHER' && (
            <div className="flex flex-col gap-2">
              <label htmlFor={detailId} className="text-label">
                기타 사유
              </label>
              <textarea
                id={detailId}
                rows={3}
                maxLength={200}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                aria-invalid={!!detailError}
                aria-describedby={detailError ? `${detailId}-error` : undefined}
                className={cn(fieldBase, 'resize-y py-3 text-input-touch md:text-body-long', fieldBorder(!!detailError))}
              />
              {detailError && (
                <p id={`${detailId}-error`} className="m-0 text-caption text-danger-text">
                  {detailError}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </FormDialog>
  )
}
