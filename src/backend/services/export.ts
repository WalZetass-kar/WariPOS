import * as fs from 'fs'
import * as path from 'path'
import { createRequire } from 'module'
import { app } from 'electron'
const require = createRequire(import.meta.url)
const { jsPDF } = require('jspdf')
const autoTable = require('jspdf-autotable').default
import ExcelJS from 'exceljs'
import { IdentitasModel } from '../models/IdentitasModel.js'
import { demoSession } from './demoSessionManager.js'
import { LaporanController } from '../controllers/LaporanController.js'
import { asNumber, buildCsv, csvEscape, saleGrandTotal, saleNet, saleSettled } from './csvUtils.js'


interface SalesExportContext {
  startDate?: string
  endDate?: string
  /** Angka ringkasan dari LaporanController agar PDF/XLSX/CSV identik dengan UI. */
  summary?: any
  labaRugi?: any
  detailItems?: any[]
  produk?: any[]
  pembayaran?: any[]
}

interface DailySalesRow {
  key: string
  label: string
  total: number
  transaksi: number
  qty: number
  pajak: number
}

interface PaymentSalesRow {
  method: string
  total: number
  transaksi: number
}

const BRAND = {
  primary: 'FFDB2777',
  primaryDark: 'FFBE185D',
  pinkSoft: 'FFFCE7F3',
  slateText: 'FF334155',
  slateMuted: 'FF64748B',
  slateSoft: 'FFF8FAFC',
  border: 'FFE2E8F0',
  green: 'FF059669',
  greenSoft: 'FFD1FAE5',
  amber: 'FFD97706',
  amberSoft: 'FFFEF3C7',
  red: 'FFDC2626',
  redSoft: 'FFFEE2E2',
  blue: 'FF2563EB',
  blueSoft: 'FFDBEAFE',
}

function formatIdr(value: unknown) {
  return `Rp ${Math.round(asNumber(value)).toLocaleString('id-ID')}`
}

function safeDate(value: unknown) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? null : date
}

function salesDateKey(value: unknown) {
  const raw = String(value ?? '')
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const date = safeDate(value)
  return date ? date.toISOString().slice(0, 10) : '-'
}

function formatShortDate(value: unknown) {
  const key = salesDateKey(value)
  if (key === '-') return '-'
  const date = new Date(`${key}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? key
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function formatLongDate(value: unknown) {
  const key = salesDateKey(value)
  if (key === '-') return '-'
  const date = new Date(`${key}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? key
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateTime(value: unknown) {
  const date = safeDate(value)
  return date
    ? date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-'
}

function salesPeriodLabel(data: any[], context?: SalesExportContext) {
  if (context?.startDate && context?.endDate) {
    return `${formatLongDate(context.startDate)} - ${formatLongDate(context.endDate)}`
  }
  const keys = data.map(item => salesDateKey(item.tgl_wkt_transaksi)).filter(key => key !== '-').sort()
  if (!keys.length) return 'Semua periode'
  return `${formatLongDate(keys[0])} - ${formatLongDate(keys[keys.length - 1])}`
}

function salesAnalytics(data: any[]) {
  const dailyMap = new Map<string, DailySalesRow>()
  const paymentMap = new Map<string, PaymentSalesRow>()

  for (const item of data) {
    const key = salesDateKey(item.tgl_wkt_transaksi)
    const total = saleGrandTotal(item)
    const qty = asNumber(item.total_qty)
    const pajak = asNumber(item.pajak)
    const daily = dailyMap.get(key) ?? {
      key,
      label: formatShortDate(key),
      total: 0,
      transaksi: 0,
      qty: 0,
      pajak: 0,
    }
    daily.total += total
    daily.transaksi += 1
    daily.qty += qty
    daily.pajak += pajak
    dailyMap.set(key, daily)

    const method = String(item.jenis_pembayaran || 'LAINNYA').toUpperCase()
    const payment = paymentMap.get(method) ?? { method, total: 0, transaksi: 0 }
    payment.total += total
    payment.transaksi += 1
    paymentMap.set(method, payment)
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.key.localeCompare(b.key))
  const payments = Array.from(paymentMap.values()).sort((a, b) => b.total - a.total)
  const totalSales = data.reduce((sum, item) => sum + saleGrandTotal(item), 0)
  const totalSubtotal = data.reduce((sum, item) => sum + asNumber(item.sub_total), 0)
  const totalTax = data.reduce((sum, item) => sum + asNumber(item.pajak), 0)
  const totalQty = data.reduce((sum, item) => sum + asNumber(item.total_qty), 0)
  const avgTransaction = data.length ? totalSales / data.length : 0
  const bestDay = daily.length ? daily.reduce((best, row) => row.total > best.total ? row : best, daily[0]) : null
  const quietDay = daily.length ? daily.reduce((low, row) => row.total < low.total ? row : low, daily[0]) : null
  const maxDaily = daily.reduce((max, row) => Math.max(max, row.total), 0)
  const maxPayment = payments.reduce((max, row) => Math.max(max, row.total), 0)

  return {
    daily,
    payments,
    totalSales,
    totalSubtotal,
    totalTax,
    totalQty,
    avgTransaction,
    bestDay,
    quietDay,
    maxDaily,
    maxPayment,
  }
}

function exportPath(defaultName: string, customPath?: string) {
  if (customPath) {
    const expectedExt = path.extname(defaultName).toLowerCase()
    const target = path.resolve(customPath)
    if (expectedExt && path.extname(target).toLowerCase() !== expectedExt) {
      throw new Error(`Ekstensi file export harus ${expectedExt}`)
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    return target
  }
  const baseDir = app.isPackaged ? app.getPath('documents') : process.cwd()
  const exportDir = path.join(baseDir, 'WariPOS', 'exports')
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true })
  return path.join(exportDir, defaultName)
}

/**
 * Grafik gambar eksternal dinonaktifkan: data penjualan tidak boleh dikirim ke
 * layanan pihak ketiga. Analisis visual memakai native Excel data bar dan tabel
 * ringkasan sehingga ekspor tetap bekerja offline dan deterministik.
 */
function getChartBuffer(_config: any): Promise<Buffer | null> {
  return Promise.resolve(null)
}

function thinBorder(color = BRAND.border) {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  } as Partial<ExcelJS.Borders>
}

function fillCell(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function styleHeaderRow(row: ExcelJS.Row, fill = BRAND.primary) {
  row.height = 24
  row.eachCell(cell => {
    fillCell(cell, fill)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = thinBorder(BRAND.primaryDark)
  })
}

function addExcelTitle(sheet: ExcelJS.Worksheet, title: string, subtitle: string, lastColumn: string) {
  sheet.mergeCells(`A1:${lastColumn}1`)
  sheet.mergeCells(`A2:${lastColumn}2`)
  const titleCell = sheet.getCell('A1')
  titleCell.value = title
  titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  fillCell(titleCell, BRAND.primary)
  sheet.getRow(1).height = 30

  const subtitleCell = sheet.getCell('A2')
  subtitleCell.value = subtitle
  subtitleCell.font = { size: 10, color: { argb: 'FFFFFFFF' } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  fillCell(subtitleCell, BRAND.primaryDark)
  sheet.getRow(2).height = 22
}

function addKpi(sheet: ExcelJS.Worksheet, row: number, col: number, label: string, value: string | number, color: string) {
  sheet.mergeCells(row, col, row, col + 1)
  sheet.mergeCells(row + 1, col, row + 1, col + 1)
  const labelCell = sheet.getCell(row, col)
  const valueCell = sheet.getCell(row + 1, col)
  labelCell.value = label
  valueCell.value = value
  labelCell.font = { size: 9, bold: true, color: { argb: BRAND.slateMuted } }
  valueCell.font = { size: 14, bold: true, color: { argb: color } }
  labelCell.alignment = { vertical: 'bottom', horizontal: 'center' }
  valueCell.alignment = { vertical: 'top', horizontal: 'center' }
  ;[labelCell, valueCell].forEach(cell => {
    fillCell(cell, BRAND.slateSoft)
    cell.border = thinBorder()
  })
}

function asciiBar(value: number, max: number, width = 38) {
  if (max <= 0 || value <= 0) return ''
  return '#'.repeat(Math.max(1, Math.round((value / max) * width)))
}

function excelDataBarRule(priority: number) {
  return {
    type: 'dataBar',
    priority,
    showValue: false,
    minLength: 0,
    maxLength: 100,
    gradient: false,
    cfvo: [{ type: 'min' }, { type: 'max' }],
  } as ExcelJS.ConditionalFormattingRule
}

function columnLetter(col: number) {
  let n = Math.max(1, Math.trunc(col))
  let letters = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

function autofitColumnWidths(sheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 35) {
  sheet.columns.forEach((column) => {
    let maxLen = 0
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      // Avoid checking merged cells to prevent inflating column width excessively
      if (cell.address.includes(':')) return
      
      const rowNum = Number(cell.row)
      if (rowNum <= 4) return // Skip rows 1-4 (merged headers)
      
      let valStr = ''
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'richText' in cell.value) {
          valStr = (cell.value as any).richText.map((t: any) => t.text).join('')
        } else if (typeof cell.value === 'number') {
          valStr = cell.numFmt?.includes('Rp') ? `Rp ${cell.value.toLocaleString('id-ID')}` : cell.value.toString()
        } else {
          valStr = cell.value.toString()
        }
      }
      if (valStr.length > maxLen) maxLen = valStr.length
    })
    column.width = Math.min(Math.max(maxLen + 4, minWidth), maxWidth)
  })
}

// ==========================================
// CSV HELPERS
// Struktur CSV: 1 baris header stabil + 1 baris per record, tanpa judul,
// merge, subtotal, atau simbol mata uang pada kolom numerik.
// ==========================================

function saveCsv(defaultName: string, content: string, customPath?: string) {
  const filepath = exportPath(defaultName, customPath)
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, content, 'utf8')
  return {
    success: true,
    message: 'Export CSV berhasil disimpan',
    data: { filepath, filename: path.basename(filepath) },
  }
}

function csvDateOnly(value: unknown): string {
  const key = salesDateKey(value)
  return key === '-' ? '' : key
}

