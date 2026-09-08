import { describe, it, expect } from 'vitest'

function formatQueueNumber(num: number, prefix = ''): string {
  const padded = String(num).padStart(3, '0')
  return prefix ? `${prefix}-${padded}` : `#${padded}`
}

function getSpeechAnnouncement(nomor_antrian: number, nomor_meja?: string | null): string {
  return nomor_meja
    ? `Nomor antrian ${nomor_antrian}, untuk meja ${nomor_meja}, silakan mengambil pesanan Anda.`
    : `Nomor antrian ${nomor_antrian}, silakan mengambil pesanan di kasir.`
}

describe('Queue Logic & Formatting', () => {
  describe('formatQueueNumber', () => {
    it('formats single-digit numbers with 3-digit zero padding', () => {
      expect(formatQueueNumber(1)).toBe('#001')
      expect(formatQueueNumber(7)).toBe('#007')
    })

    it('formats double-digit numbers with 3-digit zero padding', () => {
      expect(formatQueueNumber(42)).toBe('#042')
      expect(formatQueueNumber(99)).toBe('#099')
    })

    it('formats 3-digit numbers', () => {
      expect(formatQueueNumber(105)).toBe('#105')
      expect(formatQueueNumber(999)).toBe('#999')
    })

    it('formats with custom shift / category prefix', () => {
      expect(formatQueueNumber(5, 'A')).toBe('A-005')
      expect(formatQueueNumber(12, 'VIP')).toBe('VIP-012')
    })
  })

  describe('getSpeechAnnouncement', () => {
    it('generates counter announcement when no table is assigned', () => {
      const text = getSpeechAnnouncement(42)
      expect(text).toBe('Nomor antrian 42, silakan mengambil pesanan di kasir.')
    })

    it('generates table announcement when table number is provided', () => {
      const text = getSpeechAnnouncement(15, '08')
      expect(text).toBe('Nomor antrian 15, untuk meja 08, silakan mengambil pesanan Anda.')
    })
  })
})
