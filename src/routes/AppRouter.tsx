import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { LoginPage } from '../pages/LoginPage';
import { HQDashboardPage } from '../pages/HQDashboardPage';
import { BranchesPage } from '../pages/BranchesPage';
import { BranchDashboardPage } from '../pages/BranchDashboardPage';
import { SessionPage } from '../pages/SessionPage';
import { KioskPage } from '../pages/KioskPage';
import { StudentsPage } from '../pages/StudentsPage';
import { StudentDetailPage } from '../pages/StudentDetailPage';
import { ClassesPage } from '../pages/ClassesPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

import { AuthGuard } from './AuthGuard';
import { ROUTES } from './paths';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.login} replace />} />
        <Route path={ROUTES.login} element={<LoginPage />} />

        <Route
          path={ROUTES.hqDashboard}
          element={
            <AuthGuard>
              <HQDashboardPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.branches}
          element={
            <AuthGuard>
              <BranchesPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.branchDashboard()}
          element={
            <AuthGuard>
              <BranchDashboardPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.session()}
          element={
            <AuthGuard>
              <SessionPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.kiosk()}
          element={
            <AuthGuard>
              <KioskPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.students}
          element={
            <AuthGuard>
              <StudentsPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.studentDetail()}
          element={
            <AuthGuard>
              <StudentDetailPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.classes}
          element={
            <AuthGuard>
              <ClassesPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.settings}
          element={
            <AuthGuard>
              <SettingsPage />
            </AuthGuard>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
