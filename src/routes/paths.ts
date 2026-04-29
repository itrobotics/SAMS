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
  courses: '/courses',
  courseDetail: (courseId = ':courseId') => `/courses/${courseId}`,
  courseSession: (courseId = ':courseId', courseSessionId = ':courseSessionId') =>
    `/courses/${courseId}/sessions/${courseSessionId}`,
  instructors: '/instructors',
  instructorSchedule: '/instructor-schedule',
  settings: '/settings',
  options: '/options',
} as const;
