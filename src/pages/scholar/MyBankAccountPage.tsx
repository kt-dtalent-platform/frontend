import { ChevronLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useMe } from '../../api/auth'
import { banks, useMyBankAccount, useUpdateMyBankAccount, type MyBankAccount } from '../../api/bank'
import { ApiError } from '../../api/client'
import { fieldErrorsOf } from '../../api/types'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { LabeledField, SelectBox } from '../../components/form/LabeledField'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { PageTitle } from '../../components/ui/PageTitle'
import { ErrorState, LoadingCards } from '../../components/ui/StateView'
import { useToast } from '../../components/ui/useToast'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'

type Values = { bankName: string; accountNumber: string; accountHolder: string }

// 계좌번호: 숫자, 띄어쓰기, -만. 숫자는 백엔드와 같게 5자리 이상
const NUMBER = /^[0-9 -]+$/
const digits = (v: string) => v.replace(/[^0-9]/g, '')

// S04 장학금 받을 계좌 등록과 변경: 내 정보에서 들어온다. 입력칸 세 개라 비밀번호 변경과 같은 좁은 폭
export function MyBankAccountPage() {
  const me = useMe()
  const bank = useMyBankAccount()
  const editing = !!bank.data
  usePageTitle(editing ? '계좌 변경' : '계좌 등록')
  return (
    <div className="mx-auto flex w-full max-w-login-card-w flex-col gap-6">
      <Link to="/me" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />내 정보
      </Link>
      <PageTitle description="장학금을 받을 계좌를 적어 주세요.">{editing ? '계좌 변경' : '계좌 등록'}</PageTitle>
      {(me.isPending || bank.isPending) && <LoadingCards count={1} />}
      {/* 처음 읽기에 실패했을 때만 오류 화면. 한 번 읽은 뒤 다시 읽기가 실패해도 적던 폼은 그대로 둔다 */}
      {me.isError && !me.data && <ErrorState error={me.error} onRetry={() => me.refetch()} />}
      {bank.isError && bank.data === undefined && <ErrorState error={bank.error} onRetry={() => bank.refetch()} />}
      {me.data && bank.data !== undefined && <BankForm saved={bank.data} name={me.data.name} />}
    </div>
  )
}

function BankForm({ saved, name }: { saved: MyBankAccount | null; name: string }) {
  const navigate = useNavigate()
  const toast = useToast()
  const update = useUpdateMyBankAccount()
  // 기록에 쌓지 않고 돌아간다. 쌓으면 내 정보에서 뒤로 가기를 눌렀을 때 폼이 다시 열린다
  const back = () => navigate('/me', { replace: true })
  const { register, handleSubmit, formState, setError } = useForm<Values>({
    // 계좌번호는 뒤 4자리만 알고 있어 비워 둔다. 은행과 예금주는 저장된 값, 처음이면 예금주에 내 이름
    defaultValues: { bankName: saved?.bankName ?? '', accountNumber: '', accountHolder: saved?.accountHolder ?? name },
    mode: 'onBlur',
  })
  const e = formState.errors
  const busy = formState.isSubmitting || update.isPending
  // 예전에 저장한 은행 이름이 목록에 없으면 선택지에 붙여 그대로 고를 수 있게 한다
  const options = saved && !banks.includes(saved.bankName) ? [saved.bankName, ...banks] : banks

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ bankName: v.bankName, accountNumber: v.accountNumber.trim(), accountHolder: v.accountHolder.trim() })
      update.reset()
      toast('계좌를 저장했어요')
      back()
    } catch (err) {
      // 보낸 값(전체 계좌번호)이 요청 기록에 남지 않게 성공, 실패 모두 바로 지운다
      update.reset()
      const fields = err instanceof ApiError ? fieldErrorsOf(err.details).filter((f): f is { key: keyof Values; message: string } => f.key in v) : []
      if (fields.length) for (const f of fields) setError(f.key, { message: '형식을 확인하세요.' }, { shouldFocus: true })
      else setError('root', { message: err instanceof ApiError ? err.message : '잠시 뒤 다시 시도하세요.' })
    }
  })

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} noValidate className="flex flex-col gap-6">
      <LabeledField label="은행" required error={e.bankName?.message}>
        {(p) => (
          <SelectBox>
            <select
              {...p}
              className={cn(fieldControl, 'appearance-none pr-10', fieldBorder(!!e.bankName))}
              {...register('bankName', { required: '은행을 고르세요.' })}
            >
              <option value="">은행 선택</option>
              {options.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </SelectBox>
        )}
      </LabeledField>

      <LabeledField label="계좌번호" required hint="예: 110-123-456789" error={e.accountNumber?.message}>
        {(p) => (
          <input
            {...p}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className={cn(fieldControl, 'tabular-nums', fieldBorder(!!e.accountNumber))}
            {...register('accountNumber', {
              required: '계좌번호를 입력하세요.',
              validate: (v) => (NUMBER.test(v.trim()) && digits(v).length >= 5) || '숫자와 -만 적어 주세요. 숫자는 5자리 이상이에요.',
            })}
          />
        )}
      </LabeledField>

      <LabeledField label="예금주" required error={e.accountHolder?.message}>
        {(p) => (
          <input
            {...p}
            type="text"
            autoComplete="name"
            maxLength={50}
            className={cn(fieldControl, fieldBorder(!!e.accountHolder))}
            {...register('accountHolder', { validate: (v) => !!v.trim() || '예금주를 입력하세요.' })}
          />
        )}
      </LabeledField>

      {e.root && (
        <Banner tone="danger" title="저장하지 못했어요">
          {e.root.message}
        </Banner>
      )}

      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <Button type="button" variant="secondary" onClick={back} disabled={busy}>
          취소
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '저장하는 중' : '저장'}
        </Button>
      </div>
    </form>
  )
}
