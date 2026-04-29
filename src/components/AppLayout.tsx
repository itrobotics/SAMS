// 共用後台版型（Task 009）
//
// 上方 Topbar：品牌、主要導覽、目前使用者 + 登出。
// 主內容區：children。Login / Kiosk 等不套用此版型的頁面就不要 wrap。

import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { defaultLandingPath } from '../types/user';
import { ROUTES } from '../routes/paths';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return <>{children}</>;

  const homePath = defaultLandingPath(user);
  const isHQ = user.role === 'hq_admin';
  const isBranchAdmin = user.role === 'branch_admin';

  const navItems: Array<{ to: string; label: string; show: boolean }> = [
    { to: homePath, label: '今日看板', show: true },
    { to: ROUTES.hqDashboard, label: '總部看板', show: isHQ },
    { to: '/branches', label: '分校', show: true },
    { to: ROUTES.students, label: '學生', show: true },
    { to: ROUTES.classes, label: '班級', show: true },
    { to: ROUTES.classPricing, label: '定價表', show: isHQ || isBranchAdmin },
    { to: ROUTES.instructors, label: '講師', show: true },
    { to: ROUTES.instructorSchedule, label: '排課清單', show: true },
    { to: ROUTES.settings, label: '設定', show: isHQ },
    { to: ROUTES.options, label: '選項管理', show: isHQ },
  ];

  async function handleLogout() {
    await logout();
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <div style={styles.shell}>
      <header style={styles.topbar}>
        <div style={styles.brand}>SAMS</div>
        <nav style={styles.nav}>
          {navItems
            .filter((it) => it.show)
            .map((it) => (
              <NavLink
                key={it.to + it.label}
                to={it.to}
                style={({ isActive }) => ({
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : null),
                })}
                end={it.to === homePath}
              >
                {it.label}
              </NavLink>
            ))}
        </nav>
        <div style={styles.userBox}>
          <span style={styles.userName}>{user.name}</span>
          <span style={styles.userRole}>{roleLabel(user.role)}</span>
          <button type="button" onClick={handleLogout} style={styles.logoutBtn}>
            登出
          </button>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

function roleLabel(role: string): string {
  switch (role) {
    case 'hq_admin':
      return '總部管理員';
    case 'branch_admin':
      return '分校管理員';
    case 'teacher':
      return '講師';
    case 'staff':
      return '行政';
    default:
      return role;
  }
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: '#f9fafb',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '0 1.5rem',
    height: 56,
    background: '#1f2937',
    color: '#f3f4f6',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  brand: { fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1 },
  nav: { display: 'flex', gap: '0.5rem', flex: 1 },
  navLink: {
    padding: '0.4rem 0.8rem',
    color: '#d1d5db',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: '0.95rem',
  },
  navLinkActive: { background: '#374151', color: '#fff' },
  userBox: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' },
  userName: { color: '#fff' },
  userRole: { color: '#9ca3af', fontSize: '0.8rem' },
  logoutBtn: {
    padding: '0.35rem 0.75rem',
    background: 'transparent',
    color: '#f3f4f6',
    border: '1px solid #4b5563',
    borderRadius: 6,
    fontSize: '0.85rem',
  },
  main: { padding: '1.5rem' },
};
