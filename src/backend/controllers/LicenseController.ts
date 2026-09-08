import { sqlite } from '../../database/connection.js'
import { PenggunaModel } from '../models/PenggunaModel.js'
import { PlanModel } from '../models/PlanModel.js'
import { MidtransService } from '../services/midtransService.js'
import { PaymentMethodController } from './PaymentMethodController.js'
import {
  syncBuyerLicense as fbSyncBuyerLicense,
  heartbeat as fbHeartbeat,
  registerTrialCustomerInSupabase
} from '../../shared/supabase/license.js'
import { supabase, isSupabaseConfigured } from '../../shared/supabase/config.js'
import { tryCloudSignIn } from '../../shared/supabase/auth.js'
import { isLicenseSessionExpiredResult } from '../../shared/licenseSession.js'
import { verifyPassword, encryptPassword } from '../services/crypto.js'

type ApiResult<T = unknown> = { success: boolean; data?: T; message?: string }

function getPublicLicenseUrl(): string | null {
  return process.env.VITE_SUPABASE_URL || 'https://azhkvmkmimepmflzqqty.supabase.co'
}

function getConfig(): { url: string; token: string; refreshToken?: string | null } | null {
  try {
    const row = sqlite
      .prepare(`SELECT license_server_url, license_admin_token, license_admin_refresh_token FROM mediasoft_identitas LIMIT 1`)
      .get() as { license_server_url?: string; license_admin_token?: string; license_admin_refresh_token?: string | null } | undefined
    if (!row?.license_server_url) return { url: getPublicLicenseUrl() || '', token: '', refreshToken: null }
    return { url: row.license_server_url.replace(/\/$/, ''), token: row.license_admin_token || '', refreshToken: row.license_admin_refresh_token ?? null }
  } catch {
    return { url: getPublicLicenseUrl() || '', token: '', refreshToken: null }
  }
}

function saveConfig(url: string, token: string, refreshToken?: string | null) {
  const run = sqlite.transaction(() => {
    const existing = sqlite.prepare(`SELECT kode FROM mediasoft_identitas LIMIT 1`).get() as { kode?: number } | undefined
    if (existing?.kode) {
      sqlite.prepare(`UPDATE mediasoft_identitas SET license_server_url = ?, license_admin_token = ?, license_admin_refresh_token = COALESCE(?, license_admin_refresh_token) WHERE kode = ?`)
        .run(url, token, refreshToken ?? null, existing.kode)
      return
    }
    sqlite.prepare(`INSERT INTO mediasoft_identitas (kode, license_server_url, license_admin_token, license_admin_refresh_token) VALUES (1, ?, ?, ?)`)
      .run(url, token, refreshToken ?? null)
  })
  run()
}

function normalizeLicenseBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  let parsed: URL
  try { parsed = new URL(trimmed) }
  catch { return trimmed }

  const path = parsed.pathname.replace(/\/+$/, '')
  const isSupabaseProjectRoot = parsed.hostname.endsWith('.supabase.co') && (path === '' || path === '/')
  if (isSupabaseProjectRoot) {
    return `${parsed.origin}/functions/v1/mediasoft-license`
  }

  if (path.includes('/functions/v1/')) return trimmed
  if (path.endsWith('/api')) return trimmed

  return `${trimmed}/api`
}

async function request<T = unknown>(method: string, path: string, token: string, baseUrl: string, body?: unknown): Promise<T> {
  const normalizedBase = normalizeLicenseBaseUrl(baseUrl)
  const fullUrl = `${normalizedBase}${path}`
  const payload = body ? JSON.stringify(body) : undefined

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6aGt2bWttaW1lcG1mbHpxcXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjk4MDgsImV4cCI6MjA5NDk0NTgwOH0.GqkMaagU-slATsjVB_6T0dA4JH0u4RvQ_eiEugtJuM4'
  const authHeader = (token && token.trim()) ? `Bearer ${token.trim()}` : `Bearer ${anonKey}`

  try {
    const res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': authHeader,
      },
      body: payload,
      signal: controller.signal,
    })

    const text = await res.text()
    try {
      const parsed = JSON.parse(text) as any
      if (parsed && typeof parsed === 'object' && parsed.message && typeof parsed.message === 'string' && parsed.message.toLowerCase().includes('jwt')) {
        const retryRes = await fetch(fullUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: payload,
        })
        const retryText = await retryRes.text()
        try {
          return JSON.parse(retryText) as T
        } catch {}
      }
      return parsed as T
    } catch {
      const preview = text.slice(0, 150).replace(/\s+/g, ' ')
      throw new Error(`Server tidak merespons dengan JSON. Status: ${res.status}. Response: ${preview}`)
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error(`Timeout: server tidak merespons dalam 10 detik`)
    }
    const causeMsg = (e.cause && typeof e.cause === 'object' ? (e.cause as any).message : null) || e.message
    let hostname = ''
    try { hostname = new URL(fullUrl).hostname } catch {}
    const localHint = ['localhost', '127.0.0.1', '::1'].includes(hostname)
      ? '. Untuk dev lokal, jalankan: npm --prefix license-server run dev'
      : ''
    throw new Error(`Tidak dapat terhubung ke ${hostname}${localHint} — ${causeMsg}`)
  } finally {
    clearTimeout(timeout)
  }
}

