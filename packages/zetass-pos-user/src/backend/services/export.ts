import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { jsPDF } = require('jspdf')
const autoTable = require('jspdf-autotable').default
import ExcelJS from 'exceljs'
import { IdentitasModel } from '../models/IdentitasModel.js'
import { demoSession } from './demoSessionManager.js'
import { LaporanController } from '../controllers/LaporanController.js'


interface SalesExportContext {
  startDate?: string
  endDate?: string
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

function asNumber(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
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
    const total = asNumber(item.yang_dibayar)
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
  const totalSales = data.reduce((sum, item) => sum + asNumber(item.yang_dibayar), 0)
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
  if (customPath) return customPath
  const exportDir = path.join(process.cwd(), 'exports')
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true })
  return path.join(exportDir, defaultName)
}

function getChartBuffer(config: any): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const url = `https://quickchart.io/chart?w=600&h=350&bkg=white&c=${encodeURIComponent(JSON.stringify(config))}`
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        resolve(null)
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', (err) => {
      console.error('QuickChart download error:', err)
      resolve(null)
    })
    req.setTimeout(3500, () => {
      console.warn('QuickChart request timed out')
      req.destroy()
      resolve(null)
    })
  })
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

export class ExportService {
  // Export to Excel
  static async exportToExcel(data: any[], filename: string, sheetName: string = 'Data', customPath?: string) {
    try {
      const rows = Array.isArray(data) ? data : []
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Zetass Pos'
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

      // Header background
      doc.setFillColor(79, 70, 229) // Indigo
      doc.rect(0, 0, pageWidth, 35, 'F')

      // Logo/Icon placeholder
      doc.setFillColor(255, 255, 255)
      doc.circle(20, 17, 8, 'F')
      doc.setFontSize(12)
      doc.setTextColor(79, 70, 229)
      doc.text('⚡', 17, 20)

      // Title
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(title, 35, 15)

      // Subtitle
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Zetass Pos', 35, 21)

      // Date & Time
      doc.setFontSize(9)
      const now = new Date()
      doc.text(`Tanggal: ${now.toLocaleDateString('id-ID')}`, 35, 27)
      doc.text(`Waktu: ${now.toLocaleTimeString('id-ID')}`, 35, 31)

      // Reset text color
      doc.setTextColor(0, 0, 0)

      // Add table
      autoTable(doc, {
        head: [headers],
        body: data,
        startY: 40,
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
          fillColor: [248, 250, 252]
        },
        margin: { left: 14, right: 14 },
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 40
      if (pageHeight - finalY > 20) {
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text('Zetass Pos Developer', 14, pageHeight - 10)
        doc.text(`Halaman 1`, pageWidth - 14, pageHeight - 10, { align: 'right' })
        
        // Decorative line
        doc.setDrawColor(79, 70, 229)
        doc.setLineWidth(0.5)
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)
      }

      let filepath: string
      if (customPath) {
        filepath = customPath
      } else {
        const exportDir = path.join(process.cwd(), 'exports')
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true })
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fullFilename = `${filename}_${timestamp}.pdf`
        filepath = path.join(exportDir, fullFilename)
      }

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
      
      // Calculate laba rugi
      let labaKotor = 0
      if (startDateStr && endDateStr) {
        try {
          const lr = LaporanController.getLaporanLabaRugi(startDateStr, endDateStr)
          if (lr.success && lr.data) {
            labaKotor = lr.data.laba_kotor
          }
        } catch (err) {
          console.error('Gagal mengambil laba kotor:', err)
        }
      }
      
      // Calculate general summary
      const totalTransactions = data.length
      const totalRevenue = data.reduce((sum, item) => sum + asNumber(item.yang_dibayar), 0)
      const totalDiscounts = data.reduce((sum, item) => sum + asNumber(item.discount_amount), 0)
      const totalTaxes = data.reduce((sum, item) => sum + asNumber(item.pajak), 0)
      const totalQty = data.reduce((sum, item) => sum + asNumber(item.total_qty), 0)
      const avgTransaction = totalTransactions ? totalRevenue / totalTransactions : 0
      
      // Aggregate: Kasir Terbaik
      const cashierMap = new Map<string, { username: string, count: number, total: number }>()
      for (const item of data) {
        const cash = item.username_transaksi || 'Kasir'
        const existing = cashierMap.get(cash) ?? { username: cash, count: 0, total: 0 }
        existing.count += 1
        existing.total += asNumber(item.yang_dibayar)
        cashierMap.set(cash, existing)
      }
      const kasirTerbaik = Array.from(cashierMap.values()).sort((a, b) => b.total - a.total)
      
