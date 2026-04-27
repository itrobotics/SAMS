import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { LoginPage } from '../pages/LoginPage';
import { HQDashboardPage } from '../pages/HQDashboardPage';
import { BranchDashboardPage } from '../pages/BranchDashboardPage';
import { SessionPage } from '../pages/SessionPage';
import { KioskPage } from '../pages/KioskPage';
import { StudentsPage } from '../pages/StudentsPage';
import { ClassesPage } from '../pages/ClassesPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

import { ROUTES } from './paths';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.login} replace />} />
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.hqDashboard} element={<HQDashboardPage />} />
        <Route path={ROUTES.branchDashboard()} element={<BranchDashboardPage />} />
        <Route path={ROUTES.session()} element={<SessionPage />} />
        <Route path={ROUTES.kiosk()} element={<KioskPage />} />
        <Route path={ROUTES.students} element={<StudentsPage />} />
        <Route path={ROUTES.classes} element={<ClassesPage />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
