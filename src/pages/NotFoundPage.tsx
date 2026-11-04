import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="m-0 text-title-2">페이지를 찾을 수 없어요</h1>
        <p className="m-0 text-caption text-ink-3">주소를 다시 확인하세요.</p>
        <Link to="/" className="mt-4 text-label text-ink underline underline-offset-4">
          처음으로
        </Link>
      </div>
    </main>
  )
}
