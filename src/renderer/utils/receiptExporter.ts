import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import type { CartItem, Customer } from '../../shared/types'
import { formatRupiah } from './format'

export interface ReceiptData {
  storeName?: string
  storeAddress?: string
  storePhone?: string
  storeFooter?: string
  invoiceNumber: string
  date?: string
  cashierName: string
  cart: CartItem[]
  subTotal: number
  pajakAmount: number
  pajakPersen: number
  promoDiskon: number
  promoCode?: string
  totalBayar: number
  paidAmount: number
  kembalian: number
  jenisBayar: string
  customer?: Customer | null
  poinEarned?: number
  tableNumber?: string
  orderType?: string
}

/**
 * Save a Blob/Base64 to device storage (Android Filesystem or Desktop Download)
 */
export async function saveFileToDevice(
  fileName: string,
  base64OrBlob: string | Blob,
  mimeType: string
): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      let base64Data = ''
      if (typeof base64OrBlob === 'string') {
        base64Data = base64OrBlob.replace(/^data:[^;]+;base64,/, '')
      } else {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const res = reader.result as string
            resolve(res.replace(/^data:[^;]+;base64,/, ''))
          }
          reader.onerror = reject
          reader.readAsDataURL(base64OrBlob)
        })
      }

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      })
      return true
    }

    // Web / Desktop fallback
    const blob = typeof base64OrBlob === 'string'
      ? await (await fetch(base64OrBlob)).blob()
      : base64OrBlob

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
    return true
  } catch (error) {
    console.error('[saveFileToDevice] Failed:', error)
    return false
  }
}

/**
 * Calculate dynamic receipt page height in mm based on content lines
 */
export function calculateReceiptPdfHeight(data: ReceiptData): number {
  let estimatedY = 8 // Top margin

  // Store header
  estimatedY += 6

  // Store address
  if (data.storeAddress) {
    const approxLines = Math.max(1, Math.ceil(data.storeAddress.length / 38))
    estimatedY += approxLines * 3.6
  }

  // Store phone
  if (data.storePhone) {
    estimatedY += 4
  }

  // Divider
  estimatedY += 4

  // Invoice info
  estimatedY += 3.5 // No Trx
  estimatedY += 3.5 // Tgl
  estimatedY += 3.5 // Kasir
  if (data.tableNumber) estimatedY += 3.5
  if (data.customer?.nama_customer || (data.customer as any)?.nama) estimatedY += 3.5
  estimatedY += 4

  // Divider
  estimatedY += 4

  // ITEM & TOTAL header
  estimatedY += 4.5

  // Items
  for (const item of data.cart) {
    const nameLength = (item.nama_barang || '').length
    const nameLines = Math.max(1, Math.ceil(nameLength / 36))
    estimatedY += nameLines * 3.6 // Product name lines
    estimatedY += 4.2 // Quantity x unit price and total line
    estimatedY += 1.5 // Space between items
  }

  // Divider
  estimatedY += 4

  // Totals
  estimatedY += 3.8 // Subtotal
  if (data.promoDiskon > 0) estimatedY += 3.8
  if (data.pajakAmount > 0) estimatedY += 3.8
  estimatedY += 1
  estimatedY += 5.2 // TOTAL
  estimatedY += 1
  estimatedY += 3.8 // Metode bayar
  estimatedY += 3.8 // Bayar
  estimatedY += 3.8 // Kembalian
  if (data.poinEarned && data.poinEarned > 0) estimatedY += 5.5

  // Divider + Footer
  estimatedY += 4
  estimatedY += 6
  if (data.storeFooter) {
    const footerLines = Math.max(1, Math.ceil(data.storeFooter.length / 40))
    estimatedY += footerLines * 3.5
  } else {
    estimatedY += 4
  }

  // Bottom padding
  estimatedY += 10

  return Math.max(75, Math.ceil(estimatedY))
}

