import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../renderer/contexts/AuthContext'
import {
  canManageOperations,
  canOpenDeveloperPanel,
  canOpenUserPanel,
  hasMinRole,
  hasRole,
  type AppRole,
} from '../../shared/config/rbac'

interface GuardProps {
  children: ReactNode
  fallback?: string
}

function RestoringScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-500">Memuat sesi...</span>
    </div>
  )
}

export function RequireAuth({ children }: GuardProps) {
  const { user, isRestoring } = useAuth()
  if (isRestoring) return <RestoringScreen />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export function RequireUserPanel({ children, fallback = '/login' }: GuardProps) {
  const { user, isRestoring } = useAuth()
  if (isRestoring) return <RestoringScreen />
  if (!user) return <Navigate to="/login" replace />
  return canOpenUserPanel(user.hak_akses) ? <>{children}</> : <Navigate to={fallback} replace />
}

export function RequireMinRole({ children, minRole, fallback = '/' }: GuardProps & { minRole: AppRole }) {
  const { user, isRestoring } = useAuth()
  if (isRestoring) return <RestoringScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.hak_akses === 'demo') return <>{children}</>
  return hasMinRole(user.hak_akses, minRole) ? <>{children}</> : <Navigate to={fallback} replace />
}

export function RequireRoles({ children, allowedRoles, fallback = '/' }: GuardProps & { allowedRoles: AppRole[] }) {
  const { user, isRestoring } = useAuth()
  if (isRestoring) return <RestoringScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.hak_akses === 'demo') return <Navigate to={fallback} replace />
  return hasRole(user.hak_akses, allowedRoles) ? <>{children}</> : <Navigate to={fallback} replace />
}

export function RequireOperationalAdmin({ children, fallback = '/' }: GuardProps) {
  const { user, isRestoring } = useAuth()
  if (isRestoring) return <RestoringScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.hak_akses === 'demo') return <Navigate to={fallback} replace />
  return canManageOperations(user.hak_akses) ? <>{children}</> : <Navigate to={fallback} replace />
}

export function RequireDeveloperPanel({ children, fallback = '/' }: GuardProps) {
  const { user, isRestoring } = useAuth()
  if (isRestoring) return <RestoringScreen />
  if (!user) return <Navigate to="/login" replace />
  return canOpenDeveloperPanel(user.hak_akses) ? <>{children}</> : <Navigate to={fallback} replace />
}
