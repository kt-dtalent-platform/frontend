import { Plus } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMe } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useCohorts, useCreateCohort } from '../../api/manager'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { FormDialog } from '../ui/FormDialog'
import { useToast } from '../ui/useToast'
import { fieldBorder, fieldControl } from './fieldClass'
import { LabeledField, SelectBox } from './LabeledField'
import { errorText } from '../../api/errorText'

type Props = {
  value: string
  onChange: (cohortId: string) => void
  onBlur?: () => void
  error?: string
  name?: string
}

// 기수 고르기 + 새 기수 만들기(11/15). 새해 장학생을 등록하려면 기수가 먼저 있어야 해서 등록 화면에서 바로 만든다.
// 장학생 한 명 등록과 엑셀 일괄 등록이 같이 쓴다
export function CohortField({ value, onChange, onBlur, error, name }: Props) {
  const me = useMe()
  const programId = me.data?.accessiblePrograms?.[0]?.id
  const cohorts = useCohorts(programId)
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <LabeledField label="기수" required error={error}>
        {(p) => (
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <SelectBox>
                <select
                  {...p}
                  name={name}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlur}
                  className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(!!error))}
                >
                  <option value="">기수 선택</option>
                  {cohorts.data?.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </SelectBox>
            </div>
            <Button size="md" disabled={programId === undefined} onClick={() => setAdding(true)}>
              <Plus size={16} strokeWidth={2} aria-hidden />새 기수
            </Button>
          </div>
        )}
      </LabeledField>
      {/* 등록 폼 안에 대화상자 폼이 겹치지 않게 body로 뺀다(폼 안 폼은 바깥 폼을 제출한다) */}
      {adding &&
        programId !== undefined &&
        createPortal(
          <NewCohortDialog
            programId={programId}
            taken={cohorts.data?.map((c) => c.name) ?? []}
            onDone={(id) => (setAdding(false), onChange(String(id)))}
            onCancel={() => setAdding(false)}
          />,
          document.body,
        )}
    </div>
  )
}

// 연도만 받고 이름은 "2027년 선발"로 만든다. 기존 기수 이름 규칙을 지키고 입력을 줄인다(11/15)
const cohortName = (year: string) => `${year}년 선발`

function NewCohortDialog({ programId, taken, onDone, onCancel }: { programId: number; taken: string[]; onDone: (id: number) => void; onCancel: () => void }) {
  const create = useCreateCohort(programId)
  const toast = useToast()
  const [year, setYear] = useState(() => String(new Date().getFullYear() + 1))
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const y = year.trim()
    if (!/^\d{4}$/.test(y) || Number(y) < 2000 || Number(y) > 2100) return setError('선발 연도를 네 자리 숫자로 입력하세요.')
    const name = cohortName(y)
    if (taken.includes(name)) return setError(`${name} 기수가 이미 있어요.`)
    try {
      const c = await create.mutateAsync({ name })
      toast(`${c.name} 기수를 만들었어요`)
      onDone(c.id)
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'DUPLICATE_COHORT' ? `${name} 기수가 이미 있어요.` : errorText(err))
    }
  }

  return (
    <FormDialog open title="새 기수 만들기" submitLabel="만들기" busy={create.isPending} onSubmit={() => void submit()} onCancel={onCancel}>
      <LabeledField label="선발 연도" required hint={`기수 이름은 '${cohortName(year || '0000')}'로 만들어져요.`} error={error ?? undefined}>
        {(p) => (
          // 숫자 칸 바로 뒤에 '년 선발'(칸 밖 글자). 칸은 네 자리에 맞춘 폭
          <div className="flex items-center gap-2">
            <input
              {...p}
              value={year}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              onChange={(e) => (setYear(e.target.value.replace(/\D/g, '')), setError(null))}
              className={cn(fieldControl, fieldBorder(!!error), 'w-28 tabular-nums')}
            />
            <span className="text-ink">년 선발</span>
          </div>
        )}
      </LabeledField>
    </FormDialog>
  )
}