/**
 * Generate a receipt PDF matching standard receipt layout with dynamic vertical stacking
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Blob> {
  const pageHeight = calculateReceiptPdfHeight(data)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, pageHeight],
  })

  let y = 8
  const left = 5
  const right = 75
  const center = 40
  const printableWidth = right - left // 70mm

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.storeName || 'WARIPOS', center, y, { align: 'center' })
  y += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  if (data.storeAddress) {
    const addrLines = doc.splitTextToSize(data.storeAddress, printableWidth)
    doc.text(addrLines, center, y, { align: 'center' })
    y += addrLines.length * 3.4
  }
  if (data.storePhone) {
    doc.text(`Telp: ${data.storePhone}`, center, y, { align: 'center' })
    y += 3.8
  }

  // Divider
  doc.setLineDashPattern([1, 1], 0)
  doc.line(left, y, right, y)
  y += 3.8

  // Invoice info
  doc.setFontSize(7.5)
  doc.text(`No. Trx : ${data.invoiceNumber}`, left, y)
  y += 3.5
  doc.text(`Tgl     : ${data.date || new Date().toLocaleString('id-ID')}`, left, y)
  y += 3.5
  doc.text(`Kasir   : ${data.cashierName}`, left, y)
  if (data.tableNumber) {
    y += 3.5
    doc.text(`Meja    : ${data.tableNumber} (${data.orderType || 'DINE IN'})`, left, y)
  }
  if (data.customer?.nama_customer || (data.customer as any)?.nama) {
    y += 3.5
    doc.text(`Pelanggan: ${data.customer?.nama_customer || (data.customer as any)?.nama}`, left, y)
  }
  y += 3.8

  // Divider
  doc.line(left, y, right, y)
  y += 4

  // Items Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('ITEM', left, y)
  doc.text('TOTAL', right, y, { align: 'right' })
  y += 4.2

  // Items List with Dynamic Vertical Stacking
  for (const item of data.cart) {
    // 1. Nama produk memiliki ruang sendiri dan di-wrap secara dinamis
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const nameLines = doc.splitTextToSize(item.nama_barang || '', printableWidth)
    doc.text(nameLines, left, y)
    y += nameLines.length * 3.6

    // 2. Baris detail quantity x harga di kiri, total harga di kanan
    const disc = (item.harga_jual * (item.disc || 0)) / 100
    const itemTotal = (item.harga_jual - disc) * item.qty
    const qtyPriceStr = `${item.qty} x ${formatRupiah(item.harga_jual)}${item.disc ? ` (Disc ${item.disc}%)` : ''}`
    const totalStr = formatRupiah(itemTotal)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(qtyPriceStr, left, y)
    doc.text(totalStr, right, y, { align: 'right' })
    y += 4.5 // Vertical spacing sebelum item berikutnya
  }

  // Divider setelah seluruh item selesai
  doc.line(left, y, right, y)
  y += 4

  // Totals Section
  const printRow = (label: string, value: string, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold')
    else doc.setFont('helvetica', 'normal')
    doc.text(label, left, y)
    doc.text(value, right, y, { align: 'right' })
    y += 3.6
  }

  printRow('Subtotal', formatRupiah(data.subTotal))
  if (data.promoDiskon > 0) {
    printRow('Diskon Promo', `-${formatRupiah(data.promoDiskon)}`)
  }
  if (data.pajakAmount > 0) {
    printRow(`Pajak (${data.pajakPersen}%)`, formatRupiah(data.pajakAmount))
  }
  y += 0.8
  doc.setFontSize(9)
  printRow('TOTAL', formatRupiah(data.totalBayar), true)
  doc.setFontSize(7.5)
  y += 0.8
  printRow('Metode Bayar', data.jenisBayar)
  printRow('Bayar', formatRupiah(data.paidAmount))
  printRow('Kembalian', formatRupiah(data.kembalian))

  if (data.poinEarned && data.poinEarned > 0) {
    y += 2
    doc.text(`Poin Diperoleh: +${data.poinEarned} Poin`, center, y, { align: 'center' })
    y += 3.5
  }

  // Divider sebelum Footer
  doc.line(left, y, right, y)
  y += 4.5

  // Footer
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  const footerLines = doc.splitTextToSize(
    data.storeFooter || 'Terima kasih atas kunjungan Anda!',
    printableWidth
  )
  doc.text(footerLines, center, y, { align: 'center' })

  return doc.output('blob')
}

/**
 * Generate an Excel XLSX spreadsheet for the transaction
 */
