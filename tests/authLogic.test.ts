import { describe, it, expect } from 'vitest'

function isAccessExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false
  const expires = new Date(expiresAt)
  return !Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()
}

function getAccessDaysRemaining(expiresAt?: string | null): number | null {
  if (!expiresAt) return null
  const expires = new Date(expiresAt)
  if (Number.isNaN(expires.getTime())) return null
  return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000))
}

const PIN_PATTERN = /^\d{4,8}$/
function validatePin(pin: string): string | null {
  if (!PIN_PATTERN.test(pin)) return 'PIN kasir harus 4-8 digit angka'
  return null
}

describe('Auth Logic', () => {
  describe('isAccessExpired', () => {
    it('null tidak expired', () => expect(isAccessExpired(null)).toBe(false))
    it('undefined tidak expired', () => expect(isAccessExpired(undefined)).toBe(false))
    it('tanggal lampau expired', () => expect(isAccessExpired('2020-01-01T00:00:00Z')).toBe(true))
    it('tanggal mendatang tidak expired', () => {
      const future = new Date(Date.now() + 86400000 * 30).toISOString()
      expect(isAccessExpired(future)).toBe(false)
    })
    it('tanggal invalid tidak expired', () => expect(isAccessExpired('invalid')).toBe(false))
  })

  describe('getAccessDaysRemaining', () => {
    it('null input returns null', () => expect(getAccessDaysRemaining(null)).toBeNull())
    it('invalid date returns null', () => expect(getAccessDaysRemaining('bukan-tanggal')).toBeNull())
    it('expired date returns 0', () => expect(getAccessDaysRemaining('2020-01-01')).toBe(0))
    it('30 hari ke depan returns ~30', () => {
      const future = new Date(Date.now() + 86400000 * 30).toISOString()
      const days = getAccessDaysRemaining(future)
      expect(days).toBeGreaterThan(25)
      expect(days).toBeLessThanOrEqual(30)
    })
  })

  describe('validatePin', () => {
    it('PIN 4 digit valid', () => expect(validatePin('1234')).toBeNull())
    it('PIN 8 digit valid', () => expect(validatePin('12345678')).toBeNull())
    it('PIN 3 digit tidak valid', () => expect(validatePin('123')).not.toBeNull())
    it('PIN berisi huruf tidak valid', () => expect(validatePin('12ab')).not.toBeNull())
    it('PIN kosong tidak valid', () => expect(validatePin('')).not.toBeNull())
  })

  describe('Trial 3 Hari Access', () => {
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

    it('seluruh fitur aktif selama masa trial', () => {
      Object.values(TRIAL_FEATURE_FLAGS).forEach(enabled => {
        expect(enabled).toBe(true)
      })
    })

    it('trial aktif tidak expired dalam 3 hari', () => {
      const trialExpiry = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()
      expect(isAccessExpired(trialExpiry)).toBe(false)
      const remaining = getAccessDaysRemaining(trialExpiry)
      expect(remaining).toBeGreaterThanOrEqual(2)
      expect(remaining).toBeLessThanOrEqual(3)
    })

    it('trial expired setelah lewat dari 3 hari', () => {
      const pastExpiry = new Date(Date.now() - 1000).toISOString()
      expect(isAccessExpired(pastExpiry)).toBe(true)
      expect(getAccessDaysRemaining(pastExpiry)).toBe(0)
    })
  })
})
