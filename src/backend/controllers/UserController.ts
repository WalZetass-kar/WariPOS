import { PenggunaModel } from '../models/PenggunaModel.js'
import { ActivityLogModel } from '../models/ActivityLogModel.js'
import { AuthSessionModel } from '../models/AuthSessionModel.js'
import { sqlite } from '../../database/connection.js'
import { demoSession } from '../services/demoSessionManager.js'
import { validatePasswordStrength } from '../../shared/passwordPolicy.js'
import { hashPassword } from '../services/crypto.js'
import { LicenseController } from './LicenseController.js'
import { getSubscriptionStatus, hasSubscriptionBypass } from '../middleware/subscriptionGuard.js'

// Role hierarchy: developer > admin > operator > kasir
const ROLE_HIERARCHY = ['developer', 'admin', 'operator', 'kasir']
const CAN_MANAGE_PERMISSIONS = ['developer'] // Can set permissions for others
const UNLIMITED_ACCESS_ROLES = ['developer']
const LOCAL_ROLES = new Set(ROLE_HIERARCHY)
const ADMIN_MANAGED_ROLES = new Set(['operator', 'kasir'])
const PIN_PATTERN = /^\d{4,8}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UserRoleRecord = { hak_akses?: string | null } | null | undefined

function isDeveloperAccount(user: UserRoleRecord): boolean {
  return user?.hak_akses === 'developer'
}

function developerLockedMessage(action: string): string {
  return `Akun dengan role developer tidak dapat ${action}`
}

function normalizeLocalRole(role?: string | null): string {
  if (role === 'superadmin') return 'developer'
  return LOCAL_ROLES.has(role ?? '') ? String(role) : 'kasir'
}

