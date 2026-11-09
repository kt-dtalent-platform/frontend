import { Link, useParams } from 'react-router'
import { useRequestDetail } from '../../api/manager'
import { Banner } from '../../components/ui/Banner'
import { EmptyState } from '../../components/ui/StateView'
import { usePageTitle } from '../../lib/usePageTitle'
import { CreateForm, RequestFormShell } from './RequestCreatePage'

// A03·A04 작성 중 요청 열기: 저장해 둔 요청을 고치거나 공개한다. 공개한 요청은 제출 현황으로 안내
export function RequestEditPage() {
  const id = Number(useParams().requestId)
  const detail = useRequestDetail(id)
  const validId = Number.isInteger(id) && id > 0
  usePageTitle(detail.data?.title ?? '작성 중인 요청')
  const d = detail.data

  return (
    <RequestFormShell title="작성 중인 요청" extraLoading={validId && detail.isPending} extraError={detail.error} onRetryExtra={() => detail.refetch()}>
      {(props) =>
        !validId ? (
          <EmptyState title="요청을 찾을 수 없어요">요청 관리에서 다시 골라 주세요.</EmptyState>
        ) : d && d.status !== 'DRAFT' ? (
          <Banner tone="info" title="이미 공개한 요청이에요">
            공개한 요청은 고칠 수 없어요. <Link to={`/manager/requests/${d.id}`}>제출 현황 보기</Link>
          </Banner>
        ) : (
          // key: 다른 요청으로 옮겨 가면 입력칸을 새 값으로 다시 채운다
          d && <CreateForm key={d.id} {...props} existing={d} />
        )
      }
    </RequestFormShell>
  )
}