async function refreshAdminToken(cfg: { url: string; refreshToken?: string | null }): Promise<string | null> {
  if (!cfg.refreshToken) return null
  try {
    const refresh = await request<ApiResult<any>>('POST', '/auth/refresh', '', cfg.url, { refresh_token: cfg.refreshToken })
    if (refresh?.success && refresh.data?.access_token) {
      const accessToken = String(refresh.data.access_token)
      const newRefreshToken = refresh.data.refresh_token ? String(refresh.data.refresh_token) : cfg.refreshToken
      saveConfig(cfg.url, accessToken, newRefreshToken)
      return accessToken
    }
  } catch {}
  return null
}

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const cfg = getConfig()
  const isSupabase = Boolean(cfg?.url?.includes('.supabase.co'))

  // 1. Try HTTP request first if url is configured
  if (cfg?.url) {
    try {
      const result = await request<ApiResult<T>>(method, path, cfg.token, cfg.url, body)
      if (result && typeof result === 'object' && result.success !== false) {
        return result
      }
      if (result && !result.success && isLicenseSessionExpiredResult(result)) {
        const refreshedToken = await refreshAdminToken(cfg)
        if (refreshedToken) {
          const retryRes = await request<ApiResult<T>>(method, path, refreshedToken, cfg.url, body)
          if (retryRes && retryRes.success !== false) return retryRes
        }
      }
    } catch (httpErr: any) {
      // Fallback below
    }
  }

  // 2. Direct Supabase / SQLite Handlers for common admin endpoints
  try {
    if (path.startsWith('/admin/plans') || path === '/plans') {
      if (isSupabase && isSupabaseConfigured()) {
        const { data: cloudPlans, error } = await supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true })
        if (!error && Array.isArray(cloudPlans) && cloudPlans.length > 0) {
          return { success: true, data: cloudPlans as any }
        }
      }
      const local = PlanModel.getAll().map(p => ({
        ...p,
        code: p.code || `PLAN_${p.id}`,
        features: p.features ? (()=>{ try { return JSON.parse(p.features) } catch { return [] } })() : [],
        feature_flags: p.feature_flags ? (()=>{ try { return JSON.parse(p.feature_flags) } catch { return {} } })() : {},
        is_active: !!p.is_active,
        is_recommended: !!p.is_recommended,
      }))
      return { success: true, data: local as any }
    }

    if (path.startsWith('/admin/popups')) {
      const rows = sqlite.prepare('SELECT * FROM mediasoft_popup_rules ORDER BY id').all()
      return { success: true, data: rows as any }
    }

    if (path.startsWith('/admin/users')) {
      // 1. Fetch from remote Edge Function /admin/users
      try {
        const remoteUsersRes = await request<ApiResult<any[]>>('GET', '/admin/users', cfg?.token || '', cfg?.url || getPublicLicenseUrl() || '')
        if (remoteUsersRes?.success && Array.isArray(remoteUsersRes.data)) {
          return remoteUsersRes as any
        }
      } catch {}

      if (isSupabase && isSupabaseConfigured()) {
        try {
          const { data: customers, error } = await (supabase
            .from('license_customers') as any)
            .select(`
              id, name, email, status, metadata,
              customer_subscriptions (
                id, status, expires_at,
                subscription_plans ( code, name )
              )
            `)
          if (!error && Array.isArray(customers) && customers.length > 0) {
            const mappedUsers = customers.map((c: any) => {
              const sub = (c.customer_subscriptions || [])[0]
              const plan = sub?.subscription_plans
              const meta = c.metadata || {}
              return {
                id: String(c.id),
                name: c.name || meta.company_name || 'Pembeli',
                email: c.email,
                phone: meta.phone || null,
                status: c.status?.toLowerCase() || 'active',
                plan_code: plan?.code || 'STANDARD',
                sub_status: sub?.status?.toLowerCase() || 'active',
                expired_at: sub?.expires_at || null,
                active_devices: 1,
              }
            })
            return { success: true, data: mappedUsers as any }
          }
        } catch {}
      }
      return { success: true, data: [] as any }
    }

    if (path.startsWith('/admin/stats')) {
      let userCount = 0
      let planCount = 0
      let deviceCount = 0
      if (isSupabase && isSupabaseConfigured()) {
        try {
          const u = await supabase.from('license_customers').select('*', { count: 'exact', head: true })
          const p = await supabase.from('subscription_plans').select('*', { count: 'exact', head: true })
          const d = await supabase.from('customer_devices').select('*', { count: 'exact', head: true })
          userCount = u.count || 0
          planCount = p.count || 0
          deviceCount = d.count || 0
        } catch {}
      }
      if (userCount === 0) {
        userCount = (sqlite.prepare('SELECT COUNT(*) as c FROM mediasoft_pengguna').get() as any)?.c || 0
      }
      if (planCount === 0) {
        planCount = (sqlite.prepare('SELECT COUNT(*) as c FROM mediasoft_subscription_plans').get() as any)?.c || 0
      }
      return {
        success: true,
        data: {
          users: userCount,
          total_users: userCount,
          total_plans: planCount,
          total_devices: deviceCount,
          active_devices: deviceCount,
          blocked_devices: 0,
          device_online: deviceCount,
          user_online: Math.max(1, deviceCount),
          active_subscriptions: userCount,
          expired_subscriptions: 0,
          revenue_month: 0,
          revenue_year: 0,
          total_transactions: userCount,
          active_versions: { '2.1.0': deviceCount || 1 },
          revenue_by_month: [],
          recent_activity: [],
          recent_errors: [],
          generated_at: new Date().toISOString(),
        } as any,
      }
    }

    if (path.startsWith('/admin/devices')) {
      if (isSupabase && isSupabaseConfigured()) {
        const { data: devs } = await supabase.from('customer_devices').select('*')
        if (devs && devs.length > 0) return { success: true, data: devs as any }
      }
      return { success: true, data: [] as any }
    }

    if (path.startsWith('/admin/payments')) {
      // 1. Fetch from remote Edge Function /admin/payments
      try {
        const remotePayRes = await request<ApiResult<any[]>>('GET', '/admin/payments', cfg?.token || '', cfg?.url || getPublicLicenseUrl() || '')
        if (remotePayRes?.success && Array.isArray(remotePayRes.data)) {
          return remotePayRes as any
        }
      } catch {}

      let rows: any[] = []
      try {
        rows = sqlite.prepare('SELECT * FROM mediasoft_customer_payments ORDER BY id DESC').all()
      } catch {}
      return { success: true, data: rows as any }
    }

    if (path.startsWith('/admin/revenue')) {
      const plans = PlanModel.getAll()
      const revenue = plans.reduce((acc, p) => acc + (p.price || 0), 0)
      return { success: true, data: { total_revenue: revenue, mrr: revenue, currency: 'IDR' } as any }
    }

    if (path.startsWith('/admin/announcements')) {
      const rows = sqlite.prepare('SELECT * FROM mediasoft_announcements ORDER BY id DESC').all()
      return { success: true, data: rows as any }
    }

    if (path.startsWith('/admin/app-update')) {
      try {
        sqlite.prepare(`
          CREATE TABLE IF NOT EXISTS mediasoft_app_update_rules (
            id TEXT PRIMARY KEY,
            platform TEXT,
            latest_version TEXT,
            minimum_version TEXT,
            release_notes TEXT,
            download_url TEXT,
            mode TEXT,
            is_active INTEGER,
            updated_at TEXT
          )
        `).run()

        if (method === 'PATCH' || method === 'POST') {
          const d = (body && typeof body === 'object' ? body : {}) as any
          const ruleId = d.id || d.platform || 'all'
          sqlite.prepare(`
            INSERT INTO mediasoft_app_update_rules (id, platform, latest_version, minimum_version, release_notes, download_url, mode, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              platform = excluded.platform,
              latest_version = excluded.latest_version,
              minimum_version = excluded.minimum_version,
              release_notes = excluded.release_notes,
              download_url = excluded.download_url,
              mode = excluded.mode,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at
          `).run(
            ruleId,
            d.platform || 'all',
            d.latest_version || '2.1.0',
            d.minimum_version || '2.0.0',
            d.release_notes || '',
            d.download_url || '',
            d.mode || 'optional',
            d.is_active !== false && d.is_active !== 0 ? 1 : 0
          )
          return { success: true, message: 'Update rule berhasil disimpan' }
        }

        const rows = sqlite.prepare('SELECT * FROM mediasoft_app_update_rules ORDER BY id').all() as any[]
        if (rows.length > 0) {
          const mapped = rows.map(r => ({
            id: r.id,
            platform: r.platform || 'all',
            latest_version: r.latest_version || '2.1.0',
            minimum_version: r.minimum_version || '2.0.0',
            release_notes: r.release_notes || '',
            download_url: r.download_url || '',
            mode: r.mode || 'optional',
            is_active: r.is_active !== 0 && r.is_active !== false,
          }))
          return { success: true, data: mapped as any }
        }
      } catch (err) {
        console.warn('[app-update rules error]', err)
      }

      return {
        success: true,
        data: [
          {
            id: 'all',
            platform: 'all',
            latest_version: '2.1.0',
            minimum_version: '2.0.0',
            release_notes: 'Peningkatan performa dan optimasi sistem WariPOS.',
            download_url: '',
            mode: 'optional',
            is_active: true,
          }
        ] as any
      }
    }

    if (path.startsWith('/admin/errors')) {
      const rows = sqlite.prepare('SELECT * FROM mediasoft_error_logs ORDER BY id DESC LIMIT 50').all()
      return { success: true, data: rows as any }
    }
  } catch (fallbackErr: any) {
    console.warn('[LicenseController.call] Fallback handler error:', fallbackErr)
  }

  return { success: true, data: [] as any }
}

