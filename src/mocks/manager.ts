// 담당자 화면 목업. 모양은 노션 명세서(옛 자료)에서 MVP 범위만 가져왔다(확인 필요).
import type { ManagerDashboard, RequestRow } from '../api/manager'
import { dueIn } from './db'

const opened = (days: number) => dueIn(-days).replace('23:59:59', '09:00:00')

// 진행 중 6, 작성 중 2, 마감 17 → 전체 25건(페이지 넘김 확인용)
function rows(): RequestRow[] {
  const live: RequestRow[] = [
    {
      id: 31,
      title: '10월 행사 교통비 증빙',
      templateCode: 'TRANSPORT_CLAIM',
      cohortName: '6기',
      status: 'IN_PROGRESS',
      opensAt: opened(5),
      closesAt: dueIn(2),
      targetCount: 47,
      submittedCount: 32,
      revisionCount: 3,
    },
    {
      id: 35,
      title: '2학기 지속심사 서류 제출',
      templateCode: 'GRADE_REPORT',
      cohortName: '6기',
      status: 'IN_PROGRESS',
      opensAt: opened(3),
      closesAt: dueIn(10),
      targetCount: 47,
      submittedCount: 12,
      revisionCount: 0,
    },
    {
      id: 36,
      title: '2학기 지속심사 서류 제출',
      templateCode: 'GRADE_REPORT',
      cohortName: '5기',
      status: 'IN_PROGRESS',
      opensAt: opened(3),
      closesAt: dueIn(10),
      targetCount: 47,
      submittedCount: 20,
      revisionCount: 1,
    },
    {
      id: 37,
      title: '멘토링 활동 보고서',
      templateCode: null,
      cohortName: '5기',
      status: 'IN_PROGRESS',
      opensAt: opened(8),
      closesAt: dueIn(0),
      targetCount: 47,
      submittedCount: 40,
      revisionCount: 2,
    },
    {
      id: 38,
      title: '11월 정기 모임 참석 확인',
      templateCode: null,
      cohortName: null,
      status: 'IN_PROGRESS',
      opensAt: opened(1),
      closesAt: dueIn(5),
      targetCount: 94,
      submittedCount: 51,
      revisionCount: 0,
    },
    {
      id: 39,
      title: '재학증명서 제출',
      templateCode: null,
      cohortName: '6기',
      status: 'IN_PROGRESS',
      opensAt: opened(10),
      closesAt: dueIn(-1),
      targetCount: 47,
      submittedCount: 45,
      revisionCount: 0,
    },
    {
      id: 40,
      title: '12월 행사 교통비 증빙',
      templateCode: 'TRANSPORT_CLAIM',
      cohortName: '6기',
      status: 'DRAFT',
      opensAt: null,
      closesAt: null,
      targetCount: 0,
      submittedCount: 0,
      revisionCount: 0,
    },
    {
      id: 41,
      title: '겨울방학 활동 계획서',
      templateCode: null,
      cohortName: '5기',
      status: 'DRAFT',
      opensAt: null,
      closesAt: dueIn(30),
      targetCount: 47,
      submittedCount: 0,
      revisionCount: 0,
    },
  ]
  const closed: RequestRow[] = Array.from({ length: 17 }, (_, i) => ({
    id: 27 - i,
    title: i % 2 ? `${9 - Math.floor(i / 2)}월 행사 교통비 증빙` : `${i + 1}차 활동 보고서`,
    templateCode: i % 2 ? 'TRANSPORT_CLAIM' : null,
    cohortName: i % 3 ? '5기' : '6기',
    status: 'CLOSED',
    opensAt: opened(40 + i * 7),
    closesAt: dueIn(-(30 + i * 7)),
    targetCount: 47,
    submittedCount: 47 - (i % 4),
    revisionCount: 0,
  }))
  return [...live, ...closed]
}

export function requestList(status: string | null, page: number, pageSize: number) {
  const all = rows().filter((r) => !status || r.status === status)
  const p = Math.max(1, page)
  return { items: all.slice((p - 1) * pageSize, p * pageSize), page: p, page_size: pageSize, total: all.length }
}

export function managerDashboard(): ManagerDashboard {
  const live = rows().filter((r) => r.status === 'IN_PROGRESS')
  const soon = live
    .filter((r) => r.closesAt && new Date(r.closesAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.closesAt!.localeCompare(b.closesAt!))
  return {
    today: { unreviewedSubmissions: 14, resubmitted: 3 },
    tasks: {
      closingSoon: soon.map((r) => ({
        requestId: r.id,
        title: r.title,
        closesAt: r.closesAt!,
        notSubmitted: r.targetCount - r.submittedCount,
        targetCount: r.targetCount,
      })),
    },
    overview: {
      scholarCount: 94,
      byCohort: [
        { cohortName: '5기', count: 47 },
        { cohortName: '6기', count: 47 },
      ],
      inProgressRequests: live.length,
    },
  }
}
