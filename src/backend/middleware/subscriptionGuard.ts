/**
 * SubscriptionGuard — middleware validasi paket & fitur.
 * Dipanggil dari withDemoGuard atau langsung di handler IPC.
 */
import { sqlite } from '../../database/connection.js'

export interface SubscriptionStatus {
  plan_id: number | null
  plan_name: string | null
  expires_at: string | null
  is_expired: boolean
  is_demo: boolean
  max_devices: number
  max_transactions_per_day: number
  max_products: number
  max_users: number
  feature_flags: Record<string, boolean>
}

const UNLIMITED_ACCESS_ROLES = new Set(['developer'])

function parseFlags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getSubscriptionStatus(username: string): SubscriptionStatus {
  const user = sqlite.prepare(
    `SELECT hak_akses, subscription_plan_id, subscription_expires_at, access_expires_at
     FROM mediasoft_pengguna WHERE nama_pengguna = ?`
  ).get(username) as any

  const isDemo = user?.hak_akses === 'demo'
  let expiresAt = user?.subscription_expires_at || user?.access_expires_at || null
  let planId = user?.subscription_plan_id

  // If this user has no explicit subscription, but is a store staff account,
  // inherit the active store buyer's subscription
  if (!planId && !isDemo && user?.hak_akses !== 'developer') {
    const buyer = sqlite.prepare(
      `SELECT subscription_plan_id, subscription_expires_at, access_expires_at
       FROM mediasoft_pengguna
       WHERE (is_buyer = 1 OR subscription_plan_id IS NOT NULL)
         AND subscription_plan_id IS NOT NULL
         AND COALESCE(status_user, 'Aktif') = 'Aktif'
       ORDER BY CASE WHEN is_buyer = 1 THEN 1 ELSE 2 END, rowid DESC
       LIMIT 1`
    ).get() as any

    if (buyer?.subscription_plan_id) {
      planId = buyer.subscription_plan_id
      expiresAt = buyer.subscription_expires_at || buyer.access_expires_at || expiresAt
    }
  }

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false

  if (!planId) {
    return {
      plan_id: null, plan_name: null, expires_at: expiresAt,
      is_expired: isExpired, is_demo: isDemo,
      max_devices: 1, max_transactions_per_day: isDemo ? 20 : -1,
      max_products: isDemo ? 30 : -1, max_users: 1,
      feature_flags: {},
    }
  }

  const plan = sqlite.prepare(
    `SELECT id, name, max_devices, max_transactions_per_day, max_products, max_users, feature_flags
     FROM mediasoft_subscription_plans WHERE id = ?`
  ).get(planId) as any

  const flags = parseFlags(plan?.feature_flags)

  return {
    plan_id: plan?.id ?? null,
    plan_name: plan?.name ?? null,
    expires_at: expiresAt,
    is_expired: isExpired,
    is_demo: isDemo,
    max_devices: plan?.max_devices ?? 1,
    max_transactions_per_day: plan?.max_transactions_per_day ?? -1,
    max_products: plan?.max_products ?? -1,
    max_users: plan?.max_users ?? 1,
    feature_flags: flags,
  }
}

export function hasSubscriptionBypass(username: string): boolean {
  const user = sqlite.prepare(
    `SELECT hak_akses FROM mediasoft_pengguna WHERE nama_pengguna = ?`
  ).get(username) as { hak_akses?: string | null } | undefined
  return UNLIMITED_ACCESS_ROLES.has(user?.hak_akses ?? '')
}

/** Cek apakah fitur aktif untuk user */
export function isFeatureEnabled(username: string, featureKey: string): boolean {
  if (hasSubscriptionBypass(username)) return true
  const status = getSubscriptionStatus(username)
  if (status.is_demo) return false
  if (status.is_expired) return false
  if (Object.keys(status.feature_flags).length === 0) return true // no restrictions
  return status.feature_flags[featureKey] !== false
}

/** Ambil daftar fitur yang aktif untuk user. */
export function getActiveFeatures(username: string): { code: string; enabled: boolean }[] {
  if (hasSubscriptionBypass(username)) {
    return [
      'reports', 'export_excel', 'export_pdf', 'multi_user', 'backup', 'restore',
      'stock_opname', 'debt_management', 'shift_management', 'api_access',
      'multi_branch', 'return_refund',
    ].map(code => ({ code, enabled: true }))
  }

  const status = getSubscriptionStatus(username)
  if (status.is_expired || status.is_demo) {
    return Object.keys(status.feature_flags).map(code => ({ code, enabled: false }))
  }

  return Object.entries(status.feature_flags)
    .filter(([, enabled]) => enabled !== false)
    .map(([code]) => ({ code, enabled: true }))
}

/** Cek limit harian transaksi */
export function checkTransactionLimit(username: string): { allowed: boolean; used: number; max: number } {
  if (hasSubscriptionBypass(username)) return { allowed: true, used: 0, max: -1 }
  const status = getSubscriptionStatus(username)
  const max = status.max_transactions_per_day
  if (max === -1) return { allowed: true, used: 0, max: -1 }

  const today = new Date().toISOString().slice(0, 10)
  const used = (sqlite.prepare(
    `SELECT COUNT(*) AS c FROM mediasoft_penjualan
     WHERE username_transaksi = ? AND date(tgl_wkt_transaksi) = ?`
  ).get(username, today) as { c: number }).c

  return { allowed: used < max, used, max }
}

/** Cek limit jumlah produk berdasarkan paket. */
export function checkProductLimit(username: string, incoming = 1): { allowed: boolean; used: number; max: number } {
  if (hasSubscriptionBypass(username)) return { allowed: true, used: 0, max: -1 }
  const status = getSubscriptionStatus(username)
  const max = status.max_products
  if (max === -1) return { allowed: true, used: 0, max: -1 }

  const used = (sqlite.prepare(
    `SELECT COUNT(*) AS c FROM mediasoft_barang`
  ).get() as { c: number }).c

  return { allowed: used + Math.max(0, incoming) <= max, used, max }
}

/** Ambil popup rule berdasarkan trigger */
export function getPopupRule(code: string) {
  return sqlite.prepare(
    `SELECT * FROM mediasoft_popup_rules WHERE code = ? AND is_active = 1`
  ).get(code)
}

export function getUpgradePopup(username: string, featureKey?: string) {
  const status = getSubscriptionStatus(username)
  if (status.is_expired) return getPopupRule('EXPIRED')
  if (featureKey && !isFeatureEnabled(username, featureKey)) return getPopupRule('FEATURE_LOCKED')
  return getPopupRule('DEMO_LIMIT')
}

export function getLimitPopup(code: 'DEMO_LIMIT' | 'DEVICE_LIMIT' | 'TRANSACTION_LIMIT' | 'PRODUCT_LIMIT' = 'DEMO_LIMIT') {
  return getPopupRule(code) ?? getPopupRule('DEMO_LIMIT')
}