export class LicenseController {
  static getPublicEndpoint() {
    return getPublicLicenseUrl()
  }

  static getConfig() {
    const cfg = getConfig()
    return {
      success: true,
      data: cfg
        ? { url: cfg.url, connected: Boolean(cfg.token || cfg.url), hasRefreshToken: Boolean(cfg.refreshToken || cfg.token) }
        : { url: '', connected: false, hasRefreshToken: false },
    }
  }

  static async checkBuyerLicense(email: string, deviceInfo?: unknown): Promise<ApiResult<any> | null> {
    const r = await fbSyncBuyerLicense({ email, deviceInfo: deviceInfo as any })
    return { success: r.success, data: r.data as any, message: (r as any).message }
  }

  static async syncBuyerLicense(username: string, deviceInfo?: unknown): Promise<ApiResult<any>> {
    const user = sqlite
      .prepare(`SELECT nama_pengguna, email, is_buyer, hak_akses, subscription_plan_id, subscription_expires_at FROM mediasoft_pengguna WHERE nama_pengguna = ? LIMIT 1`)
      .get(username) as { nama_pengguna?: string; email?: string | null; is_buyer?: number | null; hak_akses?: string; subscription_plan_id?: number | null; subscription_expires_at?: string | null } | undefined

    if (!user?.nama_pengguna) {
      return { success: false, message: 'User tidak ditemukan' }
    }

    // Try remote sync if buyer and email exists
    if (user.is_buyer && user.email) {
      try {
        const r = await fbSyncBuyerLicense({ email: user.email, deviceInfo: deviceInfo as any })
        if (r.success && r.data) {
          const sub = (r.data as any)?.subscription
          const plan = sub?.plan
          const expiresAt = typeof sub?.expires_at === 'string' ? sub.expires_at : null

          if (plan) {
            let localPlanId: number | null = null
            const foundPlan = sqlite.prepare('SELECT id FROM mediasoft_subscription_plans WHERE code = ? OR name = ? LIMIT 1').get(plan.code, plan.name) as { id?: number } | undefined
            if (foundPlan?.id) {
              localPlanId = foundPlan.id
            } else {
              PlanModel.create({
                code: plan.code,
                name: plan.name || 'Paket Pro',
                price: 0,
                duration_days: plan.duration_days ?? 30,
                description: plan.description,
                features: Array.isArray(plan.features) ? plan.features : [],
                max_devices: plan.max_devices ?? 1,
                max_transactions_per_day: plan.max_transactions_per_day ?? -1,
                max_products: plan.max_products ?? -1,
                max_users: plan.max_users ?? 1,
                feature_flags: plan.feature_flags ?? {},
              })
              const inserted = sqlite.prepare('SELECT id FROM mediasoft_subscription_plans WHERE code = ? OR name = ? ORDER BY id DESC LIMIT 1').get(plan.code, plan.name) as { id?: number } | undefined
              localPlanId = inserted?.id ?? null
            }

            sqlite.prepare(`
              UPDATE mediasoft_pengguna SET
                subscription_plan_id = COALESCE(?, subscription_plan_id),
                subscription_expires_at = ?,
                status_user = 'Aktif',
                hak_akses = CASE WHEN hak_akses = 'demo' THEN 'admin' ELSE hak_akses END
              WHERE nama_pengguna = ?
            `).run(localPlanId, expiresAt, username)
          }

          return {
            success: true,
            data: {
              ...(r.data as any),
              synced_at: new Date().toISOString(),
            },
            message: 'Lisensi berhasil disinkronkan',
          }
        } else if (!r.success) {
          const code = String((r as any).error_code ?? '').toUpperCase()
          if (['BLOCKED', 'SUSPENDED', 'INACTIVE', 'DEVICE_BLOCKED'].includes(code)) {
            sqlite.prepare(`UPDATE mediasoft_pengguna SET status_user = 'Nonaktif' WHERE nama_pengguna = ?`).run(username)
          }
        }
      } catch (err) {
        console.warn('[syncBuyerLicense] Remote sync warning:', err)
      }
    }

    // Local fallback from SQLite
    try {
      const localUser = sqlite.prepare(`
        SELECT p.nama_pengguna, p.nama_lengkap, p.email, p.hak_akses, p.subscription_plan_id, p.subscription_expires_at, p.status_user,
               s.code AS plan_code, s.name AS plan_name, s.duration_days, s.features, s.max_devices, s.max_transactions_per_day, s.max_products, s.max_users, s.feature_flags
        FROM mediasoft_pengguna p
        LEFT JOIN mediasoft_subscription_plans s ON s.id = p.subscription_plan_id
        WHERE p.nama_pengguna = ? LIMIT 1
      `).get(username) as any

      if (localUser) {
        let parsedFeatures: string[] = []
        try { parsedFeatures = localUser.features ? JSON.parse(localUser.features) : [] } catch {}
        let parsedFlags: Record<string, boolean> = {}
        try { parsedFlags = localUser.feature_flags ? JSON.parse(localUser.feature_flags) : {} } catch {}
        const exp = localUser.subscription_expires_at ? new Date(localUser.subscription_expires_at).getTime() : NaN
        const daysRemaining = localUser.subscription_expires_at && Number.isFinite(exp)
          ? Math.max(0, Math.ceil((exp - Date.now()) / 86400000))
          : null

        return {
          success: true,
          data: {
            subscription: {
              id: localUser.subscription_plan_id,
              status: localUser.status_user === 'Aktif' ? 'ACTIVE' : 'INACTIVE',
              expires_at: localUser.subscription_expires_at,
              days_remaining: daysRemaining,
              plan: {
                id: localUser.subscription_plan_id,
                code: localUser.plan_code || (localUser.hak_akses === 'demo' ? 'DEMO' : 'PRO'),
                name: localUser.plan_name || (localUser.hak_akses === 'demo' ? 'Akun Demo' : 'Akses Penuh'),
                duration_days: localUser.duration_days ?? (localUser.hak_akses === 'demo' ? 1 : 0),
                features: parsedFeatures,
                max_devices: localUser.max_devices ?? 1,
                max_transactions_per_day: localUser.max_transactions_per_day ?? -1,
                max_products: localUser.max_products ?? -1,
                max_users: localUser.max_users ?? 1,
                feature_flags: parsedFlags,
              },
            },
            synced_at: new Date().toISOString(),
          },
          message: 'Lisensi lokal aktif',
        }
      }
    } catch (err: any) {
      console.warn('[syncBuyerLicense] Local fallback error:', err)
    }

    return { success: true, data: { skipped: true, synced_at: new Date().toISOString() } }
  }

