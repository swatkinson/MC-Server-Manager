import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { ToastProvider } from './context/ToastContext'
import { ToastContainer } from './components/ToastContainer'
import './styles/app.css'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <ToastContainer />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>
)
