import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ManagerHomePage } from '../pages/manager/ManagerHomePage'
import { MyTasksPage } from '../pages/scholar/MyTasksPage'
import { ManagerLayout } from './layouts/ManagerLayout'
import { ScholarLayout } from './layouts/ScholarLayout'

// 화면 ID는 노션 화면 목록과 같다.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> }, // C01
  {
    element: <ScholarLayout />, // C02 장학생
    children: [{ path: '/tasks', element: <MyTasksPage /> }], // S01
  },
  {
    path: '/manager',
    element: <ManagerLayout />, // C02 담당자
    children: [
      { index: true, element: <ManagerHomePage /> },
      { path: 'requests', element: <PlaceholderPage title="요청 관리" when="11/9 주" /> },
      { path: 'submissions', element: <PlaceholderPage title="제출 현황" when="11/9 주" /> },
      { path: 'scholars', element: <PlaceholderPage title="장학생" when="11/9 주" /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
