import { PenggunaModel } from '../models/PenggunaModel.js'
import { IdentitasModel } from '../models/IdentitasModel.js'
import { ActivityLogModel } from '../models/ActivityLogModel.js'
import { AuthSessionModel, type AuthDeviceInfo } from '../models/AuthSessionModel.js'
import { encryptPassword, verifyPassword, isSHA1Hash } from '../services/crypto.js'
import { rateLimiter } from '../services/rateLimiter.js'
import { validatePasswordStrength } from '../../shared/passwordPolicy.js'
import { DeviceController, detectPlatformOS } from './DeviceController.js'
import { sqlite } from '../../database/connection.js'
import { LicenseController } from './LicenseController.js'
import { tryCloudSignIn, updatePasswordCloud } from '../../shared/supabase/auth.js'
import { syncBuyerLicense } from '../../shared/supabase/license.js'
import { getKnownPlanDefaults } from '../../shared/planDefaults.js'

function isAccessExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false
  const expires = new Date(expiresAt)
  return !Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()
}

function hasUnlimitedAccessRole(role?: string | null): boolean {
  return role === 'developer'
}

function getAccessDaysRemaining(expiresAt?: string | null): number | null {
  if (!expiresAt) return null
  const expires = new Date(expiresAt)
  if (Number.isNaN(expires.getTime())) return null
  return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000))
}

type AuthUserRecord = NonNullable<ReturnType<typeof PenggunaModel.findActiveByUsername>>

function getEffectiveAccessExpiresAt(user: AuthUserRecord): string | null {
  if (hasUnlimitedAccessRole(user.hak_akses)) return null
  return user.subscription_expires_at ?? user.access_expires_at ?? null
}

interface RestoreSessionInput {
  username?: string
  sessionToken?: string
  deviceInfo?: AuthDeviceInfo
  remoteLicenseToken?: string | null
  remoteLicenseRefreshToken?: string | null
}

const PIN_PATTERN = /^\d{4,8}$/
const TRIAL_PLAN_NAME = 'Trial 3 Hari'
const TRIAL_DAYS = 3
const TRIAL_FEATURE_FLAGS = {
  reports: true,
  export_excel: true,
  export_pdf: true,
  multi_user: true,
  backup: true,
  restore: true,
  stock_opname: true,
  debt_management: true,
  shift_management: true,
  api_access: true,
  multi_branch: true,
  return_refund: true,
}
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeDeviceInfo(input?: AuthDeviceInfo | string | null): AuthDeviceInfo {
  if (!input) return {}
  if (typeof input === 'string') return { ipAddress: input }
  return {
    ipAddress: input.ipAddress ?? null,
    deviceId: input.deviceId ?? null,
    deviceName: input.deviceName ?? null,
    userAgent: input.userAgent ?? null,
    platform: input.platform ?? null,
    osName: input.osName ?? null,
    appVersion: input.appVersion ?? null,
  }
}

function withDetectedDeviceInfo(input: AuthDeviceInfo): AuthDeviceInfo {
  const detected = detectPlatformOS(input.userAgent ?? '')
  return {
    ...input,
    platform: input.platform ?? detected.platform,
    osName: input.osName ?? detected.os_name,
  }
}

