import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Logika yang menyentuh uang dan stok diuji dengan database tiruan.
 * Modul database asli tidak dimuat, supaya test tidak membuka file database.
 */
const fakeSqlite = {
  prepare: vi.fn(),
  exec: vi.fn(),
}

vi.mock('../src/database/connection.js', () => ({
  sqlite: fakeSqlite,
  db: {},
  reopenDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}))

const { withTransaction, withOptimisticLock, batchInsert, batchUpdate, batchDelete } =
  await import('../src/backend/utils/transaction')
const { paginate } = await import('../src/backend/utils/pagination')
const { LoyaltyService } = await import('../src/backend/services/loyaltyService')
const { PromoService } = await import('../src/backend/services/promoService')
const { hashPassword, verifyPassword, isSHA1Hash, encryptData, decryptData } =
  await import('../src/backend/services/crypto')
const { normalizeHttpsUrl, normalizeSyncServerUrl } = await import('../src/shared/endpointSecurity')

function stubStatement(result: unknown) {
  return {
    get: vi.fn().mockReturnValue(result),
    all: vi.fn().mockReturnValue(Array.isArray(result) ? result : []),
    run: vi.fn().mockReturnValue({ changes: 1 }),
  }
}

beforeEach(() => {
  fakeSqlite.prepare.mockReset()
  fakeSqlite.exec.mockReset()
})

describe('transaction helpers', () => {
  it('commits a successful transaction', async () => {
    const result = await withTransaction(() => 'ok')

    expect(result).toEqual({ success: true, data: 'ok' })
    expect(fakeSqlite.exec).toHaveBeenCalledWith('BEGIN TRANSACTION')
    expect(fakeSqlite.exec).toHaveBeenCalledWith('COMMIT')
  })

  it('rolls back when the operation throws', async () => {
    const result = await withTransaction(() => {
      throw new Error('gagal')
    })

    expect(result.success).toBe(false)
    expect(fakeSqlite.exec).toHaveBeenCalledWith('ROLLBACK')
    expect(fakeSqlite.exec).not.toHaveBeenCalledWith('COMMIT')
  })

  it('refuses a table that is not on the allowlist', () => {
    const result = batchInsert('mediasoft_pengguna', [{ a: 1 }])

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/tidak diizinkan/i)
    expect(fakeSqlite.exec).toHaveBeenCalledWith('ROLLBACK')
  })

  it('refuses a column that is not on the allowlist', () => {
    const result = batchInsert('mediasoft_barang', [{ kd_barang: 'X', 'kata_sandi; DROP TABLE': 1 } as any])

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/tidak valid|tidak diizinkan/i)
  })

  it('refuses an identifier that is not a plain name', () => {
    const result = withOptimisticLock('mediasoft_barang; DROP TABLE', 1, 'kd_barang', 1, () => 1)

    expect(result.success).toBe(false)
    expect((result as any).error).toMatch(/tidak valid/i)
  })

  it('reports a version conflict instead of overwriting', () => {
    fakeSqlite.prepare.mockReturnValue(stubStatement({ version: 7 }))

    const result = withOptimisticLock('mediasoft_barang', 'B001', 'kd_barang', 3, () => 'updated')

    expect(result.success).toBe(false)
    expect((result as any).error).toMatch(/modified by another user/i)
  })

  it('bumps the version when the lock is held', () => {
    fakeSqlite.prepare.mockReturnValue(stubStatement({ version: 3 }))

    const result = withOptimisticLock('mediasoft_barang', 'B001', 'kd_barang', 3, () => 'updated')

    expect(result).toEqual({ success: true, data: 'updated' })
  })
})

describe('pagination', () => {
  it('clamps the limit and calculates the pages', () => {
    fakeSqlite.prepare
      .mockReturnValueOnce(stubStatement({ total: 250 }))
      .mockReturnValueOnce(stubStatement([{ id: 1 }]))

    const result = paginate('mediasoft_barang', { page: 2, limit: 500 }, '', [])

    expect(result.pagination.limit).toBe(100)
    expect(result.pagination.total).toBe(250)
    expect(result.pagination.totalPages).toBe(3)
    expect(result.pagination.hasNext).toBe(true)
    expect(result.pagination.hasPrev).toBe(true)
  })

  it('falls back to a safe column when the sort field is not a plain name', () => {
    const statements: string[] = []
    fakeSqlite.prepare.mockImplementation((sql: string) => {
      statements.push(sql)
      return stubStatement(sql.includes('COUNT') ? { total: 1 } : [])
    })

    paginate('mediasoft_barang', { sortBy: 'nama; DROP TABLE x' }, '', [])

    expect(statements.join(' ')).not.toContain('DROP TABLE')
    expect(statements.join(' ')).toContain('ORDER BY id DESC')
  })
})

