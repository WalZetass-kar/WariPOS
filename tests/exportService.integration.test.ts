import os from 'os'
import path from 'path'
import fs from 'fs'
import { describe, it, expect, beforeAll, vi } from 'vitest'

// Aplikasi produksi berjalan di Electron; test berjalan di Node tanpa
// native better-sqlite3 (dikompilasi untuk ABI Electron).
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => os.tmpdir(),
  },
}))
vi.mock('../src/backend/models/IdentitasModel', () => ({
  IdentitasModel: {
    get: () => ({
      namatoko: 'Toko Uji',
      alamattoko: 'Jl. Uji No. 1',
      nomortelptoko: '0812000000',
      alamatemailowner: 'uji@example.com',
      logo: null,
    }),
  },
}))
vi.mock('../src/backend/services/demoSessionManager', () => ({
  demoSession: { getUsername: () => 'tester' },
}))
vi.mock('../src/backend/controllers/LaporanController', () => ({
  LaporanController: {
    getLaporanLabaRugi: () => ({ success: false }),
    getLaporanProdukTerlaris: () => ({ success: false }),
    getLaporanDetailItem: () => ({ success: false }),
  },
}))

import { ExportService } from '../src/backend/services/export'
import ExcelJS from 'exceljs'

const mockTmpRoot = path.join(os.tmpdir(), `waripos-export-test-${process.pid}`)

const transaksi = [
  {
    kd_tansaksi_jual: 'TRX-001',
    tgl_wkt_transaksi: '2026-10-01 09:15:00',
    username_transaksi: 'kasir1',
    nama_customer: 'Budi',
    total_qty: 2,
    sub_total: 100000,
    discount_amount: 0,
    pajak: 11000,
    yang_dibayar: 150000,
    kembalian: 39000,
    jenis_pembayaran: 'TUNAI',
  },
  {
    kd_tansaksi_jual: 'TRX-002',
    tgl_wkt_transaksi: '2026-10-02 14:40:00',
    username_transaksi: 'kasir2',
    nama_customer: null,
    total_qty: 1,
    sub_total: 50000,
    discount_amount: 5000,
    pajak: 4950,
    yang_dibayar: 50000,
    kembalian: 0,
    jenis_pembayaran: 'QRIS',
  },
]

const context = {
  startDate: '2026-10-01',
  endDate: '2026-10-02',
  summary: {
    total_transaksi: 2,
    total_qty: 3,
    omzet_kotor: 150000,
    total_diskon: 5000,
    penjualan_bersih: 145000,
    total_pajak: 15950,
    grand_total: 160950,
    total_retur: 0,
    penjualan_setelah_retur: 145000,
    rata_rata_transaksi: 72500,
  },
  labaRugi: {
    total_transaksi: 2,
    total_penjualan: 145000,
    total_diskon: 5000,
    total_return: 0,
    total_hpp: 90000,
    laba_kotor: 55000,
    laba_setelah_retur: 55000,
    total_pengeluaran: 5000,
    laba_bersih_operasional: 50000,
    margin_persen: 37.93,
  },
  detailItems: [
    {
      kd_tansaksi_jual: 'TRX-001',
      tgl_wkt_transaksi: '2026-10-01 09:15:00',
      username_transaksi: 'kasir1',
      kd_barang: 'BRG-1',
      nama_barang: 'Kopi Susu',
      qty: 2,
      harga_jual: 50000,
      disc_persen: 0,
      diskon_item: 0,
      total_harga_jual: 100000,
      harga_modal: 60000,
    },
    {
      kd_tansaksi_jual: 'TRX-002',
      tgl_wkt_transaksi: '2026-10-02 14:40:00',
      username_transaksi: 'kasir2',
      kd_barang: 'BRG-2',
      nama_barang: 'Roti Bakar',
      qty: 1,
      harga_jual: 50000,
      disc_persen: 10,
      diskon_item: 5000,
      total_harga_jual: 45000,
      harga_modal: 30000,
    },
  ],
  produk: [
    {
      kd_barang: 'BRG-1',
      nama_barang: 'Kopi Susu',
      total_qty: 2,
      total_penjualan: 100000,
      total_modal: 60000,
      qty_retur: 0,
      nilai_retur: 0,
      net_qty: 2,
      net_penjualan: 100000,
      net_laba: 40000,
    },
    {
      kd_barang: 'BRG-2',
      nama_barang: 'Roti Bakar',
      total_qty: 1,
      total_penjualan: 45000,
      total_modal: 30000,
      qty_retur: 0,
      nilai_retur: 0,
      net_qty: 1,
      net_penjualan: 45000,
      net_laba: 15000,
    },
  ],
  pembayaran: [
    { metode_pembayaran: 'TUNAI', jumlah_transaksi: 1, penjualan_bersih: 100000, pajak: 11000, total_dibayar: 111000 },
    { metode_pembayaran: 'QRIS', jumlah_transaksi: 1, penjualan_bersih: 45000, pajak: 4950, total_dibayar: 49950 },
  ],
}