function deviceDetail(device: AuthDeviceInfo): string {
  const parts = [
    device.deviceName ? `device=${device.deviceName}` : null,
    device.deviceId ? `device_id=${device.deviceId}` : null,
    device.ipAddress ? `ip=${device.ipAddress}` : null,
    device.userAgent ? `ua=${device.userAgent.slice(0, 160)}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('; ') : 'device=unknown'
}

function validatePin(pin: string): string | null {
  if (!PIN_PATTERN.test(pin)) {
    return 'PIN kasir harus 4-8 digit angka'
  }
  return null
}

function toSession(user: AuthUserRecord, auth?: {
  token?: string
  expires_at?: string
  device_id?: string | null
  remote_license_token?: string | null
  remote_license_refresh_token?: string | null
  remote_customer_id?: string | null
  remote_auth_user_id?: string | null
  remote_registration_status?: 'synced' | 'pending' | null
  remote_registration_message?: string | null
}) {
  const expiresAt = getEffectiveAccessExpiresAt(user)
  let plan: any = null
  if (user.subscription_plan_id) {
    try {
      plan = sqlite.prepare('SELECT * FROM mediasoft_subscription_plans WHERE id = ? LIMIT 1').get(user.subscription_plan_id)
    } catch {}
  }
  let parsedFlags: Record<string, boolean> = {}
  if (plan?.feature_flags) {
    try { parsedFlags = JSON.parse(plan.feature_flags) } catch {}
  }

  return {
    nama_pengguna: user.nama_pengguna,
    nama_lengkap: user.nama_lengkap,
    email: user.email ?? null,
    foto: (user as any).foto ?? null,
    hak_akses: user.hak_akses || 'kasir',
    access_expires_at: expiresAt,
    access_days_remaining: getAccessDaysRemaining(expiresAt),
    subscription_plan_id: user.subscription_plan_id ?? null,
    subscription_plan_name: plan?.name ?? (user.hak_akses === 'demo' ? 'Akun Demo' : (hasUnlimitedAccessRole(user.hak_akses) ? 'Developer Full Access' : null)),
    subscription_plan_code: plan?.code ?? (user.hak_akses === 'demo' ? 'DEMO' : null),
    subscription_expires_at: user.subscription_expires_at ?? null,
    max_devices: plan?.max_devices ?? (hasUnlimitedAccessRole(user.hak_akses) ? -1 : 1),
    max_transactions_per_day: plan?.max_transactions_per_day ?? -1,
    max_products: plan?.max_products ?? -1,
    max_users: plan?.max_users ?? (hasUnlimitedAccessRole(user.hak_akses) ? -1 : 1),
    feature_flags: parsedFlags,
    must_change_password: !!user.must_change_password,
    session_token: auth?.token,
    session_expires_at: auth?.expires_at,
    device_id: auth?.device_id ?? null,
    remote_license_token: auth?.remote_license_token ?? null,
    remote_license_refresh_token: auth?.remote_license_refresh_token ?? null,
    remote_customer_id: auth?.remote_customer_id ?? null,
    remote_auth_user_id: auth?.remote_auth_user_id ?? null,
    remote_registration_status: auth?.remote_registration_status ?? null,
    remote_registration_message: auth?.remote_registration_message ?? null,
  }
}

function ensureTrialPlan(): number {
  const existing = sqlite
    .prepare(`SELECT id, feature_flags FROM mediasoft_subscription_plans WHERE name = ? LIMIT 1`)
    .get(TRIAL_PLAN_NAME) as { id: number; feature_flags?: string } | undefined

  const trialFeatures = JSON.stringify([
    'Trial akses penuh 3 hari',
    'Semua fitur & modul aktif',
    'Laporan, Excel & PDF aktif',
    'Multi-user kasir & admin',
    'Tanpa batasan transaksi & produk selama trial',
  ])
  const trialFlags = JSON.stringify(TRIAL_FEATURE_FLAGS)

  if (existing?.id) {
    sqlite.prepare(`
      UPDATE mediasoft_subscription_plans
      SET duration_days = ?,
          features = ?,
          max_devices = 3,
          max_transactions_per_day = -1,
          max_products = -1,
          max_users = 10,
          feature_flags = ?
      WHERE id = ?
    `).run(TRIAL_DAYS, trialFeatures, trialFlags, existing.id)
    return existing.id
  }

  const result = sqlite.prepare(`
    INSERT INTO mediasoft_subscription_plans
      (name, price, duration_days, features, is_active, is_recommended, created_at,
       max_devices, max_transactions_per_day, max_products, max_users, feature_flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TRIAL_PLAN_NAME,
    0,
    TRIAL_DAYS,
    trialFeatures,
    0,
    0,
    new Date().toISOString(),
    3,
    -1,
    -1,
    10,
    trialFlags,
  )

  return Number(result.lastInsertRowid)
}

function ensurePlanFromRemote(plan: any): number {
  const code = String(plan?.code ?? '').trim()
  const name = String(plan?.name ?? (code || TRIAL_PLAN_NAME)).trim()
  const defaults = getKnownPlanDefaults(code || name)

  const existing = sqlite
    .prepare(`SELECT * FROM mediasoft_subscription_plans WHERE (code IS NOT NULL AND code != '' AND code = ?) OR name = ? LIMIT 1`)
    .get(code || name, name) as any

  const now = new Date().toISOString()
  let features = plan?.description ? [String(plan.description)] : []
  if (features.length === 0 && existing?.features) {
    try { features = JSON.parse(existing.features) } catch {}
  }
  const price = Math.round(Number(plan?.price ?? existing?.price ?? 0))
  const duration = Math.max(0, Math.trunc(Number(plan?.duration_days ?? defaults.duration_days ?? existing?.duration_days ?? TRIAL_DAYS)))
  const isTrial = (code && code.toUpperCase() === 'TRIAL_3_DAYS') || name === TRIAL_PLAN_NAME

  const resolvedMaxDevices = Number.isFinite(Number(plan?.max_devices))
    ? Math.trunc(Number(plan.max_devices))
    : (defaults.max_devices ?? (Number.isFinite(Number(existing?.max_devices)) ? Math.trunc(Number(existing.max_devices)) : 1))

  const resolvedMaxTransactions = Number.isFinite(Number(plan?.max_transactions_per_day))
    ? Math.trunc(Number(plan.max_transactions_per_day))
    : (defaults.max_transactions_per_day ?? (Number.isFinite(Number(existing?.max_transactions_per_day)) ? Math.trunc(Number(existing.max_transactions_per_day)) : -1))

  const resolvedMaxProducts = Number.isFinite(Number(plan?.max_products))
    ? Math.trunc(Number(plan.max_products))
    : (defaults.max_products ?? (Number.isFinite(Number(existing?.max_products)) ? Math.trunc(Number(existing.max_products)) : -1))

  const resolvedMaxUsers = Number.isFinite(Number(plan?.max_users))
    ? Math.trunc(Number(plan.max_users))
    : (defaults.max_users ?? (Number.isFinite(Number(existing?.max_users)) ? Math.trunc(Number(existing.max_users)) : 1))

  let resolvedFlags: Record<string, boolean> = {}
  if (plan?.feature_flags && typeof plan.feature_flags === 'object' && Object.keys(plan.feature_flags).length > 0) {
    resolvedFlags = plan.feature_flags
  } else if (defaults.feature_flags && Object.keys(defaults.feature_flags).length > 0) {
    resolvedFlags = defaults.feature_flags
  } else if (existing?.feature_flags) {
    try { resolvedFlags = JSON.parse(existing.feature_flags) } catch {}
  } else if (isTrial) {
    resolvedFlags = TRIAL_FEATURE_FLAGS
  }

  const featureFlags = JSON.stringify(resolvedFlags)

  if (existing?.id) {
    sqlite.prepare(`
      UPDATE mediasoft_subscription_plans
      SET code = COALESCE(?, code),
          name = COALESCE(?, name),
          price = ?,
          duration_days = ?,
          features = ?,
          is_active = ?,
          is_recommended = ?,
          updated_at = ?,
          max_devices = ?,
          max_transactions_per_day = ?,
          max_products = ?,
          max_users = ?,
          feature_flags = ?
      WHERE id = ?
    `).run(
      code || defaults.code || null,
      name,
      price,
      duration,
      JSON.stringify(features),
      isTrial ? 0 : 1,
      plan?.is_recommended ? 1 : 0,
      now,
      resolvedMaxDevices,
      resolvedMaxTransactions,
      resolvedMaxProducts,
      resolvedMaxUsers,
      featureFlags,
      existing.id,
    )
    return existing.id
  }

  const result = sqlite.prepare(`
    INSERT INTO mediasoft_subscription_plans
      (code, name, price, duration_days, features, is_active, is_recommended, created_at,
       max_devices, max_transactions_per_day, max_products, max_users, feature_flags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code || defaults.code || null,
    name,
    price,
    duration,
    JSON.stringify(features),
    isTrial ? 0 : 1,
    plan?.is_recommended ? 1 : 0,
    now,
    resolvedMaxDevices,
    resolvedMaxTransactions,
    resolvedMaxProducts,
    resolvedMaxUsers,
    featureFlags,
  )
  return Number(result.lastInsertRowid)
}

function findLocalUserByEmail(email: string) {
  return sqlite
    .prepare(`SELECT nama_pengguna FROM mediasoft_pengguna WHERE lower(email) = lower(?) LIMIT 1`)
    .get(email) as { nama_pengguna?: string } | undefined
}

function mapRemoteAdminRole(_role: string | null | undefined): 'developer' {
  return 'developer'
}

async function upsertRemoteAdminCache(input: {
  loginName: string
  password: string
  remote: any
  existingUser?: AuthUserRecord | null
}) {
  const admin = input.remote?.user ?? {}
  const email = String(admin.email ?? input.loginName).trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Email admin dari license server tidak valid')
  }

  const localByEmail = findLocalUserByEmail(email)
  const username = input.existingUser?.nama_pengguna
    ?? localByEmail?.nama_pengguna
    ?? email
  const role = mapRemoteAdminRole(String(admin.role ?? 'developer'))
  const name = String(admin.name ?? admin.email ?? username)
  const existing = PenggunaModel.findByUsername(username)

  if (existing) {
    PenggunaModel.update(username, {
      nama_lengkap: name,
      email,
      status_user: 'Aktif',
      hak_akses: role,
      access_expires_at: null,
      subscription_plan_id: null,
      subscription_expires_at: null,
      is_buyer: 0,
      must_change_password: 0,
    } as any)
    await PenggunaModel.updatePassword(username, input.password, false)
  } else {
    await PenggunaModel.create({
      nama_pengguna: username,
      nama_lengkap: name,
      email,
      kata_sandi: input.password,
      hak_akses: role,
      access_expires_at: null,
      subscription_plan_id: null,
      subscription_expires_at: null,
      is_buyer: 0,
      must_change_password: 0,
    })
  }

  return PenggunaModel.findActiveByUsername(username)
}

async function loginRemoteAdmin(input: {
  loginName: string
  password: string
  device: AuthDeviceInfo
  existingUser?: AuthUserRecord | null
}) {
  const email = EMAIL_PATTERN.test(input.loginName)
    ? input.loginName.trim().toLowerCase()
    : (input.existingUser?.email ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) return null

  const remote = await LicenseController.loginAdmin({ email, password: input.password }, input.device)
  if (!remote) return null
  if (!remote.success) {
    return {
      success: false,
      message: remote.message || 'Login admin ke license server pusat gagal',
      data: remote.data,
    }
  }

  const user = await upsertRemoteAdminCache({
    loginName: input.loginName,
    password: input.password,
    remote: remote.data,
    existingUser: input.existingUser,
  })

  if (!user) {
    return { success: false, message: 'Akun admin lokal gagal dibuat dari license server' }
  }

  return { success: true, user, remote: remote.data }
}

async function upsertRemoteBuyerCache(input: {
  loginName: string
  password: string
  remote: any
  existingUser?: AuthUserRecord | null
}) {
  const customer = input.remote?.customer ?? input.remote?.user ?? {}
  const plan = input.remote?.subscription?.plan ?? input.remote?.plan ?? {}
  const subscription = input.remote?.subscription ?? {}
  const email = String(customer.email ?? (EMAIL_PATTERN.test(input.loginName) ? input.loginName : '')).trim().toLowerCase()
  const localByEmail = email ? findLocalUserByEmail(email) : undefined
  const username = input.existingUser?.nama_pengguna
    ?? localByEmail?.nama_pengguna
    ?? (customer.name ? String(customer.name).trim() : undefined)
    ?? (EMAIL_PATTERN.test(input.loginName) ? input.loginName.trim().toLowerCase() : email)

  if (!username) {
    throw new Error('Email pembeli dari license server tidak valid')
  }

  const planId = ensurePlanFromRemote(plan)
  const expiresAt = typeof subscription.expires_at === 'string' ? subscription.expires_at : null
  const name = String(customer.name ?? customer.email ?? username)
  const phone = typeof customer.phone === 'string' ? customer.phone : undefined
  const existing = PenggunaModel.findByUsername(username)

  if (existing) {
    PenggunaModel.update(username, {
      nama_lengkap: name,
      email,
      no_telp: phone,
      status_user: 'Aktif',
      hak_akses: 'admin',
      access_expires_at: expiresAt,
      subscription_plan_id: planId,
      subscription_expires_at: expiresAt,
      is_buyer: 1,
      must_change_password: 0,
    } as any)
    await PenggunaModel.updatePassword(username, input.password, false)
  } else {
    await PenggunaModel.create({
      nama_pengguna: username,
      nama_lengkap: name,
      email,
      no_telp: phone,
      kata_sandi: input.password,
      hak_akses: 'admin',
      access_expires_at: expiresAt,
      subscription_plan_id: planId,
      subscription_expires_at: expiresAt,
      is_buyer: 1,
      must_change_password: 0,
    })
  }

  return PenggunaModel.findActiveByUsername(username)
}

async function loginRemoteBuyer(input: {
  loginName: string
  password: string
  device: AuthDeviceInfo
  existingUser?: AuthUserRecord | null
}) {
  let email = EMAIL_PATTERN.test(input.loginName)
    ? input.loginName.trim().toLowerCase()
    : (input.existingUser?.email ?? '').trim().toLowerCase()

  // If loginName is a username and not in existingUser, try to resolve email from remote users
  if (!email && input.loginName) {
    try {
      const remoteUsers = await LicenseController.getUsers()
      if (remoteUsers?.success && Array.isArray(remoteUsers.data)) {
        const cleanLogin = input.loginName.trim().toLowerCase()
        const matched = remoteUsers.data.find((u: any) =>
          (u.name && String(u.name).trim().toLowerCase() === cleanLogin) ||
          (u.email && String(u.email).trim().toLowerCase() === cleanLogin) ||
          (u.email && String(u.email).trim().toLowerCase().split('@')[0] === cleanLogin)
        )
        if (matched?.email) {
          email = String(matched.email).trim().toLowerCase()
        }
      }
    } catch {}
  }

  if (!email) {
    const clean = input.loginName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (clean) {
      email = `${clean}@zetass.dev`
    }
  }

  if (!EMAIL_PATTERN.test(email)) return null

  // 1. Direct Supabase Cloud Auth attempt (if GoTrue Auth record exists)
  try {
    const cloudRes = await tryCloudSignIn(email, input.password)
    if (cloudRes.success && cloudRes.user) {
      const syncRes = await syncBuyerLicense({ email, deviceInfo: input.device })
      const user = await upsertRemoteBuyerCache({
        loginName: input.loginName,
        password: input.password,
        remote: {
          customer: { id: cloudRes.user.id, email: cloudRes.user.email, name: cloudRes.user.user_metadata?.name || input.loginName },
          subscription: syncRes.data?.subscription,
          access_token: cloudRes.session?.access_token,
          refresh_token: cloudRes.session?.refresh_token,
        },
        existingUser: input.existingUser,
      })
      if (user) {
        return { success: true, user, remote: { customer: cloudRes.user, access_token: cloudRes.session?.access_token } }
      }
    }
  } catch {}

  // 2. LicenseController loginBuyer via license server Edge Function (/customer/login)
  try {
    const remote = await LicenseController.loginBuyer({ email, password: input.password }, input.device)
    if (remote?.success && remote.data) {
      const user = await upsertRemoteBuyerCache({
        loginName: input.loginName,
        password: input.password,
        remote: remote.data,
        existingUser: input.existingUser,
      })
      if (user) {
        return { success: true, user, remote: remote.data }
      }
    }

    const failureMessage = remote?.message || 'Login pembeli ke license server gagal'
    if (failureMessage.toLowerCase().includes('tidak ditemukan') && input.existingUser?.nama_pengguna) {
      sqlite.prepare(`DELETE FROM mediasoft_pengguna WHERE nama_pengguna = ? AND is_buyer = 1`).run(input.existingUser.nama_pengguna)
    }
    return {
      success: false,
      message: failureMessage,
      data: {
        ...((remote?.data as any) ?? {}),
        error_code: (remote?.data as any)?.error_code ?? (failureMessage.toLowerCase().includes('tidak ditemukan') ? 'NOT_FOUND' : undefined),
      },
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal terhubung ke license server pusat',
      data: { error_code: 'CONNECTION_ERROR' },
    }
  }
}

function completeRemoteBuyerLogin(user: AuthUserRecord, device: AuthDeviceInfo, remote?: any) {
  rateLimiter.resetAttempts(user.nama_pengguna)
  PenggunaModel.updateLastLogin(user.nama_pengguna)

  if (device.deviceId) {
    DeviceController.upsert({
      username: user.nama_pengguna,
      device_id: device.deviceId,
      device_name: device.deviceName ?? undefined,
      platform: device.platform ?? undefined,
      os_name: device.osName ?? undefined,
      app_version: device.appVersion ?? undefined,
      ip_address: device.ipAddress ?? undefined,
    })
  }

  const authSession = AuthSessionModel.create(user.nama_pengguna, device)

  ActivityLogModel.create({
    username: user.nama_pengguna,
    aktivitas: 'REMOTE_BUYER_LOGIN',
    modul: 'AUTH',
    tgl_aktivitas: new Date().toISOString(),
    ip_address: device.ipAddress ?? null,
    device_id: device.deviceId ?? null,
    user_agent: device.userAgent ?? null,
    event_type: 'login',
    detail: `Login pembeli divalidasi melalui license server pusat. ${deviceDetail(device)}`,
  })

  return {
    success: true,
    message: 'Login berhasil',
    data: toSession(user, {
      token: authSession.token,
      expires_at: authSession.expires_at,
      device_id: device.deviceId ?? null,
      remote_license_token: remote?.access_token ?? null,
      remote_license_refresh_token: remote?.refresh_token ?? null,
      remote_customer_id: remote?.customer?.id ?? null,
      remote_auth_user_id: remote?.customer?.auth_user_id ?? null,
    }),
  }
}

function completeRemoteAdminLogin(user: AuthUserRecord, device: AuthDeviceInfo, remote?: any) {
  rateLimiter.resetAttempts(user.nama_pengguna)
  PenggunaModel.updateLastLogin(user.nama_pengguna)
  LicenseController.saveAdminSessionFromRemote(remote)

  if (device.deviceId) {
    DeviceController.upsert({
      username: user.nama_pengguna,
      device_id: device.deviceId,
      device_name: device.deviceName ?? undefined,
      platform: device.platform ?? undefined,
      os_name: device.osName ?? undefined,
      app_version: device.appVersion ?? undefined,
      ip_address: device.ipAddress ?? undefined,
    })
  }

  const authSession = AuthSessionModel.create(user.nama_pengguna, device)

  ActivityLogModel.create({
    username: user.nama_pengguna,
    aktivitas: 'REMOTE_ADMIN_LOGIN',
    modul: 'AUTH',
    tgl_aktivitas: new Date().toISOString(),
    ip_address: device.ipAddress ?? null,
    device_id: device.deviceId ?? null,
    user_agent: device.userAgent ?? null,
    event_type: 'login',
    detail: `Login developer/admin divalidasi melalui Supabase license server. role=${remote?.user?.role ?? '-'}. ${deviceDetail(device)}`,
  })

  return {
    success: true,
    message: 'Login developer berhasil',
    data: toSession(user, {
      token: authSession.token,
      expires_at: authSession.expires_at,
      device_id: device.deviceId ?? null,
      remote_license_token: remote?.access_token ?? null,
      remote_license_refresh_token: remote?.refresh_token ?? null,
      remote_auth_user_id: remote?.user?.id ?? null,
    }),
  }
}

export class AuthController {
  static hasUsers() {
    return { success: true, data: { hasUsers: PenggunaModel.count() > 0 } }
  }

  static async createInitialAdmin(data: {
    username?: string
    nama_lengkap?: string
    password?: string
  }) {
    if (PenggunaModel.count() > 0) {
      return { success: false, message: 'Setup awal sudah selesai' }
    }

    const username = (data.username ?? '').trim()
    const namaLengkap = (data.nama_lengkap ?? '').trim()
    const password = data.password ?? ''

    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      return {
        success: false,
        message: 'Username minimal 3 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau strip',
      }
    }

    if (!namaLengkap) {
      return { success: false, message: 'Nama lengkap wajib diisi' }
    }

    const validation = validatePasswordStrength(password)
    if (!validation.valid) {
      return { success: false, message: validation.message }
    }

    const planId = ensureTrialPlan()
    const expiresAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()

    await PenggunaModel.create({
      nama_pengguna: username,
      nama_lengkap: namaLengkap,
      kata_sandi: password,
      hak_akses: 'admin',
      access_expires_at: expiresAt,
      subscription_plan_id: planId,
      subscription_expires_at: expiresAt,
      is_buyer: 1,
      must_change_password: 0,
    })

    ActivityLogModel.create({
      username,
      aktivitas: 'INITIAL_ADMIN_CREATED',
      modul: 'AUTH',
      tgl_aktivitas: new Date().toISOString(),
      detail: `Akun admin pertama dibuat dengan trial ${TRIAL_DAYS} hari akses penuh`,
    })

    return { success: true, message: `Akun admin pertama berhasil dibuat dengan trial ${TRIAL_DAYS} hari akses penuh` }
  }

  static async registerTrial(data: {
    username?: string
    nama_lengkap?: string
    email?: string
    no_telp?: string
    password?: string
  }, deviceInfo?: AuthDeviceInfo | string | null) {
    const device = withDetectedDeviceInfo(normalizeDeviceInfo(deviceInfo))
    const username = (data.username ?? '').trim()
    const namaLengkap = (data.nama_lengkap ?? '').trim()
    const email = (data.email ?? '').trim()
    const noTelp = (data.no_telp ?? '').trim()
    const password = data.password ?? ''

    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      return {
        success: false,
        message: 'Username minimal 3 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau strip',
      }
    }

    if (!EMAIL_PATTERN.test(email)) {
      return { success: false, message: 'Email valid wajib diisi untuk daftar akun trial' }
    }

    if (PenggunaModel.findByUsername(username)) {
      return { success: false, message: 'Username sudah digunakan. Pilih username lain.' }
    }

    if (!namaLengkap) {
      return { success: false, message: 'Nama lengkap wajib diisi' }
    }

    const validation = validatePasswordStrength(password)
    if (!validation.valid) {
      return { success: false, message: validation.message }
    }

    const planId = ensureTrialPlan()
    const remoteRegistration = await LicenseController.registerTrialCustomer({
      email,
      password,
      nama_lengkap: namaLengkap,
      no_telp: noTelp || undefined,
    }, device)
    if (remoteRegistration && !remoteRegistration.success) {
      const message = remoteRegistration.message || 'Gagal daftar akun trial ke license server pusat'
      if (message.toLowerCase().includes('sudah terdaftar')) {
        return { success: false, message }
      }
    }

    const remoteExpiresAt = (remoteRegistration?.data as any)?.subscription?.expires_at
    const remotePayload = remoteRegistration?.data as any
    const expiresAt = typeof remoteExpiresAt === 'string'
      ? remoteExpiresAt
      : new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()

    await PenggunaModel.create({
      nama_pengguna: username,
      nama_lengkap: namaLengkap,
      email: email || undefined,
      no_telp: noTelp || undefined,
      kata_sandi: password,
      hak_akses: 'admin',
      access_expires_at: expiresAt,
      subscription_plan_id: planId,
      subscription_expires_at: expiresAt,
      is_buyer: 1,
      must_change_password: 0,
    })

    const user = PenggunaModel.findActiveByUsername(username)
    if (!user) {
      return { success: false, message: 'Akun trial gagal dibuat' }
    }

    PenggunaModel.updateLastLogin(username)

    if (device.deviceId) {
      DeviceController.upsert({
        username,
        device_id: device.deviceId,
        device_name: device.deviceName ?? undefined,
        platform: device.platform ?? undefined,
        os_name: device.osName ?? undefined,
        app_version: device.appVersion ?? undefined,
        ip_address: device.ipAddress ?? undefined,
      })
    }

    const authSession = AuthSessionModel.create(username, device)

    ActivityLogModel.create({
      username,
      aktivitas: 'TRIAL_REGISTERED',
      modul: 'AUTH',
      tgl_aktivitas: new Date().toISOString(),
      ip_address: device.ipAddress ?? null,
      device_id: device.deviceId ?? null,
      user_agent: device.userAgent ?? null,
      event_type: 'subscription',
      detail: `Akun pembeli trial 3 hari dibuat; expires_at=${expiresAt}; plan=${TRIAL_PLAN_NAME}; remote=${remoteRegistration ? 1 : 0}. ${deviceDetail(device)}`,
    })

    return {
      success: true,
      message: remoteRegistration?.success
        ? 'Trial 3 hari aktif dengan semua fitur terbuka penuh!'
        : `Trial lokal 3 hari aktif dengan semua fitur terbuka penuh. Server lisensi: ${remoteRegistration?.message || 'mode offline'}`,
      data: toSession(user, {
        token: authSession.token,
        expires_at: authSession.expires_at,
        device_id: device.deviceId ?? null,
        remote_license_token: remotePayload?.access_token ?? null,
        remote_license_refresh_token: remotePayload?.refresh_token ?? null,
        remote_customer_id: remotePayload?.customer?.id ?? null,
        remote_auth_user_id: remotePayload?.customer?.auth_user_id ?? null,
        remote_registration_status: remoteRegistration?.success ? 'synced' : 'pending',
        remote_registration_message: remoteRegistration?.success ? null : remoteRegistration?.message ?? null,
      }),
    }
  }

  /**
   * Login with enhanced security
   * - Rate limiting to prevent brute force
   * - Support both SHA1 (legacy) and bcrypt
   * - Auto-migrate SHA1 to bcrypt on successful login
   * - Activity logging
   */
  static async login(username: string, password: string, deviceInfo?: AuthDeviceInfo | string | null) {
    const device = withDetectedDeviceInfo(normalizeDeviceInfo(deviceInfo))
    // Note: Do NOT sanitize username with sanitizeString() here — it encodes
    // special chars (&, <, /) which breaks DB lookup. Drizzle uses parameterized
    // queries so SQL injection is already prevented at the ORM level.
    username = (username?.trim() || '')
    
    if (!username || !password?.trim()) {
      return { success: false, message: 'Username dan password tidak boleh kosong' }
    }

    // Check rate limiting
    const lockStatus = rateLimiter.isLocked(username)
    if (lockStatus.locked) {
      const minutes = Math.ceil((lockStatus.remainingTime || 0) / 60)
      ActivityLogModel.create({
        username,
        aktivitas: 'LOGIN_BLOCKED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `Login diblokir karena terlalu banyak percobaan gagal. Tersisa ${minutes} menit. ${deviceDetail(device)}`,
      })
      
      return {
        success: false,
        message: `Akun diblokir karena terlalu banyak percobaan login gagal. Coba lagi dalam ${minutes} menit.`,
      }
    }

    // Find active user
    let user = PenggunaModel.findActiveByUsername(username)
    if (!user && EMAIL_PATTERN.test(username)) {
      const byEmail = findLocalUserByEmail(username)
      if (byEmail?.nama_pengguna) {
        user = PenggunaModel.findActiveByUsername(byEmail.nama_pengguna)
      }
    }
    const shouldTryRemoteAdmin = EMAIL_PATTERN.test(username) || user?.hak_akses === 'developer'
    if (shouldTryRemoteAdmin) {
      const remoteAdmin = await loginRemoteAdmin({ loginName: username, password, device, existingUser: user ?? null })
      if (remoteAdmin?.success && remoteAdmin.user) {
        return completeRemoteAdminLogin(remoteAdmin.user, device, remoteAdmin.remote)
      }
    }

    if (!user) {
      const remoteLogin = await loginRemoteBuyer({ loginName: username, password, device })
      if (remoteLogin?.success && remoteLogin.user) {
        return completeRemoteBuyerLogin(remoteLogin.user, device, remoteLogin.remote)
      }

      // Record failed attempt
      const attemptResult = rateLimiter.recordFailedAttempt(username)
      
      ActivityLogModel.create({
        username,
        aktivitas: 'LOGIN_FAILED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `Username tidak ditemukan atau akun tidak aktif. Sisa percobaan: ${attemptResult.remainingAttempts}. ${deviceDetail(device)}`,
      })
      
      if (attemptResult.locked) {
        return {
          success: false,
          message: 'Terlalu banyak percobaan login gagal. Akun diblokir selama 5 menit.',
        }
      }
      
      return {
        success: false,
        message: `Username atau Password Salah! Sisa percobaan: ${attemptResult.remainingAttempts}`,
      }
    }

    // Verify password based on hash type
    let passwordValid = false
    const hashType = user.password_hash_type || 'sha1'

    try {
      if (hashType === 'bcrypt') {
        // Verify with bcrypt
        passwordValid = await verifyPassword(password, user.kata_sandi || '')
      } else {
        const storedPassword = user.kata_sandi || ''
        const legacyType = isSHA1Hash(storedPassword) ? 'SHA1' : 'plaintext'
        passwordValid = legacyType === 'SHA1'
          ? encryptPassword(password) === storedPassword
          : password === storedPassword
        
        // If valid, migrate to bcrypt
        if (passwordValid) {
          await PenggunaModel.migratePasswordToBcrypt(username, password, true)
          user.must_change_password = 1
          ActivityLogModel.create({
            username,
            aktivitas: 'PASSWORD_MIGRATED',
            modul: 'AUTH',
            tgl_aktivitas: new Date().toISOString(),
            ip_address: device.ipAddress ?? null,
            device_id: device.deviceId ?? null,
            user_agent: device.userAgent ?? null,
            detail: `Password berhasil dimigrasikan dari ${legacyType} ke bcrypt. ${deviceDetail(device)}`,
          })
        }
      }
    } catch (error) {
      console.error('Password verification error:', error)
      return { success: false, message: 'Terjadi kesalahan saat verifikasi password' }
    }

    if (!passwordValid) {
      const remoteLogin = await loginRemoteBuyer({ loginName: username, password, device, existingUser: user })
      if (remoteLogin?.success && remoteLogin.user) {
        return completeRemoteBuyerLogin(remoteLogin.user, device, remoteLogin.remote)
      }

      // Record failed attempt
      const attemptResult = rateLimiter.recordFailedAttempt(username)
      
      ActivityLogModel.create({
        username,
        aktivitas: 'LOGIN_FAILED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `Password salah. Sisa percobaan: ${attemptResult.remainingAttempts}. ${deviceDetail(device)}`,
      })
      
      if (attemptResult.locked) {
        return {
          success: false,
          message: 'Terlalu banyak percobaan login gagal. Akun diblokir selama 5 menit.',
        }
      }
      
      return {
        success: false,
        message: `Username atau Password Salah! Sisa percobaan: ${attemptResult.remainingAttempts}`,
      }
    }

    if (user.is_buyer) {
      const remoteLogin = await loginRemoteBuyer({ loginName: username, password, device, existingUser: user })
      if (remoteLogin?.success && remoteLogin.user) {
        return completeRemoteBuyerLogin(remoteLogin.user, device, remoteLogin.remote)
      }
      if (remoteLogin && !remoteLogin.success) {
        const code = String((remoteLogin.data as any)?.error_code ?? '').toUpperCase()
        if (code === 'OFFLINE' || code === 'CONNECTION_ERROR' || (user.subscription_expires_at && !isAccessExpired(user.subscription_expires_at))) {
          ActivityLogModel.create({
            username,
            aktivitas: 'REMOTE_LICENSE_OFFLINE_FALLBACK',
            modul: 'AUTH',
            tgl_aktivitas: new Date().toISOString(),
            ip_address: device.ipAddress ?? null,
            device_id: device.deviceId ?? null,
            user_agent: device.userAgent ?? null,
            event_type: 'subscription',
            detail: `License server tidak dapat dijangkau atau fallback aktif. Login memakai cache lokal. ${deviceDetail(device)}`,
          })
        } else {
          return {
            success: false,
            message: remoteLogin.message || 'Akun pembeli belum aktif di license server pusat',
            data: remoteLogin.data,
          }
        }
      }
    }

    const expiresAt = getEffectiveAccessExpiresAt(user)
    if (!hasUnlimitedAccessRole(user.hak_akses) && isAccessExpired(expiresAt)) {
      const remoteLogin = await loginRemoteBuyer({ loginName: username, password, device, existingUser: user })
      if (remoteLogin?.success && remoteLogin.user) {
        return completeRemoteBuyerLogin(remoteLogin.user, device, remoteLogin.remote)
      }

      ActivityLogModel.create({
        username,
        aktivitas: 'LOGIN_EXPIRED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        event_type: 'subscription',
        detail: `Masa akses akun berakhir pada ${expiresAt}. ${deviceDetail(device)}`,
      })

      return {
        success: false,
        message: 'Masa akses akun sudah berakhir. Silakan hubungi admin untuk perpanjangan atau upgrade paket.',
        error_code: 'EXPIRED',
      }
    }

    if (device.deviceId) {
      const deviceCheck = DeviceController.validateLogin(username, device.deviceId)
      if (!deviceCheck.allowed) {
        ActivityLogModel.create({
          username,
          aktivitas: deviceCheck.reason === 'device_limit' ? 'LOGIN_DEVICE_LIMIT' : 'LOGIN_DEVICE_REVOKED',
          modul: 'AUTH',
          tgl_aktivitas: new Date().toISOString(),
          ip_address: device.ipAddress ?? null,
          device_id: device.deviceId ?? null,
          user_agent: device.userAgent ?? null,
          event_type: 'device',
          detail: `${deviceCheck.reason}; current=${deviceCheck.current}; max=${deviceCheck.max}. ${deviceDetail(device)}`,
        })
        return {
          success: false,
          message: deviceCheck.reason === 'device_limit'
            ? `Batas device paket sudah tercapai (${deviceCheck.current}/${deviceCheck.max}). Silakan revoke device lama atau upgrade paket.`
            : 'Device ini sudah direvoke atau diblokir. Hubungi admin.',
          error_code: deviceCheck.reason === 'device_limit' ? 'DEVICE_LIMIT' : 'DEVICE_REVOKED',
          data: deviceCheck,
        }
      }
    }

    // Login successful - reset rate limiter
    rateLimiter.resetAttempts(username)
    PenggunaModel.updateLastLogin(username)

    // Track device
    if (device.deviceId) {
      DeviceController.upsert({
        username,
        device_id: device.deviceId,
        device_name: device.deviceName ?? undefined,
        platform: device.platform ?? undefined,
        os_name: device.osName ?? undefined,
        app_version: device.appVersion ?? undefined,
        ip_address: device.ipAddress ?? undefined,
      })
    }

    const authSession = user.must_change_password
      ? null
      : AuthSessionModel.create(username, device)

    // ─── 2FA OTP LOGIC (Placeholder) ───
    // const otp = Math.floor(100000 + Math.random() * 900000).toString()
    // if (user.no_telp) await WhatsAppService.sendMessage({ to: user.no_telp, message: `OTP Login: ${otp}` })

    // Log successful login
    ActivityLogModel.create({
      username,
      aktivitas: 'LOGIN',
      modul: 'AUTH',
      tgl_aktivitas: new Date().toISOString(),
      ip_address: device.ipAddress ?? null,
      device_id: device.deviceId ?? null,
      user_agent: device.userAgent ?? null,
      event_type: 'login',
      detail: `Login berhasil dengan hash type: ${hashType}. ${deviceDetail(device)}`,
    })

    return {
      success: true,
      message: user.must_change_password ? 'Password wajib diganti sebelum menggunakan aplikasi' : 'Login berhasil',
      data: toSession(user, authSession ? {
        token: authSession.token,
        expires_at: authSession.expires_at,
        device_id: device.deviceId ?? null,
      } : undefined),
    }
  }

  static async loginWithPin(username: string, pin: string, deviceInfo?: AuthDeviceInfo | string | null) {
    const device = withDetectedDeviceInfo(normalizeDeviceInfo(deviceInfo))
    username = (username?.trim() || '')

    if (!username || !pin?.trim()) {
      return { success: false, message: 'Username dan PIN tidak boleh kosong' }
    }

    const pinError = validatePin(pin)
    if (pinError) return { success: false, message: pinError }

    const limiterKey = `pin:${username}`
    const lockStatus = rateLimiter.isLocked(limiterKey)
    if (lockStatus.locked) {
      const minutes = Math.ceil((lockStatus.remainingTime || 0) / 60)
      ActivityLogModel.create({
        username,
        aktivitas: 'PIN_LOGIN_BLOCKED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `Login PIN diblokir. Tersisa ${minutes} menit. ${deviceDetail(device)}`,
      })
      return {
        success: false,
        message: `Login PIN diblokir karena terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`,
      }
    }

    const user = PenggunaModel.findActiveByUsername(username)
    const deny = (detail: string) => {
      const attemptResult = rateLimiter.recordFailedAttempt(limiterKey)
      ActivityLogModel.create({
        username,
        aktivitas: 'PIN_LOGIN_FAILED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `${detail}. Sisa percobaan: ${attemptResult.remainingAttempts}. ${deviceDetail(device)}`,
      })
      return {
        success: false,
        message: attemptResult.locked
          ? 'Terlalu banyak percobaan PIN gagal. Akun diblokir selama 5 menit.'
          : `Username atau PIN salah. Sisa percobaan: ${attemptResult.remainingAttempts}`,
      }
    }

    if (!user || user.hak_akses !== 'kasir' || !user.pin_enabled || !user.pin_hash) {
      return deny('PIN tidak aktif untuk user atau user bukan kasir')
    }

    const pinValid = await verifyPassword(pin, user.pin_hash)
    if (!pinValid) {
      return deny('PIN salah')
    }

    const expiresAt = getEffectiveAccessExpiresAt(user)
    if (!hasUnlimitedAccessRole(user.hak_akses) && isAccessExpired(expiresAt)) {
      ActivityLogModel.create({
        username,
        aktivitas: 'PIN_LOGIN_EXPIRED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        event_type: 'subscription',
        detail: `Masa akses akun berakhir pada ${expiresAt}. ${deviceDetail(device)}`,
      })

      return {
        success: false,
        message: 'Masa akses akun sudah berakhir. Silakan hubungi admin.',
        error_code: 'EXPIRED',
      }
    }

    if (device.deviceId) {
      const deviceCheck = DeviceController.validateLogin(username, device.deviceId)
      if (!deviceCheck.allowed) {
        ActivityLogModel.create({
          username,
          aktivitas: deviceCheck.reason === 'device_limit' ? 'PIN_LOGIN_DEVICE_LIMIT' : 'PIN_LOGIN_DEVICE_REVOKED',
          modul: 'AUTH',
          tgl_aktivitas: new Date().toISOString(),
          ip_address: device.ipAddress ?? null,
          device_id: device.deviceId ?? null,
          user_agent: device.userAgent ?? null,
          event_type: 'device',
          detail: `${deviceCheck.reason}; current=${deviceCheck.current}; max=${deviceCheck.max}. ${deviceDetail(device)}`,
        })
        return {
          success: false,
          message: deviceCheck.reason === 'device_limit'
            ? `Batas device paket sudah tercapai (${deviceCheck.current}/${deviceCheck.max}). Silakan revoke device lama atau upgrade paket.`
            : 'Device ini sudah direvoke atau diblokir. Hubungi admin.',
          error_code: deviceCheck.reason === 'device_limit' ? 'DEVICE_LIMIT' : 'DEVICE_REVOKED',
          data: deviceCheck,
        }
      }
      DeviceController.upsert({
        username,
        device_id: device.deviceId,
        device_name: device.deviceName ?? undefined,
        platform: device.platform ?? undefined,
        os_name: device.osName ?? undefined,
        app_version: device.appVersion ?? undefined,
        ip_address: device.ipAddress ?? undefined,
      })
    }

    rateLimiter.resetAttempts(limiterKey)
    PenggunaModel.updateLastLogin(username)
    const authSession = AuthSessionModel.create(username, device)

    ActivityLogModel.create({
      username,
      aktivitas: 'PIN_LOGIN',
      modul: 'AUTH',
      tgl_aktivitas: new Date().toISOString(),
      ip_address: device.ipAddress ?? null,
      device_id: device.deviceId ?? null,
      user_agent: device.userAgent ?? null,
      event_type: 'login',
      detail: `Login PIN kasir berhasil. ${deviceDetail(device)}`,
    })

    return {
      success: true,
      message: 'Login PIN berhasil',
      data: toSession(user, {
        token: authSession.token,
        expires_at: authSession.expires_at,
        device_id: device.deviceId ?? null,
      }),
    }
  }

  /**
   * Logout user
   */
  static logout(username: string, sessionToken?: string, deviceInfo?: AuthDeviceInfo | string | null) {
    const device = normalizeDeviceInfo(deviceInfo)
    if (sessionToken) {
      AuthSessionModel.revoke(sessionToken)
    }

    ActivityLogModel.create({
      username,
      aktivitas: 'LOGOUT',
      modul: 'AUTH',
      tgl_aktivitas: new Date().toISOString(),
      ip_address: device.ipAddress ?? null,
      device_id: device.deviceId ?? null,
      user_agent: device.userAgent ?? null,
      event_type: 'logout',
      detail: `Logout berhasil. ${deviceDetail(device)}`,
    })

    return { success: true, message: 'Logout berhasil' }
  }

  /**
   * Restore renderer session into the main-process session guard.
   * The renderer only sends username; role/status are reloaded from database.
   */
  static async restoreSession(input: string | RestoreSessionInput) {
    const username = (typeof input === 'string' ? input : input.username)?.trim() || ''
    const sessionToken = typeof input === 'string' ? '' : (input.sessionToken ?? '')
    const device = typeof input === 'string' ? {} : withDetectedDeviceInfo(normalizeDeviceInfo(input.deviceInfo))
    if (!username) {
      return { success: false, error_code: 'SESSION_INVALID', message: 'Session tidak valid' }
    }

    if (!sessionToken || !AuthSessionModel.validate(sessionToken, username)) {
      ActivityLogModel.create({
        username,
        aktivitas: 'SESSION_RESTORE_FAILED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `Token sesi tidak valid atau sudah kedaluwarsa. ${deviceDetail(device)}`,
      })
      return { success: false, error_code: 'SESSION_INVALID', message: 'Session tidak valid atau sudah kedaluwarsa' }
    }

    let user = PenggunaModel.findActiveByUsername(username)
    if (!user) {
      return { success: false, error_code: 'USER_NOT_FOUND', message: 'User tidak ditemukan atau tidak aktif' }
    }

    if (user.is_buyer) {
      const remote = await LicenseController.syncBuyerLicense(username, device)
      const code = String((remote.data as any)?.error_code ?? '').toUpperCase()
      if (!remote.success && ['BLOCKED', 'SUSPENDED', 'DEVICE_BLOCKED'].includes(code)) {
        ActivityLogModel.create({
          username,
          aktivitas: 'SESSION_RESTORE_REMOTE_BLOCKED',
          modul: 'AUTH',
          tgl_aktivitas: new Date().toISOString(),
          ip_address: device.ipAddress ?? null,
          device_id: device.deviceId ?? null,
          user_agent: device.userAgent ?? null,
          event_type: 'subscription',
          detail: `Session restore ditolak oleh license server pusat. code=${code}. ${deviceDetail(device)}`,
        })
        return {
          success: false,
          message: remote.message || 'Akun atau device diblokir dari server developer',
          error_code: code || 'BLOCKED',
          data: remote.data,
        }
      }

      const refreshed = PenggunaModel.findActiveByUsername(username)
      if (refreshed) user = refreshed
    }

    const expiresAt = getEffectiveAccessExpiresAt(user)
    if (!hasUnlimitedAccessRole(user.hak_akses) && isAccessExpired(expiresAt)) {
      return {
        success: false,
        error_code: 'EXPIRED',
        message: 'Masa akses akun sudah berakhir. Silakan hubungi admin untuk perpanjangan atau upgrade paket.',
      }
    }

    if (device.deviceId && DeviceController.isRevoked(username, device.deviceId)) {
      ActivityLogModel.create({
        username,
        aktivitas: 'SESSION_RESTORE_REVOKED_DEVICE',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        event_type: 'device',
        detail: `Session restore ditolak karena device revoked. ${deviceDetail(device)}`,
      })
      return { success: false, error_code: 'DEVICE_REVOKED', message: 'Device sudah direvoke atau diblokir' }
    }

    if (user.must_change_password) {
      return { success: false, error_code: 'MUST_CHANGE_PASSWORD', message: 'Password wajib diganti sebelum session dipulihkan' }
    }

    if (
      hasUnlimitedAccessRole(user.hak_akses)
      && typeof input !== 'string'
      && input.remoteLicenseToken
    ) {
      LicenseController.saveAdminSessionFromRemote({
        access_token: input.remoteLicenseToken,
        refresh_token: input.remoteLicenseRefreshToken ?? null,
      })
    }

    return {
      success: true,
      data: toSession(user),
    }
  }

  /**
   * Change password with validation
   */
  static async changePassword(
    usernameOrPayload: string | { username?: string; oldPassword?: string; oldPass?: string; newPassword?: string; newPass?: string; deviceInfo?: any },
    oldPasswordInput?: string,
    newPasswordInput?: string,
    deviceInfo?: AuthDeviceInfo | string | null
  ) {
    let username = ''
    let oldPassword = ''
    let newPassword = ''
    let deviceInput = deviceInfo

    if (usernameOrPayload && typeof usernameOrPayload === 'object') {
      username = String(usernameOrPayload.username ?? '').trim()
      oldPassword = String(usernameOrPayload.oldPassword ?? usernameOrPayload.oldPass ?? '')
      newPassword = String(usernameOrPayload.newPassword ?? usernameOrPayload.newPass ?? '')
      deviceInput = usernameOrPayload.deviceInfo ?? deviceInfo
    } else {
      username = String(usernameOrPayload ?? '').trim()
      oldPassword = String(oldPasswordInput ?? '')
      newPassword = String(newPasswordInput ?? '')
    }

    const device = withDetectedDeviceInfo(normalizeDeviceInfo(deviceInput))
    const user = PenggunaModel.findActiveByUsername(username)
    if (!user) {
      return { success: false, message: 'User tidak ditemukan' }
    }

    const validation = validatePasswordStrength(newPassword)
    if (!validation.valid) {
      return { success: false, message: validation.message }
    }

    const hashType = user.password_hash_type || 'sha1'
    let oldPasswordValid = false
    const remoteEmail = (user.email ?? '').trim().toLowerCase() || (EMAIL_PATTERN.test(username) ? username.trim().toLowerCase() : '')

    try {
      if (hashType === 'bcrypt') {
        oldPasswordValid = await verifyPassword(oldPassword, user.kata_sandi || '')
      } else {
        const storedPassword = user.kata_sandi || ''
        oldPasswordValid = isSHA1Hash(storedPassword)
          ? encryptPassword(oldPassword) === storedPassword
          : oldPassword === storedPassword
      }

      // If local check fails but email exists, verify old password against Supabase Cloud Auth
      if (!oldPasswordValid && EMAIL_PATTERN.test(remoteEmail)) {
        const cloudAuthCheck = await tryCloudSignIn(remoteEmail, oldPassword)
        if (cloudAuthCheck.success) {
          oldPasswordValid = true
        }
      }
    } catch (error) {
      console.error('Password verification error:', error)
      return { success: false, message: 'Terjadi kesalahan saat verifikasi password lama' }
    }

    if (!oldPasswordValid) {
      ActivityLogModel.create({
        username,
        aktivitas: 'CHANGE_PASSWORD_FAILED',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `Password lama salah. ${deviceDetail(device)}`,
      })

      return { success: false, message: 'Password lama salah' }
    }

    const originalPassword = user.kata_sandi ?? ''
    const originalPasswordHashType = user.password_hash_type ?? null
    const originalMustChange = Number(user.must_change_password ?? 0)
    const requiresRemoteSync = Number(user.is_buyer ?? 0) === 1 || user.hak_akses === 'developer'
    let localPasswordUpdated = false
    let remotePasswordUpdated = false

    try {
      const updateResult = await PenggunaModel.updatePassword(username, newPassword)
      localPasswordUpdated = Number((updateResult as { changes?: number } | undefined)?.changes ?? 0) > 0
      if (!localPasswordUpdated) {
        return { success: false, message: 'Gagal mengubah password' }
      }

      // Update Supabase Cloud Auth if user has an email
      if (EMAIL_PATTERN.test(remoteEmail)) {
        const cloudUpdate = await updatePasswordCloud(newPassword)
        if (cloudUpdate.success) {
          remotePasswordUpdated = true
        }
      }

      if (requiresRemoteSync && !remotePasswordUpdated) {
        if (EMAIL_PATTERN.test(remoteEmail)) {
          try {
            const remote = await LicenseController.changePassword({
              email: remoteEmail,
              oldPassword,
              newPassword,
            })
            if (remote?.success) {
              remotePasswordUpdated = true
            }
          } catch {
            // Ignore deprecated license API error if local/cloud update is done
          }
        }
      }

      AuthSessionModel.revokeAllForUser(username)

      ActivityLogModel.create({
        username,
        aktivitas: 'CHANGE_PASSWORD',
        modul: 'AUTH',
        tgl_aktivitas: new Date().toISOString(),
        ip_address: device.ipAddress ?? null,
        device_id: device.deviceId ?? null,
        user_agent: device.userAgent ?? null,
        detail: `Password berhasil diubah dan semua sesi lama dicabut. Strength: ${validation.strength}. ${deviceDetail(device)}`,
      })

      return {
        success: true,
        message: 'Password berhasil diubah',
        data: { strength: validation.strength },
      }
    } catch (error) {
      if (localPasswordUpdated && !remotePasswordUpdated) {
        sqlite.prepare(`
          UPDATE mediasoft_pengguna
          SET kata_sandi = ?,
              password_hash_type = ?,
              must_change_password = ?,
              tgl_wkt_edit = ?
          WHERE nama_pengguna = ?
        `).run(
          originalPassword,
          originalPasswordHashType,
          originalMustChange,
          new Date().toISOString(),
          username,
        )
      }
      console.error('Password update error:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Gagal mengubah password' }
    }
  }

  /**
   * Check if store identity exists (for first-login prompt)
   */
  static checkIdentitas() {
    const identitas = IdentitasModel.get()
    return { success: true, data: { hasIdentitas: !!identitas?.namatoko } }
  }

  /**
   * Get password migration status
   */
  static getMigrationStatus() {
    const allUsers = PenggunaModel.getAll()
    const total = allUsers.length
    const migrated = allUsers.filter(u => u.password_hash_type === 'bcrypt').length
    const percentage = total > 0 ? Math.round((migrated / total) * 100) : 0

    return {
      success: true,
      data: {
        total,
        migrated,
        pending: total - migrated,
        percentage,
      },
    }
  }
}