describe('loyalty points', () => {
  it('gives one point per ten thousand rupiah', () => {
    expect(LoyaltyService.calculatePoints(10000)).toBe(1)
    expect(LoyaltyService.calculatePoints(19999)).toBe(1)
    expect(LoyaltyService.calculatePoints(25000)).toBe(2)
  })

  it('adds a bonus for the higher tiers', () => {
    expect(LoyaltyService.calculatePoints(10000, 2)).toBe(1)
    expect(LoyaltyService.calculatePoints(100000, 3)).toBe(15)
    expect(LoyaltyService.calculatePoints(100000, 4)).toBe(20)
  })

  it('picks the tier that matches the points', () => {
    fakeSqlite.prepare.mockReturnValue(stubStatement({ id: 3, min_points: 100, discount_percent: 5 }))

    const tier = LoyaltyService.getTierByPoints(150)

    expect(tier?.id).toBe(3)
  })
})

describe('promo validation', () => {
  function stubPromo(promo: Record<string, unknown>) {
    fakeSqlite.prepare.mockReturnValue(stubStatement(promo))
  }

  it('rejects an unknown code', () => {
    fakeSqlite.prepare.mockReturnValue(stubStatement(undefined))

    const result = PromoService.validatePromo('SALAH', 100000, [])

    expect(result.valid).toBe(false)
    expect(result.discount).toBe(0)
  })

  it('rejects a purchase below the minimum', () => {
    stubPromo({
      code: 'MIN10', type: 'PERCENTAGE', value: 10, min_purchase: 50000,
      usage_limit: null, usage_count: 0, is_active: 1,
    })

    const result = PromoService.validatePromo('MIN10', 10000, [])

    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/Minimum pembelian/)
  })

  it('rejects a promo whose quota is used up', () => {
    stubPromo({
      code: 'HABIS', type: 'PERCENTAGE', value: 10, min_purchase: 0,
      usage_limit: 5, usage_count: 5, is_active: 1,
    })

    const result = PromoService.validatePromo('HABIS', 100000, [])

    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/Kuota promo/)
  })

  it('caps a percentage discount at the maximum', () => {
    stubPromo({
      code: 'CAP', type: 'PERCENTAGE', value: 50, min_purchase: 0,
      max_discount: 20000, usage_limit: null, usage_count: 0, is_active: 1,
    })

    const result = PromoService.validatePromo('CAP', 100000, [])

    expect(result.valid).toBe(true)
    expect(result.discount).toBe(20000)
  })

  it('applies a fixed discount', () => {
    stubPromo({
      code: 'FIXED', type: 'FIXED', value: 15000, min_purchase: 0,
      usage_limit: null, usage_count: 0, is_active: 1,
    })

    const result = PromoService.validatePromo('FIXED', 100000, [])

    expect(result.valid).toBe(true)
    expect(result.discount).toBe(15000)
  })
})

describe('crypto service', () => {
  it('hashes a password with bcrypt and verifies it', async () => {
    const hash = await hashPassword('Kredensial-2026')

    expect(hash).not.toBe('Kredensial-2026')
    expect(await verifyPassword('Kredaniel-2026', hash)).toBe(false)
    expect(await verifyPassword('Kredensial-2026', hash)).toBe(true)
  })

  it('detects the legacy sha1 hash', () => {
    expect(isSHA1Hash('a'.repeat(40))).toBe(true)
    expect(isSHA1Hash('b'.repeat(64))).toBe(false)
  })

  it('encrypts and decrypts a value', () => {
    const key = 'kunci-uji-2026'
    const encrypted = encryptData('nilai-rahasia', key)

    expect(encrypted).not.toBe('nilai-rahasia')
    expect(encrypted.startsWith('v2gcm:')).toBe(true)
    expect(decryptData(encrypted, key)).toBe('nilai-rahasia')
  })

  it('refuses to decrypt with the wrong key', () => {
    const encrypted = encryptData('nilai-rahasia', 'kunci-uji-2026')

    expect(decryptData(encrypted, 'kunci-salah')).toBe('')
  })
})

describe('endpoint security', () => {
  it('rejects a plain http endpoint', () => {
    expect(normalizeHttpsUrl('http://contoh.test/api').valid).toBe(false)
  })

  it('rejects a placeholder host', () => {
    expect(normalizeHttpsUrl('https://your-pos.com/api').valid).toBe(false)
  })

  it('accepts a proper https endpoint', () => {
    expect(normalizeHttpsUrl('https://license.example.com/api').valid).toBe(true)
  })

  it('allows plain http only for a private address on the sync server', () => {
    expect(normalizeSyncServerUrl('http://192.168.1.10:38573').valid).toBe(true)
    expect(normalizeSyncServerUrl('http://server-perusahaan.local:38573').valid).toBe(true)
    expect(normalizeSyncServerUrl('http://contoh-publik.test:38573').valid).toBe(false)
  })
})
