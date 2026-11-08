import { createBrowserRouter } from 'react-router'
import { LoginPage } from '../pages/LoginPage'
import { LogoutPage } from '../pages/LogoutPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ManagerHomePage } from '../pages/manager/ManagerHomePage'
import { RequestCreatePage } from '../pages/manager/RequestCreatePage'
import { RequestsPage } from '../pages/manager/RequestsPage'
import { RequestSubmissionsPage } from '../pages/manager/RequestSubmissionsPage'
import { SubmissionReviewPage } from '../pages/manager/SubmissionReviewPage'
import { SubmissionsHubPage } from '../pages/manager/SubmissionsHubPage'
import { MyTasksPage } from '../pages/scholar/MyTasksPage'
import { SubmissionPage } from '../pages/scholar/SubmissionPage'
import { ManagerLayout } from './layouts/ManagerLayout'
import { ScholarLayout } from './layouts/ScholarLayout'
import { RequireAuth, RootRedirect } from './RequireAuth'

// 화면 ID는 노션 화면 목록과 같다.
export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> }, // C01
  { path: '/logout', element: <LogoutPage /> },
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
      { path: 'requests/new', element: <RequestCreatePage /> }, // A05
      { path: 'requests/:requestId', element: <RequestSubmissionsPage /> }, // A01 제출 현황
      { path: 'submissions/:submissionId', element: <SubmissionReviewPage /> }, // A02 개별 검토
      { path: 'submissions', element: <SubmissionsHubPage /> },
      { path: 'scholars', element: <PlaceholderPage title="장학생" when="11/9 주" /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