export function generateReceiptXlsx(data: ReceiptData): Blob {
  const rows: any[] = [
    { 'Informasi Transaksi': 'Nama Toko', Nilai: data.storeName || 'WariPOS' },
    { 'Informasi Transaksi': 'No. Transaksi', Nilai: data.invoiceNumber },
    { 'Informasi Transaksi': 'Tanggal & Waktu', Nilai: data.date || new Date().toLocaleString('id-ID') },
    { 'Informasi Transaksi': 'Kasir', Nilai: data.cashierName },
    { 'Informasi Transaksi': 'Pelanggan', Nilai: data.customer?.nama_customer || (data.customer as any)?.nama || '-' },
    { 'Informasi Transaksi': 'Metode Pembayaran', Nilai: data.jenisBayar },
    {},
    {
      'No': 'No',
      'Kode Barang': 'Kode Barang',
      'Nama Produk': 'Nama Produk',
      'Jumlah (Qty)': 'Qty',
      'Harga Satuan (Rp)': 'Harga Satuan (Rp)',
      'Diskon (%)': 'Diskon (%)',
      'Subtotal (Rp)': 'Subtotal (Rp)',
    },
  ]

  let idx = 1
  for (const item of data.cart) {
    const itemTotal = (item.harga_jual - (item.harga_jual * (item.disc || 0)) / 100) * item.qty
    rows.push({
      'No': idx++,
      'Kode Barang': item.kd_barang,
      'Nama Produk': item.nama_barang,
      'Jumlah (Qty)': item.qty,
      'Harga Satuan (Rp)': item.harga_jual,
      'Diskon (%)': item.disc || 0,
      'Subtotal (Rp)': itemTotal,
    })
  }

  rows.push(
    {},
    { 'No': '', 'Kode Barang': '', 'Nama Produk': '', 'Jumlah (Qty)': '', 'Harga Satuan (Rp)': '', 'Diskon (%)': 'Subtotal', 'Subtotal (Rp)': data.subTotal },
    { 'No': '', 'Kode Barang': '', 'Nama Produk': '', 'Jumlah (Qty)': '', 'Harga Satuan (Rp)': '', 'Diskon (%)': 'Diskon Promo', 'Subtotal (Rp)': data.promoDiskon },
    { 'No': '', 'Kode Barang': '', 'Nama Produk': '', 'Jumlah (Qty)': '', 'Harga Satuan (Rp)': '', 'Diskon (%)': `Pajak (${data.pajakPersen}%)`, 'Subtotal (Rp)': data.pajakAmount },
    { 'No': '', 'Kode Barang': '', 'Nama Produk': '', 'Jumlah (Qty)': '', 'Harga Satuan (Rp)': '', 'Diskon (%)': 'GRAND TOTAL', 'Subtotal (Rp)': data.totalBayar },
    { 'No': '', 'Kode Barang': '', 'Nama Produk': '', 'Jumlah (Qty)': '', 'Harga Satuan (Rp)': '', 'Diskon (%)': 'Jumlah Dibayar', 'Subtotal (Rp)': data.paidAmount },
    { 'No': '', 'Kode Barang': '', 'Nama Produk': '', 'Jumlah (Qty)': '', 'Harga Satuan (Rp)': '', 'Diskon (%)': 'Kembalian', 'Subtotal (Rp)': data.kembalian },
  )

  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Struk Transaksi')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Generate a printable PDF Sticker for a restaurant table QR code
 */
export async function generateTableStickerPdf(
  tableNumber: string,
  qrDataUrl: string,
  storeName = 'WARIPOS'
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [90, 120],
  })

  // Border frame
  doc.setLineWidth(1)
  doc.setDrawColor(15, 23, 42)
  doc.roundedRect(5, 5, 80, 110, 4, 4)

  // Store header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(storeName.toUpperCase(), 45, 16, { align: 'center' })

  // Table label & number
  doc.setFontSize(22)
  doc.text(`MEJA ${tableNumber}`, 45, 28, { align: 'center' })

  // QR Code Image
  doc.addImage(qrDataUrl, 'PNG', 20, 34, 50, 50)

  // Instructions
  doc.setFontSize(10)
  doc.text('SCAN UNTUK PESAN', 45, 92, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Buka kamera HP atau aplikasi QR scanner', 45, 98, { align: 'center' })
  doc.text('Pilih menu & bayar langsung dari meja', 45, 103, { align: 'center' })

  return doc.output('blob')
}

/**
 * Ekspor soft file struk langsung dari elemen preview DOM ke file PNG atau PDF.
 * Desain dijamin 100% identik dengan tampilan preview yang sedang aktif pada aplikasi.
 */
export async function exportReceiptSoftFile(
  element: HTMLElement,
  invoiceNumber: string,
  format: 'png' | 'pdf' = 'png'
): Promise<{ success: boolean; fileName: string; error?: string }> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Kualitas tinggi retina
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const cleanInvoice = (invoiceNumber || `TRX-${Date.now()}`).replace(/[^\w-]/g, '_')

    if (format === 'png') {
      const fileName = `Struk-${cleanInvoice}.png`
      const dataUrl = canvas.toDataURL('image/png')
      const saved = await saveFileToDevice(fileName, dataUrl, 'image/png')
      return { success: saved, fileName }
    } else {
      // PDF dengan ukuran presisi canvas struk
      const imgData = canvas.toDataURL('image/png')
      // Konversi pixel ke mm (1 px ≈ 0.264583 mm) dikompensasi scale: 2
      const mmWidth = (canvas.width * 0.264583) / 2
      const mmHeight = (canvas.height * 0.264583) / 2

      const pdf = new jsPDF({
        orientation: mmHeight > mmWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [Math.max(58, mmWidth), Math.max(80, mmHeight)],
      })

      pdf.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight)
      const pdfBlob = pdf.output('blob')
      const fileName = `Struk-${cleanInvoice}.pdf`
      const saved = await saveFileToDevice(fileName, pdfBlob, 'application/pdf')
      return { success: saved, fileName }
    }
  } catch (error) {
    console.error('[exportReceiptSoftFile] Gagal menghasilkan soft file:', error)
    return { success: false, fileName: '', error: String(error) }
  }
}
