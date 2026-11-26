import { useEffect, useId, useState, type Ref } from 'react'
import { useController, type Control, type FieldValues, type Path, type UseControllerProps } from 'react-hook-form'
import { useSchools } from '../../api/schools'
import { cn } from '../../lib/cn'
import { LabeledField, type FieldA11y } from './LabeledField'
import { fieldBorder, fieldControl } from './fieldClass'

type Props = FieldA11y & {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  invalid: boolean
  name?: string
  ref?: Ref<HTMLInputElement>
  // 목록에서 고른 이름인지(입력을 멈추고 목록이 닫혔을 때만 알린다). 확인 중이면 null
  onListedChange?: (listed: boolean | null) => void
}

// 학교 검색 선택칸(11/15 회의). 입력하면 학교 목록에서 찾아 고르고, 목록에 없으면 쓴 그대로 둔다.
// 캠퍼스는 학교 이름에 들어 있다(예: 고려대학교 (세종캠퍼스)).
// 접근성: WAI-ARIA combobox 패턴(입력칸 + listbox). 위아래 화살표로 고르고 Enter, Esc로 닫는다
export function SchoolCombobox({ value, onChange, onBlur, invalid, name, ref, onListedChange, ...a11y }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // 입력을 멈추고 0.2초 뒤에 찾는다
  const [keyword, setKeyword] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setKeyword(value), 200)
    return () => clearTimeout(t)
  }, [value])
  const query = useSchools(keyword)
  const items = query.data?.items ?? []
  const typed = value.trim()
  // 고른 학교 하나만 맞을 때만 목록을 숨긴다. "고려대학교"를 골라도 "고려대학교 (세종캠퍼스)"는 계속 보이게
  const onlyExact = items.length === 1 && schoolKey(items[0].name) === schoolKey(typed)
  const shown = open && typed.length > 0 && items.length > 0 && !onlyExact
  const optionId = (i: number) => `${listId}-${i}`
  // 목록이 바뀌면 고르던 위치를 비운다(없는 항목을 가리키지 않게)
  const [listKey, setListKey] = useState(query.data)
  if (listKey !== query.data) {
    setListKey(query.data)
    setActive(-1)
  }

  // 목록에 있는 학교인지: 입력을 멈추고(keyword가 따라잡고) 목록이 닫혔을 때만 판단한다
  const settled = !open && keyword === value && !query.isFetching
  const listed = !typed ? true : settled && query.data ? items.some((s) => schoolKey(s.name) === schoolKey(typed)) : null
  useEffect(() => {
    onListedChange?.(listed)
  }, [listed, onListedChange])

  const close = () => {
    setOpen(false)
    setActive(-1)
  }
  const pick = (name: string) => {
    onChange(name)
    close()
  }

  return (
    <div className="relative">
      <input
        {...a11y}
        ref={ref}
        name={name}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? optionId(active) : undefined}
        // Safari가 연락처 자동 완성 아이콘을 붙이지 않게(확인 필요: Safari는 autocomplete=off만으로는 안 숨김)
        autoComplete="off"
        data-1p-ignore
        value={value}
        placeholder="학교 이름으로 찾기"
        className={cn(fieldControl, fieldBorder(invalid))}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          close()
          onBlur()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!shown) return setOpen(true)
            const step = e.key === 'ArrowDown' ? 1 : -1
            setActive((i) => (i + step + items.length) % items.length)
          } else if (e.key === 'Enter' && shown && items[active]) {
            e.preventDefault()
            pick(items[active].name)
          } else if (e.key === 'Escape' && shown) {
            e.preventDefault()
            close()
          }
        }}
      />
      <ul
        id={listId}
        role="listbox"
        // 스크롤 막대 자리를 양쪽에 같이 둬서 고른 줄의 회색 바탕이 좌우 같은 여백이 되게 한다(막대가 늘 보이는 맥, 윈도우 설정)
        aria-label="학교 목록"
        hidden={!shown}
        className="absolute inset-x-0 top-full z-(--z-popover) m-0 mt-1 scrollbar-both max-h-72 animate-pop-down list-none overflow-y-auto rounded-md bg-surface p-1 shadow-pop"
      >
        {items.map((s, i) => (
          <li
            key={s.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // 입력칸의 blur보다 먼저 고르도록 mousedown에서 처리
            onMouseDown={(e) => (e.preventDefault(), pick(s.name))}
            onMouseEnter={() => setActive(i)}
            className={cn('flex cursor-pointer items-baseline justify-between gap-3 rounded-sm px-3 py-2', i === active && 'bg-control-tonal-hover')}
          >
            <span className="min-w-0 truncate">{s.name}</span>
            {s.region && <span className="shrink-0 text-caption text-ink-3">{s.region}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

type FieldProps<T extends FieldValues> = {
  control: Control<T>
  name: Path<T>
  required?: boolean
  rules?: UseControllerProps<T>['rules']
}

// 라벨, 학교 검색 선택칸, 안내를 묶은 폼 항목. 장학생 등록과 수정이 같이 쓴다
export function SchoolField<T extends FieldValues>({ control, name, required, rules }: FieldProps<T>) {
  const { field, fieldState } = useController({ control, name, rules })
  const value = String(field.value ?? '')
  // 목록에 없는 학교를 직접 쓴 경우 확인을 권한다(막지는 않음)
  const [listed, setListed] = useState<boolean | null>(true)
  return (
    <LabeledField
      label="학교"
      required={required}
      error={fieldState.error?.message}
      hint={listed === false ? '목록에 없는 학교예요. 이름이 맞는지 한 번 더 확인하세요.' : '목록에 없으면 그대로 입력하세요.'}
    >
      {(p) => (
        <SchoolCombobox
          {...p}
          ref={field.ref}
          name={field.name}
          value={value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          invalid={!!fieldState.error}
          onListedChange={setListed}
        />
      )}
    </LabeledField>
  )
}

// 학교 이름 비교 기준. 서버 학교 검색과 같게 띄어쓰기와 괄호를 빼고 영문은 소문자로 본다
// 예: "고려대학교(세종캠퍼스)"와 "고려대학교 (세종캠퍼스)"는 같은 학교
function schoolKey(name: string) {
  return name.replace(/[\s()]/g, '').toLowerCase()
}