describe('ExportService output artifacts', () => {
  const outDir = path.join(mockTmpRoot, 'exports')
  const csvPath = path.join(outDir, 'penjualan.csv')
  const xlsxPath = path.join(outDir, 'penjualan.xlsx')
  const pdfPath = path.join(outDir, 'penjualan.pdf')
  const emptyCsvPath = path.join(outDir, 'penjualan-kosong.csv')

  beforeAll(() => {
    fs.mkdirSync(outDir, { recursive: true })
  })

  it('writes a BOM-prefixed CSV with one row per transaction and no currency symbols', async () => {
    const result = await ExportService.exportLaporanPenjualanCSV(transaksi, csvPath, context)
    expect(result.success).toBe(true)

    const raw = fs.readFileSync(csvPath, 'utf8')
    expect(raw.charCodeAt(0)).toBe(0xfeff)

    const lines = raw.replace(/^\uFEFF/, '').trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(
      'nomor_invoice,tanggal,waktu,kasir,pelanggan,metode_pembayaran,jumlah_item,subtotal,diskon,pajak,grand_total,dibayar,kembalian,status_pembayaran'
    )
    expect(lines[1]).toContain('TRX-001')
    expect(lines[1]).toContain('111000')
    expect(lines[1]).not.toContain('Rp')
    expect(lines[2]).toContain('49950')
    expect(lines[2]).toContain('LUNAS')
  })

  it('writes a stable header only for an empty period', async () => {
    const result = await ExportService.exportLaporanPenjualanCSV([], emptyCsvPath, {
      ...context,
      summary: { ...context.summary, total_transaksi: 0 },
    })
    expect(result.success).toBe(true)
    const lines = fs.readFileSync(emptyCsvPath, 'utf8').replace(/^\uFEFF/, '').trimEnd().split('\r\n')
    expect(lines).toHaveLength(1)
    expect(lines[0].startsWith('nomor_invoice,')).toBe(true)
  }, 30_000)

  it('writes an XLSX workbook with summary, transaction, item, product, cashier, and payment sheets', async () => {
    const result = await ExportService.exportLaporanPenjualanExcel(transaksi, xlsxPath, context)
    expect(result.success).toBe(true)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(xlsxPath)
    const names = workbook.worksheets.map(sheet => sheet.name)
    expect(names).toEqual(expect.arrayContaining([
      'Ringkasan', 'Detail Transaksi', 'Detail Item', 'Produk Terlaris', 'Kasir Terbaik', 'Metode Pembayaran',
    ]))

    const detail = workbook.getWorksheet('Detail Transaksi')!
    expect(detail.getCell('B6').value).toBe('TRX-001')
    expect(detail.getCell('J6').value).toBe(111000)
    expect(detail.getCell('K6').value).toBe(111000)
    expect(detail.getCell('L6').value).toBe(39000)
    expect(detail.getCell('N6').value).toBe('LUNAS')
    expect(detail.getCell('J7').value).toBe(49950)
    expect(detail.getCell('N7').value).toBe('LUNAS')
    expect(detail.autoFilter).toBeTruthy()
    const totalRow = detail.getRow(8)
    expect((totalRow.getCell(10).value as any).formula).toBe('SUM(J6:J7)')

    const items = workbook.getWorksheet('Detail Item')!
    expect(items.getCell('F6').value).toBe('Kopi Susu')
    expect(items.getCell('K6').value).toBe(100000)
    expect(items.autoFilter).toBeTruthy()

    const ringkasan = workbook.getWorksheet('Ringkasan')!
    // KPI penjualan bersih & grand total memakai angka ringkasan, bukan hasil hitung ulang.
    const kpiValues = [ringkasan.getCell('D8').value, ringkasan.getCell('F8').value]
    expect(kpiValues).toEqual([145000, 160950])
  }, 90_000)

  it('writes a valid multi-page PDF with header, summary, and detail table', async () => {
    const result = ExportService.exportLaporanPenjualanPDF(transaksi, pdfPath, context)
    expect(result.success).toBe(true)

    const buffer = fs.readFileSync(pdfPath)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    const text = buffer.toString('latin1')
    const pageCount = (text.match(/\/Type\s*\/Page\b/g) ?? []).length
    expect(pageCount).toBeGreaterThanOrEqual(2)
    expect(text).toContain('/Producer')
    expect(buffer.length).toBeGreaterThan(5000)
  }, 60_000)

  it('paginates the generic table PDF with a real page count', () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`BRG-${i + 1}`, `Barang ${i + 1}`, 1000 + i])
    const genericPdf = path.join(outDir, 'daftar-harga.pdf')
    const result = ExportService.exportToPDF(
      'Daftar Harga',
      ['Kode', 'Nama', 'Harga'],
      rows,
      'daftar-harga',
      'portrait',
      genericPdf,
    )
    expect(result.success).toBe(true)

    const buffer = fs.readFileSync(genericPdf)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    const pageCount = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length
    expect(pageCount).toBeGreaterThanOrEqual(2)
  }, 60_000)

  it('handles an empty period in XLSX and PDF without crashing', async () => {
    const emptyXlsx = path.join(outDir, 'penjualan-kosong.xlsx')
    const emptyPdf = path.join(outDir, 'penjualan-kosong.pdf')
    const emptyContext = {
      ...context,
      summary: {
        total_transaksi: 0, total_qty: 0, omzet_kotor: 0, total_diskon: 0,
        penjualan_bersih: 0, total_pajak: 0, grand_total: 0, total_retur: 0,
        penjualan_setelah_retur: 0, rata_rata_transaksi: 0,
      },
      labaRugi: {
        total_transaksi: 0, total_penjualan: 0, total_diskon: 0, total_return: 0,
        total_hpp: 0, laba_kotor: 0, laba_setelah_retur: 0, total_pengeluaran: 0,
        laba_bersih_operasional: 0, margin_persen: 0,
      },
      detailItems: [],
      produk: [],
      pembayaran: [],
    }

    expect((await ExportService.exportLaporanPenjualanExcel([], emptyXlsx, emptyContext)).success).toBe(true)
    expect(ExportService.exportLaporanPenjualanPDF([], emptyPdf, emptyContext).success).toBe(true)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(emptyXlsx)
    expect(workbook.getWorksheet('Detail Transaksi')).toBeTruthy()
    expect(workbook.getWorksheet('Detail Item')).toBeTruthy()
    const pdf = fs.readFileSync(emptyPdf)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  }, 60_000)

  it('writes inventory reports with status and totals', async () => {
    const items = [
      { kd_barang: 'BRG-1', nama_barang: 'Kopi Susu', stok: 5, stok_minimum: 10 },
      { kd_barang: 'BRG-2', nama_barang: 'Roti Bakar', stok: 20, stok_minimum: 5 },
    ]
    const stokXlsx = path.join(outDir, 'stok.xlsx')
    const stokPdf = path.join(outDir, 'stok.pdf')

    expect((await ExportService.exportLaporanStokExcel(items, stokXlsx)).success).toBe(true)
    expect(ExportService.exportLaporanStokPDF(items, stokPdf).success).toBe(true)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(stokXlsx)
    const sheet = workbook.getWorksheet('Persediaan')!
    expect(sheet.getCell('C12').value).toBe('Kopi Susu')
    expect(sheet.getCell('D12').value).toBe(5)
    expect(sheet.getCell('F12').value).toBe('MENIPIS')
    expect(sheet.getCell('F13').value).toBe('AMAN')
    expect(sheet.autoFilter).toBeTruthy()

    const pdf = fs.readFileSync(stokPdf)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(1)
  }, 60_000)

  it('writes product, profit/loss, and customer reports in XLSX and PDF', async () => {
    const customers = [
      { kd_customer: 'C-1', nama_customer: 'Budi', no_telp: '0812', email: 'budi@example.com', poin: 10, total_belanja: 150000, status: 'Aktif' },
      { kd_customer: 'C-2', nama_customer: 'Siti', no_telp: '-', email: '-', poin: 0, total_belanja: 0, status: 'Tidak Aktif' },
    ]

    const produkXlsx = path.join(outDir, 'produk.xlsx')
    const produkPdf = path.join(outDir, 'produk.pdf')
    const labaXlsx = path.join(outDir, 'laba-rugi.xlsx')
    const labaPdf = path.join(outDir, 'laba-rugi.pdf')
    const customerXlsx = path.join(outDir, 'customer.xlsx')
    const customerPdf = path.join(outDir, 'customer.pdf')

    expect((await ExportService.exportLaporanProdukExcel(context.produk, produkXlsx, context)).success).toBe(true)
    expect(ExportService.exportLaporanProdukPDF(context.produk, produkPdf, context).success).toBe(true)
    expect((await ExportService.exportLaporanLabaRugiExcel(context.labaRugi, labaXlsx, context)).success).toBe(true)
    expect(ExportService.exportLaporanLabaRugiPDF(context.labaRugi, labaPdf, context).success).toBe(true)
    expect((await ExportService.exportLaporanCustomerExcel(customers, customerXlsx)).success).toBe(true)
    expect(ExportService.exportLaporanCustomerPDF(customers, customerPdf).success).toBe(true)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(produkXlsx)
    const produkSheet = workbook.getWorksheet('Produk Terlaris')!
    expect(produkSheet.getCell('C13').value).toBe('Kopi Susu')
    expect(produkSheet.getCell('F13').value).toBe(2)
    expect(produkSheet.autoFilter).toBeTruthy()

    const labaWorkbook = new ExcelJS.Workbook()
    await labaWorkbook.xlsx.readFile(labaXlsx)
    const labaSheet = labaWorkbook.getWorksheet('Laba Rugi')!
    expect(String(labaSheet.getCell('A12').value)).toContain('Pendapatan penjualan')
    expect(labaSheet.getCell('B18').value).toBe(-5000)
    expect(labaSheet.getCell('B19').value).toBe(50000)
    expect(labaSheet.getCell('B20').value).toBeCloseTo(0.3793, 6)

    for (const file of [produkPdf, labaPdf, customerPdf]) {
      const buffer = fs.readFileSync(file)
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(2000)
    }
  }, 90_000)
})
