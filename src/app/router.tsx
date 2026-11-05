import { createBrowserRouter } from 'react-router'
import { LoginPage } from '../pages/LoginPage'
import { LogoutPage } from '../pages/LogoutPage'
import { PasswordChangePage } from '../pages/PasswordChangePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ManagerHomePage } from '../pages/manager/ManagerHomePage'
import { RequestsPage } from '../pages/manager/RequestsPage'
import { ScholarCreatePage } from '../pages/manager/ScholarCreatePage'
import { ScholarDetailPage } from '../pages/manager/ScholarDetailPage'
import { ScholarsPage } from '../pages/manager/ScholarsPage'
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
  { path: '/password', element: <PasswordChangePage /> }, // C03
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
      { path: 'requests/new', element: <PlaceholderPage title="요청 만들기" when="11/10~12" /> },
      { path: 'requests/:requestId', element: <PlaceholderPage title="제출 현황" when="11/13~15" /> }, // A01
      { path: 'submissions', element: <PlaceholderPage title="제출 현황" when="11/9 주" /> },
      { path: 'scholars', element: <ScholarsPage /> }, // A06
      { path: 'scholars/new', element: <ScholarCreatePage /> }, // A08
      { path: 'scholars/:scholarId', element: <ScholarDetailPage /> }, // A07
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
