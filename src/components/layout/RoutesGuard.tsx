import { Navigate, useLocation } from 'react-router-dom'

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = localStorage.getItem('fintrack_is_authenticated') === 'true'
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = localStorage.getItem('fintrack_is_authenticated') === 'true'
  const user = JSON.parse(localStorage.getItem('fintrack_user') || '{}')
  const location = useLocation()

  if (!isAuthenticated || user.role !== 'admin') {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return <>{children}</>
}