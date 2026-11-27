import { AuthProvider, useAuth } from '@/app/AuthContext'
import { AdminShell, StudentShell } from '@/components/layout/Shell'
import { ViewAsBanner } from '@/components/layout/ViewAsBanner'
import { ViewAsPage } from '@/features/teacher/ViewAsPage'
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
import { StaffProfilePage } from '@/features/settings/AvatarSettings'
import { FlashcardPage } from '@/features/study/FlashcardPage'
import { GrammarLessonPage } from '@/features/study/GrammarLessonPage'
import { StudyPage } from '@/features/study/StudyPage'
import { VocabGamesPage } from '@/features/study/VocabGamesPage'
import { AdminStudyPage } from '@/features/teacher/AdminStudyPage'
import { ExamBankPage } from '@/features/teacher/ExamBankPage'
import { ReportsPage } from '@/features/teacher/ReportsPage'
import { StudentDetailPage } from '@/features/teacher/StudentDetailPage'
import { BugReportsPage } from '@/features/bugs/BugReportsPage'
import { StaffHonorPage } from '@/features/honor/StaffHonorPage'
import { StudentHonorPage } from '@/features/honor/StudentHonorPage'
import { SiteSettingsPage } from '@/features/teacher/SiteSettingsPage'
import { TeacherAssignmentsPage } from '@/features/teacher/TeacherAssignmentsPage'
import { TeacherDashboardPage } from '@/features/teacher/TeacherDashboardPage'
import { NotebookPage } from '@/features/vocabulary/NotebookPage'
import { SiteSettingsProvider, useThemeGate, type ThemeSurface } from '@/features/site/SiteSettingsProvider'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { ApiError } from '@/lib/api'
import { avatarListKeys } from '@/lib/account-avatars'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { homePathForRole } from '@toeic/shared'
import { useLayoutEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

function FullPageSpinner() {
  return <LoadingScreen />
}

const PLAIN_ROUTE = /^\/(study|grammar)(\/|$)|^\/attempts\/|^\/admin\/students\/[^/]+\/attempts\//

/** Switches surface: `splash` (loading), `login` (login gate with effects), `plain` (study & exam, solid no backdrop), or `shell` (backdrop in margins). */
function ThemeSurfaceSync() {
  const setSurface = useThemeGate()
  const { status, user } = useAuth()
  const { pathname } = useLocation()
  const surface: ThemeSurface =
    status === 'loading'
      ? 'splash'
      : pathname === '/login' && !user
        ? 'login'
        : PLAIN_ROUTE.test(pathname)
          ? 'plain'
          : 'shell'
  useLayoutEffect(() => {
    setSurface(surface)
    document.documentElement.classList.toggle('exam-plain', surface === 'plain')
  }, [surface, setSurface])
  return null
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
      <ViewAsBanner />
    </Shell>
  )
}

function StaffGrant({ need }: { need: 'manage' | 'assignments' | 'progress' | 'admin' }) {
  const { user } = useAuth()
  if (!user) return null
  if (need === 'admin') return user.role === 'ADMIN' ? <Outlet /> : <Navigate to="/admin" replace />
  if (user.role === 'ADMIN') return <Outlet />
  const grants = user.permissions
  const allowed =
    need === 'manage' ? grants.manageAssignments
    : need === 'assignments' ? grants.manageAssignments || grants.viewProgress
    : grants.viewProgress
  return allowed ? <Outlet /> : <Navigate to="/admin" replace />
}

function AppRoutes() {
  const { status, user } = useAuth()
  const home = user ? (user.mustChangePassword ? '/change-password' : homePathForRole(user.role)) : '/login'

  return (
    <Routes>
      <Route path="/" element={status === 'loading' ? <FullPageSpinner /> : <Navigate to={home} replace />} />
      <Route path="/login" element={status === 'loading' ? <FullPageSpinner /> : user ? <Navigate to={home} replace /> : <LoginPage />} />
      <Route path="/change-password" element={status === 'loading' ? <FullPageSpinner /> : <ChangePasswordPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/error" element={<SystemErrorPage />} />
      <Route element={<RequireAuth audience="student" />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/study" element={<StudyPage />} />
        <Route path="/study/notebook" element={<NotebookPage />} />
        <Route path="/study/flashcards" element={<FlashcardPage />} />
        <Route path="/study/games" element={<VocabGamesPage />} />
        <Route path="/grammar/:topicId" element={<GrammarLessonPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/practice/listening" element={<ListeningDrillsPage />} />
        <Route path="/practice/reading" element={<ReadingDrillsPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/honor" element={<StudentHonorPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/attempts/:attemptId/play" element={<ExamPlayerPage />} />
        <Route path="/attempts/:attemptId/result" element={<ResultPage />} />
        <Route path="/attempts/:attemptId/review" element={<ReviewPage />} />
      </Route>
      <Route element={<RequireAuth audience="staff" />}>
        <Route path="/admin" element={<TeacherDashboardPage />} />
        <Route path="/admin/profile" element={<StaffProfilePage />} />
        <Route path="/admin/honor" element={<StaffHonorPage />} />
        <Route element={<StaffGrant need="progress" />}>
          <Route path="/admin/students/:studentId" element={<StudentDetailPage />} />
          <Route path="/admin/students/:studentId/attempts/:attemptId" element={<ResultPage />} />
          <Route path="/admin/students/:studentId/attempts/:attemptId/review" element={<ReviewPage />} />
          <Route path="/admin/reports" element={<ReportsPage />} />
        </Route>
        <Route element={<StaffGrant need="manage" />}>
          <Route path="/admin/exams" element={<ExamBankPage />} />
        </Route>
        <Route element={<StaffGrant need="assignments" />}>
          <Route path="/admin/assignments" element={<TeacherAssignmentsPage />} />
        </Route>
        <Route element={<StaffGrant need="admin" />}>
          <Route path="/admin/view-as" element={<ViewAsPage />} />
          <Route path="/admin/study" element={<AdminStudyPage />} />
          <Route path="/admin/bugs" element={<BugReportsPage />} />
          <Route path="/admin/settings" element={<SiteSettingsPage />} />
        </Route>
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

for (const queryKey of avatarListKeys) {
  queryClient.setQueryDefaults(queryKey, { refetchOnWindowFocus: 'always' })
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SiteSettingsProvider>
          <BrowserRouter>
            <RouteErrorBoundary>
              <ThemeSurfaceSync />
              <AppRoutes />
            </RouteErrorBoundary>
          </BrowserRouter>
        </SiteSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