      // Aggregate: Metode Pembayaran
      const payMap = new Map<string, { method: string, count: number, total: number }>()
      for (const item of data) {
        const pay = String(item.jenis_pembayaran || 'TUNAI').toUpperCase()
        const existing = payMap.get(pay) ?? { method: pay, count: 0, total: 0 }
        existing.count += 1
        existing.total += asNumber(item.yang_dibayar)
        payMap.set(pay, existing)
      }
      const metodePembayaran = Array.from(payMap.values()).sort((a, b) => b.total - a.total)
      const topPaymentMethod = metodePembayaran[0]?.method || '-'
      
      // Retrieve Best Selling Products
      let produkTerlaris: any[] = []
      if (startDateStr && endDateStr) {
        try {
          const pr = LaporanController.getLaporanProdukTerlaris(startDateStr, endDateStr, 100)
          if (pr.success && pr.data) {
            produkTerlaris = pr.data
          }
        } catch (err) {
          console.error('Gagal mengambil produk terlaris:', err)
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
      const applyKpiCard = (sheet: ExcelJS.Worksheet, r: number, c: number, lbl: string, val: string | number, color: string) => {
        sheet.mergeCells(r, c, r, c + 1)
        sheet.mergeCells(r + 1, c, r + 1, c + 1)
        
        const cellLbl = sheet.getCell(r, c)
        const cellVal = sheet.getCell(r + 1, c)
        
        cellLbl.value = lbl
        cellVal.value = val
        
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
      
      // KPIs Row 1
      applyKpiCard(ringkasanSheet, 7, 1, 'TOTAL TRANSAKSI', totalTransactions.toLocaleString('id-ID'), BRAND.blue)
      applyKpiCard(ringkasanSheet, 7, 3, 'TOTAL PENDAPATAN', formatIdr(totalRevenue), BRAND.green)
      applyKpiCard(ringkasanSheet, 7, 5, 'TOTAL KEUNTUNGAN', formatIdr(labaKotor), BRAND.primary)
      applyKpiCard(ringkasanSheet, 7, 7, 'PRODUK TERJUAL', totalQty.toLocaleString('id-ID'), BRAND.amber)
      ringkasanSheet.getRow(7).height = 18
      ringkasanSheet.getRow(8).height = 26
      
      // KPIs Row 2
      applyKpiCard(ringkasanSheet, 10, 1, 'TOTAL DISKON', formatIdr(totalDiscounts), BRAND.red)
      applyKpiCard(ringkasanSheet, 10, 3, 'TOTAL PAJAK', formatIdr(totalTaxes), BRAND.amber)
      applyKpiCard(ringkasanSheet, 10, 5, 'RATA-RATA / TRANSAKSI', formatIdr(avgTransaction), BRAND.blue)
      applyKpiCard(ringkasanSheet, 10, 7, 'METODE TERBANYAK', topPaymentMethod, BRAND.green)
      ringkasanSheet.getRow(10).height = 18
      ringkasanSheet.getRow(11).height = 26
      
      // Otorisasi / Signatures area
      ringkasanSheet.mergeCells('A13:H13')
      const secHeader2 = ringkasanSheet.getCell('A13')
      secHeader2.value = 'LEMBAR PENGESAHAN LAPORAN'
      secHeader2.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      secHeader2.alignment = { vertical: 'middle', horizontal: 'center' }
      fillCell(secHeader2, BRAND.slateText)
      ringkasanSheet.getRow(13).height = 24
      
      const sigR = 15
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
        'TOTAL OMZET',
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
          totalRevenue ? asNumber(row.total) / totalRevenue : 0,
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
      
      const cTotalRow = chartSheet.addRow([
        '',
        'TOTAL',
        analytics.daily.reduce((sum, item) => sum + asNumber(item.transaksi), 0),
        analytics.daily.reduce((sum, item) => sum + asNumber(item.qty), 0),
        totalRevenue,
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
      const detailSheet = workbook.addWorksheet('Detail Penjualan', {
        views: [{ state: 'frozen', ySplit: 5 }]
      })
      applyCompanyHeader(detailSheet, 'LAPORAN RAGAM TRANSAKSI PENJUALAN', 'L')
      
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
        'METODE PEMBAYARAN',
        'STATUS'
      ]
      
      const dHeaderRow = detailSheet.getRow(5)
      dHeaderRow.values = detailHeaders
      styleHeaderRow(dHeaderRow, BRAND.primary)
      
      data.forEach((item, index) => {
        const row = detailSheet.addRow([
          index + 1,
          item.kd_tansaksi_jual,
          formatDateTime(item.tgl_wkt_transaksi),
          item.username_transaksi || '-',
          item.nama_customer || 'Umum',
          asNumber(item.total_qty),
          asNumber(item.sub_total),
          asNumber(item.discount_amount),
          asNumber(item.pajak),
          asNumber(item.yang_dibayar),
          item.jenis_pembayaran || '-',
          'Selesai'
        ])
        
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 6 || colNum === 11 || colNum === 12) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 6) {
            cell.numFmt = '#,##0'
          } else if (colNum === 7 || colNum === 8 || colNum === 9 || colNum === 10) {
            cell.numFmt = '"Rp" #,##0'
          }
        })
        
        if (index % 2 === 1) {
          row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
        }
      })
      
