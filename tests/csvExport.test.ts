import { describe, it, expect } from 'vitest'
import {
  buildCsv,
  csvEscape,
  saleGrandTotal,
  saleNet,
  salePaymentStatus,
  saleSettled,
  CSV_BOM,
} from '../src/backend/services/csvUtils'

describe('csvEscape', () => {
  it('returns empty string for null/undefined', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })

  it('keeps numbers as plain numeric strings without currency symbols', () => {
    expect(csvEscape(1500)).toBe('1500')
    expect(csvEscape(-250)).toBe('-250')
    expect(csvEscape(0)).toBe('0')
  })

  it('quotes values containing comma, quote, or newline', () => {
    expect(csvEscape('Kopi, Gula')).toBe('"Kopi, Gula"')
    expect(csvEscape('Produk "Spesial"')).toBe('"Produk ""Spesial"""')
    expect(csvEscape('baris 1\nbaris 2')).toBe('"baris 1\nbaris 2"')
  })

  it('preserves Indonesian characters', () => {
    expect(csvEscape('Kopi Susu Gula Aren')).toBe('Kopi Susu Gula Aren')
    expect(csvEscape('Çèmpédé & Rūmäh')).toBe('Çèmpédé & Rūmäh')
  })

  it('neutralises formula injection from text values', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(csvEscape('+62 812')).toBe("'+62 812")
    expect(csvEscape('-not-a-number')).toBe("'-not-a-number")
    expect(csvEscape('@user')).toBe("'@user")
    expect(csvEscape('\tnama')).toBe("'\tnama")
  })
})

describe('buildCsv', () => {
  it('starts with a single UTF-8 BOM and uses CRLF line endings', () => {
    const csv = buildCsv(['a', 'b'], [[1, 2], [3, 4]])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv.indexOf(CSV_BOM, 1)).toBe(-1)
    expect(csv).toBe('\uFEFFa,b\r\n1,2\r\n3,4\r\n')
  })

  it('keeps stable headers and one row per record for empty data', () => {
    const csv = buildCsv(['nomor_invoice', 'grand_total'], [])
    expect(csv).toBe('\uFEFFnomor_invoice,grand_total\r\n')
  })

  it('escapes headers and values consistently', () => {
    const csv = buildCsv(['nama, produk', 'jumlah'], [['Kopi "Aren"', 2]])
    expect(csv).toBe('\uFEFF"nama, produk",jumlah\r\n"Kopi ""Aren""",2\r\n')
  })
})

describe('canonical transaction values', () => {
  const sale = {
    sub_total: 100000,
    discount_amount: 5000,
    pajak: 10500,
    yang_dibayar: 200000,
    kembalian: 94500,
  }

  it('computes net revenue excluding tax and invoice discount', () => {
    expect(saleNet(sale)).toBe(95000)
  })

  it('computes grand total as net revenue plus tax', () => {
    expect(saleGrandTotal(sale)).toBe(105500)
  })

  it('computes settled amount as tendered minus change', () => {
    expect(saleSettled(sale)).toBe(105500)
  })

  it('marks a fully paid transaction as LUNAS', () => {
    expect(salePaymentStatus(sale)).toBe('LUNAS')
  })

  it('marks a short payment as KURANG BAYAR', () => {
    expect(salePaymentStatus({ ...sale, yang_dibayar: 50000, kembalian: 0 })).toBe('KURANG BAYAR')
  })

  it('does not produce NaN for empty rows', () => {
    expect(saleNet({})).toBe(0)
    expect(saleGrandTotal({})).toBe(0)
    expect(saleSettled({})).toBe(0)
    expect(salePaymentStatus({})).toBe('LUNAS')
  })
})
