import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import {
  withdrawalText,
  useChangeScholarStatus,
  useScholar,
  useUpdateScholar,
  type AccountStatus,
  type ScholarDetail,
  type ScholarUpdate,
} from '../../api/scholars'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { LabeledField } from '../../components/form/LabeledField'
import { SchoolField } from '../../components/form/SchoolCombobox'
import { UnsavedChangesGuard } from '../../components/form/UnsavedChangesGuard'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { PageTitle } from '../../components/ui/PageTitle'
import { ScholarStatusBadge } from '../../components/ui/ScholarStatusBadge'
import { EmptyState, ErrorState, LoadingCards } from '../../components/ui/StateView'
import { phoneDigits, phoneField } from '../../lib/phone'
import { cn } from '../../lib/cn'
import { usePageTitle } from '../../lib/usePageTitle'
import { useFindSchoolId } from '../../api/schools'
import { MetaList } from '../../components/ui/MetaList'
import { ScholarStatusDialog } from './ScholarStatusDialog'
import { LoginNoticeDialog } from './LoginNoticeDialog'
import { noticeText, sentText, useNoticeStatus } from '../../api/loginNotices'
import { useToast } from '../../components/ui/useToast'
import { errorText } from '../../api/errorText'

// A05 장학생 상세: 기본 정보 보기, 이름, 연락처, 학교, 전공 고치기(백엔드 KT-11, 12 기준), 상태 바꾸기
export function ScholarDetailPage() {
  const id = Number(useParams().scholarId)
  const query = useScholar(id)
  const validId = Number.isInteger(id) && id > 0
  usePageTitle(query.data?.name ?? '장학생')
  return (
    <div className="mx-auto flex w-full max-w-page-form flex-col gap-6">
      <Link to="/manager/scholars" className="inline-flex items-center gap-1 self-start text-label text-ink-3 no-underline hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        장학생
      </Link>
      {!validId && <EmptyState title="장학생을 찾을 수 없어요">명단에서 다시 골라 주세요.</EmptyState>}
      {validId && query.isPending && <LoadingCards count={1} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && (
        <div className="flex animate-fade-in flex-col gap-6">
          <Detail key={query.data.id} s={query.data} />
        </div>
      )}
    </div>
  )
}

