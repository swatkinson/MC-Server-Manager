import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { LoginPage } from './pages/LoginPage'
import { AccountsPage } from './pages/AccountsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { ModConfigsPage } from './pages/ModConfigsPage'
import { BackupsPage } from './pages/BackupsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastContainer } from './components/ToastContainer'
import './styles/app.css'

// Protected routes — redirect to /login when not authenticated
const PROTECTED = new Set(['/', '/configs', '/backups', '/settings', '/accounts', '/audit'])

function RootLayout() {
  const { user, loading, setupRequired } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (loading) return
    const needsAuth = PROTECTED.has(pathname)
    const unauthenticated = !user || setupRequired === true
    if (needsAuth && unauthenticated) {
      void navigate({ to: '/login' })
    } else if (user && setupRequired === false && pathname === '/login') {
      void navigate({ to: '/' })
    }
  }, [loading, user, setupRequired, pathname, navigate])

  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      {loading ? (
        <div className="auth-page">
          <div className="auth-card__loading">Loading…</div>
        </div>
      ) : (
        <Outlet />
      )}
      <ToastContainer />
    </>
  )
}

const rootRoute = createRootRoute({ component: RootLayout })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// Pathless layout: sidebar + top bar around every signed-in page.
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
})

const page = (path: string, component: () => JSX.Element) =>
  createRoute({ getParentRoute: () => shellRoute, path, component })

const routeTree = rootRoute.addChildren([
  loginRoute,
  shellRoute.addChildren([
    page('/', Dashboard),
    page('/configs', ModConfigsPage),
    page('/backups', BackupsPage),
    page('/settings', SettingsPage),
    page('/accounts', AccountsPage),
    page('/audit', AuditLogPage),
  ]),
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  </StrictMode>
)
