import { useState } from 'react'
import { useNoticeSender, useSaveNoticeSender, useSendNotices, type NoticeResult } from '../../api/loginNotices'
import { fieldBorder, fieldControl } from '../../components/form/fieldClass'
import { LabeledField } from '../../components/form/LabeledField'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { FormDialog } from '../../components/ui/FormDialog'
import { cn } from '../../lib/cn'
import { FormError } from '../../components/form/FormError'
import { errorText } from '../../api/errorText'
import { isEmail } from '../../lib/email'

// 로그인 안내 메일 보내기(백엔드 KT-60). 명단에서 고른 여러 명, 등록 결과, 장학생 상세가 같이 쓴다.
// reissue=false: 처음 보내기(이미 보냈거나 비밀번호를 바꾼 장학생은 서버가 건너뜀)
// reissue=true: 임시 비밀번호 다시 보내기(지금 비밀번호를 바꿈)
// 보내는 사람을 아직 정하지 않았으면 여기서 함께 정한다. 정했으면 한 줄로 보여 주고 [바꾸기]
export function LoginNoticeDialog({
  scholarIds,
  who,
  reissue,
  onClose,
  onSent,
}: {
  scholarIds: number[]
  who: string // "3명", "이름 님"
  reissue: boolean
  onClose: () => void
  onSent: (r: NoticeResult) => void
}) {
  const sender = useNoticeSender()
  const saveSender = useSaveNoticeSender()
  const send = useSendNotices()
  const saved = sender.data ?? null
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  // 보내는 사람 칸을 보여 줄 때: 아직 없거나, [바꾸기]를 눌렀을 때
  const askSender = sender.isSuccess && (!saved || editing)
  const busy = sender.isPending || saveSender.isPending || send.isPending

  const startEdit = () => {
    setName(saved?.senderName ?? '')
    setAddress(saved?.fromAddress ?? '')
    setEditing(true)
  }

  const submit = async () => {
    setFailure(null)
    if (askSender) {
      const next = {
        name: name.trim() ? undefined : '보내는 사람 이름을 입력하세요.',
        address: isEmail(address) ? undefined : '메일 주소 형식을 확인하세요. 예: scholarship@kt.com',
      }
      setErrors(next)
      if (next.name || next.address) return
    }
    try {
      if (askSender) await saveSender.mutateAsync({ senderName: name.trim(), fromAddress: address.trim() })
      const r = await send.mutateAsync({ scholarIds, reissue })
      onSent(r)
    } catch (err) {
      setFailure(errorText(err))
    }
  }

  return (
    <FormDialog
      open
      title={reissue ? '임시 비밀번호 다시 보내기' : '로그인 안내 메일 보내기'}
      submitLabel={reissue ? '다시 보내기' : '보내기'}
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <p className="m-0 text-ink-2">
        {reissue
          ? `${who}에게 새 임시 비밀번호를 메일로 보내요. 지금 비밀번호로는 더 로그인할 수 없어요.`
          : `${who}에게 아이디와 임시 비밀번호를 메일로 보내요. 전에 전달한 임시 비밀번호는 더 쓸 수 없어요.`}
      </p>

      {sender.isError && (
        <Banner tone="danger" title="보내는 사람 정보를 불러오지 못했어요">
          <Button size="compact" onClick={() => void sender.refetch()}>
            다시 시도
          </Button>
        </Banner>
      )}

      {sender.isSuccess && saved && !editing && (
        // 이름표, 값(이름과 주소 두 줄), 버튼을 가운데 맞춤. 글자 크기는 본문 하나로
        <div className="flex items-center gap-3 border-t border-line-subtle pt-4">
          <span className="shrink-0 text-ink-3">보내는 사람</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{saved.senderName}</span>
            <span className="truncate text-ink-3">{saved.fromAddress}</span>
          </span>
          <Button size="compact" onClick={startEdit} aria-label="보내는 사람 바꾸기">
            바꾸기
          </Button>
        </div>
      )}

      {askSender && (
        <div className="flex flex-col gap-4 border-t border-line-subtle pt-4">
          <LabeledField label="보내는 사람 이름" required error={errors.name}>
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={100}
                placeholder="KT 디지털인재장학 사무국"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(fieldControl, fieldBorder(!!errors.name))}
              />
            )}
          </LabeledField>
          <LabeledField label="보내는 메일 주소" required hint="메일 서버에서 허용한 주소만 쓸 수 있어요." error={errors.address}>
            {(p) => (
              <input
                {...p}
                type="email"
                maxLength={255}
                autoComplete="off"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={cn(fieldControl, fieldBorder(!!errors.address))}
              />
            )}
          </LabeledField>
        </div>
      )}

      {failure && <FormError>{failure}</FormError>}
    </FormDialog>
  )
}
