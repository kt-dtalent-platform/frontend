import { ChevronDown, Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { UseFormRegister } from 'react-hook-form'
import type { AnswerValue, FormField as Field, UploadedFile } from '../../api/submissions'
import { cn } from '../../lib/cn'
import { Tag } from '../ui/Tag'
import { FileField, type FileHandlers } from './FileField'
import { fieldBase, fieldControl } from './fieldClass'
import { Checkbox } from './Checkbox'

export type FormValues = Record<string, string | boolean | string[]>

type Props = {
  field: Field
  register: UseFormRegister<FormValues>
  editable: boolean
  highlight?: boolean // 보완 요청 항목
  error?: string
  hint?: ReactNode // 막지는 않는 경고(예: 평점이 만점보다 큼)
  value: AnswerValue
  files: UploadedFile[]
  fileHandlers?: FileHandlers
}

const base = fieldBase
const control = fieldControl

// 서버가 준 항목 정의(fieldType)대로 입력칸 하나를 그린다.
export function FormField({ field, register, editable, highlight, error, hint, value, files, fileHandlers }: Props) {
  const id = `f-${field.fieldKey}`
  const describedBy = [field.helpText && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const border = error ? 'border-danger-line' : 'border-line-control'
  const rules = formatRules(field)
  const required = field.required && editable

  let input: ReactNode
  if (!editable && field.fieldType !== 'FILE') {
    input = <ReadOnlyValue field={field} value={value} />
  } else {
    switch (field.fieldType) {
      case 'TEXTAREA':
        input = (
          <textarea
            id={id}
            rows={4}
            aria-invalid={!!error}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            className={cn(base, 'resize-y py-3 text-input-touch md:text-body-long', border)}
            {...register(field.fieldKey, rules)}
          />
        )
        break
      case 'NUMBER':
        input = (
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!error}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            className={cn(control, 'tabular-nums', border)}
            {...register(field.fieldKey, rules)}
          />
        )
        break
      case 'DATE':
        input = (
          <input
            id={id}
            type="date"
            aria-invalid={!!error}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            className={cn(control, border)}
            {...register(field.fieldKey, rules)}
          />
        )
        break
      case 'SELECT_ONE':
        input = (
          <div className="relative">
            <select
              id={id}
              aria-invalid={!!error}
              aria-required={required || undefined}
              aria-describedby={describedBy}
              className={cn(control, 'appearance-none pr-10', border)}
              {...register(field.fieldKey, rules)}
            >
              <option value="">선택하세요</option>
              {(field.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <ChevronDown size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" aria-hidden />
          </div>
        )
        break
      case 'SELECT_MULTI':
        input = (
          <div className="flex flex-col gap-2" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
            {(field.options ?? []).map((o) => (
              <label key={o} className="flex min-h-control-default items-center gap-2">
                <Checkbox value={o} {...register(field.fieldKey)} />
                {o}
              </label>
            ))}
          </div>
        )
        break
      case 'CHECKBOX':
        // 체크박스는 라벨이 곧 질문이라 아래에서 따로 그린다
        input = null
        break
      case 'FILE':
        input = <FileField id={id} field={field} files={files} editable={editable} invalid={!!error} describedBy={describedBy} handlers={fileHandlers} />
        break
      default:
        input = (
          <input
            id={id}
            aria-invalid={!!error}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            className={cn(control, border)}
            {...register(field.fieldKey, rules)}
          />
        )
    }
  }

  if (field.fieldType === 'CHECKBOX') {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex min-h-control-default items-center gap-3">
          <Checkbox disabled={!editable} aria-invalid={!!error} aria-describedby={describedBy} {...register(field.fieldKey)} />
          <span className="text-label">{field.label}</span>
          {highlight && <Tag tone="warning">보완 요청</Tag>}
        </label>
        {field.helpText && (
          <p id={`${id}-help`} className="m-0 pl-8 text-caption text-ink-3">
            {field.helpText}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} className="m-0 pl-8 text-caption text-danger-text">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label id={`${id}-label`} htmlFor={id} className="text-label text-ink">
          {field.label}
          {required && (
            <>
              <span className="ml-0.5 text-kt-red-text" aria-hidden>
                *
              </span>
              <span className="sr-only">(필수)</span>
            </>
          )}
        </label>
        {highlight && <Tag tone="warning">보완 요청</Tag>}
        {!editable && <Lock size={16} strokeWidth={2} className="text-ink-3" role="img" aria-label="수정할 수 없음" />}
      </div>
      {input}
      {field.helpText && editable && (
        <p id={`${id}-help`} className="m-0 text-caption text-ink-3">
          {field.helpText}
        </p>
      )}
      {hint && !error && <p className="m-0 text-caption text-warning-text">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="m-0 text-caption text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}

// 임시 저장은 필수 항목이 비어도 되고, 형식만 확인한다(명세서 기준).
function formatRules(field: Field) {
  const v = field.validation ?? {}
  if (field.fieldType === 'NUMBER') {
    return {
      validate: (raw: unknown) => {
        const s = String(raw ?? '').trim()
        if (s === '') return true
        const n = Number(s)
        if (Number.isNaN(n)) return '숫자만 입력하세요.'
        if (v.min !== undefined && n < v.min) return `${v.min.toLocaleString()} 이상으로 입력하세요.`
        if (v.max !== undefined && n > v.max) return `${v.max.toLocaleString()} 이하로 입력하세요.`
        return true
      },
    }
  }
  if (v.maxLength) {
    return {
      maxLength: {
        value: v.maxLength,
        message: `${v.maxLength}자 안으로 입력하세요.`,
      },
    }
  }
  return {}
}

function ReadOnlyValue({ field, value }: { field: Field; value: AnswerValue }) {
  const text =
    value === null || value === undefined || value === ''
      ? '입력하지 않음'
      : Array.isArray(value)
        ? value.join(', ')
        : typeof value === 'number'
          ? value.toLocaleString()
          : String(value)
  return (
    <div className={cn('flex min-h-control-h items-center rounded-md bg-surface-sunken px-4 text-ink-2', field.fieldType === 'TEXTAREA' && 'py-3')}>{text}</div>
  )
}
