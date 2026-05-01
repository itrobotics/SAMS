// 集中管理所有路由 path，避免散落字面值。

export const ROUTES = {
  login: '/login',
  hqDashboard: '/hq-dashboard',
  branches: '/branches',
  branchDashboard: (branchId = ':branchId') => `/branch-dashboard/${branchId}`,
  session: (sessionId = ':sessionId') => `/session/${sessionId}`,
  kiosk: (branchId = ':branchId') => `/kiosk/${branchId}`,
  students: '/students',
  studentDetail: (studentId = ':studentId') => `/students/${studentId}`,
  classes: '/classes',
  classDetail: (classId = ':classId') => `/classes/${classId}`,
  instructors: '/instructors',
  instructorSchedule: '/instructor-schedule',
  settings: '/settings',
  options: '/options',
  surveyFill: (responseId = ':responseId') => `/survey/${responseId}`,
} as const;
