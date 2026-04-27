// AuthGuard（Task 007）
//
// 兩道閘門：
//  1) 未登入       → 導向 /login（保留 from 以便登入後返回）
//  2) 跨分校存取   → 若 URL 帶 :branchId 且使用者無權限，導回自己的首頁
//
// HQ 角色可存取所有分校；其餘角色僅能存取 branchIds 內的分校。
// Kiosk 路由（未登入）目前一視同仁地擋下；後續若要支援 KIOSK_DEVICE 帳號，
// 在這裡放行對應角色即可。

import { type ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { canAccessBranch, defaultLandingPath } from '../types/user';
import { ROUTES } from './paths';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { branchId } = useParams<{ branchId?: string }>();

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280' }}>載入中…</div>
    );
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

  return <>{children}</>;
}