function Detail({ s }: { s: ScholarDetail }) {
  const [editing, setEditing] = useState(false)
  const [changing, setChanging] = useState(false)
  const toast = useToast()
  const done = (r: 'saved' | 'unchanged' | 'status' | null) => {
    if (r) toast({ saved: '정보를 수정했어요', unchanged: '바뀐 내용이 없어요', status: '상태를 바꿨어요' }[r])
  }
  const changeStatus = useChangeScholarStatus(s.id)
  return (
    <>
      <PageTitle description={<MetaList items={[s.cohort.name, s.university]} />}>{s.name}</PageTitle>
      {changing && (
        <ScholarStatusDialog
          open
          s={s}
          cohortName={s.cohort.name}
          busy={changeStatus.isPending}
          onCancel={() => setChanging(false)}
          onSubmit={(body) =>
            changeStatus.mutate(body, {
              onSuccess: () => (setChanging(false), done('status')),
              // 실패하면 대화상자를 닫고 아래 안내로 알린다
              onError: () => setChanging(false),
            })
          }
        />
      )}
      {changeStatus.isError && !changing && (
        <Banner tone="danger" title="상태를 바꾸지 못했어요">
          {errorText(changeStatus.error)}
        </Banner>
      )}
      {/* 상태와 기본 정보를 구역으로 나누고 각 구역 머리에 작은 고치기 버튼(32px)을 둔다(11/12).
          상태는 수료 연도, 중단 사유를 함께 받아야 해서 정보 수정과 따로 바꾼다 */}
      <section aria-labelledby={`status-${s.id}`} className="flex flex-col gap-3 rounded-lg bg-surface px-6 py-6 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <h2 id={`status-${s.id}`} className="m-0 text-title-2">
            상태
          </h2>
          {!editing && (
            <Button size="compact" onClick={() => (changeStatus.reset(), setChanging(true))}>
              상태 바꾸기
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ScholarStatusBadge status={s.status} />
          {s.status === 'COMPLETED' && s.completedYear && <span className="text-body">{s.completedYear}년 수료</span>}
          {s.status === 'WITHDRAWN' && <span className="text-body">{withdrawalText(s) ?? '사유 없음'}</span>}
        </div>
      </section>
      <LoginSection id={s.id} name={s.name} account={s.accountStatus} />
      {editing ? (
        <EditForm s={s} onDone={(r) => (setEditing(false), done(r))} />
      ) : (
        <section aria-labelledby={`info-${s.id}`} className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-6 md:px-8">
          <div className="flex items-center justify-between gap-4">
            <h2 id={`info-${s.id}`} className="m-0 text-title-2">
              기본 정보
            </h2>
            <Button size="compact" onClick={() => setEditing(true)}>
              정보 수정
            </Button>
          </div>
          <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Item label="이메일" value={s.email} />
            <Item label="연락처" value={s.maskedPhone} />
            <Item label="기수" value={s.cohort.name} />
            <Item label="학교" value={s.university} />
            <Item label="전공" value={s.major} />
            {/* 계좌와 예금주는 한 칸에(두 칸이면 2열 격자에서 서로 다른 줄로 갈라진다) */}
            <Item
              label="장학금 받을 계좌"
              value={
                s.bankAccount &&
                [s.bankAccount.bankName, s.bankAccount.accountNumber, s.bankAccount.accountHolder && `(예금주 ${s.bankAccount.accountHolder})`]
                  .filter(Boolean)
                  .join(' ')
              }
            />
          </dl>
        </section>
      )}
    </>
  )
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className={cn('m-0 break-all', !value && 'text-ink-3')}>{value || '없음'}</dd>
    </div>
  )
}

type Values = { name: string; phone: string; university: string; major: string }

function EditForm({ s, onDone }: { s: ScholarDetail; onDone: (result: 'saved' | 'unchanged' | null) => void }) {
  const update = useUpdateScholar(s.id)
  const { register, handleSubmit, formState, setError, control } = useForm<Values>({
    defaultValues: { name: s.name, phone: '', university: s.university, major: s.major ?? '' },
    mode: 'onBlur',
  })
  const e = formState.errors
  const findSchoolId = useFindSchoolId()

  const onSubmit = handleSubmit(async (v) => {
    // 백엔드는 보낸 문자열 항목만 바꾼다. 바뀐 항목만 보낸다(빈 값으로 지우기는 아직 지원 안 함)
    const body: ScholarUpdate = {}
    if (v.name.trim() !== s.name) body.name = v.name.trim()
    if (v.phone.trim()) body.phone = phoneDigits(v.phone)
    // 학교를 바꾸면 목록의 학교 ID도 같이 보낸다. 직접 쓴 이름이면 null(서버가 예전 ID를 지운다)
    if (v.university.trim() && v.university.trim() !== s.university) {
      body.university = v.university.trim()
      body.schoolId = await findSchoolId(v.university)
    }
    if (v.major.trim() && v.major.trim() !== (s.major ?? '')) body.major = v.major.trim()
    if (Object.keys(body).length === 0) return onDone('unchanged')
    try {
      await update.mutateAsync(body)
      onDone('saved')
    } catch (err) {
      setError('root', { message: errorText(err) })
    }
  })

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} noValidate className="flex flex-col gap-6">
      {/* 저장에 성공하면 폼이 닫히므로 고친 내용이 있는 동안만 묻는다 */}
      <UnsavedChangesGuard when={formState.isDirty} />
      <section className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-8 md:px-8">
        <LabeledField label="이름" required error={e.name?.message}>
          {(p) => (
            <input
              {...p}
              autoComplete="off"
              className={cn(fieldControl, fieldBorder(!!e.name))}
              {...register('name', { validate: (x) => (x.trim() ? true : '이름을 입력하세요.'), maxLength: { value: 50, message: '50자 안으로 입력하세요.' } })}
            />
          )}
        </LabeledField>
        <LabeledField label="연락처" hint={s.maskedPhone ? `지금 ${s.maskedPhone}. 바꿀 때만 입력하세요.` : '예: 010-1234-5678'} error={e.phone?.message}>
          {(p) => (
            <input
              {...p}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className={cn(fieldControl, 'tabular-nums', fieldBorder(!!e.phone))}
              {...register('phone', phoneField)}
            />
          )}
        </LabeledField>
        <SchoolField
          control={control}
          name="university"
          rules={{
            // 백엔드가 빈 값으로 지우기를 아직 지원하지 않는다
            validate: (x: string) => (x.trim() || !s.university ? true : '학교는 비워 둘 수 없어요.'),
            maxLength: { value: 100, message: '100자 안으로 입력하세요.' },
          }}
        />
        <LabeledField label="전공" error={e.major?.message}>
          {(p) => (
            <input
              {...p}
              autoComplete="off"
              className={cn(fieldControl, fieldBorder(!!e.major))}
              {...register('major', {
                validate: (x) => (x.trim() || !s.major ? true : '전공은 비워 둘 수 없어요.'),
                maxLength: { value: 100, message: '100자 안으로 입력하세요.' },
              })}
            />
          )}
        </LabeledField>
      </section>
      {e.root && (
        <Banner tone="danger" title="고치지 못했어요">
          {e.root.message}
        </Banner>
      )}
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
        <Button disabled={update.isPending} onClick={() => onDone(null)}>
          취소
        </Button>
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? '저장하는 중' : '저장하기'}
        </Button>
      </div>
    </form>
  )
}