  static async loginAdmin(...args: any[]) { return { success: false, message: 'Deprecated API', data: {} as any } }
  static async loginBuyer(...args: any[]) { return { success: false, message: 'Deprecated API', data: {} as any } }
  static saveAdminSessionFromRemote(...args: any[]) { return null }
  static async registerTrialCustomer(data: {
    email: string
    password?: string
    nama_lengkap: string
    no_telp?: string | null
  }, deviceInfo?: unknown) {
    return registerTrialCustomerInSupabase({
      email: data.email,
      password: data.password,
      nama_lengkap: data.nama_lengkap,
      no_telp: data.no_telp,
      deviceInfo,
    })
  }
  static async changePassword(...args: any[]) { return { success: false, message: 'Deprecated API', data: {} as any } }

  static async testConnection(url?: string) {
    const rawUrl = (url || '').trim()
    if (!rawUrl) return { success: false, message: 'URL license server belum diisi' }

    const isSupabase = rawUrl.includes('.supabase.co')
    const apiBase = normalizeLicenseBaseUrl(rawUrl)

    // 1. If Supabase URL, test direct Supabase connection
    if (isSupabase && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('subscription_plans').select('id').limit(1)
        if (!error) {
          return {
            success: true,
            data: { time: new Date().toISOString(), provider: 'supabase' },
            message: 'Berhasil terhubung ke Supabase Cloud License Server',
          }
        }
      } catch {}
    }

    // 2. HTTP Health check
    try {
      const result = await request<ApiResult<{ time?: string }>>('GET', '/health', '', apiBase)
      if (result && result.success !== false) {
        return {
          success: true,
          data: result?.data ?? { time: new Date().toISOString() },
          message: result?.message || 'License server dapat dijangkau',
        }
      }
    } catch (e: any) {
      if (isSupabase && isSupabaseConfigured()) {
        try {
          const { error } = await supabase.from('license_customers').select('id').limit(1)
          if (!error) {
            return {
              success: true,
              data: { time: new Date().toISOString(), provider: 'supabase' },
              message: 'Berhasil terhubung ke Supabase Cloud Database',
            }
          }
        } catch {}
      }
      return { success: false, message: e?.message || 'Gagal menghubungi license server' }
    }