function normalizeAccessExpiresAt(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined
  if (!value?.trim()) return null

  const raw = value.trim()
  const date = raw.includes('T')
    ? new Date(raw)
    : new Date(`${raw}T23:59:59.999`)

  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function getDefaultSubscriptionExpiry(planId?: number | null): string | null {
  if (!planId) return null
  const plan = sqlite
    .prepare('SELECT duration_days FROM mediasoft_subscription_plans WHERE id = ?')
    .get(planId) as { duration_days?: number | null } | undefined
  const days = plan?.duration_days ?? 0
  if (!days || days <= 0) return null
  return addDays(new Date(), days).toISOString()
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function validatePin(pin?: string | null): string | null {
  if (!pin) return null
  return PIN_PATTERN.test(pin) ? null : 'PIN kasir harus 4-8 digit angka'
}

function getCallerAccount(username?: string | null) {
  if (!username) return null
  const row = sqlite.prepare(`
    SELECT nama_pengguna, hak_akses, is_buyer, subscription_plan_id
    FROM mediasoft_pengguna
    WHERE nama_pengguna = ?
  `).get(username) as { nama_pengguna: string; hak_akses?: string | null; is_buyer?: number | null; subscription_plan_id?: number | null } | undefined
  return row ?? null
}

function countPlanManagedLocalUsers(): number {
  const row = sqlite.prepare(`
    SELECT COUNT(*) AS c
    FROM mediasoft_pengguna
    WHERE COALESCE(hak_akses, '') != 'developer'
  `).get() as { c?: number } | undefined
  return Number(row?.c ?? 0)
}

function validateLocalUserLimit(caller?: string | null): string | null {
  if (!caller || hasSubscriptionBypass(caller)) return null

  const account = getCallerAccount(caller)
  if (!account) return null
  const isPlanManaged = Number(account.is_buyer ?? 0) === 1 || !!account.subscription_plan_id
  if (!isPlanManaged) return null

  const status = getSubscriptionStatus(caller)
  if (status.is_expired) {
    return 'Paket pembeli sudah berakhir. Upgrade atau perpanjang paket sebelum menambah pengguna lokal.'
  }
  if (status.feature_flags.multi_user === false) {
    return 'Paket pembeli belum mengaktifkan multi-user. Aktifkan fitur multi_user di Developer Panel -> Paket.'
  }

  const maxUsers = Number(status.max_users ?? 1)
  if (maxUsers !== -1) {
    const used = countPlanManagedLocalUsers()
    if (used >= maxUsers) {
      return `Paket pembeli hanya mengizinkan ${maxUsers} pengguna lokal termasuk owner. Ubah Max User di Developer Panel -> Paket untuk menambah kasir lagi.`
    }
  }

  return null
}

function validateRoleAssignment(caller: string | undefined, targetRole: string): string | null {
  const callerAccount = getCallerAccount(caller)
  const callerRole = callerAccount?.hak_akses ?? null
  if (callerRole === 'developer' || callerRole === 'super_admin') return null
  if (callerRole === 'admin' && ADMIN_MANAGED_ROLES.has(targetRole)) return null
  return 'Akun Anda tidak memiliki izin untuk membuat atau mengubah role tersebut.'
}

export class UserController {
  static getAll() {
    try {
      const sanitized = sqlite.prepare(`
        SELECT
          u.nama_pengguna,
          u.nama_lengkap,
          u.email,
          u.no_telp,
          u.hak_akses,
          u.status_user,
          u.terakhir_login,
          u.tgl_wkt_simpan,
          u.access_expires_at,
          u.must_change_password,
          u.pin_enabled,
          u.subscription_plan_id,
          u.subscription_expires_at,
          u.is_buyer,
          p.name AS plan_name,
          COALESCE(p.max_devices, 1) AS max_devices,
          (
            SELECT COUNT(*)
            FROM mediasoft_user_devices d
            WHERE d.username = u.nama_pengguna AND d.status = 'active'
          ) AS current_devices
        FROM mediasoft_pengguna u
        LEFT JOIN mediasoft_subscription_plans p ON p.id = u.subscription_plan_id
        ORDER BY u.tgl_wkt_simpan DESC, u.nama_pengguna ASC
      `).all()
      return { success: true, data: sanitized }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static async create(data: {
    nama_pengguna: string
    kata_sandi?: string
    password?: string // Accept both kata_sandi and password
    nama_lengkap: string
    email?: string
    no_telp?: string
    hak_akses?: string
    access_expires_at?: string | null
    permissions?: Record<string, boolean>
    pin?: string
    pin_enabled?: boolean | number
    subscription_plan_id?: number | null
    subscription_expires_at?: string | null
    is_buyer?: boolean | number
    _caller?: string
  }) {
    try {
      // Check if username already exists
      const existing = PenggunaModel.findByUsername(data.nama_pengguna)
      if (existing) {
        return { success: false, message: 'Username sudah digunakan' }
      }

      // Get password from either field
      const plainPassword = data.kata_sandi || data.password
      if (!plainPassword) {
        return { success: false, message: 'Password wajib diisi' }
      }

      const passwordValidation = validatePasswordStrength(plainPassword)
      if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message }
      }

      const pinError = validatePin(data.pin)
      if (pinError) return { success: false, message: pinError }
      const role = normalizeLocalRole(data.hak_akses)
      const roleError = validateRoleAssignment(data._caller, role)
      if (roleError) return { success: false, message: roleError }

      if (data.pin_enabled && role !== 'kasir') {
        return { success: false, message: 'PIN login hanya boleh diaktifkan untuk role kasir' }
      }

      const localUserLimitError = validateLocalUserLimit(data._caller)
      if (localUserLimitError) return { success: false, message: localUserLimitError }

      await PenggunaModel.create({
        nama_pengguna: data.nama_pengguna,
        kata_sandi: plainPassword,
        nama_lengkap: data.nama_lengkap,
        email: data.email,
        no_telp: data.no_telp,
        hak_akses: role,
        access_expires_at: UNLIMITED_ACCESS_ROLES.includes(role)
          ? null
          : normalizeAccessExpiresAt(data.access_expires_at),
        must_change_password: 1,
        pin_hash: data.pin ? await hashPassword(data.pin) : null,
        pin_enabled: data.pin && data.pin_enabled ? 1 : 0,
        subscription_plan_id: data.subscription_plan_id ?? null,
        subscription_expires_at: normalizeAccessExpiresAt(data.subscription_expires_at)
          ?? getDefaultSubscriptionExpiry(data.subscription_plan_id),
        is_buyer: data.is_buyer ? 1 : 0,
      })

      if (data.permissions) {
        this.savePermissions(data.nama_pengguna, data.permissions)
      }

      // Activity log
      if (data._caller) {
        ActivityLogModel.log(
          data._caller,
          `Menambah user baru: ${data.nama_pengguna}`,
          'USER_MANAGEMENT',
          `Hak akses: ${role}; paket=${data.subscription_plan_id ?? '-'}; buyer=${data.is_buyer ? 1 : 0}`,
          data.subscription_plan_id ? 'subscription' : 'general'
        )
      }

      return { success: true, message: 'User berhasil ditambahkan' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static async update(username: string, data: {
    nama_lengkap?: string
    email?: string
    no_telp?: string
    foto?: string | null
    hak_akses?: string
    status_user?: string
    access_expires_at?: string | null
    permissions?: Record<string, boolean>
    pin?: string
    pin_enabled?: boolean | number
    subscription_plan_id?: number | null
    subscription_expires_at?: string | null
    is_buyer?: boolean | number
    _caller?: string
  }) {
    try {
      const {
        _caller,
        permissions,
        pin: _pin,
        pin_enabled: requestedPinEnabled,
        confirmPin: _confirmPin,
        ...payload
      } = data as typeof data & { confirmPin?: string }
      const callerIsPrivileged = CAN_MANAGE_PERMISSIONS.includes(demoSession.getRole() ?? '')
      const existing = PenggunaModel.findByUsername(username)
      if (!existing) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(existing)) {
        return { success: false, message: developerLockedMessage('diubah') }
      }

      const callerUsername = _caller || demoSession.getUsername()
      if (!callerIsPrivileged && callerUsername && callerUsername !== username) {
        return { success: false, message: 'Anda hanya dapat mengubah profil akun Anda sendiri' }
      }

      const pinError = validatePin(data.pin)
      if (pinError) return { success: false, message: pinError }

      const targetRole = normalizeLocalRole(payload.hak_akses ?? existing?.hak_akses ?? 'kasir')
      if (requestedPinEnabled && targetRole !== 'kasir') {
        return { success: false, message: 'PIN login hanya boleh diaktifkan untuk role kasir' }
      }
      if (requestedPinEnabled && !data.pin && !existing.pin_hash) {
        return { success: false, message: 'Isi PIN kasir sebelum mengaktifkan login PIN' }
      }
      const normalizedPayload: Record<string, unknown> = {
        ...payload,
        hak_akses: payload.hak_akses === undefined ? undefined : targetRole,
        access_expires_at: UNLIMITED_ACCESS_ROLES.includes(targetRole)
          ? null
          : normalizeAccessExpiresAt(payload.access_expires_at),
      }
      if (payload.hak_akses === undefined) delete normalizedPayload.hak_akses
      if (payload.subscription_plan_id !== undefined) {
        normalizedPayload.subscription_plan_id = payload.subscription_plan_id ?? null
      }
      if (payload.subscription_expires_at !== undefined) {
        normalizedPayload.subscription_expires_at = normalizeAccessExpiresAt(payload.subscription_expires_at)
      } else if (payload.subscription_plan_id !== undefined) {
        normalizedPayload.subscription_expires_at = getDefaultSubscriptionExpiry(payload.subscription_plan_id)
      }
      if (payload.is_buyer !== undefined) {
        normalizedPayload.is_buyer = payload.is_buyer ? 1 : 0
      }

      if (!callerIsPrivileged) {
        // Non-privileged caller: strip role/status/access controls.
        const { hak_akses: _r, status_user: _s, access_expires_at: _e, ...safe } = normalizedPayload
        PenggunaModel.update(username, safe)
      } else {
        PenggunaModel.update(username, normalizedPayload)
      }

      if (permissions && callerIsPrivileged) {
        this.savePermissions(username, permissions)
      }

      if (callerIsPrivileged && (data.pin || requestedPinEnabled !== undefined)) {
        const nextPinHash = data.pin ? await hashPassword(data.pin) : existing.pin_hash ?? null
        PenggunaModel.updatePin(username, nextPinHash, Boolean(requestedPinEnabled))
      }

      // Activity log
      if (_caller) {
        const changes = Object.keys(payload).filter(k => k !== '_caller').join(', ')
        const eventType = ['subscription_plan_id', 'subscription_expires_at', 'access_expires_at', 'is_buyer']
          .some(key => Object.prototype.hasOwnProperty.call(payload, key))
          ? 'subscription'
          : 'general'
        ActivityLogModel.log(
          _caller,
          `Mengubah data user: ${username}`,
          'USER_MANAGEMENT',
          `Field yang diubah: ${changes}`,
          eventType
        )
      }

      return { success: true, message: 'User berhasil diupdate' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static async changePassword(username: string, oldPassword: string, newPassword: string) {
    let localPasswordUpdated = false
    let remotePasswordUpdated = false
    let originalPassword = ''
    let originalPasswordHashType: string | null = null
    let originalMustChange = 0

    try {
      const user = PenggunaModel.findByUsername(username)
      if (!user) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(user)) {
        return { success: false, message: developerLockedMessage('diubah passwordnya') }
      }

      // Verify old password (support both SHA1 and bcrypt)
      const { verifyPassword, isSHA1Hash, encryptPassword } = await import('../services/crypto.js')
      
      let isValid = false
      if (isSHA1Hash(user.kata_sandi || '')) {
        // Old SHA1 password
        const oldEncrypted = encryptPassword(oldPassword)
        isValid = user.kata_sandi === oldEncrypted
      } else if ((user.kata_sandi || '').startsWith('$2')) {
        // Bcrypt password
        isValid = await verifyPassword(oldPassword, user.kata_sandi || '')
      } else {
        // Legacy plaintext password from older local databases.
        isValid = oldPassword === user.kata_sandi
      }

      if (!isValid) {
        return { success: false, message: 'Password lama salah' }
      }

      const passwordValidation = validatePasswordStrength(newPassword)
      if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message }
      }

      const requiresRemoteSync = Number(user.is_buyer ?? 0) === 1
      const remoteEmail = (user.email ?? '').trim().toLowerCase() || (EMAIL_PATTERN.test(username) ? username.trim().toLowerCase() : '')
      originalPassword = user.kata_sandi ?? ''
      originalPasswordHashType = user.password_hash_type ?? null
      originalMustChange = Number(user.must_change_password ?? 0)

      const updateResult = await PenggunaModel.updatePassword(username, newPassword)
      localPasswordUpdated = Number((updateResult as { changes?: number } | undefined)?.changes ?? 0) > 0
      if (!localPasswordUpdated) {
        return { success: false, message: 'Gagal mengubah password' }
      }

      if (requiresRemoteSync) {
        if (!EMAIL_PATTERN.test(remoteEmail)) {
          throw new Error('Email akun tidak valid untuk sinkronisasi password ke license server')
        }

        const remote = await LicenseController.changePassword({
          email: remoteEmail,
          oldPassword,
          newPassword,
        })

        if (!remote?.success) {
          throw new Error(remote?.message || 'Gagal sinkronisasi password ke license server')
        }

        remotePasswordUpdated = true
      }

      AuthSessionModel.revokeAllForUser(username)

      return { success: true, message: 'Password berhasil diubah' }
    } catch (error) {
      if (localPasswordUpdated && !remotePasswordUpdated) {
        try {
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
        } catch {
          // Ignore restore failures; the original error will be returned below.
        }
      }
      return { success: false, message: String(error) }
    }
  }

  static async resetPassword(username: string, newPassword: string, caller?: string) {
    try {
      const user = PenggunaModel.findByUsername(username)
      if (!user) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(user)) {
        return { success: false, message: developerLockedMessage('direset passwordnya') }
      }

      if (user.is_buyer) {
        return { success: false, message: 'Reset password akun pembeli dilakukan melalui tab Pembeli di Developer Panel' }
      }

      const passwordValidation = validatePasswordStrength(newPassword)
      if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message }
      }

      await PenggunaModel.updatePassword(username, newPassword, true)
      AuthSessionModel.revokeAllForUser(username)

      // Activity log
      if (caller) {
        ActivityLogModel.log(
          caller,
          `Mereset password user: ${username}`,
          'USER_MANAGEMENT'
        )
      }

      return { success: true, message: 'Password berhasil direset. User wajib mengganti password saat login berikutnya' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static delete(username: string, caller?: string) {
    try {
      if (caller && username === caller) {
        return { success: false, message: 'Anda tidak dapat menghapus akun yang sedang digunakan' }
      }

      const user = PenggunaModel.findByUsername(username)
      if (!user) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(user)) {
        return { success: false, message: developerLockedMessage('dihapus') }
      }

      const deleteUser = sqlite.transaction(() => {
        sqlite.prepare('DELETE FROM mediasoft_grup_pengguna_hak_akses WHERE nama_grup = ?').run(username)
        sqlite.prepare('DELETE FROM mediasoft_grup_pengguna WHERE nama_grup = ?').run(username)
        sqlite.prepare('DELETE FROM mediasoft_error_logs WHERE user_id = ?').run(username)
        sqlite.prepare('DELETE FROM mediasoft_shifts WHERE user_id = ?').run(username)
        sqlite.prepare('DELETE FROM mediasoft_debt_payments WHERE created_by = ?').run(username)
        sqlite.prepare('DELETE FROM mediasoft_auth_sessions WHERE username = ?').run(username)
        sqlite.prepare('DELETE FROM mediasoft_user_devices WHERE username = ?').run(username)
        PenggunaModel.delete(username)

        if (caller) {
          ActivityLogModel.log(
            caller,
            `Menghapus user: ${username}`,
            'USER_MANAGEMENT',
            `Nama: ${user.nama_lengkap}, Hak akses: ${user.hak_akses}`
          )
        }
      })

      deleteUser()

      return { success: true, message: 'User berhasil dihapus' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static toggleStatus(username: string, caller?: string) {
    try {
      const user = PenggunaModel.findByUsername(username)
      if (!user) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(user)) {
        return { success: false, message: developerLockedMessage('diubah statusnya') }
      }

      const newStatus = user.status_user === 'Aktif' ? 'Nonaktif' : 'Aktif'
      PenggunaModel.update(username, { status_user: newStatus })

      // Activity log
      if (caller) {
        ActivityLogModel.log(
          caller,
          `Mengubah status user: ${username}`,
          'USER_MANAGEMENT',
          `Status: ${user.status_user} → ${newStatus}`
        )
      }

      return { success: true, message: `User berhasil di${newStatus === 'Aktif' ? 'aktifkan' : 'nonaktifkan'}` }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static extendAccess(username: string, days: number, caller?: string) {
    try {
      if (!Number.isFinite(days) || days <= 0) {
        return { success: false, message: 'Jumlah hari perpanjangan harus lebih dari 0' }
      }

      const user = PenggunaModel.findByUsername(username)
      if (!user) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(user)) {
        return { success: false, message: developerLockedMessage('diubah masa aksesnya') }
      }

      const now = new Date()
      const currentExpiry = user.access_expires_at ? new Date(user.access_expires_at) : null
      const base = currentExpiry && currentExpiry > now ? currentExpiry : now
      const nextExpiry = addDays(base, Math.floor(days)).toISOString()

      PenggunaModel.update(username, {
        access_expires_at: nextExpiry,
        subscription_expires_at: user.subscription_plan_id ? nextExpiry : user.subscription_expires_at,
      })

      if (caller) {
        ActivityLogModel.log(
          caller,
          `Memperpanjang masa akses user: ${username}`,
          'USER_MANAGEMENT',
          `Tambah ${Math.floor(days)} hari, berlaku sampai ${nextExpiry}`
        )
      }

      return { success: true, message: 'Masa akses berhasil diperpanjang', data: { access_expires_at: nextExpiry } }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static block(username: string, blocked: boolean, caller?: string) {
    try {
      const user = PenggunaModel.findByUsername(username)
      if (!user) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(user)) {
        return { success: false, message: developerLockedMessage('diblokir atau diaktifkan') }
      }

      const status_user = blocked ? 'Nonaktif' : 'Aktif'
      PenggunaModel.update(username, { status_user })
      if (blocked) {
        AuthSessionModel.revokeAllForUser(username)
      }

      if (caller) {
        ActivityLogModel.log(
          caller,
          `${blocked ? 'Memblokir' : 'Membuka blokir'} user: ${username}`,
          'USER_MANAGEMENT',
          `Status: ${user.status_user} → ${status_user}`
        )
      }

      return { success: true, message: blocked ? 'User berhasil diblokir' : 'User berhasil diaktifkan' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static getPermissions(username: string) {
    try {
      const rows = sqlite.prepare(
        'SELECT menu_code, status FROM mediasoft_grup_pengguna_hak_akses WHERE nama_grup = ?'
      ).all(username) as { menu_code: string; status: string }[]
      const permissions: Record<string, boolean> = {}
      for (const r of rows) permissions[r.menu_code] = r.status === 'True'
      return { success: true, data: permissions }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static savePermissions(username: string, permissions: Record<string, boolean>) {
    try {
      const user = PenggunaModel.findByUsername(username)
      if (!user) {
        return { success: false, message: 'User tidak ditemukan' }
      }

      if (isDeveloperAccount(user)) {
        return { success: false, message: developerLockedMessage('diubah izinnya') }
      }

      sqlite.prepare('INSERT OR IGNORE INTO mediasoft_grup_pengguna (nama_grup) VALUES (?)').run(username)
      const removeExisting = sqlite.prepare('DELETE FROM mediasoft_grup_pengguna_hak_akses WHERE nama_grup = ?')
      const insert = sqlite.prepare(`
        INSERT INTO mediasoft_grup_pengguna_hak_akses (nama_grup, menu_code, status)
        VALUES (?, ?, ?)
      `)
      const run = sqlite.transaction(() => {
        removeExisting.run(username)
        for (const [menu_code, allowed] of Object.entries(permissions)) {
          insert.run(username, menu_code, allowed ? 'True' : 'False')
        }
      })
      run()
      return { success: true, message: 'Izin akses berhasil disimpan' }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }
}
