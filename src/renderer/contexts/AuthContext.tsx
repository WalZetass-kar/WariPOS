import { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import type { UserSession } from '../../shared/types'
import { api } from '../utils/api'
import { secureStorage } from '../utils/secureStorage'
import { collectAuthDeviceInfo } from '../utils/authDevice'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { subscribeLicense, syncBuyerLicense, heartbeat as supabaseHeartbeat } from '../../shared/supabase/license'
import { logActivity } from '../../shared/supabase/logging'

/** Session TTL: 8 hours in milliseconds */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
/** Check session expiry every 60 seconds */
const EXPIRY_CHECK_INTERVAL_MS = 60 * 1000
/** Re-check remote license (Supabase) every 12 seconds while logged in. */
const REMOTE_LICENSE_SYNC_INTERVAL_MS = 12 * 1000
const LICENSE_LAST_SUCCESS_KEY = 'license_last_success_at'
const LICENSE_OFFLINE_GRACE_MS = Number(import.meta.env.VITE_LICENSE_OFFLINE_GRACE_HOURS ?? 720) * 60 * 60 * 1000

function numericValue(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function shouldShowRemoteLicensePopup(data: any): boolean {
  const code = String(data?.popup?.code ?? '').toUpperCase()
  if (code !== 'ACCESS_EXPIRING') return true

  const daysRemaining = numericValue(
    data?.subscription?.days_remaining
      ?? data?.days_remaining
      ?? data?.access_days_remaining
  )
  if (daysRemaining === null) return false

  const durationDays = numericValue(
    data?.plan?.duration_days
      ?? data?.subscription?.plan?.duration_days
  )
  const thresholdDays = durationDays !== null && durationDays > 7 ? 7 : 1
  return daysRemaining <= thresholdDays
}

interface StoredSession extends UserSession {
  loginAt: number
  expiresAt: number
  sessionToken: string
  sessionExpiresAt: string
  deviceId: string | null
}

interface AuthContextValue {
  user: UserSession | null
  /** Whether the current user is in demo mode (UX helper) */
  isDemo: boolean
  login: (user: UserSession) => void
  logout: () => void
  refreshUser: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeLocalRole(role?: string | null): string | null {
  return role === 'superadmin' ? 'developer' : role ?? null
}

/** Restore encrypted session with expiry validation */
function toPublicSession(session: StoredSession): UserSession {
  return {
    nama_pengguna: session.nama_pengguna,
    nama_lengkap: session.nama_lengkap,
    email: session.email ?? null,
    foto: (session as any).foto ?? null,
    hak_akses: normalizeLocalRole(session.hak_akses),
    access_expires_at: session.access_expires_at ?? null,
    access_days_remaining: session.access_days_remaining ?? null,
    must_change_password: session.must_change_password ?? false,
    subscription_plan_id: session.subscription_plan_id ?? null,
    subscription_expires_at: session.subscription_expires_at ?? null,
    remote_license_token: session.remote_license_token ?? null,
    remote_license_refresh_token: session.remote_license_refresh_token ?? null,
    remote_customer_id: session.remote_customer_id ?? null,
    remote_auth_user_id: session.remote_auth_user_id ?? null,
  }
}

function restoreSession(): StoredSession | null {
  try {
    const saved = secureStorage.getItem('pos_session')
    if (!saved) return null
    const parsed: StoredSession = JSON.parse(saved)
    // Check session expiry
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      secureStorage.removeItem('pos_session')
      return null
    }
    if (parsed.must_change_password) {
      secureStorage.removeItem('pos_session')
      return null
    }
    const sessionExpiry = new Date(parsed.sessionExpiresAt).getTime()
    if (!parsed.sessionToken || !parsed.sessionExpiresAt || !Number.isFinite(sessionExpiry) || Date.now() > sessionExpiry) {
      secureStorage.removeItem('pos_session')
      return null
    }
    return parsed
  } catch {
    secureStorage.removeItem('pos_session')
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storageReady, setStorageReady] = useState(() => !Capacitor.isNativePlatform())
  const [user, setUser] = useState<UserSession | null>(() => {
    const restored = restoreSession()
    return restored ? toPublicSession(restored) : null
  })

  const isDemo = useMemo(() => user?.hak_akses === 'demo', [user])

  const { isOnline } = useNetworkStatus()
  const wasOnlineRef = useRef(isOnline)

  const logout = useCallback(() => {
    const stored = restoreSession()
    // Notify main process to clear server-side session
    try {
      api('auth:logout', {
        username: user?.nama_pengguna ?? stored?.nama_pengguna ?? 'unknown',
        sessionToken: stored?.sessionToken,
        deviceInfo: collectAuthDeviceInfo(),
      })
    } catch {
      // Ignore errors during logout
    }
    setUser(null)
    secureStorage.removeItem('pos_session')
  }, [user?.nama_pengguna])

  const refreshUser = useCallback(() => {
    const raw = secureStorage.getItem('pos_session')
    if (!raw) return
    try {
      const stored = JSON.parse(raw) as StoredSession
      setUser(toPublicSession(stored))
    } catch { /* ignore */ }
  }, [])

  const login = useCallback((u: UserSession) => {
    const sessionToken = u.session_token
    const sessionExpiresAt = u.session_expires_at
    if (!sessionToken || !sessionExpiresAt) {
      throw new Error('Session token tidak diterima dari backend')
    }

    const backendExpiry = new Date(sessionExpiresAt).getTime()
    const localExpiry = Number.isFinite(backendExpiry)
      ? Math.min(backendExpiry, Date.now() + SESSION_TTL_MS)
      : Date.now() + SESSION_TTL_MS

    const stored: StoredSession = {
      ...u,
      session_token: undefined,
      session_expires_at: undefined,
      sessionToken,
      sessionExpiresAt,
      deviceId: u.device_id ?? null,
      loginAt: Date.now(),
      expiresAt: localExpiry,
    }
    setUser(toPublicSession(stored))
    secureStorage.setJSON('pos_session', stored)
    if (u.remote_customer_id || u.remote_license_token) {
      secureStorage.setItem(LICENSE_LAST_SUCCESS_KEY, String(Date.now()))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    secureStorage.ready(['pos_session', 'rememberMe', 'auth_device_id']).then(() => {
      if (cancelled) return
      setStorageReady(true)
      const restored = restoreSession()
      if (restored && !user) setUser(toPublicSession(restored))
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    api('auth:init').then(() => {
      if (cancelled) return
      const stored = restoreSession()
      if (stored) {
        setUser(toPublicSession(stored))
        if (stored.sessionToken && stored.nama_pengguna) {
          api<UserSession>('auth:restoreSession', {
            username: stored.nama_pengguna,
            sessionToken: stored.sessionToken,
            deviceInfo: collectAuthDeviceInfo(),
            remoteLicenseToken: stored.remote_license_token ?? null,
            remoteLicenseRefreshToken: stored.remote_license_refresh_token ?? null,
          }).then(result => {
            if (cancelled) return
            if (result?.success && result.data) {
              const restored = result.data as UserSession
              const nextStored: StoredSession = {
                ...restored,
                sessionToken: stored.sessionToken,
                sessionExpiresAt: stored.sessionExpiresAt,
                deviceId: stored.deviceId,
                remote_license_token: restored.remote_license_token ?? stored.remote_license_token ?? null,
                remote_license_refresh_token: restored.remote_license_refresh_token ?? stored.remote_license_refresh_token ?? null,
                remote_customer_id: restored.remote_customer_id ?? stored.remote_customer_id ?? null,
                remote_auth_user_id: restored.remote_auth_user_id ?? stored.remote_auth_user_id ?? null,
                loginAt: stored.loginAt,
                expiresAt: Math.min(stored.expiresAt, new Date(stored.sessionExpiresAt).getTime()),
              }
              setUser(toPublicSession(nextStored))
              secureStorage.setJSON('pos_session', nextStored)
            } else if (result && !result.success && ['BLOCKED', 'SUSPENDED', 'SESSION_INVALID', 'EXPIRED'].includes(String(result.error_code || ''))) {
              logout()
            }
          }).catch(() => {})
        }
      }
    })
    return () => { cancelled = true }
  }, [logout])

  const lastHeartbeatRef = useRef(0)

  useEffect(() => {
    if (!user?.nama_pengguna) return

    let cancelled = false
    const sendHeartbeat = () => {
      if (cancelled) return
      const now = Date.now()
      if (now - lastHeartbeatRef.current < 45 * 1000) return
      lastHeartbeatRef.current = now

      const deviceInfo = collectAuthDeviceInfo()
      void supabaseHeartbeat({
        email: user.email ?? user.nama_pengguna,
        customerId: user.remote_customer_id ?? undefined,
        deviceInfo,
      })
    }

    sendHeartbeat()
    const heartbeat = window.setInterval(sendHeartbeat, 60 * 1000)
    window.addEventListener('focus', sendHeartbeat)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sendHeartbeat()
    })
    return () => {
      cancelled = true
      window.clearInterval(heartbeat)
      window.removeEventListener('focus', sendHeartbeat)
    }
  }, [user?.nama_pengguna, user?.email, user?.remote_auth_user_id, user?.remote_customer_id, user?.remote_license_token])

  useEffect(() => {
    if (!user?.nama_pengguna) return

    const report = (errorType: string, message: string, stack?: string) => {
      const deviceInfo = collectAuthDeviceInfo()
      void logActivity({
        username: user.email ?? user.nama_pengguna,
        action: 'APP_ERROR',
        module: 'SYSTEM',
        detail: `${errorType}: ${message.slice(0, 1000)}`,
        deviceId: deviceInfo.deviceId,
        userAgent: deviceInfo.userAgent,
      })
    }
    const onError = (event: ErrorEvent) => report('application', event.message || 'Application error', event.error?.stack)
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      report('application', reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [user?.nama_pengguna, user?.email, user?.remote_auth_user_id, user?.remote_customer_id])

  useEffect(() => {
    if (!user?.nama_pengguna) return

    let cancelled = false
    let syncing = false

    const sync = async () => {
      if (syncing) return
      syncing = true
      try {
        if (!user.email || !user.email.includes('@')) {
          if (cancelled) return
          syncing = false
          return
        }
        // 1. Sync license with backend
        const r = await api<any>('license:syncBuyerLicense', user.nama_pengguna, collectAuthDeviceInfo())
        if (cancelled) return

        const data: any = r?.data ?? {}
        const reachedServer = String(data?.error_code ?? '').toUpperCase() !== 'OFFLINE'
        // Only refresh the "last verified" timestamp when we actually reached the
        // server. The offline fallback returns success:true with error_code
        // OFFLINE and must NOT keep resetting the grace clock.
        if (r?.success && reachedServer) {
          secureStorage.setItem(LICENSE_LAST_SUCCESS_KEY, String(Date.now()))
        }

        // 2. Refresh local session from backend DB to get latest permissions, plan, expiry, and limits
        const stored = restoreSession()
        if (stored?.sessionToken) {
          const restoreRes = await api<UserSession>('auth:restoreSession', {
            username: user.nama_pengguna,
            sessionToken: stored.sessionToken,
            deviceInfo: collectAuthDeviceInfo(),
            remoteLicenseToken: stored.remote_license_token ?? null,
            remoteLicenseRefreshToken: stored.remote_license_refresh_token ?? null,
          })

          if (!cancelled && restoreRes?.success && restoreRes.data) {
            const nextUser = restoreRes.data
            const wasDemo = user.hak_akses === 'demo'
            const isNowPaid = nextUser.hak_akses !== 'demo' && (Boolean(nextUser.subscription_plan_name) || Boolean(nextUser.subscription_plan_id))

            const nextStored: StoredSession = {
              ...nextUser,
              sessionToken: stored.sessionToken,
              sessionExpiresAt: stored.sessionExpiresAt,
              deviceId: stored.deviceId,
              loginAt: stored.loginAt,
              expiresAt: Math.min(stored.expiresAt, new Date(stored.sessionExpiresAt).getTime()),
            }

            setUser(toPublicSession(nextStored))
            secureStorage.setJSON('pos_session', nextStored)

            window.dispatchEvent(new CustomEvent('license:updated', { detail: { user: nextUser } }))

            if (wasDemo && isNowPaid) {
              window.dispatchEvent(new CustomEvent('toast:show', {
                detail: {
                  message: `Lisensi Aktif: ${nextUser.subscription_plan_name || 'Paket Berhasil Diaktifkan'}!`,
                  type: 'success',
                },
              }))
            }
          } else if (!cancelled && restoreRes && !restoreRes.success && ['BLOCKED', 'SUSPENDED', 'SESSION_INVALID', 'EXPIRED'].includes(String(restoreRes.error_code || ''))) {
            logout()
          }
        }

        if (data?.popup && shouldShowRemoteLicensePopup(data)) {
          window.dispatchEvent(new CustomEvent('license:remote-popup', {
            detail: { popup: data.popup, force: !!data.force_popup },
          }))
        }

        const code = String(data?.error_code ?? '').toUpperCase()
        if (code === 'OFFLINE') {
          const lastSuccess = Number(secureStorage.getItem(LICENSE_LAST_SUCCESS_KEY) ?? 0)
          const graceExceeded = lastSuccess > 0 && Date.now() - lastSuccess > LICENSE_OFFLINE_GRACE_MS
          if (graceExceeded) {
            window.dispatchEvent(new CustomEvent('license:remote-popup', {
              detail: {
                force: true,
                popup: {
                  code: 'OFFLINE_GRACE_EXPIRED',
                  title: 'Validasi Lisensi Gagal',
                  description: 'Aplikasi terlalu lama tidak terhubung ke server developer. Sambungkan internet lalu login ulang.',
                  severity: 'danger',
                  dismissible: false,
                },
              },
            }))
            setTimeout(() => {
              if (!cancelled) logout()
            }, 1200)
          }
          return
        }

        if (['BLOCKED', 'SUSPENDED', 'DEVICE_BLOCKED'].includes(code)) {
          setTimeout(() => {
            if (!cancelled) logout()
          }, 1200)
        }
      } finally {
        syncing = false
      }
    }

    void sync()
    const interval = window.setInterval(sync, REMOTE_LICENSE_SYNC_INTERVAL_MS)
    window.addEventListener('license:sync-now', sync)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('license:sync-now', sync)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [user?.nama_pengguna, logout])

  // Connectivity transitions: re-validate license + refresh device heartbeat the
  // moment the internet comes back, instead of waiting for the 12s poll / focus.
  useEffect(() => {
    const wasOnline = wasOnlineRef.current
    wasOnlineRef.current = isOnline

    if (wasOnline === isOnline) return

    if (isOnline) {
      if (user?.nama_pengguna) {
        window.dispatchEvent(new Event('license:sync-now'))
        void supabaseHeartbeat({
          email: user.email ?? user.nama_pengguna,
          customerId: user.remote_customer_id ?? undefined,
          deviceInfo: collectAuthDeviceInfo(),
        })
        window.dispatchEvent(new CustomEvent('toast:show', {
          detail: { message: 'Kembali online — sinkronisasi lisensi...', type: 'success' },
        }))
      }
    } else if (user?.nama_pengguna) {
      window.dispatchEvent(new CustomEvent('toast:show', {
        detail: { message: 'Mode offline — data tersimpan di perangkat', type: 'info' },
      }))
    }
  }, [isOnline, user?.nama_pengguna, user?.email, user?.remote_customer_id])

  useEffect(() => {
    if (!user?.nama_pengguna) return

    // Realtime license-control via Firestore snapshots.
    const notifySync = () => window.dispatchEvent(new Event('license:sync-now'))
    const unsubscribe = subscribeLicense(
      {
        email: user.email ?? user.nama_pengguna,
        customerId: user.remote_customer_id ?? undefined,
      },
      () => notifySync(),
      () => {
        /* error listener (misal: belum Supabase-auth). Diabaikan; sync periodik tetap jalan. */
      },
    )

    return () => {
      unsubscribe()
    }
  }, [user?.nama_pengguna, user?.email, user?.remote_customer_id])

  // Auto-logout when session expires
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      const restored = restoreSession()
      if (!restored) {
        logout()
      }
    }, EXPIRY_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, logout])

  if (!storageReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="animate-pulse text-slate-400 text-sm">Memuat...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isDemo, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    return {
      user: null,
      isDemo: false,
      login: async () => false,
      logout: async () => {},
      refreshUser: async () => {},
    }
  }
  return ctx
}
