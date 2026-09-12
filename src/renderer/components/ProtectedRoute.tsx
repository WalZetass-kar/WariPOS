import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isRestoring } = useAuth()
  if (isRestoring) return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
