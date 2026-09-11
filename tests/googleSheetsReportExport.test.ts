import { describe, it, expect } from 'vitest'
import { reportToSheetsPayload, reportToTsv } from '../src/shared/googleSheetsExport'

describe('Google Sheets Report Export', () => {
  it('generates valid payload for Penjualan report', () => {
    const payload = reportToSheetsPayload({
      title: 'Penjualan',
      tab: 'penjualan',
      dateRange: { start: '2026-09-01', end: '2026-09-08' },
      headers: ['No. Transaksi', 'Tanggal', 'Kasir', 'Total Bayar'],
      rows: [
        ['TRX-001', '2026-09-01 10:00:00', 'kasir1', 50000],
        ['TRX-002', '2026-09-02 11:30:00', 'kasir2', 75000],
      ],
      summaryCards: [
        { label: 'Total Transaksi', value: 2 },
        { label: 'Total Omzet (Rp)', value: 125000 },
      ],
    })

    expect(payload.app).toBe('WariPOS')
    expect(payload.action).toBe('append_report')
    expect(payload.sheets).toHaveLength(1)
    expect(payload.sheets[0].name).toBe('penjualan')

    const rows = payload.sheets[0].rows
    expect(rows[0][0]).toBe('WariPOS - Penjualan')
    expect(rows[1][0]).toBe('Periode')
    expect(rows[1][1]).toBe('2026-09-01 s/d 2026-09-08')

    // Summary cards exist
    const summaryHeaderIndex = rows.findIndex(r => r[0] === 'RINGKASAN')
    expect(summaryHeaderIndex).toBeGreaterThan(0)
    expect(rows[summaryHeaderIndex + 1]).toEqual(['Total Transaksi', 2])

    // Data headers exist
    const headersIndex = rows.findIndex(r => r[0] === 'No. Transaksi')
    expect(headersIndex).toBeGreaterThan(summaryHeaderIndex)
    expect(rows[headersIndex + 1]).toEqual(['TRX-001', '2026-09-01 10:00:00', 'kasir1', 50000])
  })

  it('generates valid TSV string for clipboard fallback', () => {
    const tsv = reportToTsv({
      title: 'Laba Rugi',
      tab: 'laba-rugi',
      headers: ['Keterangan', 'Nilai (Rp)'],
      rows: [
        ['Total Transaksi', 10],
        ['Total Penjualan', 500000],
        ['Laba Kotor', 150000],
      ],
    })

    expect(typeof tsv).toBe('string')
    expect(tsv).toContain('laba-rugi')
    expect(tsv).toContain('WariPOS - Laba Rugi')
    expect(tsv).toContain('Keterangan\tNilai (Rp)')
    expect(tsv).toContain('Total Transaksi\t10')
    expect(tsv).toContain('Laba Kotor\t150000')
  })

  it('handles empty dateRange gracefully', () => {
    const payload = reportToSheetsPayload({
      title: 'Stok Barang',
      tab: 'stok',
      headers: ['Kode', 'Nama', 'Stok'],
      rows: [['BRG01', 'Kopi', 20]],
    })

    expect(payload.sheets[0].rows[1][1]).toBe('Semua Periode')
  })
})
