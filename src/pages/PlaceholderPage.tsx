import { PageTitle } from '../components/ui/PageTitle'

// 아직 만들지 않은 화면 자리. 메뉴가 404로 가지 않게 한다.
export function PlaceholderPage({ title, when }: { title: string; when: string }) {
  return <PageTitle description={`${when}에 만듭니다.`}>{title}</PageTitle>
}
