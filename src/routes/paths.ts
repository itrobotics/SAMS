// 集中管理所有路由 path，避免散落字面值。

export const ROUTES = {
  login: '/login',
  hqDashboard: '/hq-dashboard',
  branchDashboard: (branchId = ':branchId') => `/branch-dashboard/${branchId}`,
  session: (sessionId = ':sessionId') => `/session/${sessionId}`,
  kiosk: (branchId = ':branchId') => `/kiosk/${branchId}`,
  students: '/students',
  classes: '/classes',
  settings: '/settings',
} as const;