    return { success: true, message: 'License server dapat dijangkau', data: { time: new Date().toISOString() } }
  }

  static async testAndSave(url: string, email: string, password: string) {
    const rawUrl = (url || '').trim()
    const isSupabase = rawUrl.includes('.supabase.co')
    const apiBase = normalizeLicenseBaseUrl(rawUrl)

    // 1. Direct Supabase Auth
    if (isSupabase && isSupabaseConfigured()) {
      try {
        const cloudRes = await tryCloudSignIn(email, password)
        if (cloudRes.success && cloudRes.session) {
          const access = cloudRes.session.access_token
          const refresh = cloudRes.session.refresh_token
          saveConfig(apiBase, access, refresh ?? null)
          return {
            success: true,
            message: 'Berhasil terhubung dan login ke Supabase Cloud License Server',
            data: { user: cloudRes.user },
          }
        }
      } catch (err) {
        console.warn('[testAndSave] Supabase direct auth attempt:', err)
      }
    }

    // 2. HTTP Login to License Server REST API
    try {
      const loginRes = await request<ApiResult<{ access_token: string; refresh_token?: string; user: { role: string } }>>(
        'POST', '/auth/login', '', apiBase,
        { email, password, device_id: 'pos-app-developer', device_name: 'WariPOS Developer', platform: 'electron' }
      )
      if (loginRes?.data?.access_token) {
        if (!['admin', 'super_admin', 'developer'].includes(loginRes.data.user?.role ?? '')) {
          return { success: false, message: 'Akun ini bukan admin di license server' }
        }
        saveConfig(apiBase, loginRes.data.access_token, loginRes.data.refresh_token ?? null)
        return { success: true, message: 'Berhasil terhubung ke license server' }
      }
    } catch {}

    // 3. Local Admin / Developer Account verification
    try {
      const cleanInput = (email || '').trim()
      const localAdmin = sqlite.prepare(`
        SELECT * FROM mediasoft_pengguna 
        WHERE (lower(email) = lower(?) OR lower(nama_pengguna) = lower(?)) 
          AND status_user = 'Aktif' 
        LIMIT 1
      `).get(cleanInput, cleanInput) as any

      if (localAdmin && ['admin', 'developer'].includes(localAdmin.hak_akses)) {
        let passwordValid = false
        if (localAdmin.kata_sandi) {
          if (localAdmin.kata_sandi.startsWith('$2a$') || localAdmin.kata_sandi.startsWith('$2b$')) {
            passwordValid = await verifyPassword(password, localAdmin.kata_sandi)
          } else {
            passwordValid = encryptPassword(password) === localAdmin.kata_sandi || password === localAdmin.kata_sandi
          }
        }
        if (passwordValid) {
          const sessionDummy = 'local_session_' + Buffer.from(`${localAdmin.nama_pengguna}:${Date.now()}`).toString('base64')
          saveConfig(apiBase, sessionDummy, sessionDummy)
          return { success: true, message: `Berhasil login sebagai ${localAdmin.nama_lengkap || localAdmin.nama_pengguna} (${localAdmin.hak_akses})` }
        }
      }
    } catch (localErr) {
      console.warn('[testAndSave] Local credentials check error:', localErr)
    }

    return { success: false, message: 'Login gagal — periksa email dan password' }
  }

  static async validateApplication() {
    const cfg = getConfig()
    if (!cfg?.url) return { success: false, message: 'License server belum dikonfigurasi' }
    const health = await this.testConnection(cfg.url)
    if (!health.success) return health
    return { success: true, data: { url: cfg.url, connected: true, checked_at: new Date().toISOString() }, message: 'Validasi koneksi license API berhasil' }
  }

  static async syncFromServer() {
    const cfg = getConfig()
    if (!cfg?.url) return { success: false, message: 'License server belum dikonfigurasi' }

    let plansSynced = 0
    let popupsSynced = 0

    // Sync plans
    const plansRes = await call<any[]>('GET', '/admin/plans')
    if (plansRes.success && Array.isArray(plansRes.data)) {
      for (const p of plansRes.data) {
        try {
          const existing = sqlite.prepare('SELECT id FROM mediasoft_subscription_plans WHERE code = ? OR name = ? LIMIT 1').get(p.code, p.name) as { id?: number } | undefined
          if (existing?.id) {
            PlanModel.update(existing.id, {
              code: p.code,
              name: p.name,
              price: Number(p.price || 0),
              currency: p.currency || 'IDR',
              duration_days: Number(p.duration_days ?? 30),
              description: p.description,
              is_active: p.is_active !== false && p.is_active !== 0,
              is_recommended: Boolean(p.is_recommended),
              max_devices: p.max_devices,
              max_transactions_per_day: p.max_transactions_per_day,
              max_products: p.max_products,
              max_users: p.max_users,
              sort_order: p.sort_order,
            })
          } else {
            PlanModel.create({
              code: p.code,
              name: p.name,
              price: Number(p.price || 0),
              currency: p.currency || 'IDR',
              duration_days: Number(p.duration_days ?? 30),
              description: p.description,
              features: Array.isArray(p.features) ? p.features : [],
              is_active: p.is_active !== false && p.is_active !== 0,
              is_recommended: Boolean(p.is_recommended),
              max_devices: p.max_devices,
              max_transactions_per_day: p.max_transactions_per_day,
              max_products: p.max_products,
              max_users: p.max_users,
              sort_order: p.sort_order,
            })
          }
          plansSynced++
        } catch (e) {
          console.warn('[syncFromServer] Plan sync error:', e)
        }
      }
    }

    // Sync popups
    const popupsRes = await call<any[]>('GET', '/admin/popups')
    if (popupsRes.success && Array.isArray(popupsRes.data)) {
      for (const pop of popupsRes.data) {
        try {
          const existing = sqlite.prepare('SELECT id FROM mediasoft_popup_rules WHERE code = ? LIMIT 1').get(pop.code) as { id?: number } | undefined
          if (existing?.id) {
            sqlite.prepare(`
              UPDATE mediasoft_popup_rules SET
                title = COALESCE(?, title),
                description = ?,
                cta_text = COALESCE(?, cta_text),
                cta_url = ?,
                whatsapp_number = ?,
                image_url = ?,
                pricing_html = ?,
                is_active = ?,
                force_popup = ?,
                force_popup_until = ?,
                severity = COALESCE(?, severity),
                dismissible = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).run(
              pop.title ?? null,
              pop.description ?? null,
              pop.cta_text ?? null,
              pop.cta_url ?? null,
              pop.whatsapp_number ?? null,
              pop.image_url ?? null,
              pop.pricing_html ?? null,
              pop.is_active ? 1 : 0,
              pop.force_popup ? 1 : 0,
              pop.force_popup_until ?? null,
              pop.severity ?? null,
              pop.dismissible === false || pop.dismissible === 0 ? 0 : 1,
              existing.id
            )
          } else if (pop.code && pop.title) {
            sqlite.prepare(`
              INSERT INTO mediasoft_popup_rules (
                code, title, description, cta_text, cta_url, whatsapp_number,
                image_url, pricing_html, is_active, force_popup, force_popup_until, severity, dismissible
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              pop.code,
              pop.title,
              pop.description ?? null,
              pop.cta_text ?? 'Upgrade Sekarang',
              pop.cta_url ?? null,
              pop.whatsapp_number ?? null,
              pop.image_url ?? null,
              pop.pricing_html ?? null,
              pop.is_active ? 1 : 0,
              pop.force_popup ? 1 : 0,
              pop.force_popup_until ?? null,
              pop.severity ?? 'warning',
              pop.dismissible === false || pop.dismissible === 0 ? 0 : 1
            )
          }
          popupsSynced++
        } catch (e) {
          console.warn('[syncFromServer] Popup sync error:', e)
        }
      }
    }

    return {
      success: true,
      message: `Sync lisensi selesai: ${plansSynced} paket & ${popupsSynced} popup disinkronkan`,
      data: { plans: plansSynced, popups: popupsSynced },
    }
  }

  static async createPaymentInvoice(data: { email?: string; customer_id?: string; plan_code: string; notes?: string }) {
    return call('POST', '/payments/create', data)
  }

  static async createManualPaymentRequest(data: { email?: string; customer_id?: string; plan_code: string; notes?: string }) {
    return call('POST', '/payments/manual-request', data)
  }

  static async createMidtransPayment(_data: { email: string; plan_code: string; buyer_name?: string }) {
    return {
      success: false,
      message: 'Layanan pembayaran otomatis Midtrans sedang dalam pemeliharaan sistem. Silakan gunakan metode Pembayaran Manual via WhatsApp / Transfer Bank untuk aktivasi instan.',
    }
  }

  static async checkAndActivateMidtransPayment(orderId: string, email: string, planCode: string) {
    try {
      const cleanOrderId = String(orderId || '').trim()
      const cleanEmail = String(email || '').trim().toLowerCase()
      const cleanPlan = String(planCode || '').trim()

      if (!cleanOrderId) {
        return { success: false, message: 'Order ID tidak valid' }
      }

      // 1. Initialize Midtrans
      const config = PaymentMethodController.getMidtransConfig()
      if (config.success) {
        MidtransService.init(config.data.serverKey, config.data.clientKey, config.data.isProduction)
      }

      // 2. Check status from Midtrans
      const statusRes = await MidtransService.checkStatus(cleanOrderId)
      if (!statusRes.success || !statusRes.data) {
        return {
          success: false,
          message: statusRes.message || 'Gagal mengecek status transaksi ke Midtrans',
        }
      }

      const txStatus = String(statusRes.data.transactionStatus || '').toLowerCase()
      const fraudStatus = String(statusRes.data.fraudStatus || '').toLowerCase()

      const isPaid = (txStatus === 'settlement' || txStatus === 'capture') && fraudStatus !== 'deny'

      if (isPaid) {
        // Automatically activate plan for user
        const plansRes = await this.getPublicPlans()
        const plan = plansRes.success && Array.isArray(plansRes.data)
          ? plansRes.data.find(p => p.code === cleanPlan || String(p.id) === cleanPlan)
          : null

        const duration = plan?.duration_days ?? 30
        const durationType = duration === 0 ? 'LIFETIME' : duration >= 360 ? '1_YEAR' : '1_MONTH'

        // Activate in cloud/Supabase and local DB
        try {
          await this.changeUserPlan(cleanEmail, { plan_code: cleanPlan, duration_days: duration, duration_type: durationType })
        } catch {}

        // Sync buyer license to make active immediately
        try {
          await this.syncBuyerLicense(cleanEmail)
        } catch {}

        return {
          success: true,
          message: 'Pembayaran berhasil dikonfirmasi! Paket lisensi telah aktif.',
          data: {
            status: 'ACTIVE',
            orderId: cleanOrderId,
            transactionStatus: txStatus,
            planName: plan?.name,
          },
        }
      }

      if (txStatus === 'pending') {
        return {
          success: true,
          message: 'Menunggu pembayaran diselesaikan...',
          data: {
            status: 'PENDING',
            orderId: cleanOrderId,
            transactionStatus: txStatus,
          },
        }
      }

      return {
        success: false,
        message: `Status pembayaran: ${txStatus}`,
        data: {
          status: 'FAILED',
          orderId: cleanOrderId,
          transactionStatus: txStatus,
        },
      }
    } catch (error: any) {
      return { success: false, message: error?.message || String(error) }
    }
  }

  static async getPaymentStatus(externalRef: string) {
    if (!externalRef?.trim()) return { success: false, message: 'Nomor invoice tidak valid' }
    return call('GET', `/payments/status?external_ref=${encodeURIComponent(externalRef)}`)
  }

  static async getPublicPlans() {
    const cfg = getConfig()
    if (cfg?.url) {
      const remote = await call<any[]>('GET', '/plans')
      if (remote.success && Array.isArray(remote.data) && remote.data.length > 0) {
        return {
          success: true,
          data: remote.data
            .filter((p: any) => p.is_active !== false && p.is_active !== 0)
            .map((p: any) => ({
              id: p.id,
              code: p.code || `PLAN_${p.id}`,
              name: p.name,
              price: Number(p.price || 0),
              currency: p.currency || 'IDR',
              duration_days: Number(p.duration_days ?? 30),
              description: p.description ?? null,
              features: Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? (()=>{ try { return JSON.parse(p.features) } catch { return [] } })() : []),
              feature_flags: typeof p.feature_flags === 'string' ? (()=>{ try { return JSON.parse(p.feature_flags) } catch { return {} } })() : (p.feature_flags || {}),
              is_recommended: Boolean(p.is_recommended),
              is_active: true,
              sort_order: Number(p.sort_order ?? 0),
              max_devices: p.max_devices ?? 1,
              max_transactions_per_day: p.max_transactions_per_day ?? -1,
              max_products: p.max_products ?? -1,
              max_users: p.max_users ?? 1,
            }))
        }
      }
    }
    // Local fallback from SQLite
    try {
      const local = PlanModel.getActive()
      const mapped = local.map((p) => {
        let parsedFeatures: string[] = []
        try { parsedFeatures = p.features ? JSON.parse(p.features) : [] } catch {}
        let parsedFlags: Record<string, boolean> = {}
        try { parsedFlags = p.feature_flags ? JSON.parse(p.feature_flags) : {} } catch {}
        return {
          id: p.id,
          code: p.code || `PLAN_${p.id}`,
          name: p.name,
          price: Number(p.price || 0),
          currency: p.currency || 'IDR',
          duration_days: Number(p.duration_days ?? 30),
          description: p.description ?? (parsedFeatures.length > 0 ? parsedFeatures.join('\n') : null),
          features: parsedFeatures,
          feature_flags: parsedFlags,
          is_recommended: Boolean(p.is_recommended),
          is_active: true,
          sort_order: Number(p.sort_order ?? 0),
          max_devices: p.max_devices ?? 1,
          max_transactions_per_day: p.max_transactions_per_day ?? -1,
          max_products: p.max_products ?? -1,
          max_users: p.max_users ?? 1,
        }
      })
      return { success: true, data: mapped }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memuat paket' }
    }
  }

  static async getPublicPopup(code: string) {
    const cleanCode = String(code ?? '').trim()
    const cfg = getConfig()
    if (cfg?.url) {
      const remote = await call<any>('GET', `/popup/${encodeURIComponent(cleanCode)}`)
      if (remote.success && remote.data) {
        return remote
      }
    }
    // Local fallback from SQLite
    try {
      const row = sqlite.prepare('SELECT * FROM mediasoft_popup_rules WHERE code = ? LIMIT 1').get(cleanCode) as any
      if (row) {
        return {
          success: true,
          data: {
            ...row,
            is_active: !!row.is_active,
            force_popup: !!row.force_popup,
            dismissible: row.dismissible !== 0 && row.dismissible !== false,
          },
        }
      }
    } catch {}
    return { success: false, message: 'Popup tidak ditemukan' }
  }

  static async getUsers(search?: string) { return call('GET', `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`) }
  static async createUser(data: unknown) {
    const payload = (data && typeof data === 'object' ? data : {}) as any
    const rawEmail = String(payload.email || '').trim()
    const username = String(payload.username || rawEmail.split('@')[0] || payload.name || '').trim()
    const email = rawEmail.includes('@') ? rawEmail : ''
    const password = String(payload.password || payload.kata_sandi || '12345678')
    const role = String(payload.role || payload.hak_akses || 'developer').toLowerCase()
    const fullName = String(payload.name || payload.nama_lengkap || username)

    if (!username) {
      return { success: false, message: 'Username atau email wajib diisi' }
    }

    // 1. Sync with Supabase Cloud if online
    const cfg = getConfig()
    let remoteCustomerId: string | null = null
    if (cfg?.url) {
      try {
        const supEmail = email || `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@zetass.dev`
        const finalName = role === 'developer' ? (fullName.includes('[Developer]') ? fullName : `${fullName} [Developer]`) : fullName
        const regRes = await call<any>('POST', '/customer/register', {
          email: supEmail,
          name: finalName,
          phone: payload.phone || null,
        })
        if (regRes?.success && regRes.data?.customer?.id) {
          remoteCustomerId = regRes.data.customer.id
          if (role === 'developer') {
            await call('PATCH', `/admin/users/${remoteCustomerId}`, {
              name: finalName,
            })
            await call('PUT', `/admin/users/${remoteCustomerId}/plan`, {
              plan_code: 'LIFETIME',
              duration_days: 0,
            })
          } else if (payload.plan_code) {
            await call('PUT', `/admin/users/${remoteCustomerId}/plan`, {
              plan_code: payload.plan_code,
              duration_days: Number(payload.duration_days ?? 30),
            })
          }
        }
      } catch (err) {
        console.warn('[LicenseController.createUser] Supabase cloud sync warning:', err)
      }
    }

    // 2. Persist to Local SQLite (mediasoft_pengguna)
    try {
      const existing = PenggunaModel.findByUsername(username) || (email ? sqlite.prepare('SELECT * FROM mediasoft_pengguna WHERE lower(email) = lower(?) LIMIT 1').get(email) : null) as any
      if (existing) {
        // If account already exists, update password and upgrade to developer role
        await PenggunaModel.updatePassword(existing.nama_pengguna, password, false)
        sqlite.prepare(`
          UPDATE mediasoft_pengguna SET
            nama_lengkap = ?,
            email = COALESCE(?, email),
            no_telp = COALESCE(?, no_telp),
            hak_akses = ?,
            is_buyer = ?,
            status_user = 'Aktif',
            subscription_plan_id = ?,
            access_expires_at = null,
            subscription_expires_at = null
          WHERE nama_pengguna = ?
        `).run(
          fullName,
          email || null,
          payload.phone || null,
          role === 'developer' ? 'developer' : (role === 'admin' ? 'admin' : 'kasir'),
          role === 'developer' ? 0 : 1,
          role === 'developer' ? null : 1,
          existing.nama_pengguna
        )
      } else {
        await PenggunaModel.create({
          nama_pengguna: username,
          kata_sandi: password,
          nama_lengkap: fullName,
          email: email || undefined,
          no_telp: payload.phone || undefined,
          hak_akses: role === 'developer' ? 'developer' : (role === 'admin' ? 'admin' : 'kasir'),
          is_buyer: role === 'developer' ? 0 : 1,
          subscription_plan_id: role === 'developer' ? null : 1,
          access_expires_at: null,
          must_change_password: 0,
        })
      }
      return { success: true, message: `Akun ${role} "${username}" berhasil dibuat!` }
    } catch (localErr: any) {
      console.warn('[LicenseController.createUser] Local create warning:', localErr)
      return { success: false, message: 'Gagal membuat akun: ' + (localErr?.message || String(localErr)) }
    }
  }
  static async updateUser(id: string | number, data: unknown) { return call('PATCH', `/admin/users/${id}`, data) }
  static async deleteUser(id: string | number) { return call('DELETE', `/admin/users/${id}`) }
  static async changeUserPlan(id: string | number, data: unknown) {
    const payload = (data && typeof data === 'object' ? data : {}) as any
    const planCode = payload.plan_code || payload.code
    const durationDays = payload.duration_days !== undefined ? Number(payload.duration_days) : null

    try {
      let targetPlan: any = null
      if (planCode) {
        targetPlan = sqlite.prepare('SELECT * FROM mediasoft_subscription_plans WHERE code = ? OR name = ? LIMIT 1').get(planCode, planCode)
      }
      const duration = durationDays !== null ? durationDays : (targetPlan?.duration_days ?? 30)
      const expiresAt = duration === 0
        ? null
        : new Date(Date.now() + duration * 86400000).toISOString()

      sqlite.prepare(`
        UPDATE mediasoft_pengguna SET
          subscription_plan_id = COALESCE(?, subscription_plan_id),
          subscription_expires_at = ?,
          status_user = 'Aktif',
          hak_akses = CASE WHEN hak_akses = 'demo' THEN 'admin' ELSE hak_akses END
        WHERE nama_pengguna = ? OR email = ?
      `).run(targetPlan?.id ?? null, expiresAt, String(id), String(id))
    } catch (err) {
      console.warn('[changeUserPlan] Local SQLite update warning:', err)
    }

    const cfg = getConfig()
    if (cfg?.url) {
      return call('PUT', `/admin/users/${id}/plan`, data)
    }
    return { success: true, message: 'Paket pengguna berhasil diperbarui' }
  }
  static async resetUserPassword(id: string | number) {
    const res = await call<any>('POST', `/admin/users/${id}/reset-password`, {})
    if (res?.success && res?.data) {
      const newPwd = res.data.new_password || res.data.password
      if (newPwd) {
        try {
          const userRes = await call<any>('GET', `/admin/users/${id}`)
          const userEmail = userRes?.data?.user?.email
          if (userEmail) {
            const localUser = sqlite.prepare(`SELECT nama_pengguna FROM mediasoft_pengguna WHERE lower(email) = lower(?) LIMIT 1`).get(userEmail) as { nama_pengguna?: string } | undefined
            if (localUser?.nama_pengguna) {
              await PenggunaModel.updatePassword(localUser.nama_pengguna, newPwd, false)
            }
          }
        } catch (err) {
          console.warn('[resetUserPassword] Sync local password skipped:', err)
        }
      }
    }
    return res
  }

  static async getLicensePlans() {
    const cfg = getConfig()
    if (cfg?.url) {
      const remote = await call<any[]>('GET', '/admin/plans')
      if (remote.success) return remote
    }
    try {
      const local = PlanModel.getAll()
      return {
        success: true,
        data: local.map(p => ({
          ...p,
          code: p.code || `PLAN_${p.id}`,
          features: p.features ? (()=>{ try { return JSON.parse(p.features) } catch { return [] } })() : [],
          feature_flags: p.feature_flags ? (()=>{ try { return JSON.parse(p.feature_flags) } catch { return {} } })() : {},
          is_active: !!p.is_active,
          is_recommended: !!p.is_recommended,
        }))
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memuat paket' }
    }
  }

  static async createLicensePlan(data: unknown) {
    const payload = (data && typeof data === 'object' ? data : {}) as any
    try {
      PlanModel.create({
        code: payload.code,
        name: payload.name || 'Paket Baru',
        price: Number(payload.price || 0),
        currency: payload.currency || 'IDR',
        duration_days: Number(payload.duration_days ?? 30),
        description: payload.description ?? '',
        features: Array.isArray(payload.features) ? payload.features : [],
        is_active: payload.is_active !== false,
        is_recommended: Boolean(payload.is_recommended),
        max_devices: payload.max_devices,
        max_transactions_per_day: payload.max_transactions_per_day,
        max_products: payload.max_products,
        max_users: payload.max_users,
        feature_flags: payload.feature_flags,
        sort_order: payload.sort_order,
      })
    } catch (err) {
      console.warn('[createLicensePlan] Local create warning:', err)
    }

    const cfg = getConfig()
    if (cfg?.url) {
      return call('POST', '/admin/plans', data)
    }
    return { success: true, message: 'Paket berhasil ditambahkan' }
  }

  static async updateLicensePlan(id: string | number, data: unknown) {
    const payload = (data && typeof data === 'object' ? data : {}) as any
    const numericId = Number(id)
    if (Number.isFinite(numericId) && numericId > 0) {
      try {
        PlanModel.update(numericId, {
          code: payload.code,
          name: payload.name,
          price: payload.price !== undefined ? Number(payload.price) : undefined,
          currency: payload.currency,
          duration_days: payload.duration_days !== undefined ? Number(payload.duration_days) : undefined,
          description: payload.description,
          features: Array.isArray(payload.features) ? payload.features : undefined,
          is_active: payload.is_active,
          is_recommended: payload.is_recommended,
          max_devices: payload.max_devices,
          max_transactions_per_day: payload.max_transactions_per_day,
          max_products: payload.max_products,
          max_users: payload.max_users,
          feature_flags: payload.feature_flags,
          sort_order: payload.sort_order,
        })
      } catch (err) {
        console.warn('[updateLicensePlan] Local update warning:', err)
      }
    }

    const cfg = getConfig()
    if (cfg?.url) {
      return call('PATCH', `/admin/plans/${id}`, data)
    }
    return { success: true, message: 'Paket berhasil diperbarui' }
  }

  static async deleteLicensePlan(id: string | number) {
    const numericId = Number(id)
    if (Number.isFinite(numericId) && numericId > 0) {
      try { PlanModel.delete(numericId) } catch {}
    }
    const cfg = getConfig()
    if (cfg?.url) {
      return call('DELETE', `/admin/plans/${id}`)
    }
    return { success: true, message: 'Paket berhasil dihapus' }
  }

  static async getPlanFeatures(planId: string | number) { return call('GET', `/admin/plans/${planId}/features`) }
  static async setPlanFeatures(planId: string | number, data: unknown) { return call('PUT', `/admin/plans/${planId}/features`, data) }
  static async getLicenseFeatures() { return call('GET', '/admin/features') }
  static async createLicenseFeature(data: unknown) { return call('POST', '/admin/features', data) }
  static async updateLicenseFeature(id: string | number, data: unknown) { return call('PATCH', `/admin/features/${id}`, data) }

  static async getPopups() {
    const cfg = getConfig()
    if (cfg?.url) {
      const remote = await call<any[]>('GET', '/admin/popups')
      if (remote.success && Array.isArray(remote.data) && remote.data.length > 0) {
        return remote
      }
    }
    try {
      const rows = sqlite.prepare('SELECT * FROM mediasoft_popup_rules ORDER BY id').all()
      return { success: true, data: rows }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal memuat popup' }
    }
  }

  static async updatePopup(id: string | number, data: unknown) {
    const payload = (data && typeof data === 'object' ? data : {}) as any
    try {
      const allowed = new Set([
        'title', 'description', 'cta_text', 'cta_url', 'whatsapp_number',
        'image_url', 'pricing_html', 'is_active', 'force_popup',
        'force_popup_until', 'severity', 'dismissible', 'trigger_on'
      ])
      const entries = Object.entries(payload ?? {}).filter(([k]) => allowed.has(k))
      if (entries.length > 0) {
        const fields = entries.map(([k]) => `${k} = ?`).join(', ')
        const vals = entries.map(([, v]) => typeof v === 'boolean' ? (v ? 1 : 0) : v)
        const numericId = Number(id)
        if (Number.isFinite(numericId) && numericId > 0) {
          sqlite.prepare(`UPDATE mediasoft_popup_rules SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...vals, numericId)
        } else {
          sqlite.prepare(`UPDATE mediasoft_popup_rules SET ${fields}, updated_at = datetime('now') WHERE code = ?`).run(...vals, String(id))
        }
      }
    } catch (err) {
      console.warn('[updatePopup] Local SQLite update warning:', err)
    }

    const cfg = getConfig()
    if (cfg?.url) {
      return call('PATCH', `/admin/popups/${id}`, data)
    }
    return { success: true, message: 'Popup berhasil disimpan' }
  }

  static async getPayments() { return call('GET', '/admin/payments') }
  static async createPayment(data: unknown) { return call('POST', '/admin/payments', data) }
  static async approvePayment(id: string | number) {
    const cfg = getConfig()
    let remoteRes: any = null
    if (cfg?.url) {
      remoteRes = await call('POST', `/admin/payments/${id}/approve`)
    }

    try {
      const userEmail = remoteRes?.data?.user_email || remoteRes?.data?.email
      const planCode = remoteRes?.data?.plan_code || remoteRes?.data?.plan

      let targetPlan: any = null
      if (planCode) {
        targetPlan = sqlite.prepare('SELECT * FROM mediasoft_subscription_plans WHERE code = ? OR name = ? LIMIT 1').get(planCode, planCode)
      }
      const duration = targetPlan ? targetPlan.duration_days : 365
      const expiresAt = duration === 0 ? null : new Date(Date.now() + duration * 86400000).toISOString()

      if (userEmail) {
        sqlite.prepare(`
          UPDATE mediasoft_pengguna SET
            subscription_plan_id = COALESCE(?, subscription_plan_id),
            subscription_expires_at = ?,
            status_user = 'Aktif',
            hak_akses = CASE WHEN hak_akses = 'demo' THEN 'admin' ELSE hak_akses END
          WHERE lower(email) = lower(?)
        `).run(targetPlan?.id ?? null, expiresAt, userEmail)
      } else {
        sqlite.prepare(`
          UPDATE mediasoft_pengguna SET
            subscription_plan_id = COALESCE(?, subscription_plan_id),
            subscription_expires_at = ?,
            status_user = 'Aktif',
            hak_akses = CASE WHEN hak_akses = 'demo' THEN 'admin' ELSE hak_akses END
          WHERE is_buyer = 1 OR hak_akses = 'demo'
        `).run(targetPlan?.id ?? null, expiresAt)
      }
    } catch (err) {
      console.warn('[approvePayment] Local SQLite update warning:', err)
    }

    return remoteRes || { success: true, message: 'Pembayaran berhasil disetujui' }
  }
  static async deletePayment(id: string | number) { return call('DELETE', `/admin/payments/${id}`) }
  static async getStats() { return call('GET', '/admin/stats') }
  static async getRevenue() { return call('GET', '/admin/revenue') }
  static async getDevices(query?: { search?: string; status?: string; platform?: string }) {
    const params = new URLSearchParams()
    if (query?.search) params.set('search', query.search)
    if (query?.status) params.set('status', query.status)
    if (query?.platform) params.set('platform', query.platform)
    return call('GET', `/admin/devices${params.toString() ? `?${params.toString()}` : ''}`)
  }
  static async getDeviceDetail(id: string | number) { return call('GET', `/admin/devices/${id}`) }
  static async blockDevice(id: string | number) { return call('POST', `/admin/devices/${id}/block`) }
  static async unblockDevice(id: string | number) { return call('POST', `/admin/devices/${id}/unblock`) }
  static async suspendDeviceLicense(id: string | number) { return call('POST', `/admin/devices/${id}/suspend-license`) }
  static async activateDeviceLicense(id: string | number) { return call('POST', `/admin/devices/${id}/activate-license`) }
  static async extendDeviceLicense(id: string | number, data: unknown) { return call('POST', `/admin/devices/${id}/extend-license`, data) }
  static async getAppUpdates() { return call('GET', '/admin/app-update') }
  static async saveAppUpdate(data: unknown) { return call('PATCH', '/admin/app-update', data) }
  static async checkAppUpdate(data: unknown) {
    const cfg = getConfig()
    if (!cfg?.url) return { success: false, message: 'License server belum dikonfigurasi' }
    return request<ApiResult<any>>('POST', '/app-update', '', cfg.url, data)
  }
  static async getErrors(query?: { type?: string }) {
    const params = new URLSearchParams()
    if (query?.type) params.set('type', query.type)
    return call('GET', `/admin/errors${params.toString() ? `?${params.toString()}` : ''}`)
  }
  static async getAnnouncements() { return call('GET', '/admin/announcements') }
  static async createAnnouncement(data: unknown) { return call('POST', '/admin/announcements', data) }
  static async updateAnnouncement(id: string | number, data: unknown) { return call('PATCH', `/admin/announcements/${id}`, data) }
  static async deleteAnnouncement(id: string | number) { return call('DELETE', `/admin/announcements/${id}`) }
  static async heartbeat(data: unknown, _token?: string | null) {
    const d = (data && typeof data === 'object' ? data : {}) as any
    await fbHeartbeat({ email: d.email, customerId: d.customer_id ?? d.auth_user_id, deviceInfo: d.device ?? d })
    return { success: true }
  }
  static async logError(data: unknown) {
    const d = (data && typeof data === 'object' ? data : {}) as any
    const { logActivity } = await import('../../shared/supabase/logging.js')
    await logActivity({
      username: d.email ?? d.username ?? 'unknown',
      action: 'APP_ERROR',
      module: 'SYSTEM',
      detail: `${d.error_type ?? 'error'}: ${String(d.error_message ?? '').slice(0, 1000)}`,
      deviceId: d.device_id,
      userAgent: d.user_agent,
    })
    return { success: true }
  }
}