// 로그인 안내(백엔드 KT-60): 안내 메일을 보냈는지와 [임시 비밀번호 다시 보내기].
// 장학생이 비밀번호를 잊었거나 안내를 못 받았을 때 담당자가 여기서 새 임시 비밀번호를 메일로 보낸다
// 계정이 정상일 때만 메일을 보낼 수 있다. 사용 중지와 잠김은 이유와 할 일을 먼저 보여 준다
const blocked: Partial<Record<AccountStatus, { label: string; text: string }>> = {
  INACTIVE: { label: '사용 중지', text: '중단된 장학생이라 로그인할 수 없어요. 안내 메일도 보내지 않아요.' },
  LOCKED: { label: '잠김', text: '비밀번호를 여러 번 틀려 잠겼어요. 시간이 지나면 풀리니 그 뒤에 보내세요.' },
}

function LoginSection({ id, name, account }: { id: number; name: string; account: AccountStatus }) {
  const toast = useToast()
  const status = useNoticeStatus([id])
  const [open, setOpen] = useState(false)
  const item = status.data?.find((i) => i.scholarId === id)
  const block = blocked[account]
  return (
    <section aria-labelledby={`login-${id}`} className="flex flex-col gap-5 rounded-lg bg-surface px-6 py-6 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <h2 id={`login-${id}`} className="m-0 text-title-2">
          로그인 안내
        </h2>
        {!block && (
          <Button size="compact" onClick={() => setOpen(true)}>
            임시 비밀번호 다시 보내기
          </Button>
        )}
      </div>
      <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Item label="계정" value={block ? block.label : '사용 중'} />
        <Item label="안내 메일" value={status.isPending ? '확인 중' : status.isError ? '불러오지 못함' : noticeText(item)} />
      </dl>
      {block && <p className="m-0 text-ink-2">{block.text}</p>}
      {open && (
        <LoginNoticeDialog scholarIds={[id]} who={`${name} 님`} reissue onClose={() => setOpen(false)} onSent={(r) => (setOpen(false), toast(sentText(r)))} />
      )}
    </section>
  )
}
