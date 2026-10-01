import { AuthProvider, useAuth } from '@/app/AuthContext'
import { AdminShell, StudentShell } from '@/components/layout/Shell'
import { AssignmentsPage } from '@/features/assignments/AssignmentsPage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { NotFoundPage, RouteErrorBoundary, SystemErrorPage } from '@/features/errors/ErrorPages'
import { ExamPlayerPage } from '@/features/exams/ExamPlayerPage'
import { ResultPage } from '@/features/exams/ResultPage'
import { ReviewPage } from '@/features/exams/ReviewPage'
import { ListeningDrillsPage } from '@/features/practice/ListeningDrillsPage'
import { PracticePage } from '@/features/practice/PracticePage'
import { ReadingDrillsPage } from '@/features/practice/ReadingDrillsPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { GrammarLessonPage } from '@/features/study/GrammarLessonPage'
import { StudyPage } from '@/features/study/StudyPage'
import { ExamBankPage } from '@/features/teacher/ExamBankPage'
import { ReportsPage } from '@/features/teacher/ReportsPage'
import { StudentDetailPage } from '@/features/teacher/StudentDetailPage'
import { BugReportsPage } from '@/features/bugs/BugReportsPage'
import { SiteSettingsPage } from '@/features/teacher/SiteSettingsPage'
import { TeacherAssignmentsPage } from '@/features/teacher/TeacherAssignmentsPage'
import { TeacherDashboardPage } from '@/features/teacher/TeacherDashboardPage'
import { NotebookPage } from '@/features/vocabulary/NotebookPage'
import { SiteSettingsProvider } from '@/features/site/SiteSettingsProvider'
import { ApiError } from '@/lib/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { homePathForRole } from '@toeic/shared'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper text-sm text-ink/55" role="status" aria-live="polite">
      Đang tải…
    </div>
  )
}

/**
 * Protected-route guard (AUTH-011).
 * loading → spinner · anonymous → /login · temp password → /change-password · wrong role → own home.
 */
function RequireAuth({ audience }: { audience: 'student' | 'staff' }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  const isStudent = user.role === 'STUDENT'
  if ((audience === 'student') !== isStudent) return <Navigate to={homePathForRole(user.role)} replace />
  const Shell = isStudent ? StudentShell : AdminShell
  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}

function AppRoutes() {
  const { status, user } = useAuth()
  const home = user ? (user.mustChangePassword ? '/change-password' : homePathForRole(user.role)) : '/login'

  return (
    <Routes>
      <Route path="/login" element={status === 'loading' ? <FullPageSpinner /> : user ? <Navigate to={home} replace /> : <LoginPage />} />
      <Route path="/change-password" element={status === 'loading' ? <FullPageSpinner /> : <ChangePasswordPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/error" element={<SystemErrorPage />} />
      <Route element={<RequireAuth audience="student" />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/study" element={<StudyPage />} />
        <Route path="/study/notebook" element={<NotebookPage />} />
        <Route path="/grammar/:topicId" element={<GrammarLessonPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/practice/listening" element={<ListeningDrillsPage />} />
        <Route path="/practice/reading" element={<ReadingDrillsPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/attempts/:attemptId/play" element={<ExamPlayerPage />} />
        <Route path="/attempts/:attemptId/result" element={<ResultPage />} />
        <Route path="/attempts/:attemptId/review" element={<ReviewPage />} />
      </Route>
      <Route element={<RequireAuth audience="staff" />}>
        <Route path="/admin" element={<TeacherDashboardPage />} />
        <Route path="/admin/students/:studentId" element={<StudentDetailPage />} />
        <Route path="/admin/students/:studentId/attempts/:attemptId" element={<ResultPage />} />
        <Route path="/admin/students/:studentId/attempts/:attemptId/review" element={<ReviewPage />} />
        <Route path="/admin/exams" element={<ExamBankPage />} />
        <Route path="/admin/assignments" element={<TeacherAssignmentsPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/bugs" element={<BugReportsPage />} />
        <Route path="/admin/settings" element={<SiteSettingsPage />} />
      </Route>
      <Route path="*" element={status === 'loading' ? <FullPageSpinner /> : <NotFoundPage />} />
    </Routes>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Auth errors are handled centrally in api() — don't hammer the API retrying them.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500 && err.status !== 0) && count < 2,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteSettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <RouteErrorBoundary>
              <AppRoutes />
            </RouteErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </SiteSettingsProvider>
    </QueryClientProvider>
  )
}
