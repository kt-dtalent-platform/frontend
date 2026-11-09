# KT디지털인재장학생 통합 운영 플랫폼 Frontend

미리보기: https://kt-dtalent-platform.github.io/frontend/ (main에 머지할 때마다 자동으로 올라가는 목업 화면)

장학생은 서류를 내고, 담당자는 제출물을 검토하는 웹 서비스의 프론트엔드입니다.

## 시작하기

Node 22.22.0 이상이 필요합니다(react-router 기준). 팀은 Node 24를 씁니다.

```bash
npm install
cp .env.example .env   # 처음 한 번
npm run dev            # http://localhost:5173
```

개발 서버는 기본으로 목업 응답(MSW)을 씁니다. 백엔드 없이도 화면이 돌아갑니다.
로컬 백엔드와 붙일 때는 백엔드를 `localhost:8080`에 띄운 뒤 `.env`에서 `VITE_USE_MOCK=false`로 바꾸고 개발 서버를 다시 켭니다. 개발 서버가 `/v1` 요청을 백엔드로 넘겨 주므로(프록시) CORS 설정이 필요 없습니다. 백엔드 주소가 다르면 `VITE_BACKEND_ORIGIN`을 바꿉니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 배포용 빌드 |
| `npm run lint` | 코드 검사(oxlint) |
| `npm run tokens` | `design/tokens.json`에서 `src/styles/tokens.css` 생성 |

## 스택

React 19, TypeScript, Vite, React Router, Tailwind CSS 4, TanStack Query, React Hook Form + Zod, MSW, Pretendard, lucide-react

## 폴더

```
design/tokens.json     디자인 토큰 원본 (디자인 시스템과 같은 파일)
scripts/               토큰 변환 스크립트
src/
  app/                 라우터, 공통 Provider, 레이아웃
  pages/               화면 단위 (scholar/, manager/)
  components/ui/       버튼, 상태 배지 같은 공통 컴포넌트
  api/                 API 호출과 Query 훅 (기능별 파일)
  mocks/               MSW 목업 핸들러
  lib/                 작은 도구 함수
  styles/tokens.css    자동 생성. 직접 고치지 않습니다.
```

## 디자인 토큰

색, 글자 크기, 모서리, 높이는 `design/tokens.json` 한 곳에서 정합니다. 값을 바꾸려면 이 파일을 고치고 `npm run tokens`를 실행합니다. 화면 코드에는 색 값(#161616)을 직접 쓰지 않고 `text-ink`, `bg-canvas`, `h-control-h` 같은 토큰 이름을 씁니다. Tailwind 기본 색(blue-500 등)은 꺼 두었습니다.

작업 방식과 커밋 규칙은 [CONTRIBUTING.md](./CONTRIBUTING.md)에 있습니다.
