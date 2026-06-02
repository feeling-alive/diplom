import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/** Centered design-system spinner (no MUI). Shown while the session loads. */
function CenteredSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 240,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--r-pill)',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'fintrack-spin 0.8s linear infinite',
        }}
      />
      <style>{'@keyframes fintrack-spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  console.debug('[PrivateRoute] isAuth=%s isLoading=%s', isAuthenticated, isLoading)

  if (isLoading) return <CenteredSpinner />
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) return <CenteredSpinner />
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/" state={{ from: location }} replace />
  }
  return <>{children}</>
}
