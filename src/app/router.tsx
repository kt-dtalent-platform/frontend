import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '../pages/LoginPage'
import { LogoutPage } from '../pages/LogoutPage'
import { PasswordChangePage } from '../pages/PasswordChangePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ManagerHomePage } from '../pages/manager/ManagerHomePage'
import { RequestCreatePage } from '../pages/manager/RequestCreatePage'
import { RequestEditPage } from '../pages/manager/RequestEditPage'
import { RequestsPage } from '../pages/manager/RequestsPage'
import { ScholarCreatePage } from '../pages/manager/ScholarCreatePage'
import { ScholarDetailPage } from '../pages/manager/ScholarDetailPage'
import { ScholarsPage } from '../pages/manager/ScholarsPage'
import { RequestSubmissionsPage } from '../pages/manager/RequestSubmissionsPage'
import { SubmissionReviewPage } from '../pages/manager/SubmissionReviewPage'
import { MyTasksPage } from '../pages/scholar/MyTasksPage'
import { SubmissionPage } from '../pages/scholar/SubmissionPage'
import { ManagerLayout } from './layouts/ManagerLayout'
import { ScholarLayout } from './layouts/ScholarLayout'
import { RequireAuth, RootRedirect } from './RequireAuth'
import { basePath } from '../lib/env'

// 화면 ID는 노션 화면 목록과 같다.
export const router = createBrowserRouter(
  [
    { path: '/', element: <RootRedirect /> },
    { path: '/login', element: <LoginPage /> }, // C01
    { path: '/logout', element: <LogoutPage /> },
    { path: '/password', element: <PasswordChangePage /> }, // C01 첫 로그인 비밀번호 변경
    {
      element: (
        <RequireAuth role="SCHOLAR">
          <ScholarLayout />
        </RequireAuth>
      ), // C02 장학생
      children: [
        { path: '/tasks', element: <MyTasksPage /> }, // S01
        { path: '/tasks/:requestId', element: <SubmissionPage /> }, // S02
      ],
    },
    {
      path: '/manager',
      element: (
        <RequireAuth role="MANAGER">
          <ManagerLayout />
        </RequireAuth>
      ), // C02 담당자
      children: [
        { index: true, element: <ManagerHomePage /> },
        { path: 'requests', element: <RequestsPage /> }, // A04
        { path: 'requests/new', element: <RequestCreatePage /> }, // A03·A04
        { path: 'requests/:requestId/edit', element: <RequestEditPage /> }, // A03·A04 작성 중 요청
        { path: 'requests/:requestId', element: <RequestSubmissionsPage /> }, // A01 제출 현황
        { path: 'submissions/:submissionId', element: <SubmissionReviewPage /> }, // A02 개별 검토
        // 제출 현황 메뉴는 없앴다(11/12). 예전 주소로 오면 요청 관리로
        { path: 'submissions', element: <Navigate to="/manager/requests" replace /> },
        { path: 'scholars', element: <ScholarsPage /> }, // A05
        { path: 'scholars/new', element: <ScholarCreatePage /> }, // A06
        { path: 'scholars/:scholarId', element: <ScholarDetailPage /> }, // A05 상세
      ],
    },
    { path: '*', element: <NotFoundPage /> },
  ],
  // GitHub Pages처럼 하위 경로(/frontend/)에 올라가도 주소가 맞게
  { basename: basePath },
)
