/**
 * Utilitas CSV dan nilai transaksi kanonik.
 *
 * `yang_dibayar` pada tabel penjualan adalah uang yang diserahkan pembeli
 * (termasuk kembalian), bukan omzet. Gunakan helper di sini agar laporan CSV,
 * PDF, XLSX, dan UI memakai definisi yang sama.
 */

export const CSV_BOM = '\uFEFF'

export function asNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Nilai item setelah diskon item, sebelum diskon invoice dan pajak. */
export function saleSubtotal(item: any): number {
  return asNumber(item?.sub_total)
}

/** Diskon level invoice/promo. */
export function saleDiscount(item: any): number {
  return asNumber(item?.discount_amount)
}

/** Pendapatan bersih: subtotal - diskon invoice (tanpa pajak, tanpa retur). */
export function saleNet(item: any): number {
  return saleSubtotal(item) - saleDiscount(item)
}

/** Grand total yang harus dibayar: penjualan bersih + pajak. */
export function saleGrandTotal(item: any): number {
  return saleNet(item) + asNumber(item?.pajak)
}

/** Uang yang benar-benar dipakai membayar: diterima - kembalian. */
export function saleSettled(item: any): number {
  return Math.max(0, asNumber(item?.yang_dibayar) - asNumber(item?.kembalian))
}

/** Status pembayaran diturunkan dari data; skema penjualan tidak punya status batal. */
export function salePaymentStatus(item: any): 'LUNAS' | 'KURANG BAYAR' {
  return saleSettled(item) + 0.01 >= saleGrandTotal(item) ? 'LUNAS' : 'KURANG BAYAR'
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'

  let text = String(value)
  // Cegah formula injection dari teks yang berasal dari input pengguna.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','))
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n'
}
