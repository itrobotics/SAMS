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
import { ClassDetailPage } from '../pages/ClassDetailPage';
import { ClassPricingPage } from '../pages/ClassPricingPage';
import { CoursesPage } from '../pages/CoursesPage';
import { CourseDetailPage } from '../pages/CourseDetailPage';
import { CourseSessionPage } from '../pages/CourseSessionPage';
import { InstructorsPage } from '../pages/InstructorsPage';
import { InstructorSchedulePage } from '../pages/InstructorSchedulePage';
import { SettingsPage } from '../pages/SettingsPage';
import { OptionsPage } from '../pages/OptionsPage';
import { EmploymentTrackingPage } from '../pages/EmploymentTrackingPage';
import { NotFoundPage } from '../pages/NotFoundPage';

import { SurveyFillPage } from '../pages/SurveyFillPage';
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
            <AuthGuard withLayout={false}>
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
          path={ROUTES.classDetail()}
          element={
            <AuthGuard>
              <ClassDetailPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.classPricing}
          element={
            <AuthGuard>
              <ClassPricingPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.courses}
          element={
            <AuthGuard>
              <CoursesPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.courseDetail()}
          element={
            <AuthGuard>
              <CourseDetailPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.courseSession()}
          element={
            <AuthGuard>
              <CourseSessionPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.instructors}
          element={
            <AuthGuard>
              <InstructorsPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.instructorSchedule}
          element={
            <AuthGuard>
              <InstructorSchedulePage />
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
        <Route
          path={ROUTES.options}
          element={
            <AuthGuard>
              <OptionsPage />
            </AuthGuard>
          }
        />

        {/* 問卷填寫頁：無需登入 */}
        <Route path={ROUTES.surveyFill()} element={<SurveyFillPage />} />

        <Route
          path={ROUTES.employmentTracking}
          element={
            <AuthGuard>
              <EmploymentTrackingPage />
            </AuthGuard>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
