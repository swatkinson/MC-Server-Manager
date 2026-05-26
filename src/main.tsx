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
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastContainer } from './components/ToastContainer'
import './styles/app.css'

// Protected routes — redirect to /login when not authenticated
const PROTECTED = new Set(['/', '/accounts'])

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

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card__loading">Loading…</div>
      </div>
    )
  }

  return (
    <>
      <Outlet />
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

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts',
  component: AccountsPage,
})

const routeTree = rootRoute.addChildren([loginRoute, indexRoute, accountsRoute])

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