      const totalRow = detailSheet.addRow([
        '',
        '',
        '',
        'TOTAL KESELURUHAN',
        '',
        totalQty,
        data.reduce((sum, item) => sum + asNumber(item.sub_total), 0),
        totalDiscounts,
        totalTaxes,
        totalRevenue,
        '',
        ''
      ])
      
      totalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        
        if (colNum === 6) {
          cell.numFmt = '#,##0'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum === 7 || colNum === 8 || colNum === 9 || colNum === 10) {
          cell.numFmt = '"Rp" #,##0'
        }
      })
      autofitColumnWidths(detailSheet, 10, 32)
      
      // ==========================================
      // SHEET 3: PRODUK TERLARIS
      // ==========================================
      const produkSheet = workbook.addWorksheet('Produk Terlaris', {
        views: [{ state: 'frozen', ySplit: 5 }]
      })
      applyCompanyHeader(produkSheet, 'LAPORAN PENJUALAN PRODUK TERLARIS', 'F')
      
      const produkHeaders = ['NO', 'KODE PRODUK', 'NAMA PRODUK', 'QTY TERJUAL', 'TOTAL PENDAPATAN', 'KONTRIBUSI (%)']
      const pHeaderRow = produkSheet.getRow(5)
      pHeaderRow.values = produkHeaders
      styleHeaderRow(pHeaderRow, BRAND.primary)
      
      produkTerlaris.forEach((item, index) => {
        const row = produkSheet.addRow([
          index + 1,
          item.kd_barang,
          item.nama_barang || '-',
          asNumber(item.total_qty),
          asNumber(item.total_penjualan),
          totalRevenue ? asNumber(item.total_penjualan) / totalRevenue : 0
        ])
        
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 2 || colNum === 4 || colNum === 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 4) {
            cell.numFmt = '#,##0'
          } else if (colNum === 5) {
            cell.numFmt = '"Rp" #,##0'
          } else if (colNum === 6) {
            cell.numFmt = '0.0%'
          }
        })
        
        if (index % 2 === 1) {
          row.eachCell(cell => fillCell(cell, BRAND.slateSoft))
        }
      })
      
      const pTotalRow = produkSheet.addRow([
        '',
        '',
        'TOTAL',
        produkTerlaris.reduce((sum, item) => sum + asNumber(item.total_qty), 0),
        produkTerlaris.reduce((sum, item) => sum + asNumber(item.total_penjualan), 0),
        1.0
      ])
      
      pTotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        if (colNum === 4 || colNum === 6) {
          cell.numFmt = colNum === 4 ? '#,##0' : '0.0%'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum === 5) {
          cell.numFmt = '"Rp" #,##0'
        }
      })
      
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
      applyCompanyHeader(kasirSheet, 'LAPORAN KASIR TERJEMPOL', 'E')
      
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
      
      autofitColumnWidths(kasirSheet, 10, 32)
      
      // ==========================================
      // SHEET 5: METODE PEMBAYARAN
      // ==========================================
      const metodeSheet = workbook.addWorksheet('Metode Pembayaran', {
        views: [{ state: 'frozen', ySplit: 5 }]
      })
      applyCompanyHeader(metodeSheet, 'KONTRIBUSI METODE PEMBAYARAN', 'E')
      
      const metodeHeaders = ['NO', 'METODE PEMBAYARAN', 'JUMLAH TRANSAKSI', 'TOTAL NOMINAL', 'PERSENTASE KONTRIBUSI']
      const mHeaderRow = metodeSheet.getRow(5)
      mHeaderRow.values = metodeHeaders
      styleHeaderRow(mHeaderRow, BRAND.primary)
      
      metodePembayaran.forEach((item, index) => {
        const row = metodeSheet.addRow([
          index + 1,
          item.method,
          asNumber(item.count),
          asNumber(item.total),
          totalRevenue ? asNumber(item.total) / totalRevenue : 0
        ])
        
        row.eachCell((cell, colNum) => {
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
          if (colNum === 1 || colNum === 3 || colNum === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
          if (colNum === 3) {
            cell.numFmt = '#,##0'
          } else if (colNum === 4) {
            cell.numFmt = '"Rp" #,##0'
          } else if (colNum === 5) {
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
        metodePembayaran.reduce((sum, item) => sum + asNumber(item.total), 0),
        1.0
      ])
      
      mTotalRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: BRAND.slateText } }
        fillCell(cell, BRAND.pinkSoft)
        cell.border = thinBorder()
        cell.alignment = { vertical: 'middle' }
        if (colNum === 3 || colNum === 5) {
          cell.numFmt = colNum === 3 ? '#,##0' : '0.0%'
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (colNum === 4) {
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
      
      // Calculate laba rugi
      let labaKotor = 0
      if (startDateStr && endDateStr) {
        try {
          const lr = LaporanController.getLaporanLabaRugi(startDateStr, endDateStr)
          if (lr.success && lr.data) {
            labaKotor = lr.data.laba_kotor
          }
        } catch (err) {
          console.error(err)
        }
      }
      
      const totalTransactions = data.length
      const totalRevenue = data.reduce((sum, item) => sum + asNumber(item.yang_dibayar), 0)
      const totalDiscounts = data.reduce((sum, item) => sum + asNumber(item.discount_amount), 0)
      const totalTaxes = data.reduce((sum, item) => sum + asNumber(item.pajak), 0)
      const totalQty = data.reduce((sum, item) => sum + asNumber(item.total_qty), 0)
      const avgTransaction = totalTransactions ? totalRevenue / totalTransactions : 0
      
      // Find top payment method
      const payMap = new Map<string, number>()
      for (const item of data) {
        const m = String(item.jenis_pembayaran || 'TUNAI').toUpperCase()
        payMap.set(m, (payMap.get(m) || 0) + 1)
      }
      const sortedPay = Array.from(payMap.entries()).sort((a, b) => b[1] - a[1])
      const topPaymentMethod = sortedPay[0]?.[0] || 'TUNAI'
      
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
          d.text('🛒', logoX + logoSize/2, logoY + logoSize/2 + 2, { align: 'center' })
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
        d.text('LAPORAN PENJUALAN HARIAN', pageWidth - 15, logoY + 4, { align: 'right' })
        
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
        { label: 'TOTAL PENDAPATAN', value: formatIdr(totalRevenue), color: [5, 150, 105] },
        { label: 'TOTAL KEUNTUNGAN', value: formatIdr(labaKotor), color: [219, 39, 119] },
        { label: 'PRODUK TERJUAL', value: totalQty.toLocaleString('id-ID'), color: [217, 119, 6] },
        { label: 'TOTAL DISKON', value: formatIdr(totalDiscounts), color: [220, 38, 38] },
        { label: 'TOTAL PAJAK', value: formatIdr(totalTaxes), color: [217, 119, 6] },
        { label: 'RATA-RATA / TRANSAKSI', value: formatIdr(avgTransaction), color: [37, 99, 235] },
        { label: 'METODE TERBANYAK', value: topPaymentMethod, color: [5, 150, 105] }
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
        'Metode',
        'Status'
      ]
      
      const body = data.map((item, idx) => [
        idx + 1,
        item.kd_tansaksi_jual,
        formatDateTime(item.tgl_wkt_transaksi),
        item.username_transaksi || '-',
        item.nama_customer || 'Umum',
        asNumber(item.total_qty).toLocaleString('id-ID'),
        formatIdr(item.sub_total),
        formatIdr(item.discount_amount ?? 0),
        formatIdr(item.pajak),
        formatIdr(item.yang_dibayar),
        item.jenis_pembayaran || '-',
        'Selesai'
      ])
      
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
        formatIdr(totalRevenue),
        '',
        ''
      ]]
      
      autoTable(doc, {
        head: [headers],
        body,
        foot,
        startY: 68,
        styles: {
          fontSize: 7,
          cellPadding: 1.8,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [219, 39, 119],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        footStyles: {
          fillColor: [252, 231, 243],
          textColor: [51, 65, 85],
          fontStyle: 'bold',
          fontSize: 7.2
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { cellWidth: 32 },
          2: { cellWidth: 32 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 },
          5: { halign: 'center', cellWidth: 10 },
          6: { halign: 'right', cellWidth: 28 },
          7: { halign: 'right', cellWidth: 20 },
          8: { halign: 'right', cellWidth: 20 },
          9: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
          10: { halign: 'center', cellWidth: 24 },
          11: { halign: 'center', cellWidth: 18 }
        },
        margin: { left: 15, right: 15, top: 32, bottom: 20 }
      })
      
      // Signature Section
      const finalY = (doc as any).lastAutoTable.finalY || 120
      let sigY = finalY + 15
      
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
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Stok Barang')

      // Add headers
      worksheet.columns = [
        { header: 'Kode Barang', key: 'kode', width: 15 },
        { header: 'Nama Barang', key: 'nama', width: 30 },
        { header: 'Stok', key: 'stok', width: 12 },
        { header: 'Stok Minimum', key: 'min', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ]

      // Style header
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      }

      // Add data with conditional formatting
      data.forEach((item) => {
        const status = (item.stok || 0) <= (item.stok_minimum || 0) ? 'MENIPIS' : 'AMAN'
        const row = worksheet.addRow({
          kode: item.kd_barang,
          nama: item.nama_barang,
          stok: item.stok,
          min: item.stok_minimum,
          status: status,
        })

        // Color code status
        if (status === 'MENIPIS') {
          row.getCell('status').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFECACA' }
          }
          row.getCell('status').font = { color: { argb: 'FFDC2626' }, bold: true }
        } else {
          row.getCell('status').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1FAE5' }
          }
          row.getCell('status').font = { color: { argb: 'FF059669' }, bold: true }
        }
      })

      // Add summary sheet with gorgeous styling and Doughnut Chart
      const summarySheet = workbook.addWorksheet('Ringkasan', {
        views: [{ showGridLines: true }]
      })
      const menipis = data.filter(d => (d.stok || 0) <= (d.stok_minimum || 0)).length
      const aman = data.length - menipis

      summarySheet.addRow(['Status', 'Jumlah'])
      summarySheet.addRow(['Stok Menipis', menipis])
      summarySheet.addRow(['Stok Aman', aman])
      
      // Styling summary sheet
      summarySheet.getRow(1).height = 24
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      summarySheet.getRow(1).eachCell(cell => {
        fillCell(cell, 'FF4F46E5') // Indigo
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = thinBorder('FF4338CA')
      })

      const rowMenipis = summarySheet.getRow(2)
      rowMenipis.height = 20
      rowMenipis.getCell(1).border = thinBorder()
      rowMenipis.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } } // Red
      rowMenipis.getCell(2).border = thinBorder()
      rowMenipis.getCell(2).numFmt = '#,##0'
      rowMenipis.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }

      const rowAman = summarySheet.getRow(3)
      rowAman.height = 20
      rowAman.getCell(1).border = thinBorder()
      rowAman.getCell(1).font = { bold: true, color: { argb: 'FF059669' } } // Emerald
      rowAman.getCell(2).border = thinBorder()
      rowAman.getCell(2).numFmt = '#,##0'
      rowAman.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }

      summarySheet.columns = [{ width: 22 }, { width: 16 }]

      // Add Doughnut Chart
      if (data.length > 0) {
        const stokChartConfig = {
          type: 'doughnut',
          data: {
            labels: ['Stok Menipis', 'Stok Aman'],
            datasets: [{
              data: [menipis, aman],
              backgroundColor: ['#DC2626', '#059669'], // red and green
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            title: {
              display: true,
              text: 'PERSENTASE KETERSEDIAAN STOK BARANG',
              fontSize: 12,
              fontColor: '#1E293B'
            },
            legend: {
              position: 'bottom',
              labels: { fontSize: 10 }
            }
          }
        }
        const stokChartBuffer = await getChartBuffer(stokChartConfig)
        if (stokChartBuffer) {
          try {
            const imageId = workbook.addImage({
              buffer: stokChartBuffer as any,
              extension: 'png',
            })
            summarySheet.addImage(imageId, {
              tl: { col: 3, row: 0 }, // Column D (index 3), Row 1 (index 0)
              ext: { width: 420, height: 280 }
            })
          } catch (imgErr) {
            console.error('Error inserting stock chart:', imgErr)
          }
        }
      }

      // Save file
      let filepath: string
      if (customPath) {
        filepath = customPath
      } else {
        const exportDir = path.join(process.cwd(), 'exports')
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true })
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        filepath = path.join(exportDir, `laporan_stok_${timestamp}.xlsx`)
      }

      await workbook.xlsx.writeFile(filepath)

      return {
        success: true,
        message: 'Export berhasil disimpan dengan grafik',
        data: { filepath, filename: path.basename(filepath) },
      }
    } catch (error) {
      return {
        success: false,
        message: 'Gagal export: ' + (error as Error).message,
      }
    }
  }

  // Export Laporan Stok to PDF
  static exportLaporanStokPDF(data: any[], customPath?: string) {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Header background
      doc.setFillColor(16, 185, 129) // Emerald
      doc.rect(0, 0, pageWidth, 40, 'F')
      doc.setFillColor(5, 150, 105)
      doc.rect(0, 30, pageWidth, 10, 'F')

      // Logo
      doc.setFillColor(255, 255, 255)
      doc.circle(20, 20, 10, 'F')
      doc.setFontSize(14)
      doc.setTextColor(16, 185, 129)
      doc.text('📦', 16, 23)

      // Title
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('LAPORAN STOK BARANG', 38, 18)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text('Zetass Pos', 38, 25)

      const now = new Date()
      doc.setFontSize(9)
      doc.text(`Dicetak: ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID')}`, 38, 32)

      // Summary
      const menipis = data.filter(d => (d.stok || 0) <= (d.stok_minimum || 0)).length
      const aman = data.length - menipis
      
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(pageWidth - 70, 8, 60, 24, 3, 3, 'F')
      doc.setTextColor(16, 185, 129)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('STATUS STOK', pageWidth - 65, 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(220, 38, 38)
      doc.text(`⚠ Menipis: ${menipis} item`, pageWidth - 65, 19)
      doc.setTextColor(16, 185, 129)
      doc.text(`✓ Aman: ${aman} item`, pageWidth - 65, 24)
      doc.setTextColor(100, 116, 139)
      doc.text(`Total: ${data.length} item`, pageWidth - 65, 29)

      doc.setTextColor(0, 0, 0)

      // Table
      const headers = ['No', 'Kode', 'Nama Barang', 'Stok', 'Min', 'Status']
      const body = data.map((item, idx) => {
        const status = (item.stok || 0) <= (item.stok_minimum || 0) ? 'MENIPIS ⚠' : 'AMAN ✓'
        return [
          idx + 1,
          item.kd_barang,
          item.nama_barang,
          item.stok || 0,
          item.stok_minimum || 0,
          status,
        ]
      })

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 45,
        styles: { 
          fontSize: 8,
          cellPadding: 2.5,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: { 
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: function(data: any) {
          if (data.section === 'body' && data.column.index === 5) {
            const cellValue = data.cell.raw as string
            if (cellValue.includes('MENIPIS')) {
              data.cell.styles.textColor = [220, 38, 38]
              data.cell.styles.fillColor = [254, 226, 226]
            } else {
              data.cell.styles.textColor = [16, 185, 129]
              data.cell.styles.fillColor = [209, 250, 229]
            }
          }
        },
        margin: { left: 14, right: 14 },
      })

      // Footer
      doc.setDrawColor(16, 185, 129)
      doc.setLineWidth(0.5)
      doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)
      
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('Zetass Pos Developer', 14, pageHeight - 8)
      doc.text('Inventory Management System', pageWidth / 2, pageHeight - 8, { align: 'center' })
      doc.text(`Halaman 1`, pageWidth - 14, pageHeight - 8, { align: 'right' })

      let filepath: string
      if (customPath) {
        filepath = customPath
      } else {
        const exportDir = path.join(process.cwd(), 'exports')
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true })
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        filepath = path.join(exportDir, `laporan_stok_${timestamp}.pdf`)
      }

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
        message: 'Gagal export: ' + (error as Error).message,
      }
    }
  }
}