function csvTimeOnly(value: unknown): string {
  const date = safeDate(value)
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function periodFromContext(context?: SalesExportContext) {
  if (!context?.startDate || !context?.endDate) return ''
  return `${context.startDate}_sampai_${context.endDate}`.replace(/[^\w-]+/g, '_')
}

export class ExportService {
  // Export to Excel
  static async exportToExcel(data: any[], filename: string, sheetName: string = 'Data', customPath?: string) {
    try {
      const rows = Array.isArray(data) ? data : []
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'WariPOS'
      workbook.created = new Date()

      const safeSheetName = String(sheetName || 'Data').slice(0, 31)
      const worksheet = workbook.addWorksheet(safeSheetName, {
        views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
        properties: { tabColor: { argb: BRAND.primary } },
      })
      const keys = rows.length > 0
        ? (Array.isArray(rows[0]) ? rows[0].map((_: unknown, index: number) => `Kolom ${index + 1}`) : Object.keys(rows[0]))
        : ['Keterangan', 'Nilai']

      worksheet.columns = keys.map(key => ({ width: Math.min(Math.max(String(key).length + 6, 14), 32) }))
      addExcelTitle(worksheet, filename.replace(/_/g, ' ').toUpperCase(), `Dicetak ${new Date().toLocaleString('id-ID')}`, String.fromCharCode(64 + Math.min(keys.length, 26)))

      worksheet.getRow(4).values = keys.map(key => String(key).replace(/_/g, ' ').toUpperCase())
      styleHeaderRow(worksheet.getRow(4), BRAND.primary)

      rows.forEach((item, index) => {
        const values = Array.isArray(item) ? item : keys.map(key => item[key])
        const row = worksheet.addRow(values)
        row.eachCell((cell, colNumber) => {
          const key = String(keys[colNumber - 1] ?? '').toLowerCase()
          if (typeof cell.value === 'number' && /(total|penjualan|belanja|nilai|modal|laba|amount|harga|bayar)/i.test(key)) {
            cell.numFmt = '"Rp" #,##0'
          }
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
        })
        if (index % 2 === 1) row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
      })
      if (rows.length > 0 && keys.length > 0) {
        worksheet.autoFilter = { from: 'A4', to: `${String.fromCharCode(64 + Math.min(keys.length, 26))}${rows.length + 4}` }
      }

      const labelKey = keys.find(key => /(nama|keterangan|produk|customer|status)/i.test(String(key))) ?? keys[0]
      const numericKey = keys.find(key => rows.some(row => !Array.isArray(row) && typeof row[key] === 'number') && /(total|penjualan|belanja|nilai|modal|laba|amount|harga|qty|poin)/i.test(String(key)))
        ?? keys.find(key => rows.some(row => !Array.isArray(row) && typeof row[key] === 'number'))
      if (labelKey && numericKey && rows.length > 0 && !Array.isArray(rows[0])) {
        const chartRows = rows
          .map(row => ({ label: String(row[labelKey] ?? '-'), value: asNumber(row[numericKey]) }))
          .filter(row => row.value > 0)
          .slice(0, 20)
        const maxValue = chartRows.reduce((max, row) => Math.max(max, row.value), 0)
        if (chartRows.length > 0) {
          const chartSheet = workbook.addWorksheet('Grafik', {
            views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
            properties: { tabColor: { argb: BRAND.blue } },
          })
          chartSheet.columns = [
            { header: 'Label', key: 'label', width: 32 },
            { header: 'Nilai', key: 'value', width: 18 },
            { header: 'Grafik', key: 'grafik', width: 22 },
            { header: 'Bar Visual', key: 'bar', width: 44 },
          ]
          addExcelTitle(chartSheet, 'Grafik Ringkasan', `Berdasarkan kolom ${String(numericKey).replace(/_/g, ' ')}`, 'D')
          styleHeaderRow(chartSheet.getRow(3), BRAND.blue)
          chartRows.forEach(row => {
            const added = chartSheet.addRow({
              label: row.label,
              value: row.value,
              grafik: row.value,
              bar: asciiBar(row.value, maxValue),
            })
            added.getCell('value').numFmt = /(total|penjualan|belanja|nilai|modal|laba|amount|harga|bayar)/i.test(String(numericKey)) ? '"Rp" #,##0' : '#,##0'
            added.getCell('grafik').numFmt = added.getCell('value').numFmt
            added.getCell('bar').font = { bold: true, color: { argb: BRAND.primary } }
          })
          chartSheet.addConditionalFormatting({
            ref: `C4:C${chartRows.length + 3}`,
            rules: [excelDataBarRule(1)],
          })
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filepath = exportPath(`${filename}_${timestamp}.xlsx`, customPath)
      await workbook.xlsx.writeFile(filepath)

      return {
        success: true,
        message: 'Export berhasil disimpan dengan format laporan',
        data: { filepath, filename: path.basename(filepath) },
      }
    } catch (error) {
      return {
        success: false,
        message: 'Gagal export ke Excel: ' + (error as Error).message,
      }
    }
  }

  // Export to PDF
  static exportToPDF(
    title: string,
    headers: string[],
    data: any[][],
    filename: string,
    orientation: 'portrait' | 'landscape' = 'portrait',
    customPath?: string
  ) {
    try {
      // Create PDF
      const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const storeInfo = IdentitasModel.get()
      const storeName = storeInfo?.namatoko || 'WariPOS'
      const storeAddress = storeInfo?.alamattoko || '-'
      const storePhone = storeInfo?.nomortelptoko || '-'
      const printedAt = new Date().toLocaleString('id-ID')
      const generatedBy = demoSession.getUsername() || 'Administrator'

      const drawHeader = () => {
        doc.setFillColor(79, 70, 229)
        doc.rect(0, 0, pageWidth, 32, 'F')

        let logoDrawn = false
        if (storeInfo?.logo) {
          try {
            doc.addImage(storeInfo.logo, 'PNG', 14, 8, 13, 13)
            logoDrawn = true
          } catch (err) {
            console.error('Gagal memuat logo identitas:', err)
          }
        }
        if (!logoDrawn) {
          doc.setFillColor(255, 255, 255)
          doc.circle(20.5, 14.5, 6.5, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          doc.setTextColor(79, 70, 229)
          doc.text(storeName.slice(0, 1).toUpperCase(), 20.5, 16.5, { align: 'center' })
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(255, 255, 255)
        doc.text(title, 33, 13)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const storeLine = [storeName, storeAddress, storePhone !== '-' ? `Telp: ${storePhone}` : ''].filter(Boolean).join(' | ')
        doc.text(storeLine, 33, 19)

        doc.setFontSize(8)
        doc.text(`Dicetak: ${printedAt} | Oleh: ${generatedBy}`, pageWidth - 14, 13, { align: 'right' })
        doc.text(`${data.length.toLocaleString('id-ID')} baris data`, pageWidth - 14, 18, { align: 'right' })
      }

      const drawFooter = (pageNo: number, totalPages: number) => {
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.3)
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text('WariPOS - Sistem Kasir', 14, pageHeight - 10)
        doc.text(`Halaman ${pageNo} dari ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' })
      }

      autoTable(doc, {
        head: [headers],
        body: data,
        startY: 32,
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { top: 38, left: 14, right: 14, bottom: 20 },
        didDrawPage: () => drawHeader(),
      })

      const totalPages = doc.getNumberOfPages()
      for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
        doc.setPage(pageNo)
        drawFooter(pageNo, totalPages)
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filepath = exportPath(`${filename}_${timestamp}.pdf`, customPath)

      // Save to file system using buffer
      const pdfBuffer = doc.output('arraybuffer')
      fs.writeFileSync(filepath, Buffer.from(pdfBuffer))

      return {
        success: true,
        message: 'Export berhasil disimpan',
        data: { filepath, filename: path.basename(filepath) },
      }
    } catch (error) {
      return {
        success: false,
        message: 'Gagal export ke PDF: ' + (error as Error).message,
      }
    }
  }

  // Export Laporan Penjualan to Excel with multi-sheet structure and visual layout
  static async exportLaporanPenjualanExcel(data: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const storeInfo = IdentitasModel.get()
      const cashierName = demoSession.getUsername() || 'Administrator'
      
      let startDateStr = context?.startDate
      let endDateStr = context?.endDate
      if (!startDateStr || !endDateStr) {
        const dates = data.map(item => String(item.tgl_wkt_transaksi || '').slice(0, 10)).filter(Boolean).sort()
        if (dates.length > 0) {
          startDateStr = dates[0]
          endDateStr = dates[dates.length - 1]
        }
      }
      
      const period = salesPeriodLabel(data, context)
      const generatedAt = new Date().toLocaleString('id-ID')

      // Ringkasan kanonik: pakai hasil LaporanController bila tersedia supaya
      // angka di XLSX = PDF = CSV = tampilan aplikasi.
      const summary = context?.summary ?? null
      let labaRugi: any = context?.labaRugi ?? null
      if (!labaRugi && startDateStr && endDateStr) {
        try {
          const lr = LaporanController.getLaporanLabaRugi(startDateStr, endDateStr)
          if (lr.success && lr.data) labaRugi = lr.data
        } catch (err) {
          console.error('Gagal mengambil laba kotor:', err)
        }
      }

      const totalTransactions = asNumber(summary?.total_transaksi ?? data.length)
      const totalRevenue = asNumber(summary?.penjualan_bersih
        ?? data.reduce((sum, item) => sum + saleNet(item), 0))
      const totalDiscounts = asNumber(summary?.total_diskon
        ?? data.reduce((sum, item) => sum + asNumber(item.discount_amount), 0))
      const totalTaxes = asNumber(summary?.total_pajak
        ?? data.reduce((sum, item) => sum + asNumber(item.pajak), 0))
      const totalQty = asNumber(summary?.total_qty
        ?? data.reduce((sum, item) => sum + asNumber(item.total_qty), 0))
      const grandTotal = asNumber(summary?.grand_total
        ?? data.reduce((sum, item) => sum + saleGrandTotal(item), 0))
      const totalRetur = asNumber(summary?.total_retur ?? 0)
      const netAfterReturns = asNumber(summary?.penjualan_setelah_retur ?? (totalRevenue - totalRetur))
      const hpp = asNumber(labaRugi?.total_hpp ?? labaRugi?.total_modal ?? 0)
      const labaKotor = asNumber(labaRugi?.laba_kotor ?? 0)
      const marginPersen = asNumber(labaRugi?.margin_persen ?? 0)
      const avgTransaction = asNumber(summary?.rata_rata_transaksi
        ?? (totalTransactions ? totalRevenue / totalTransactions : 0))

      // Aggregate: Kasir Terbaik (penjualan bersih per kasir)
      const cashierMap = new Map<string, { username: string, count: number, total: number }>()
      for (const item of data) {
        const cash = item.username_transaksi || 'Kasir'
        const existing = cashierMap.get(cash) ?? { username: cash, count: 0, total: 0 }
        existing.count += 1
        existing.total += saleNet(item)
        cashierMap.set(cash, existing)
      }
      const kasirTerbaik = Array.from(cashierMap.values()).sort((a, b) => b.total - a.total)

      // Aggregate: Metode Pembayaran (nilai yang benar-benar dibayar, termasuk pajak)
      const payMap = new Map<string, { method: string, count: number, net: number, pajak: number, total: number }>()
      for (const item of data) {
        const pay = String(item.jenis_pembayaran || 'TUNAI').toUpperCase()
        const existing = payMap.get(pay) ?? { method: pay, count: 0, net: 0, pajak: 0, total: 0 }
        existing.count += 1
        existing.net += saleNet(item)
        existing.pajak += asNumber(item.pajak)
        existing.total += saleGrandTotal(item)
        payMap.set(pay, existing)
      }
      const metodePembayaran = Array.from(payMap.values()).sort((a, b) => b.total - a.total)
      const topPaymentMethod = metodePembayaran[0]?.method || '-'

      // Produk terlaris & detail item dari sumber yang sama
      let produkTerlaris: any[] = Array.isArray(context?.produk) ? context?.produk ?? [] : []
      if (!produkTerlaris.length && startDateStr && endDateStr) {
        try {
          const pr = LaporanController.getLaporanProdukTerlaris(startDateStr, endDateStr, 1000)
          if (pr.success && pr.data) produkTerlaris = pr.data
        } catch (err) {
          console.error('Gagal mengambil produk terlaris:', err)
        }
      }
      let detailItems: any[] = Array.isArray(context?.detailItems) ? context?.detailItems ?? [] : []
      if (!detailItems.length && startDateStr && endDateStr) {
        try {
          const dr = LaporanController.getLaporanDetailItem(startDateStr, endDateStr)
          if (dr.success && dr.data) detailItems = dr.data
        } catch (err) {
          console.error('Gagal mengambil detail item:', err)
        }
      }
      
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'WariPOS System'
      workbook.created = new Date()
      
      // Helper function to build header
      const applyCompanyHeader = (sheet: ExcelJS.Worksheet, title: string, lastCol: string) => {
        const storeName = storeInfo?.namatoko || 'WariPOS'
        const storeAddress = storeInfo?.alamattoko || 'Jl. Raya WariPOS No. 1, Pekanbaru'
        const storePhone = storeInfo?.nomortelptoko || '0812-3456-7890'
        const storeEmail = storeInfo?.alamatemailowner || 'info@waripos.com'
        
        sheet.mergeCells(`A1:${lastCol}1`)
        const cell1 = sheet.getCell('A1')
        cell1.value = storeName.toUpperCase()
        cell1.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
        cell1.alignment = { vertical: 'middle', horizontal: 'center' }
        fillCell(cell1, BRAND.primaryDark)
        sheet.getRow(1).height = 28
        
        sheet.mergeCells(`A2:${lastCol}2`)
        const cell2 = sheet.getCell('A2')
        cell2.value = `${storeAddress}  |  Telp: ${storePhone}  |  Email: ${storeEmail}`
        cell2.font = { size: 9, color: { argb: 'FFFFFFFF' }, italic: true }
        cell2.alignment = { vertical: 'middle', horizontal: 'center' }
        fillCell(cell2, BRAND.primary)
        sheet.getRow(2).height = 18
        
        sheet.mergeCells(`A3:${lastCol}3`)
        const cell3 = sheet.getCell('A3')
        cell3.value = `${title}  |  Periode: ${period}`
        cell3.font = { bold: true, size: 10, color: { argb: BRAND.slateText } }
        cell3.alignment = { vertical: 'middle', horizontal: 'center' }
        fillCell(cell3, 'FFF1F5F9')
        sheet.getRow(3).height = 22
        
        sheet.getRow(4).height = 8 // spacer row
      }
      
      // Reusable KPI Card helper
      const applyKpiCard = (sheet: ExcelJS.Worksheet, r: number, c: number, lbl: string, val: string | number, color: string, numFmt?: string) => {
        sheet.mergeCells(r, c, r, c + 1)
        sheet.mergeCells(r + 1, c, r + 1, c + 1)
        
        const cellLbl = sheet.getCell(r, c)
        const cellVal = sheet.getCell(r + 1, c)
        
        cellLbl.value = lbl
        cellVal.value = val
        if (numFmt) cellVal.numFmt = numFmt
        
        cellLbl.font = { size: 9, bold: true, color: { argb: BRAND.slateMuted } }
        cellVal.font = { size: 14, bold: true, color: { argb: color } }
        
        cellLbl.alignment = { vertical: 'bottom', horizontal: 'center' }
        cellVal.alignment = { vertical: 'top', horizontal: 'center' }
        
        for (let rowIdx = r; rowIdx <= r + 1; rowIdx++) {
          for (let colIdx = c; colIdx <= c + 1; colIdx++) {
            const cell = sheet.getCell(rowIdx, colIdx)
            fillCell(cell, BRAND.slateSoft)
            cell.border = thinBorder()
          }
        }
      }
      
      // ==========================================
      // SHEET 1: RINGKASAN
      // ==========================================
      const ringkasanSheet = workbook.addWorksheet('Ringkasan', {
        views: [{ showGridLines: true }]
      })
      ringkasanSheet.columns = Array(8).fill({ width: 14 })
      applyCompanyHeader(ringkasanSheet, 'RINGKASAN EKSEKUTIF PENJUALAN', 'H')
      
      ringkasanSheet.mergeCells('A5:H5')
      const secHeader = ringkasanSheet.getCell('A5')
      secHeader.value = 'METRIK KINERJA BISNIS UTAMA'
      secHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      secHeader.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(secHeader, BRAND.slateText)
      ringkasanSheet.getRow(5).height = 24
      
      const RP = '"Rp" #,##0'

      // KPIs Row 1
      applyKpiCard(ringkasanSheet, 7, 1, 'TOTAL TRANSAKSI', totalTransactions, BRAND.blue, '#,##0')
      applyKpiCard(ringkasanSheet, 7, 3, 'PENJUALAN BERSIH', totalRevenue, BRAND.green, RP)
      applyKpiCard(ringkasanSheet, 7, 5, 'GRAND TOTAL (TERMASUK PAJAK)', grandTotal, BRAND.primary, RP)
      applyKpiCard(ringkasanSheet, 7, 7, 'PRODUK TERJUAL', totalQty, BRAND.amber, '#,##0')
      ringkasanSheet.getRow(7).height = 18
      ringkasanSheet.getRow(8).height = 26
      
      // KPIs Row 2
      applyKpiCard(ringkasanSheet, 10, 1, 'TOTAL DISKON', totalDiscounts, BRAND.red, RP)
      applyKpiCard(ringkasanSheet, 10, 3, 'TOTAL PAJAK', totalTaxes, BRAND.amber, RP)
      applyKpiCard(ringkasanSheet, 10, 5, 'RETUR DISETUJUI', totalRetur, BRAND.red, RP)
      applyKpiCard(ringkasanSheet, 10, 7, 'RATA-RATA / TRANSAKSI', avgTransaction, BRAND.blue, RP)
      ringkasanSheet.getRow(10).height = 18
      ringkasanSheet.getRow(11).height = 26

      // KPIs Row 3
      applyKpiCard(ringkasanSheet, 13, 1, 'HPP (HARGA MODAL)', hpp, BRAND.slateText, RP)
      applyKpiCard(ringkasanSheet, 13, 3, 'LABA KOTOR', labaKotor, BRAND.green, RP)
      applyKpiCard(ringkasanSheet, 13, 5, 'MARGIN LABA', marginPersen / 100, BRAND.primary, '0.00%')
      applyKpiCard(ringkasanSheet, 13, 7, 'METODE TERBANYAK', topPaymentMethod, BRAND.blue)
      ringkasanSheet.getRow(13).height = 18
      ringkasanSheet.getRow(14).height = 26

      // Definisi metrik agar laporan dapat diaudit
      ringkasanSheet.mergeCells('A16:H16')
      const defHeader = ringkasanSheet.getCell('A16')
      defHeader.value = 'DEFINISI METRIK'
      defHeader.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      defHeader.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(defHeader, BRAND.slateText)
      const definitions = [
        'Omzet kotor = jumlah subtotal item setelah diskon item, sebelum diskon invoice dan pajak.',
        'Penjualan bersih = omzet kotor - diskon invoice. Belum termasuk pajak dan retur.',
        'Grand total = penjualan bersih + pajak. Nilai ini yang dibayar pelanggan.',
        'Retur = total retur berstatus APPROVED pada periode retur. Laba kotor belum memperhitungkan HPP barang retur.',
        `Penjualan setelah retur = ${formatIdr(netAfterReturns)}.`,
        'Skema transaksi tidak menyimpan status pembatalan; status LUNAS/KURANG BAYAR diturunkan dari pembayaran yang tercatat.',
      ]
      definitions.forEach((text, index) => {
        const rowNo = 17 + index
        ringkasanSheet.mergeCells(`A${rowNo}:H${rowNo}`)
        const cell = ringkasanSheet.getCell(`A${rowNo}`)
        cell.value = `• ${text}`
        cell.font = { size: 9, color: { argb: BRAND.slateMuted } }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      })

      // Otorisasi / Signatures area
      ringkasanSheet.mergeCells('A23:H23')
      const secHeader2 = ringkasanSheet.getCell('A23')
      secHeader2.value = 'LEMBAR PENGESAHAN LAPORAN'
      secHeader2.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      secHeader2.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(secHeader2, BRAND.slateText)
      ringkasanSheet.getRow(23).height = 24
      
      const sigR = 25
      ringkasanSheet.mergeCells(sigR, 1, sigR, 2)
      ringkasanSheet.mergeCells(sigR, 4, sigR, 5)
      ringkasanSheet.mergeCells(sigR, 7, sigR, 8)
      ringkasanSheet.getCell(sigR, 1).value = 'Dibuat Oleh,'
      ringkasanSheet.getCell(sigR, 4).value = 'Diperiksa Oleh,'
      ringkasanSheet.getCell(sigR, 7).value = 'Disetujui Oleh,'
      
      ;[1, 4, 7].forEach(col => {
        const cell = ringkasanSheet.getCell(sigR, col)
        cell.font = { italic: true, size: 9, color: { argb: BRAND.slateText } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })
      ringkasanSheet.getRow(sigR).height = 20
      
      const nameR = sigR + 4
      ringkasanSheet.mergeCells(nameR, 1, nameR, 2)
      ringkasanSheet.mergeCells(nameR, 4, nameR, 5)
      ringkasanSheet.mergeCells(nameR, 7, nameR, 8)
      ringkasanSheet.getCell(nameR, 1).value = cashierName
      ringkasanSheet.getCell(nameR, 4).value = '( ___________________ )'
      ringkasanSheet.getCell(nameR, 7).value = '( ___________________ )'
      
      ;[1, 4, 7].forEach(col => {
        const cell = ringkasanSheet.getCell(nameR, col)
        cell.font = { bold: true, size: 10, color: { argb: BRAND.slateText } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })
      
      const roleR = nameR + 1
      ringkasanSheet.mergeCells(roleR, 1, roleR, 2)
      ringkasanSheet.mergeCells(roleR, 4, roleR, 5)
      ringkasanSheet.mergeCells(roleR, 7, roleR, 8)
      ringkasanSheet.getCell(roleR, 1).value = 'Kasir / Staff POS'
      ringkasanSheet.getCell(roleR, 4).value = 'Supervisor / Manager'
      ringkasanSheet.getCell(roleR, 7).value = 'Owner / Direktur'
      
      ;[1, 4, 7].forEach(col => {
        const cell = ringkasanSheet.getCell(roleR, col)
        cell.font = { size: 8, color: { argb: BRAND.slateMuted }, italic: true }
        cell.alignment = { horizontal: 'center', vertical: 'top' }
      })
      ringkasanSheet.getRow(roleR).height = 16
      
      // ==========================================
      // SHEET 1.5: GRAFIK PENJUALAN
      // ==========================================
      const chartSheet = workbook.addWorksheet('Grafik Penjualan', {
        views: [{ state: 'frozen', ySplit: 5 }]
      })
      applyCompanyHeader(chartSheet, 'GRAFIK TREN PENJUALAN HARIAN', 'G')
      
      const chartHeaders = [
        'NO',
        'TANGGAL',
        'JUMLAH TRANSAKSI',
        'QTY TERJUAL',
        'TOTAL DITERIMA (PAJAK TERMASUK)',
        'PERSENTASE (%)',
        'GRAFIK DATA BAR'
      ]
      
      const cHeaderRow = chartSheet.getRow(5)
      cHeaderRow.values = chartHeaders
      styleHeaderRow(cHeaderRow, BRAND.blue)
      
      const analytics = salesAnalytics(data)
      
      analytics.daily.forEach((row, index) => {
        const added = chartSheet.addRow([
          index + 1,
          row.label,
          asNumber(row.transaksi),
          asNumber(row.qty),
          asNumber(row.total),
          grandTotal ? asNumber(row.total) / grandTotal : 0,
          asNumber(row.total) // dataBar target
        ])
        
        added.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 2 || colNum === 3 || colNum === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 3 || colNum === 4) {
            cell.numFmt = '#,##0'
          } else if (colNum === 5) {
            cell.numFmt = '"Rp" #,##0'
          } else if (colNum === 6) {
            cell.numFmt = '0.0%'
          } else if (colNum === 7) {
            cell.numFmt = '"Rp" #,##0'
          }
        })
        
        if (index % 2 === 1) {
          added.eachCell(cell => fillCell(cell, BRAND.slateSoft))
        }
      })
      
      if (analytics.daily.length > 0) {
        chartSheet.autoFilter = { from: 'A5', to: `G${5 + analytics.daily.length}` }
      }

      const cTotalRow = chartSheet.addRow([
        '',
        'TOTAL',
        analytics.daily.reduce((sum, item) => sum + asNumber(item.transaksi), 0),
        analytics.daily.reduce((sum, item) => sum + asNumber(item.qty), 0),
        grandTotal,
        1.0,
        ''
      ])
      
      cTotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        if (colNum === 3 || colNum === 4 || colNum === 6) {
          cell.numFmt = colNum === 6 ? '0.0%' : '#,##0'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum === 5) {
          cell.numFmt = '"Rp" #,##0'
        }
      })
      
      // Apply Native Excel Conditional Formatting Data Bars
      if (analytics.daily.length > 0) {
        chartSheet.addConditionalFormatting({
          ref: `G6:G${analytics.daily.length + 5}`,
          rules: [
            {
              type: 'dataBar',
              priority: 1,
              showValue: true,
              minLength: 0,
              maxLength: 100,
              gradient: true,
              cfvo: [{ type: 'min' }, { type: 'max' }],
              color: { argb: BRAND.blue }
            } as any
          ]
        })
      }
      
      // Add Line Chart next to daily sales table
      if (analytics.daily.length > 0) {
        const trendLabels = analytics.daily.map(row => row.label)
        const trendData = analytics.daily.map(row => asNumber(row.total))
        const chartConfig = {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [{
              label: 'Total Omzet (IDR)',
              data: trendData,
              borderColor: '#4F46E5', // Indigo
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              fill: true,
              borderWidth: 2.5,
              pointBackgroundColor: '#4F46E5',
              pointRadius: 3
            }]
          },
          options: {
            responsive: true,
            title: {
              display: true,
              text: 'TREN OMZET PENJUALAN HARIAN',
              fontSize: 14,
              fontColor: '#1E293B'
            },
            legend: {
              position: 'bottom',
              labels: { fontSize: 10 }
            },
            scales: {
              yAxes: [{
                ticks: {
                  fontSize: 9,
                  callback: (value: number) => {
                    if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + 'Jt'
                    if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(0) + 'Rb'
                    return 'Rp ' + value
                  }
                }
              }],
              xAxes: [{
                ticks: { fontSize: 9 }
              }]
            }
          }
        }
        const chartBuffer = await getChartBuffer(chartConfig)
        if (chartBuffer) {
          try {
            const imageId = workbook.addImage({
              buffer: chartBuffer as any,
              extension: 'png',
            })
            chartSheet.addImage(imageId, {
              tl: { col: 8, row: 4 }, // Column I (index 8), Row 5 (index 4)
              ext: { width: 580, height: 330 }
            })
          } catch (imgErr) {
            console.error('Error inserting daily chart:', imgErr)
          }
        }
      }
      
      autofitColumnWidths(chartSheet, 10, 32)
      
      // ==========================================
      // SHEET 2: DETAIL PENJUALAN
      // ==========================================
      const detailSheet = workbook.addWorksheet('Detail Transaksi', {
        views: [{ state: 'frozen', ySplit: 5 }],
        properties: { tabColor: { argb: BRAND.primary } },
      })
      applyCompanyHeader(detailSheet, 'LAPORAN RAGAM TRANSAKSI PENJUALAN', 'N')
      
      const detailHeaders = [
        'NO',
        'NOMOR INVOICE',
        'TANGGAL',
        'KASIR',
        'PELANGGAN',
        'JUMLAH ITEM',
        'SUBTOTAL',
        'DISKON',
        'PAJAK',
        'GRAND TOTAL',
        'DIBAYAR',
        'KEMBALIAN',
        'METODE PEMBAYARAN',
        'STATUS'
      ]
      
      const dHeaderRow = detailSheet.getRow(5)
      dHeaderRow.values = detailHeaders
      styleHeaderRow(dHeaderRow, BRAND.primary)
      
      data.forEach((item, index) => {
        const txDate = safeDate(item.tgl_wkt_transaksi)
        const grandTotalRow = saleGrandTotal(item)
        const settled = saleSettled(item)
        const row = detailSheet.addRow([
          index + 1,
          item.kd_tansaksi_jual,
          txDate ?? formatDateTime(item.tgl_wkt_transaksi),
          item.username_transaksi || '-',
          item.nama_customer || 'Umum',
          asNumber(item.total_qty),
          asNumber(item.sub_total),
          asNumber(item.discount_amount),
          asNumber(item.pajak),
          grandTotalRow,
          settled,
          asNumber(item.kembalian),
          item.jenis_pembayaran || '-',
          settled + 0.01 >= grandTotalRow ? 'LUNAS' : 'KURANG BAYAR',
        ])
        
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 6 || colNum === 13 || colNum === 14) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 3 && txDate) {
            cell.numFmt = 'dd/mm/yyyy hh:mm'
          } else if (colNum === 6) {
            cell.numFmt = '#,##0'
          } else if (colNum >= 7 && colNum <= 12) {
            cell.numFmt = '"Rp" #,##0'
          }
          if (colNum === 14 && String(cell.value) === 'KURANG BAYAR') {
            cell.font = { bold: true, color: { argb: BRAND.red } }
          }
        })
        
        if (index % 2 === 1) {
          row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
        }
      })

      const firstDataRow = 6
      const lastDataRow = firstDataRow + data.length - 1
      if (data.length > 0) {
        detailSheet.autoFilter = { from: 'A5', to: `N${lastDataRow}` }
      }

      const totalRow = detailSheet.addRow([
        '',
        '',
        '',
        'TOTAL KESELURUHAN',
        '',
        data.length ? { formula: `SUM(F${firstDataRow}:F${lastDataRow})` } : 0,
        data.length ? { formula: `SUM(G${firstDataRow}:G${lastDataRow})` } : 0,
        data.length ? { formula: `SUM(H${firstDataRow}:H${lastDataRow})` } : 0,
        data.length ? { formula: `SUM(I${firstDataRow}:I${lastDataRow})` } : 0,
        data.length ? { formula: `SUM(J${firstDataRow}:J${lastDataRow})` } : 0,
        data.length ? { formula: `SUM(K${firstDataRow}:K${lastDataRow})` } : 0,
        data.length ? { formula: `SUM(L${firstDataRow}:L${lastDataRow})` } : 0,
        '',
        '',
      ])
      
      totalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        
        if (colNum === 6) {
          cell.numFmt = '#,##0'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum >= 7 && colNum <= 12) {
          cell.numFmt = '"Rp" #,##0'
        }
      })
      autofitColumnWidths(detailSheet, 10, 32)

      // ==========================================
      // SHEET 3: DETAIL ITEM
      // ==========================================
      const itemSheet = workbook.addWorksheet('Detail Item', {
        views: [{ state: 'frozen', ySplit: 5 }],
        properties: { tabColor: { argb: BRAND.amber } },
      })
      applyCompanyHeader(itemSheet, 'RINCIAN ITEM TERJUAL', 'L')

      const itemHeaders = [
        'NO', 'NOMOR INVOICE', 'TANGGAL', 'KASIR', 'KODE BARANG', 'NAMA BARANG',
        'QTY', 'HARGA SATUAN', 'DISKON (%)', 'DISKON (Rp)', 'TOTAL PENJUALAN', 'HARGA MODAL',
      ]
      const iHeaderRow = itemSheet.getRow(5)
      iHeaderRow.values = itemHeaders
      styleHeaderRow(iHeaderRow, BRAND.primaryDark)

      detailItems.forEach((item, index) => {
        const itemDate = safeDate(item.tgl_wkt_transaksi)
        const row = itemSheet.addRow([
          index + 1,
          item.kd_tansaksi_jual ?? '',
          itemDate ?? formatDateTime(item.tgl_wkt_transaksi),
          item.username_transaksi ?? '-',
          item.kd_barang ?? '',
          item.nama_barang ?? '-',
          asNumber(item.qty),
          asNumber(item.harga_jual),
          asNumber(item.disc_persen) / 100,
          asNumber(item.diskon_item),
          asNumber(item.total_harga_jual),
          asNumber(item.harga_modal),
        ])
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 5 || colNum === 7 || colNum === 9) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 3 && itemDate) {
            cell.numFmt = 'dd/mm/yyyy hh:mm'
          } else if (colNum === 7) {
            cell.numFmt = '#,##0'
          } else if (colNum === 9) {
            cell.numFmt = '0.00%'
          } else if (colNum === 8 || colNum === 10 || colNum === 11 || colNum === 12) {
            cell.numFmt = '"Rp" #,##0'
          }
        })
        if (index % 2 === 1) row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
      })

      const firstItemRow = 6
      const lastItemRow = firstItemRow + detailItems.length - 1
      if (detailItems.length > 0) {
        itemSheet.autoFilter = { from: 'A5', to: `L${lastItemRow}` }
      }
      const itemTotalRow = itemSheet.addRow([
        '', '', '', 'TOTAL ITEM', '', '',
        detailItems.length ? { formula: `SUM(G${firstItemRow}:G${lastItemRow})` } : 0,
        '', '',
        detailItems.length ? { formula: `SUM(J${firstItemRow}:J${lastItemRow})` } : 0,
        detailItems.length ? { formula: `SUM(K${firstItemRow}:K${lastItemRow})` } : 0,
        detailItems.length ? { formula: `SUM(L${firstItemRow}:L${lastItemRow})` } : 0,
      ])
      itemTotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        if (colNum === 7) cell.numFmt = '#,##0'
        if (colNum === 10 || colNum === 11 || colNum === 12) cell.numFmt = '"Rp" #,##0'
      })
      autofitColumnWidths(itemSheet, 10, 34)

      // ==========================================
      // SHEET 4: PRODUK TERLARIS
      // ==========================================
      const produkSheet = workbook.addWorksheet('Produk Terlaris', {
        views: [{ state: 'frozen', ySplit: 5 }],
        properties: { tabColor: { argb: BRAND.green } },
      })
      applyCompanyHeader(produkSheet, 'LAPORAN PENJUALAN PRODUK TERLARIS', 'I')
      
      const produkHeaders = [
        'NO', 'KODE PRODUK', 'NAMA PRODUK', 'QTY TERJUAL', 'QTY RETUR', 'QTY BERSIH',
        'OMZET KOTOR', 'NILAI RETUR', 'OMZET BERSIH',
      ]
      const pHeaderRow = produkSheet.getRow(5)
      pHeaderRow.values = produkHeaders
      styleHeaderRow(pHeaderRow, BRAND.primary)

      const produkOmzetTotal = produkTerlaris.reduce(
        (sum, item) => sum + asNumber(item.net_penjualan ?? item.total_penjualan), 0
      )
      produkTerlaris.forEach((item, index) => {
        const row = produkSheet.addRow([
          index + 1,
          item.kd_barang,
          item.nama_barang || '-',
          asNumber(item.total_qty),
          asNumber(item.qty_retur),
          asNumber(item.net_qty ?? item.total_qty),
          asNumber(item.total_penjualan),
          asNumber(item.nilai_retur),
          asNumber(item.net_penjualan ?? item.total_penjualan),
        ])
        
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum >= 4 && colNum <= 6) {
            cell.numFmt = '#,##0'
          } else if (colNum >= 7 && colNum <= 9) {
            cell.numFmt = '"Rp" #,##0'
          }
        })
        
        if (index % 2 === 1) {
          row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
        }
      })

      const firstProdukRow = 6
      const lastProdukRow = firstProdukRow + produkTerlaris.length - 1
      if (produkTerlaris.length > 0) {
        produkSheet.autoFilter = { from: 'A5', to: `I${lastProdukRow}` }
      }
      if (!produkTerlaris.length) {
        const emptyRow = produkSheet.addRow(['', '', 'Tidak ada penjualan pada periode ini', '', '', '', '', '', ''])
        emptyRow.getCell(3).font = { italic: true, color: { argb: BRAND.slateMuted } }
      }
      
      const pTotalRow = produkSheet.addRow([
        '',
        '',
        'TOTAL',
        produkTerlaris.length ? { formula: `SUM(D${firstProdukRow}:D${lastProdukRow})` } : 0,
        produkTerlaris.length ? { formula: `SUM(E${firstProdukRow}:E${lastProdukRow})` } : 0,
        produkTerlaris.length ? { formula: `SUM(F${firstProdukRow}:F${lastProdukRow})` } : 0,
        produkTerlaris.length ? { formula: `SUM(G${firstProdukRow}:G${lastProdukRow})` } : 0,
        produkTerlaris.length ? { formula: `SUM(H${firstProdukRow}:H${lastProdukRow})` } : 0,
        produkTerlaris.length ? { formula: `SUM(I${firstProdukRow}:I${lastProdukRow})` } : 0,
      ])
      
      pTotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        if (colNum >= 4 && colNum <= 6) {
          cell.numFmt = '#,##0'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum >= 7 && colNum <= 9) {
          cell.numFmt = '"Rp" #,##0'
        }
      })
      // Kontribusi omzet bersih per produk (dihitung dari total omzet produk)
      if (produkOmzetTotal > 0) {
        const contribRow = produkSheet.addRow(['', '', 'KONTRIBUSI OMZET BERSIH', '', '', '', '', '', ''])
        contribRow.getCell(3).font = { bold: true, size: 9, color: { argb: BRAND.slateMuted } }
        produkTerlaris.slice(0, 10).forEach((item, index) => {
          const share = asNumber(item.net_penjualan ?? item.total_penjualan) / produkOmzetTotal
          produkSheet.addRow(['', item.kd_barang, item.nama_barang || '-', '', '', '', '', '', share])
            .getCell(9).numFmt = '0.00%'
        })
      }
      
      // Add Product Sales Chart next to table
      if (produkTerlaris.length > 0) {
        const topProducts = produkTerlaris.slice(0, 10)
        const productChartConfig = {
          type: 'horizontalBar',
          data: {
            labels: topProducts.map(item => String(item.nama_barang || '').slice(0, 18)),
            datasets: [{
              label: 'Qty Terjual',
              data: topProducts.map(item => asNumber(item.total_qty)),
              backgroundColor: 'rgba(219, 39, 119, 0.75)', // Pink/Magenta theme
              borderColor: '#DB2777',
              borderWidth: 1.5
            }]
          },
          options: {
            responsive: true,
            title: {
              display: true,
              text: 'TOP 10 PRODUK TERLARIS (QTY)',
              fontSize: 14,
              fontColor: '#1E293B'
            },
            legend: { display: false },
            scales: {
              xAxes: [{
                ticks: { beginAtZero: true, fontSize: 9 }
              }],
              yAxes: [{
                ticks: { fontSize: 9 }
              }]
            }
          }
        }
        const productChartBuffer = await getChartBuffer(productChartConfig)
        if (productChartBuffer) {
          try {
            const imageId = workbook.addImage({
              buffer: productChartBuffer as any,
              extension: 'png',
            })
            produkSheet.addImage(imageId, {
              tl: { col: 7, row: 4 }, // Column H (index 7), Row 5 (index 4)
              ext: { width: 550, height: 330 }
            })
          } catch (imgErr) {
            console.error('Error inserting product chart:', imgErr)
          }
        }
      }
      
      autofitColumnWidths(produkSheet, 10, 35)
      
      // ==========================================
      // SHEET 4: KASIR TERBAIK
      // ==========================================
      const kasirSheet = workbook.addWorksheet('Kasir Terbaik', {
        views: [{ state: 'frozen', ySplit: 5 }]
      })
      applyCompanyHeader(kasirSheet, 'LAPORAN KINERJA KASIR', 'E')
      
      const kasirHeaders = ['NO', 'USERNAME KASIR', 'JUMLAH TRANSAKSI', 'TOTAL PENJUALAN', 'RATA-RATA TRANSAKSI']
      const kHeaderRow = kasirSheet.getRow(5)
      kHeaderRow.values = kasirHeaders
      styleHeaderRow(kHeaderRow, BRAND.primary)
      
      kasirTerbaik.forEach((item, index) => {
        const row = kasirSheet.addRow([
          index + 1,
          item.username,
          asNumber(item.count),
          asNumber(item.total),
          item.count ? asNumber(item.total) / item.count : 0
        ])
        
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 3) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 3) {
            cell.numFmt = '#,##0'
          } else if (colNum === 4 || colNum === 5) {
            cell.numFmt = '"Rp" #,##0'
          }
        })
        
        if (index % 2 === 1) {
          row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
        }
      })
      
      const kTotalRow = kasirSheet.addRow([
        '',
        'TOTAL',
        kasirTerbaik.reduce((sum, item) => sum + asNumber(item.count), 0),
        kasirTerbaik.reduce((sum, item) => sum + asNumber(item.total), 0),
        kasirTerbaik.length ? kasirTerbaik.reduce((sum, item) => sum + asNumber(item.total), 0) / kasirTerbaik.reduce((sum, item) => sum + asNumber(item.count), 0) : 0
      ])
      
      kTotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        if (colNum === 3) {
          cell.numFmt = '#,##0'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum === 4 || colNum === 5) {
          cell.numFmt = '"Rp" #,##0'
        }
      })
      
      // Add Cashier Sales Chart next to table
      if (kasirTerbaik.length > 0) {
        const kasirChartConfig = {
          type: 'bar',
          data: {
            labels: kasirTerbaik.map(item => item.username),
            datasets: [{
              label: 'Total Penjualan (IDR)',
              data: kasirTerbaik.map(item => asNumber(item.total)),
              backgroundColor: 'rgba(5, 150, 105, 0.75)', // Emerald green
              borderColor: '#059669',
              borderWidth: 1.5
            }]
          },
          options: {
            responsive: true,
            title: {
              display: true,
              text: 'PERBANDINGAN PENJUALAN KASIR',
              fontSize: 14,
              fontColor: '#1E293B'
            },
            legend: { display: false },
            scales: {
              yAxes: [{
                ticks: {
                  beginAtZero: true,
                  fontSize: 9,
                  callback: (value: number) => {
                    if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + 'Jt'
                    if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(0) + 'Rb'
                    return 'Rp ' + value
                  }
                }
              }],
              xAxes: [{
                ticks: { fontSize: 9 }
              }]
            }
          }
        }
        const kasirChartBuffer = await getChartBuffer(kasirChartConfig)
        if (kasirChartBuffer) {
          try {
            const imageId = workbook.addImage({
              buffer: kasirChartBuffer as any,
              extension: 'png',
            })
            kasirSheet.addImage(imageId, {
              tl: { col: 6, row: 4 }, // Column G (index 6), Row 5 (index 4)
              ext: { width: 550, height: 330 }
            })
          } catch (imgErr) {
            console.error('Error inserting cashier chart:', imgErr)
          }
        }
      }
      
      if (kasirTerbaik.length > 0) {
        kasirSheet.autoFilter = { from: 'A5', to: `E${5 + kasirTerbaik.length}` }
      } else {
        kasirSheet.addRow(['', '', 'Tidak ada transaksi pada periode ini', '', '']).getCell(3).font = {
          italic: true, color: { argb: BRAND.slateMuted },
        }
      }
      autofitColumnWidths(kasirSheet, 10, 32)
      
      // ==========================================
      // SHEET 5: METODE PEMBAYARAN
      // ==========================================
      const metodeSheet = workbook.addWorksheet('Metode Pembayaran', {
        views: [{ state: 'frozen', ySplit: 5 }]
      })
      applyCompanyHeader(metodeSheet, 'KONTRIBUSI METODE PEMBAYARAN', 'G')
      
      const metodeHeaders = [
        'NO', 'METODE PEMBAYARAN', 'JUMLAH TRANSAKSI', 'PENJUALAN BERSIH', 'PAJAK', 'TOTAL DITERIMA', 'PERSENTASE',
      ]
      const mHeaderRow = metodeSheet.getRow(5)
      mHeaderRow.values = metodeHeaders
      styleHeaderRow(mHeaderRow, BRAND.primary)
      
      metodePembayaran.forEach((item, index) => {
        const row = metodeSheet.addRow([
          index + 1,
          item.method,
          asNumber(item.count),
          asNumber(item.net),
          asNumber(item.pajak),
          asNumber(item.total),
          grandTotal ? asNumber(item.total) / grandTotal : 0,
        ])
        
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 3 || colNum === 7) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 3) {
            cell.numFmt = '#,##0'
          } else if (colNum >= 4 && colNum <= 6) {
            cell.numFmt = '"Rp" #,##0'
          } else if (colNum === 7) {
            cell.numFmt = '0.0%'
          }
        })
        
        if (index % 2 === 1) {
          row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
        }
      })
      
      const mTotalRow = metodeSheet.addRow([
        '',
        'TOTAL',
        metodePembayaran.reduce((sum, item) => sum + asNumber(item.count), 0),
        metodePembayaran.reduce((sum, item) => sum + asNumber(item.net), 0),
        metodePembayaran.reduce((sum, item) => sum + asNumber(item.pajak), 0),
        metodePembayaran.reduce((sum, item) => sum + asNumber(item.total), 0),
        1.0
      ])
      
      mTotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        if (colNum === 3 || colNum === 7) {
          cell.numFmt = colNum === 3 ? '#,##0' : '0.0%'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum >= 4 && colNum <= 6) {
          cell.numFmt = '"Rp" #,##0'
        }
      })
      
      // Add Payment Method Donut Chart next to table
      if (metodePembayaran.length > 0) {
        const paymentChartConfig = {
          type: 'doughnut',
          data: {
            labels: metodePembayaran.map(item => item.method),
            datasets: [{
              data: metodePembayaran.map(item => asNumber(item.total)),
              backgroundColor: ['#2563EB', '#D97706', '#DB2777', '#059669', '#7C3AED', '#3B82F6'], // multi-color
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            title: {
              display: true,
              text: 'KONTRIBUSI METODE PEMBAYARAN',
              fontSize: 14,
              fontColor: '#1E293B'
            },
            legend: {
              position: 'bottom',
              labels: { fontSize: 9 }
            }
          }
        }
        const paymentChartBuffer = await getChartBuffer(paymentChartConfig)
        if (paymentChartBuffer) {
          try {
            const imageId = workbook.addImage({
              buffer: paymentChartBuffer as any,
              extension: 'png',
            })
            metodeSheet.addImage(imageId, {
              tl: { col: 6, row: 4 }, // Column G (index 6), Row 5 (index 4)
              ext: { width: 450, height: 330 }
            })
          } catch (imgErr) {
            console.error('Error inserting payment chart:', imgErr)
          }
        }
      }
      
      if (metodePembayaran.length > 0) {
        metodeSheet.autoFilter = { from: 'A5', to: `G${5 + metodePembayaran.length}` }
      } else {
        metodeSheet.addRow(['', 'Tidak ada data pembayaran', '', '', '', '', '']).getCell(2).font = {
          italic: true, color: { argb: BRAND.slateMuted },
        }
      }
      autofitColumnWidths(metodeSheet, 10, 32)
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filepath = exportPath(`laporan_penjualan_${timestamp}.xlsx`, customPath)
      await workbook.xlsx.writeFile(filepath)
      
      return {
        success: true,
        message: 'Laporan Penjualan Excel berhasil diexport dengan multi-sheet profesional',
        data: { filepath, filename: path.basename(filepath) }
      }
    } catch (error) {
      return {
        success: false,
        message: 'Gagal export Excel: ' + (error as Error).message
      }
    }
  }

  // Export Laporan Penjualan to PDF in A4 Landscape, repeating headers, signatures, and summary panel
  static exportLaporanPenjualanPDF(data: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const storeInfo = IdentitasModel.get()
      const cashierName = demoSession.getUsername() || 'Administrator'
      
      let startDateStr = context?.startDate
      let endDateStr = context?.endDate
      if (!startDateStr || !endDateStr) {
        const dates = data.map(item => String(item.tgl_wkt_transaksi || '').slice(0, 10)).filter(Boolean).sort()
        if (dates.length > 0) {
          startDateStr = dates[0]
          endDateStr = dates[dates.length - 1]
        }
      }
      
      const period = salesPeriodLabel(data, context)
      const printedAt = new Date().toLocaleString('id-ID')

      // Angka ringkasan kanonik (sama dengan UI, XLSX, dan CSV)
      const summary = context?.summary ?? null
      let labaRugi: any = context?.labaRugi ?? null
      if (!labaRugi && startDateStr && endDateStr) {
        try {
          const lr = LaporanController.getLaporanLabaRugi(startDateStr, endDateStr)
          if (lr.success && lr.data) labaRugi = lr.data
        } catch (err) {
          console.error(err)
        }
      }

      const totalTransactions = asNumber(summary?.total_transaksi ?? data.length)
      const totalRevenue = asNumber(summary?.penjualan_bersih
        ?? data.reduce((sum, item) => sum + saleNet(item), 0))
      const totalDiscounts = asNumber(summary?.total_diskon
        ?? data.reduce((sum, item) => sum + asNumber(item.discount_amount), 0))
      const totalTaxes = asNumber(summary?.total_pajak
        ?? data.reduce((sum, item) => sum + asNumber(item.pajak), 0))
      const totalQty = asNumber(summary?.total_qty
        ?? data.reduce((sum, item) => sum + asNumber(item.total_qty), 0))
      const grandTotal = asNumber(summary?.grand_total
        ?? data.reduce((sum, item) => sum + saleGrandTotal(item), 0))
      const totalRetur = asNumber(summary?.total_retur ?? 0)
      const netAfterReturns = asNumber(summary?.penjualan_setelah_retur ?? (totalRevenue - totalRetur))
      const hpp = asNumber(labaRugi?.total_hpp ?? labaRugi?.total_modal ?? 0)
      const labaKotor = asNumber(labaRugi?.laba_kotor ?? 0)
      const marginPersen = asNumber(labaRugi?.margin_persen ?? 0)
      const avgTransaction = asNumber(summary?.rata_rata_transaksi
        ?? (totalTransactions ? totalRevenue / totalTransactions : 0))

      // Metode pembayaran terbanyak berdasarkan nilai transaksi
      const payMap = new Map<string, number>()
      for (const item of data) {
        const m = String(item.jenis_pembayaran || 'TUNAI').toUpperCase()
        payMap.set(m, (payMap.get(m) || 0) + saleGrandTotal(item))
      }
      const sortedPay = Array.from(payMap.entries()).sort((a, b) => b[1] - a[1])
      const topPaymentMethod = sortedPay[0]?.[0] || 'TUNAI'

      let produkTerlaris: any[] = Array.isArray(context?.produk) ? context?.produk ?? [] : []
      if (!produkTerlaris.length && startDateStr && endDateStr) {
        try {
          const pr = LaporanController.getLaporanProdukTerlaris(startDateStr, endDateStr, 1000)
          if (pr.success && pr.data) produkTerlaris = pr.data
        } catch (err) {
          console.error(err)
        }
      }
      
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })
      
      const pageWidth = doc.internal.pageSize.getWidth() // 297mm
      const pageHeight = doc.internal.pageSize.getHeight() // 210mm
      
      // Helper function to draw page header
      const drawHeader = (d: any, pageNo: number) => {
        const logoX = 15
        const logoY = 10
        const logoSize = 14 // diameter
        
        const storeName = storeInfo?.namatoko || 'WariPOS'
        const storeAddress = storeInfo?.alamattoko || 'Jl. Raya WariPOS No. 1, Pekanbaru'
        const storePhone = storeInfo?.nomortelptoko || '0812-3456-7890'
        const storeEmail = storeInfo?.alamatemailowner || 'info@waripos.com'
        
        // Circular Logo Placeholder or Base64 Image
        let logoDrawn = false
        if (storeInfo?.logo) {
          try {
            d.addImage(storeInfo.logo, 'PNG', logoX, logoY, logoSize, logoSize)
            logoDrawn = true
          } catch (err) {
            console.error('Gagal memuat logo identitas:', err)
          }
        }
        
        if (!logoDrawn) {
          d.setFillColor(219, 39, 119) // deep pink BRAND.primary
          d.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 'F')
          d.setTextColor(255, 255, 255)
          d.setFont('helvetica', 'bold')
          d.setFontSize(14)
          d.text('', logoX + logoSize/2, logoY + logoSize/2 + 2, { align: 'center' })
        }
        
        // Store Meta on Left
        d.setFont('helvetica', 'bold')
        d.setFontSize(12)
        d.setTextColor(51, 65, 85)
        d.text(storeName, logoX + logoSize + 4, logoY + 3.5)
        
        d.setFont('helvetica', 'normal')
        d.setFontSize(8)
        d.setTextColor(100, 116, 139)
        d.text(storeAddress, logoX + logoSize + 4, logoY + 7.5)
        d.text(`Telp: ${storePhone}   |   Email: ${storeEmail}`, logoX + logoSize + 4, logoY + 11.5)
        
        // Report Info on Right
        d.setFont('helvetica', 'bold')
        d.setFontSize(14)
        d.setTextColor(219, 39, 119)
        d.text('LAPORAN PENJUALAN', pageWidth - 15, logoY + 4, { align: 'right' })
        
        d.setFont('helvetica', 'normal')
        d.setFontSize(8)
        d.setTextColor(100, 116, 139)
        d.text(`Periode: ${period}`, pageWidth - 15, logoY + 8, { align: 'right' })
        d.text(`Dicetak: ${printedAt}   |   Kasir: ${cashierName}`, pageWidth - 15, logoY + 12, { align: 'right' })
        
        // Bottom divider line
        d.setDrawColor(226, 232, 240)
        d.setLineWidth(0.3)
        d.line(15, logoY + logoSize + 4, pageWidth - 15, logoY + logoSize + 4)
      }
      
      // Helper function to draw page footer
      const drawFooter = (d: any, pageNo: number, totalP: number) => {
        d.setDrawColor(226, 232, 240)
        d.setLineWidth(0.3)
        d.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15)
        
        d.setFontSize(7.5)
        d.setFont('helvetica', 'normal')
        d.setTextColor(148, 163, 184)
        d.text('Laporan POS Keuangan Penjualan - Sistem Kasir Profesional WariPOS', 15, pageHeight - 10)
        d.text(`Halaman ${pageNo} dari ${totalP}`, pageWidth - 15, pageHeight - 10, { align: 'right' })
      }
      
      // Page 1 Dashboard / KPI cards
      const cardW = 63
      const cardH = 14
      const cardGapX = 5
      const cardGapY = 3
      
      const cards = [
        { label: 'TOTAL TRANSAKSI', value: totalTransactions.toLocaleString('id-ID'), color: [37, 99, 235] },
        { label: 'PENJUALAN BERSIH', value: formatIdr(totalRevenue), color: [5, 150, 105] },
        { label: 'GRAND TOTAL (PAJAK TERMASUK)', value: formatIdr(grandTotal), color: [219, 39, 119] },
        { label: 'PRODUK TERJUAL', value: totalQty.toLocaleString('id-ID'), color: [217, 119, 6] },
        { label: 'TOTAL DISKON', value: formatIdr(totalDiscounts), color: [220, 38, 38] },
        { label: 'TOTAL PAJAK', value: formatIdr(totalTaxes), color: [217, 119, 6] },
        { label: 'RETUR DISETUJUI', value: formatIdr(totalRetur), color: [220, 38, 38] },
        { label: 'RATA-RATA / TRANSAKSI', value: formatIdr(avgTransaction), color: [37, 99, 235] },
        { label: 'HPP (HARGA MODAL)', value: formatIdr(hpp), color: [100, 116, 139] },
        { label: 'LABA KOTOR', value: formatIdr(labaKotor), color: [5, 150, 105] },
        { label: 'MARGIN LABA', value: `${marginPersen.toFixed(2)}%`, color: [219, 39, 119] },
        { label: 'METODE TERBANYAK', value: topPaymentMethod, color: [37, 99, 235] }
      ]
      
      // Render KPI cards on first page
      doc.setFont('helvetica', 'normal')
      cards.forEach((card, idx) => {
        const row = Math.floor(idx / 4)
        const col = idx % 4
        const x = 15 + col * (cardW + cardGapX)
        const y = 32 + row * (cardH + cardGapY)
        
        doc.setFillColor(248, 250, 252) // slate-50
        doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'F')
        
        doc.setDrawColor(226, 232, 240) // slate-200
        doc.setLineWidth(0.2)
        doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'S')
        
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 116, 139)
        doc.text(card.label, x + 3, y + 4.5)
        
        doc.setFontSize(9)
        const [cr, cg, cb] = card.color
        doc.setTextColor(cr, cg, cb)
        doc.text(card.value, x + 3, y + 10.5)
      })
      
      // Draw details table
      const headers = [
        'No',
        'Nomor Invoice',
        'Tanggal',
        'Kasir',
        'Pelanggan',
        'Item',
        'Subtotal',
        'Diskon',
        'Pajak',
        'Grand Total',
        'Dibayar',
        'Kembali',
        'Metode',
        'Status'
      ]

      const body: any[] = data.map((item, idx) => {
        const grandTotalRow = saleGrandTotal(item)
        const settled = saleSettled(item)
        return [
          idx + 1,
          item.kd_tansaksi_jual,
          formatDateTime(item.tgl_wkt_transaksi),
          item.username_transaksi || '-',
          item.nama_customer || 'Umum',
          asNumber(item.total_qty).toLocaleString('id-ID'),
          formatIdr(item.sub_total),
          formatIdr(item.discount_amount ?? 0),
          formatIdr(item.pajak),
          formatIdr(grandTotalRow),
          formatIdr(settled),
          formatIdr(item.kembalian ?? 0),
          item.jenis_pembayaran || '-',
          settled + 0.01 >= grandTotalRow ? 'LUNAS' : 'KURANG BAYAR',
        ]
      })

      if (!data.length) {
        body.push([{ content: 'Tidak ada transaksi pada periode ini', colSpan: 14, styles: { halign: 'center', fontStyle: 'italic', textColor: [148, 163, 184] } }])
      }
      
      const foot = [[
        '',
        '',
        '',
        'TOTAL KESELURUHAN',
        '',
        totalQty.toLocaleString('id-ID'),
        formatIdr(data.reduce((sum, item) => sum + asNumber(item.sub_total), 0)),
        formatIdr(totalDiscounts),
        formatIdr(totalTaxes),
        formatIdr(grandTotal),
        formatIdr(data.reduce((sum, item) => sum + saleSettled(item), 0)),
        formatIdr(data.reduce((sum, item) => sum + asNumber(item.kembalian), 0)),
        '',
        ''
      ]]
      
      autoTable(doc, {
        head: [headers],
        body,
        foot,
        startY: 86,
        showHead: 'everyPage',
        styles: {
          fontSize: 6.8,
          cellPadding: 1.6,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [219, 39, 119],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 6.8
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        footStyles: {
          fillColor: [252, 231, 243],
          textColor: [51, 65, 85],
          fontStyle: 'bold',
          fontSize: 6.6
        },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'left' },
          2: { halign: 'left' },
          3: { halign: 'left' },
          4: { halign: 'left' },
          5: { halign: 'center' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right', fontStyle: 'bold' },
          10: { halign: 'right' },
          11: { halign: 'right' },
          12: { halign: 'center' },
          13: { halign: 'center' }
        },
        didParseCell: (cellData: any) => {
          if (cellData.section !== 'body') return
          if (cellData.column.index === 13 && cellData.cell.raw === 'KURANG BAYAR') {
            cellData.cell.styles.textColor = [220, 38, 38]
            cellData.cell.styles.fontStyle = 'bold'
          }
        },
        margin: { left: 15, right: 15, top: 32, bottom: 20 }
      })
      
      const finalY = (doc as any).lastAutoTable.finalY || 120

      // Definisi metrik & catatan agar laporan dapat diaudit
      const notes = [
        'Omzet kotor = jumlah subtotal item setelah diskon item, sebelum diskon invoice dan pajak.',
        'Penjualan bersih = omzet kotor - diskon invoice (belum termasuk pajak dan retur).',
        `Grand total = penjualan bersih + pajak = ${formatIdr(grandTotal)}.`,
        `Penjualan setelah retur = ${formatIdr(netAfterReturns)}. Retur dihitung dari retur APPROVED pada periode ini.`,
        'HPP dan laba kotor dihitung dari harga modal item. HPP barang retur belum tersedia pada data retur.',
        'Tidak ada status pembatalan pada skema penjualan; status LUNAS/KURANG BAYAR diturunkan dari pembayaran tercatat.',
      ]
      let cursorY = finalY + 7
      if (cursorY + notes.length * 4 > pageHeight - 30) {
        doc.addPage()
        cursorY = 38
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      doc.setTextColor(100, 116, 139)
      notes.forEach((note, index) => {
        doc.text(`- ${note}`, 15, cursorY + index * 4)
      })

      // Analisis produk terlaris (halaman terpisah)
      const produkTop = produkTerlaris.slice(0, 15)
      if (produkTop.length) {
        doc.addPage()
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(51, 65, 85)
        doc.text('PRODUK TERLARIS', 15, 38)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text('Diurutkan berdasarkan qty bersih setelah retur pada periode laporan', 15, 43)

        autoTable(doc, {
          head: [['No', 'Kode', 'Nama Produk', 'Qty Terjual', 'Qty Retur', 'Qty Bersih', 'Omzet Kotor', 'Nilai Retur', 'Omzet Bersih']],
          body: produkTop.map((item: any, idx: number) => [
            idx + 1,
            item.kd_barang ?? '-',
            item.nama_barang ?? '-',
            asNumber(item.total_qty).toLocaleString('id-ID'),
            asNumber(item.qty_retur).toLocaleString('id-ID'),
            asNumber(item.net_qty ?? item.total_qty).toLocaleString('id-ID'),
            formatIdr(item.total_penjualan),
            formatIdr(item.nilai_retur),
            formatIdr(item.net_penjualan ?? item.total_penjualan),
          ]),
          startY: 47,
          showHead: 'everyPage',
          styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.1, overflow: 'linebreak' },
          headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { halign: 'center' },
            1: { halign: 'left' },
            2: { halign: 'left' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: 15, right: 15, top: 32, bottom: 20 },
        })
      }

      // Signature Section
      let sigY = ((doc as any).lastAutoTable?.finalY || cursorY) + 15
      
      // If remaining height is too small for signature block, add page
      if (sigY > pageHeight - 45) {
        doc.addPage()
        sigY = 40 // top-aligned on new page, below page header
      }
      
      const sigWidth = pageWidth - 30 // printable width 267mm
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)
      
      doc.text('Dibuat Oleh,', 15 + sigWidth / 6, sigY, { align: 'center' })
      doc.text('Diperiksa Oleh,', 15 + sigWidth / 2, sigY, { align: 'center' })
      doc.text('Disetujui Oleh,', 15 + 5 * sigWidth / 6, sigY, { align: 'center' })
      
      const sigNameY = sigY + 22
      doc.setFont('helvetica', 'bold')
      doc.text(cashierName, 15 + sigWidth / 6, sigNameY, { align: 'center' })
      doc.text('( ___________________ )', 15 + sigWidth / 2, sigNameY, { align: 'center' })
      doc.text('( ___________________ )', 15 + 5 * sigWidth / 6, sigNameY, { align: 'center' })
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text('Kasir / Staff POS', 15 + sigWidth / 6, sigNameY + 4, { align: 'center' })
      doc.text('Supervisor / Manager', 15 + sigWidth / 2, sigNameY + 4, { align: 'center' })
      doc.text('Owner / Direktur', 15 + 5 * sigWidth / 6, sigNameY + 4, { align: 'center' })
      
      // Loop over all pages to draw dynamic header/footer
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        drawHeader(doc, i)
        drawFooter(doc, i, pageCount)
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filepath = exportPath(`laporan_penjualan_${timestamp}.pdf`, customPath)
      const pdfBuffer = doc.output('arraybuffer')
      fs.writeFileSync(filepath, Buffer.from(pdfBuffer))
      
      return {
        success: true,
        message: 'Laporan Penjualan PDF berhasil diexport dengan format A4 Landscape profesional',
        data: { filepath, filename: path.basename(filepath) }
      }
    } catch (error) {
      return {
        success: false,
        message: 'Gagal export PDF: ' + (error as Error).message
      }
    }
  }

  // Export Laporan Stok to Excel with Chart
  static async exportLaporanStokExcel(data: any[], customPath?: string) {
    try {
      const items = Array.isArray(data) ? data : []
      const menipis = items.filter(item => asNumber(item.stok) <= asNumber(item.stok_minimum)).length
      const aman = items.length - menipis
      const today = new Date().toISOString().slice(0, 10)

      return this.writeReportExcel({
        filenamePrefix: 'laporan_stok',
        sheetName: 'Persediaan',
        title: 'LAPORAN PERSEDIAAN',
        subtitle: `Per ${formatLongDate(today)}`,
        metrics: [
          { label: 'TOTAL ITEM', value: items.length, numFmt: '#,##0' },
          { label: 'STOK MENIPIS', value: menipis, numFmt: '#,##0' },
          { label: 'STOK AMAN', value: aman, numFmt: '#,##0' },
          { label: 'PERSENTASE MENIPIS', value: items.length ? menipis / items.length : 0, numFmt: '0.00%' },
        ],
        headers: ['NO', 'KODE BARANG', 'NAMA BARANG', 'STOK', 'STOK MINIMUM', 'STATUS'],
        rows: items.map((item, index) => [
          index + 1,
          item.kd_barang ?? '',
          item.nama_barang ?? '',
          asNumber(item.stok),
          asNumber(item.stok_minimum),
          asNumber(item.stok) <= asNumber(item.stok_minimum) ? 'MENIPIS' : 'AMAN',
        ]),
        numFmts: { 4: '#,##0', 5: '#,##0' },
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static exportLaporanStokPDF(data: any[], customPath?: string) {
    try {
      const items = Array.isArray(data) ? data : []
      const menipis = items.filter(item => asNumber(item.stok) <= asNumber(item.stok_minimum)).length
      const aman = items.length - menipis
      const today = new Date().toISOString().slice(0, 10)

      return this.writeReportPDF({
        filenamePrefix: 'laporan_stok',
        title: 'LAPORAN PERSEDIAAN',
        subtitle: `Per ${formatLongDate(today)}`,
        metrics: [
          { label: 'TOTAL ITEM', value: items.length.toLocaleString('id-ID') },
          { label: 'STOK MENIPIS', value: menipis.toLocaleString('id-ID') },
          { label: 'STOK AMAN', value: aman.toLocaleString('id-ID') },
          { label: 'PERSENTASE MENIPIS', value: `${items.length ? ((menipis / items.length) * 100).toFixed(2) : '0.00'}%` },
        ],
        headers: ['No', 'Kode', 'Nama Barang', 'Stok', 'Minimum', 'Status'],
        rows: items.map((item, index) => [
          index + 1,
          item.kd_barang ?? '-',
          item.nama_barang ?? '-',
          asNumber(item.stok).toLocaleString('id-ID'),
          asNumber(item.stok_minimum).toLocaleString('id-ID'),
          asNumber(item.stok) <= asNumber(item.stok_minimum) ? 'MENIPIS' : 'AMAN',
        ]),
        orientation: 'portrait',
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold' },
        },
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ==========================================
  // CSV EXPORTS
  // ==========================================

  static exportLaporanPenjualanCSV(data: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const rows = (Array.isArray(data) ? data : []).map(item => [
        item.kd_tansaksi_jual ?? '',
        csvDateOnly(item.tgl_wkt_transaksi),
        csvTimeOnly(item.tgl_wkt_transaksi),
        item.username_transaksi ?? '',
        item.nama_customer ?? 'Umum',
        String(item.jenis_pembayaran ?? '').toUpperCase(),
        asNumber(item.total_qty),
        asNumber(item.sub_total),
        asNumber(item.discount_amount),
        asNumber(item.pajak),
        saleGrandTotal(item),
        saleSettled(item),
        asNumber(item.kembalian),
        saleSettled(item) + 0.01 >= saleGrandTotal(item) ? 'LUNAS' : 'KURANG BAYAR',
      ])

      const headers = [
        'nomor_invoice', 'tanggal', 'waktu', 'kasir', 'pelanggan', 'metode_pembayaran',
        'jumlah_item', 'subtotal', 'diskon', 'pajak', 'grand_total', 'dibayar',
        'kembalian', 'status_pembayaran',
      ]

      const period = periodFromContext(context) || new Date().toISOString().slice(0, 10)
      return saveCsv(`laporan_penjualan_${period}.csv`, buildCsv(headers, rows), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static exportLaporanDetailItemCSV(items: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const rows = (Array.isArray(items) ? items : []).map(item => [
        item.kd_tansaksi_jual ?? '',
        csvDateOnly(item.tgl_wkt_transaksi),
        item.username_transaksi ?? '',
        item.kd_barang ?? '',
        item.nama_barang ?? '',
        asNumber(item.qty),
        asNumber(item.harga_jual),
        asNumber(item.disc_persen),
        asNumber(item.diskon_item),
        asNumber(item.total_harga_jual),
        asNumber(item.harga_modal),
      ])

      const headers = [
        'nomor_invoice', 'tanggal', 'kasir', 'kode_barang', 'nama_barang', 'qty',
        'harga_satuan', 'diskon_persen', 'diskon_item', 'total_penjualan', 'harga_modal',
      ]

      const period = periodFromContext(context) || new Date().toISOString().slice(0, 10)
      return saveCsv(`laporan_detail_item_${period}.csv`, buildCsv(headers, rows), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static exportLaporanPembayaranCSV(rows: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const body = (Array.isArray(rows) ? rows : []).map(item => [
        String(item.metode_pembayaran ?? item.jenis_pembayaran ?? '').toUpperCase(),
        asNumber(item.jumlah_transaksi),
        asNumber(item.penjualan_bersih),
        asNumber(item.pajak),
        asNumber(item.total_dibayar),
      ])
      const headers = ['metode_pembayaran', 'jumlah_transaksi', 'penjualan_bersih', 'pajak', 'total_dibayar']
      const period = periodFromContext(context) || new Date().toISOString().slice(0, 10)
      return saveCsv(`laporan_pembayaran_${period}.csv`, buildCsv(headers, body), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static exportLaporanProdukCSV(produk: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const rows = (Array.isArray(produk) ? produk : []).map(item => [
        item.kd_barang ?? '',
        item.nama_barang ?? '',
        asNumber(item.total_qty),
        asNumber(item.qty_retur),
        asNumber(item.net_qty ?? asNumber(item.total_qty)),
        asNumber(item.total_penjualan),
        asNumber(item.nilai_retur),
        asNumber(item.net_penjualan ?? asNumber(item.total_penjualan)),
      ])
      const headers = [
        'kode_barang', 'nama_barang', 'qty_terjual', 'qty_retur', 'qty_bersih',
        'omzet_kotor', 'nilai_retur', 'omzet_bersih',
      ]
      const period = periodFromContext(context) || new Date().toISOString().slice(0, 10)
      return saveCsv(`laporan_produk_terlaris_${period}.csv`, buildCsv(headers, rows), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static exportLaporanLabaRugiCSV(data: any, customPath?: string, context?: SalesExportContext) {
    try {
      const metrics: Array<[string, number, string]> = [
        ['total_transaksi', asNumber(data?.total_transaksi), 'Jumlah transaksi pada periode'],
        ['total_hpp', asNumber(data?.total_hpp ?? data?.total_modal), 'Harga pokok penjualan dari detail item'],
        ['total_diskon', asNumber(data?.total_diskon), 'Diskon invoice/promo'],
        ['total_retur', asNumber(data?.total_return), 'Retur APPROVED pada periode'],
        ['penjualan_bersih', asNumber(data?.total_penjualan), 'Penjualan setelah diskon, sebelum retur dan pajak'],
        ['penjualan_setelah_retur', asNumber(data?.penjualan_setelah_retur ?? data?.total_penjualan), 'Penjualan bersih setelah retur'],
        ['laba_kotor', asNumber(data?.laba_kotor), 'Penjualan bersih sebelum retur dikurangi HPP'],
        ['laba_setelah_retur', asNumber(data?.laba_setelah_retur ?? data?.laba_kotor), 'Penjualan setelah retur dikurangi HPP'],
        ['total_pengeluaran', asNumber(data?.total_pengeluaran), 'Pengeluaran kas tercatat pada periode'],
        ['laba_bersih_operasional', asNumber(data?.laba_bersih_operasional ?? data?.laba_setelah_retur), 'Laba setelah retur dikurangi pengeluaran kas tercatat'],
        ['margin_persen', asNumber(data?.margin_persen), 'Laba kotor / penjualan bersih'],
      ]
      const rows = metrics.map(([metrik, nilai, keterangan]) => [metrik, nilai, keterangan])
      const period = periodFromContext(context) || new Date().toISOString().slice(0, 10)
      return saveCsv(`laporan_laba_rugi_${period}.csv`, buildCsv(['metrik', 'nilai', 'keterangan'], rows), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static exportLaporanStokCSV(data: any[], customPath?: string) {
    try {
      const rows = (Array.isArray(data) ? data : []).map(item => {
        const stok = asNumber(item.stok)
        const minimum = asNumber(item.stok_minimum)
        return [
          item.kd_barang ?? '',
          item.nama_barang ?? '',
          stok,
          minimum,
          stok <= minimum ? 'MENIPIS' : 'AMAN',
        ]
      })
      const headers = ['kode_barang', 'nama_barang', 'stok', 'stok_minimum', 'status']
      const date = new Date().toISOString().slice(0, 10)
      return saveCsv(`laporan_stok_${date}.csv`, buildCsv(headers, rows), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static exportLaporanCustomerCSV(customers: any[], customPath?: string) {
    try {
      // Data kontak tidak diikutkan: tidak diperlukan untuk laporan kinerja
      // pelanggan dan mengurangi risiko penyebaran data pribadi.
      const rows = (Array.isArray(customers) ? customers : []).map(item => [
        item.kd_customer ?? '',
        item.nama_customer ?? '',
        asNumber(item.poin),
        asNumber(item.total_belanja),
        item.status ?? '',
        item.tgl_daftar ?? '',
      ])
      const headers = [
        'kode_customer', 'nama_customer', 'poin', 'total_belanja', 'status', 'tanggal_daftar',
      ]
      const date = new Date().toISOString().slice(0, 10)
      return saveCsv(`laporan_customer_${date}.csv`, buildCsv(headers, rows), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  // Generic CSV export untuk data tabular lain (arus kas, pajak, dsb).
  static exportToCSV(data: any[], filename: string, customPath?: string) {
    try {
      const rows = Array.isArray(data) ? data : []
      const keys = rows.length > 0
        ? (Array.isArray(rows[0])
          ? rows[0].map((_: unknown, index: number) => `kolom_${index + 1}`)
          : Object.keys(rows[0]))
        : ['keterangan']
      const body = rows.map(item => Array.isArray(item) ? item : keys.map(key => item[key]))
      const safeName = String(filename || 'export').replace(/[^\w-]+/g, '_')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      return saveCsv(`${safeName}_${timestamp}.csv`, buildCsv(keys, body), customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  // ==========================================
  // LAPORAN PRODUK TERLARIS
  // ==========================================

  static async exportLaporanProdukExcel(produk: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const period = salesPeriodLabel([], context)
      const totalQty = produk.reduce((sum, item) => sum + asNumber(item.net_qty ?? item.total_qty), 0)
      const totalOmzet = produk.reduce((sum, item) => sum + asNumber(item.net_penjualan ?? item.total_penjualan), 0)
      const totalRetur = produk.reduce((sum, item) => sum + asNumber(item.nilai_retur), 0)
      const unallocatedRetur = Math.max(0, asNumber(context?.summary?.total_retur) - totalRetur)

      const headers = [
        'NO', 'KODE PRODUK', 'NAMA PRODUK', 'QTY TERJUAL', 'QTY RETUR', 'QTY BERSIH',
        'OMZET KOTOR', 'NILAI RETUR', 'OMZET BERSIH',
      ]
      const rows = produk.map((item, index) => [
        index + 1,
        item.kd_barang ?? '',
        item.nama_barang ?? '-',
        asNumber(item.total_qty),
        asNumber(item.qty_retur),
        asNumber(item.net_qty ?? item.total_qty),
        asNumber(item.total_penjualan),
        asNumber(item.nilai_retur),
        asNumber(item.net_penjualan ?? item.total_penjualan),
      ])

      return this.writeReportExcel({
        filenamePrefix: 'laporan_produk_terlaris',
        sheetName: 'Produk Terlaris',
        title: 'LAPORAN PRODUK TERLARIS',
        subtitle: period,
        metrics: [
          { label: 'JUMLAH PRODUK', value: produk.length, numFmt: '#,##0' },
          { label: 'QTY BERSIH TERJUAL', value: totalQty, numFmt: '#,##0' },
          { label: 'OMZET BERSIH', value: totalOmzet, numFmt: '"Rp" #,##0' },
          { label: 'NILAI RETUR', value: totalRetur, numFmt: '"Rp" #,##0' },
          { label: 'RETUR TANPA DETAIL ITEM', value: unallocatedRetur, numFmt: '"Rp" #,##0' },
        ],
        headers,
        rows,
        numFmts: { 4: '#,##0', 5: '#,##0', 6: '#,##0', 7: '"Rp" #,##0', 8: '"Rp" #,##0', 9: '"Rp" #,##0' },
        sumColumns: [4, 5, 6, 7, 8, 9],
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static exportLaporanProdukPDF(produk: any[], customPath?: string, context?: SalesExportContext) {
    try {
      const period = salesPeriodLabel([], context)
      const totalQty = produk.reduce((sum, item) => sum + asNumber(item.net_qty ?? item.total_qty), 0)
      const totalOmzet = produk.reduce((sum, item) => sum + asNumber(item.net_penjualan ?? item.total_penjualan), 0)
      const totalRetur = produk.reduce((sum, item) => sum + asNumber(item.nilai_retur), 0)
      const unallocatedRetur = Math.max(0, asNumber(context?.summary?.total_retur) - totalRetur)

      const headers = ['No', 'Kode', 'Nama Produk', 'Qty Terjual', 'Qty Retur', 'Qty Bersih', 'Omzet Kotor', 'Nilai Retur', 'Omzet Bersih']
      const rows = produk.map((item, index) => [
        index + 1,
        item.kd_barang ?? '-',
        item.nama_barang ?? '-',
        asNumber(item.total_qty).toLocaleString('id-ID'),
        asNumber(item.qty_retur).toLocaleString('id-ID'),
        asNumber(item.net_qty ?? item.total_qty).toLocaleString('id-ID'),
        formatIdr(item.total_penjualan),
        formatIdr(item.nilai_retur),
        formatIdr(item.net_penjualan ?? item.total_penjualan),
      ])

      return this.writeReportPDF({
        filenamePrefix: 'laporan_produk_terlaris',
        title: 'LAPORAN PRODUK TERLARIS',
        subtitle: period,
        metrics: [
          { label: 'JUMLAH PRODUK', value: produk.length.toLocaleString('id-ID') },
          { label: 'QTY BERSIH', value: totalQty.toLocaleString('id-ID') },
          { label: 'NILAI RETUR', value: formatIdr(totalRetur) },
          { label: 'OMZET BERSIH', value: formatIdr(totalOmzet) },
          { label: 'RETUR TANPA DETAIL ITEM', value: formatIdr(unallocatedRetur) },
        ],
        headers,
        rows,
        orientation: 'landscape',
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'left' },
          2: { halign: 'left' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right', fontStyle: 'bold' },
        },
        foot: [[
          '', '', 'TOTAL',
          produk.reduce((sum, item) => sum + asNumber(item.total_qty), 0).toLocaleString('id-ID'),
          produk.reduce((sum, item) => sum + asNumber(item.qty_retur), 0).toLocaleString('id-ID'),
          totalQty.toLocaleString('id-ID'),
          formatIdr(produk.reduce((sum, item) => sum + asNumber(item.total_penjualan), 0)),
          formatIdr(totalRetur),
          formatIdr(totalOmzet),
        ]],
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ==========================================
  // LAPORAN LABA RUGI
  // ==========================================

  static async exportLaporanLabaRugiExcel(data: any, customPath?: string, context?: SalesExportContext) {
    try {
      const period = salesPeriodLabel([], context)
      const rows = [
        ['Pendapatan penjualan (setelah diskon)', asNumber(data?.total_penjualan)],
        ['Retur penjualan (APPROVED)', -asNumber(data?.total_return)],
        ['Penjualan bersih setelah retur', asNumber(data?.penjualan_setelah_retur ?? data?.total_penjualan)],
        ['Harga pokok penjualan (HPP)', -asNumber(data?.total_hpp ?? data?.total_modal)],
        ['Laba kotor', asNumber(data?.laba_kotor)],
        ['Laba setelah retur', asNumber(data?.laba_setelah_retur ?? data?.laba_kotor)],
        ['Pengeluaran kas tercatat', -asNumber(data?.total_pengeluaran)],
        ['Laba bersih operasional', asNumber(data?.laba_bersih_operasional ?? data?.laba_setelah_retur)],
        ['Margin laba (%)', asNumber(data?.margin_persen) / 100],
      ]

      return this.writeReportExcel({
        filenamePrefix: 'laporan_laba_rugi',
        sheetName: 'Laba Rugi',
        title: 'LAPORAN LABA RUGI',
        subtitle: period,
        metrics: [
          { label: 'TOTAL TRANSAKSI', value: asNumber(data?.total_transaksi), numFmt: '#,##0' },
          { label: 'TOTAL DISKON', value: asNumber(data?.total_diskon), numFmt: '"Rp" #,##0' },
          { label: 'TOTAL RETUR', value: asNumber(data?.total_return), numFmt: '"Rp" #,##0' },
          { label: 'MARGIN LABA', value: asNumber(data?.margin_persen) / 100, numFmt: '0.00%' },
        ],
        headers: ['KOMPONEN', 'NILAI', 'KETERANGAN'],
        rows: rows.map(([label, value], index) => [
          label,
          index === rows.length - 1 ? asNumber(value) : asNumber(value),
          index === 8 ? 'Persentase laba kotor terhadap penjualan setelah diskon' : '',
        ]),
        numFmts: { 2: '"Rp" #,##0' },
        rowNumFmts: { 9: '0.00%' },
        sumColumns: [],
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static exportLaporanLabaRugiPDF(data: any, customPath?: string, context?: SalesExportContext) {
    try {
      const period = salesPeriodLabel([], context)
      const rows = [
        ['Pendapatan penjualan (setelah diskon)', formatIdr(data?.total_penjualan), 'Omzet kotor - diskon invoice'],
        ['Retur penjualan (APPROVED)', `-${formatIdr(data?.total_return)}`, 'Retur pada periode laporan'],
        ['Penjualan bersih setelah retur', formatIdr(data?.penjualan_setelah_retur ?? data?.total_penjualan), ''],
        ['Harga pokok penjualan (HPP)', `-${formatIdr(data?.total_hpp ?? data?.total_modal)}`, 'Dari harga modal detail item'],
        ['Laba kotor', formatIdr(data?.laba_kotor), 'Pendapatan setelah diskon - HPP'],
        ['Laba setelah retur', formatIdr(data?.laba_setelah_retur ?? data?.laba_kotor), 'HPP barang retur belum tersedia'],
        ['Pengeluaran kas tercatat', `-${formatIdr(data?.total_pengeluaran)}`, 'Dari kas keluar pada periode'],
        ['Laba bersih operasional', formatIdr(data?.laba_bersih_operasional ?? data?.laba_setelah_retur), 'Laba setelah retur - pengeluaran kas'],
        ['Margin laba', `${asNumber(data?.margin_persen).toFixed(2)}%`, 'Laba kotor / pendapatan setelah diskon'],
      ]

      return this.writeReportPDF({
        filenamePrefix: 'laporan_laba_rugi',
        title: 'LAPORAN LABA RUGI',
        subtitle: period,
        metrics: [
          { label: 'TOTAL TRANSAKSI', value: asNumber(data?.total_transaksi).toLocaleString('id-ID') },
          { label: 'TOTAL DISKON', value: formatIdr(data?.total_diskon) },
          { label: 'TOTAL RETUR', value: formatIdr(data?.total_return) },
          { label: 'LABA KOTOR', value: formatIdr(data?.laba_kotor) },
        ],
        headers: ['Komponen', 'Nilai', 'Keterangan'],
        rows,
        orientation: 'portrait',
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'left', textColor: [100, 116, 139] },
        },
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ==========================================
  // LAPORAN CUSTOMER
  // ==========================================

  static async exportLaporanCustomerExcel(customers: any[], customPath?: string) {
    try {
      const date = new Date().toISOString().slice(0, 10)
      const totalBelanja = customers.reduce((sum, item) => sum + asNumber(item.total_belanja), 0)
      const totalPoin = customers.reduce((sum, item) => sum + asNumber(item.poin), 0)
      const aktif = customers.filter(item => String(item.status ?? '').toLowerCase() === 'aktif').length

      return this.writeReportExcel({
        filenamePrefix: 'laporan_customer',
        sheetName: 'Customer',
        title: 'LAPORAN CUSTOMER',
        subtitle: `Per ${formatLongDate(date)}`,
        metrics: [
          { label: 'TOTAL CUSTOMER', value: customers.length, numFmt: '#,##0' },
          { label: 'CUSTOMER AKTIF', value: aktif, numFmt: '#,##0' },
          { label: 'TOTAL POIN', value: totalPoin, numFmt: '#,##0' },
          { label: 'TOTAL BELANJA', value: totalBelanja, numFmt: '"Rp" #,##0' },
        ],
        headers: ['NO', 'KODE CUSTOMER', 'NAMA CUSTOMER', 'POIN', 'TOTAL BELANJA', 'STATUS'],
        rows: customers.map((item, index) => [
          index + 1,
          item.kd_customer ?? '',
          item.nama_customer ?? '',
          asNumber(item.poin),
          asNumber(item.total_belanja),
          item.status ?? '',
        ]),
        numFmts: { 4: '#,##0', 5: '"Rp" #,##0' },
        sumColumns: [4, 5],
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static exportLaporanCustomerPDF(customers: any[], customPath?: string) {
    try {
      const date = new Date().toISOString().slice(0, 10)
      const totalBelanja = customers.reduce((sum, item) => sum + asNumber(item.total_belanja), 0)
      const totalPoin = customers.reduce((sum, item) => sum + asNumber(item.poin), 0)
      const aktif = customers.filter(item => String(item.status ?? '').toLowerCase() === 'aktif').length

      return this.writeReportPDF({
        filenamePrefix: 'laporan_customer',
        title: 'LAPORAN CUSTOMER',
        subtitle: `Per ${formatLongDate(date)}`,
        metrics: [
          { label: 'TOTAL CUSTOMER', value: customers.length.toLocaleString('id-ID') },
          { label: 'CUSTOMER AKTIF', value: aktif.toLocaleString('id-ID') },
          { label: 'TOTAL POIN', value: totalPoin.toLocaleString('id-ID') },
          { label: 'TOTAL BELANJA', value: formatIdr(totalBelanja) },
        ],
        headers: ['No', 'Kode', 'Nama Customer', 'Poin', 'Total Belanja', 'Status'],
        rows: customers.map((item, index) => [
          index + 1,
          item.kd_customer ?? '-',
          item.nama_customer ?? '-',
          asNumber(item.poin).toLocaleString('id-ID'),
          formatIdr(item.total_belanja),
          item.status ?? '-',
        ]),
        orientation: 'portrait',
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'left' },
          2: { halign: 'left' },
          3: { halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'center' },
        },
        customPath,
      })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ==========================================
  // SHARED REPORT BUILDERS (PDF & XLSX)
  // ==========================================

  private static writeReportPDF(opts: {
    filenamePrefix: string
    title: string
    subtitle: string
    metrics: Array<{ label: string; value: string }>
    headers: string[]
    rows: any[][]
    orientation?: 'portrait' | 'landscape'
    columnStyles?: Record<number, any>
    foot?: any[][]
    customPath?: string
  }) {
    try {
      const storeInfo = IdentitasModel.get()
      const user = demoSession.getUsername() || 'Administrator'
      const printedAt = new Date().toLocaleString('id-ID')
      const doc = new jsPDF({ orientation: opts.orientation ?? 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const storeName = storeInfo?.namatoko || 'WariPOS'
      const storeAddress = storeInfo?.alamattoko || '-'
      const storePhone = storeInfo?.nomortelptoko || '-'
      const storeEmail = storeInfo?.alamatemailowner || '-'

      const drawHeader = (d: any) => {
        d.setFillColor(219, 39, 119)
        d.rect(0, 0, pageWidth, 3, 'F')
        d.setFont('helvetica', 'bold')
        d.setFontSize(12)
        d.setTextColor(51, 65, 85)
        d.text(storeName, 15, 13)
        d.setFont('helvetica', 'normal')
        d.setFontSize(8)
        d.setTextColor(100, 116, 139)
        d.text(storeAddress, 15, 17)
        d.text(`Telp: ${storePhone}   |   Email: ${storeEmail}`, 15, 21)

        d.setFont('helvetica', 'bold')
        d.setFontSize(13)
        d.setTextColor(219, 39, 119)
        d.text(opts.title, pageWidth - 15, 13, { align: 'right' })
        d.setFont('helvetica', 'normal')
        d.setFontSize(8)
        d.setTextColor(100, 116, 139)
        d.text(`Periode: ${opts.subtitle}`, pageWidth - 15, 17, { align: 'right' })
        d.text(`Dicetak: ${printedAt}   |   Oleh: ${user}`, pageWidth - 15, 21, { align: 'right' })

        d.setDrawColor(226, 232, 240)
        d.setLineWidth(0.3)
        d.line(15, 25, pageWidth - 15, 25)
      }

      drawHeader(doc)

      // KPI cards
      const perRow = 3
      const gap = 4
      const cardW = (pageWidth - 30 - gap * (perRow - 1)) / perRow
      const cardH = 13
      opts.metrics.forEach((metric, index) => {
        const row = Math.floor(index / perRow)
        const col = index % perRow
        const x = 15 + col * (cardW + gap)
        const y = 31 + row * (cardH + 3)
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'F')
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.2)
        doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'S')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(100, 116, 139)
        doc.text(metric.label, x + 3, y + 4.5)
        doc.setFontSize(9.5)
        doc.setTextColor(219, 39, 119)
        doc.text(metric.value, x + 3, y + 10.2)
      })

      const metricRows = Math.ceil(opts.metrics.length / perRow)
      const startY = 31 + metricRows * (cardH + 3) + 6

      autoTable(doc, {
        head: [opts.headers],
        body: opts.rows.length ? opts.rows : [[{
          content: 'Tidak ada data pada periode ini',
          colSpan: opts.headers.length,
          styles: { halign: 'center', fontStyle: 'italic', textColor: [148, 163, 184] },
        }]],
        foot: opts.foot,
        startY,
        showHead: 'everyPage',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.1, overflow: 'linebreak' },
        headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        footStyles: { fillColor: [252, 231, 243], textColor: [51, 65, 85], fontStyle: 'bold' },
        columnStyles: opts.columnStyles,
        margin: { left: 15, right: 15, top: 30, bottom: 20 },
      })

      const finalY = (doc as any).lastAutoTable?.finalY || 100
      let sigY = finalY + 15
      if (sigY > pageHeight - 42) {
        doc.addPage()
        sigY = 40
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(51, 65, 85)
      doc.text('Dibuat Oleh,', 15 + (pageWidth - 30) / 4, sigY, { align: 'center' })
      doc.text('Disetujui Oleh,', 15 + (pageWidth - 30) * 3 / 4, sigY, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.text(demoSession.getUsername() || 'Administrator', 15 + (pageWidth - 30) / 4, sigY + 18, { align: 'center' })
      doc.text('( ___________________ )', 15 + (pageWidth - 30) * 3 / 4, sigY + 18, { align: 'center' })

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        drawHeader(doc)
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.3)
        doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(148, 163, 184)
        doc.text(`WariPOS - ${opts.title}`, 15, pageHeight - 10)
        doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 15, pageHeight - 10, { align: 'right' })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filepath = exportPath(`${opts.filenamePrefix}_${timestamp}.pdf`, opts.customPath)
      fs.writeFileSync(filepath, Buffer.from(doc.output('arraybuffer')))
      return { success: true, message: 'Export PDF berhasil disimpan', data: { filepath, filename: path.basename(filepath) } }
    } catch (error) {
      return { success: false, message: 'Gagal export PDF: ' + (error as Error).message }
    }
  }

  private static async writeReportExcel(opts: {
    filenamePrefix: string
    sheetName: string
    title: string
    subtitle: string
    metrics: Array<{ label: string; value: string | number; numFmt?: string }>
    headers: string[]
    rows: any[][]
    numFmts?: Record<number, string>
    rowNumFmts?: Record<number, string>
    sumColumns?: number[]
    customPath?: string
  }) {
    try {
      const storeInfo = IdentitasModel.get()
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'WariPOS'
      workbook.created = new Date()

      const lastCol = columnLetter(opts.headers.length)
      const sheet = workbook.addWorksheet(opts.sheetName.slice(0, 31), {
        views: [{ state: 'frozen', ySplit: 0, showGridLines: false }],
        properties: { tabColor: { argb: BRAND.primary } },
      })
      sheet.columns = opts.headers.map((header, index) => ({ width: Math.min(Math.max(header.length + 6, 14), 40) }))

      // Branded header
      sheet.mergeCells(`A1:${lastCol}1`)
      const titleCell = sheet.getCell('A1')
      titleCell.value = (storeInfo?.namatoko || 'WariPOS').toUpperCase()
      titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(titleCell, BRAND.primaryDark)
      sheet.getRow(1).height = 28

      sheet.mergeCells(`A2:${lastCol}2`)
      const infoCell = sheet.getCell('A2')
      infoCell.value = `${storeInfo?.alamattoko || '-'} | Telp: ${storeInfo?.nomortelptoko || '-'} | Email: ${storeInfo?.alamatemailowner || '-'}`
      infoCell.font = { size: 9, color: { argb: 'FFFFFFFF' }, italic: true }
      infoCell.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(infoCell, BRAND.primary)

      sheet.mergeCells(`A3:${lastCol}3`)
      const subtitleCell = sheet.getCell('A3')
      subtitleCell.value = `${opts.title}  |  Periode: ${opts.subtitle}  |  Dicetak: ${new Date().toLocaleString('id-ID')}`
      subtitleCell.font = { bold: true, size: 10, color: { argb: BRAND.slateText } }
      subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(subtitleCell, 'FFF1F5F9')
      sheet.getRow(3).height = 22

      // Ringkasan
      sheet.mergeCells(`A5:${lastCol}5`)
      const summaryHeader = sheet.getCell('A5')
      summaryHeader.value = 'RINGKASAN'
      summaryHeader.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(summaryHeader, BRAND.slateText)

      opts.metrics.forEach((metric, index) => {
        const rowNo = 6 + index
        sheet.getCell(rowNo, 1).value = metric.label
        sheet.getCell(rowNo, 2).value = metric.value
        if (metric.numFmt) sheet.getCell(rowNo, 2).numFmt = metric.numFmt
        sheet.getCell(rowNo, 1).font = { size: 9, color: { argb: BRAND.slateMuted } }
        sheet.getCell(rowNo, 2).font = { size: 10, bold: true, color: { argb: BRAND.slateText } }
        sheet.getCell(rowNo, 2).alignment = { horizontal: 'right' }
      })

      const headerRowNo = 6 + opts.metrics.length + 1
      const headerRow = sheet.getRow(headerRowNo)
      headerRow.values = opts.headers
      styleHeaderRow(headerRow, BRAND.primary)
      sheet.views = [{ state: 'frozen', ySplit: headerRowNo, showGridLines: false }]

      opts.rows.forEach((values, index) => {
        const row = sheet.addRow(values)
        row.eachCell((cell, col) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          const fmt = opts.numFmts?.[col]
          if (fmt) cell.numFmt = fmt
          const rowFmt = opts.rowNumFmts?.[index + 1]
          if (rowFmt && col === 2) cell.numFmt = rowFmt
        })
        if (index % 2 === 1) row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
      })

      const firstRow = headerRowNo + 1
      const lastRow = headerRowNo + opts.rows.length
      if (opts.rows.length > 0) {
        sheet.autoFilter = { from: `A${headerRowNo}`, to: `${lastCol}${lastRow}` }
      }

      if (opts.sumColumns?.length) {
        const totalValues: any[] = new Array(opts.headers.length).fill('')
        totalValues[0] = 'TOTAL'
        if (opts.headers.length > 2) totalValues[1] = ''
        opts.sumColumns.forEach(col => {
          totalValues[col - 1] = opts.rows.length
            ? { formula: `SUM(${columnLetter(col)}${firstRow}:${columnLetter(col)}${lastRow})` }
            : 0
        })
        const totalRow = sheet.addRow(totalValues)
        totalRow.eachCell((cell, col) => {
          cell.font = { bold: true, color: { argb: BRAND.slateText } }
          fillCell(cell, BRAND.pinkSoft)
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          const fmt = opts.numFmts?.[col]
          if (fmt) cell.numFmt = fmt
        })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filepath = exportPath(`${opts.filenamePrefix}_${timestamp}.xlsx`, opts.customPath)
      await workbook.xlsx.writeFile(filepath)
      return { success: true, message: 'Export Excel berhasil disimpan', data: { filepath, filename: path.basename(filepath) } }
    } catch (error) {
      return { success: false, message: 'Gagal export Excel: ' + (error as Error).message }
    }
  }
}
