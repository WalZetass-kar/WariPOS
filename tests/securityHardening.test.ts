import { describe, expect, it, afterEach } from 'vitest'
import { isDeveloperUser, normalizeRole } from '../src/shared/config/rbac'
import { migrateLegacyDeveloperRoles } from '../src/database/legacyDeveloperRole'
import { encryptSecret, decryptSecret, isPlainSecret } from '../src/backend/services/secretBox'
import { demoSession } from '../src/backend/services/demoSessionManager'
import { DemoWriteBlockedError, guardedWriteSync, safeWrite } from '../src/backend/services/dbWriteGuard'

afterEach(() => {
  demoSession.clearSession()
})

describe('developer access', () => {
  it('grants access only from the role stored in the database', () => {
    expect(isDeveloperUser({ hak_akses: 'developer' })).toBe(true)
    expect(isDeveloperUser({ hak_akses: 'super_admin' })).toBe(true)
    expect(isDeveloperUser({ hak_akses: 'superadmin' })).toBe(true)
  })

  it('refuses access for every other role', () => {
    expect(isDeveloperUser({ hak_akses: 'admin' })).toBe(false)
    expect(isDeveloperUser({ hak_akses: 'operator' })).toBe(false)
    expect(isDeveloperUser({ hak_akses: 'kasir' })).toBe(false)
    expect(isDeveloperUser({ hak_akses: 'demo' })).toBe(false)
    expect(isDeveloperUser({ hak_akses: null })).toBe(false)
    expect(isDeveloperUser(null)).toBe(false)
  })

  it('refuses access for identity patterns that used to grant it', () => {
    expect(isDeveloperUser({ nama_pengguna: 'developer' })).toBe(false)
    expect(isDeveloperUser({ nama_pengguna: 'mihwalmaulana' })).toBe(false)
    expect(isDeveloperUser({ nama_lengkap: 'Mihwal Maulana [developer]' })).toBe(false)
    expect(isDeveloperUser({ email: 'mihwalmaulana@zetass.dev' })).toBe(false)
    expect(isDeveloperUser({ email: 'admin@zetass.dev' })).toBe(false)
  })

  it('keeps the role alias mapping intact', () => {
    expect(normalizeRole('superadmin')).toBe('developer')
    expect(normalizeRole('owner')).toBe('admin')
    expect(normalizeRole('user')).toBe('kasir')
  })
})

describe('legacy developer role migration', () => {
  function createFakeSqlite(rows: Array<Record<string, string | null>>) {
    const updates: Array<{ username: string; role: string }> = []
    return {
      updates,
      api: {
        prepare(sql: string) {
          if (sql.includes('SELECT')) {
            return { all: () => rows }
          }
          return {
            run: (params: unknown[]) => {
              updates.push({ username: String(params[0]), role: 'developer' })
            },
          }
        },
      } as any,
    }
  }

  it('promotes the accounts that used to rely on the identity pattern', () => {
    const fake = createFakeSqlite([
      { nama_pengguna: 'mihwalmaulana', nama_lengkap: 'Mihwal Maulana', email: 'mihwalmaulana@zetass.dev', hak_akses: 'kasir' },
      { nama_pengguna: 'kasir01', nama_lengkap: 'Kasir Satu', email: 'kasir01@toko.id', hak_akses: 'kasir' },
    ])

    const promoted = migrateLegacyDeveloperRoles(fake.api)

    expect(promoted).toBe(1)
    expect(fake.updates).toEqual([{ username: 'mihwalmaulana', role: 'developer' }])
  })

  it('leaves accounts that already carry a role untouched', () => {
    const fake = createFakeSqlite([
      { nama_pengguna: 'developer', nama_lengkap: 'Super Admin', email: 'dev@toko.id', hak_akses: 'developer' },
      { nama_pengguna: 'admin', nama_lengkap: 'Admin Toko', email: 'admin@toko.id', hak_akses: 'admin' },
    ])

    expect(migrateLegacyDeveloperRoles(fake.api)).toBe(0)
    expect(fake.updates).toEqual([])
  })
})

describe('license token encryption at rest', () => {
  it('round trips a value', () => {
    const encrypted = encryptSecret('super-secret-token')
    expect(encrypted).not.toBe('super-secret-token')
    expect(decryptSecret(encrypted)).toBe('super-secret-token')
  })

  it('keeps a plain value readable so old rows still work', () => {
    expect(decryptSecret('plain-token')).toBe('plain-token')
    expect(isPlainSecret('plain-token')).toBe(true)
    expect(isPlainSecret(encryptSecret('plain-token'))).toBe(false)
  })

  it('does not encrypt twice', () => {
    const once = encryptSecret('token-value')
    expect(encryptSecret(once)).toBe(once)
  })

  it('returns an empty value for a payload that cannot be decrypted', () => {
    expect(decryptSecret('v1:garbage')).toBe('')
  })
})

describe('demo write guard', () => {
  it('blocks writes while a demo session is active', () => {
    demoSession.setSession('demo', 'demo')
    expect(() => safeWrite('barang:create')).toThrow(DemoWriteBlockedError)
    expect(() => guardedWriteSync('penjualan:create', () => 'should not run')).toThrow(DemoWriteBlockedError)
  })

  it('lets writes pass for a regular cashier session', () => {
    demoSession.setSession('kasir', 'kasir')
    expect(guardedWriteSync('barang:create', () => 'ok')).toBe('ok')
  })
})
