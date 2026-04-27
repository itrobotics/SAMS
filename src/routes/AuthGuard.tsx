// AuthGuard（Task 007 + Task 009 layout）
//
// 兩道閘門：
//  1) 未登入       → 導向 /login（保留 from 以便登入後返回）
//  2) 跨分校存取   → 若 URL 帶 :branchId 且使用者無權限，導回自己的首頁
//
// 受保護頁面預設套用 AppLayout（topbar + nav）。Kiosk 等全螢幕頁面可關閉。

import { type ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { canAccessBranch, defaultLandingPath } from '../types/user';
import { ROUTES } from './paths';

interface AuthGuardProps {
  children: ReactNode;
  withLayout?: boolean;
}

export function AuthGuard({ children, withLayout = true }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { branchId } = useParams<{ branchId?: string }>();

  if (loading) {
    return <div style={{ padding: '2rem', color: '#6b7280' }}>載入中…</div>;
  }

  if (!user) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (branchId && !canAccessBranch(user, branchId)) {
    return <Navigate to={defaultLandingPath(user)} replace />;
  }

  return withLayout ? <AppLayout>{children}</AppLayout> : <>{children}</>;
}
