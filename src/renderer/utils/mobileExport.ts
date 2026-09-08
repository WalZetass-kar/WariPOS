import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah } from './format'

/** Convert binary uint8array to base64 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Trigger browser anchor download */
function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

/** Save file to device storage & trigger download */
export async function saveMobileExport(
  data: Uint8Array | Blob,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; filePath: string; message: string }> {
  try {
    const cleanFileName = fileName.replace(/[^\w.-]/g, '_')
    let uint8: Uint8Array
    let blob: Blob

    if (data instanceof Blob) {
      blob = data
      const buffer = await data.arrayBuffer()
      uint8 = new Uint8Array(buffer)
    } else {
      uint8 = data
      blob = new Blob([uint8 as unknown as BlobPart], { type: mimeType })
    }

    // Always trigger browser download in WebView / browser
    triggerBrowserDownload(blob, cleanFileName)

    // On native Android/iOS, also write to Filesystem Documents/Downloads directory
    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = uint8ArrayToBase64(uint8)
        const writeResult = await Filesystem.writeFile({
          path: cleanFileName,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        })
        return {
          success: true,
          filePath: writeResult.uri || `Documents/${cleanFileName}`,
          message: `File berhasil disimpan ke Dokumen/Download (${cleanFileName})`,
        }
      } catch (fsError: any) {
        console.warn('[mobileExport] Filesystem native write warning:', fsError)
      }
    }

    return {
      success: true,
      filePath: cleanFileName,
      message: `File ${cleanFileName} berhasil diunduh`,
    }
  } catch (err: any) {
    console.error('[mobileExport] Save error:', err)
    return {
      success: false,
      filePath: fileName,
      message: err?.message || 'Gagal menyimpan file export',
    }
  }
}

// ─── Generic Table Exporters ────────────────────────────────────────

export async function mobileExportToExcel(
  data: Record<string, any>[],
  fileName = 'export'
) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const fullName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  return saveMobileExport(
    new Uint8Array(wbout),
    fullName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

export async function mobileExportToPDF(
  title: string,
  headers: string[],
  rows: any[][],
  fileName = 'export'
) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 15)
  doc.setFontSize(9)
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 22)

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [220, 38, 38] },
  })

  const pdfOutput = doc.output('arraybuffer')
  const fullName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
  return saveMobileExport(new Uint8Array(pdfOutput), fullName, 'application/pdf')
}

// ─── Specialized Module Exporters ───────────────────────────────────

export async function mobileExportPenjualanExcel(
  penjualanList: any[],
  startDate: string,
  endDate: string,
  storeName = 'WariPOS'
) {
  const rows = (penjualanList || []).map((p, idx) => ({
    No: idx + 1,
    'No Faktur': p.kd_tansaksi_jual || p.kd_penjualan || p.no_faktur || '-',
    Tanggal: p.tgl_wkt_transaksi || p.tanggal || p.created_at || '-',
    Kasir: p.username_transaksi || p.nama_kasir || p.kasir || '-',
    Pelanggan: p.nama_customer || p.pelanggan || 'Umum',
    'Tipe Bayar': p.jenis_pembayaran || p.jenis_bayar || 'TUNAI',
    Subtotal: Number(p.sub_total || p.subtotal || p.total || 0),
    Diskon: Number(p.discount_amount || p.diskon || p.potongan || 0),
    Pajak: Number(p.pajak || 0),
    'Total Akhir': Number(p.yang_dibayar || p.total_akhir || p.total || 0),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Penjualan')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const fileName = `Laporan_Penjualan_${startDate}_sd_${endDate}.xlsx`
  return saveMobileExport(
    new Uint8Array(wbout),
    fileName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

export async function mobileExportPenjualanPDF(
  penjualanList: any[],
  startDate: string,
  endDate: string,
  storeName = 'WariPOS'
) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(`${storeName} - Laporan Penjualan`, 14, 15)
  doc.setFontSize(9)
  doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 22)

  const headers = ['No', 'No Faktur', 'Tanggal', 'Kasir', 'Pelanggan', 'Metode', 'Total']
  const rows = (penjualanList || []).map((p, idx) => [
    idx + 1,
    p.kd_tansaksi_jual || p.kd_penjualan || p.no_faktur || '-',
    String(p.tgl_wkt_transaksi || p.tanggal || p.created_at || '-').slice(0, 19),
    p.username_transaksi || p.nama_kasir || p.kasir || '-',
    p.nama_customer || p.pelanggan || 'Umum',
    p.jenis_pembayaran || p.jenis_bayar || 'TUNAI',
    formatRupiah(Number(p.yang_dibayar || p.total_akhir || p.total || 0)),
  ])

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [220, 38, 38] },
  })

  const pdfOutput = doc.output('arraybuffer')
  const fileName = `Laporan_Penjualan_${startDate}_sd_${endDate}.pdf`
  return saveMobileExport(new Uint8Array(pdfOutput), fileName, 'application/pdf')
}

export async function mobileExportStokExcel(barangList: any[]) {
  const rows = (barangList || []).map((b, idx) => ({
    No: idx + 1,
    'Kode Barang': b.kd_barang || '-',
    'Nama Produk': b.nama_barang || '-',
    Kategori: b.kategori_barang || '-',
    'Harga Beli': Number(b.harga_beli || 0),
    'Harga Jual': Number(b.harga_barang || b.harga_jual || 0),
    Stok: Number(b.stok || 0),
    Satuan: b.satuan_barang || 'Pcs',
    'Nilai Aset': Number(b.stok || 0) * Number(b.harga_beli || 0),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stok Produk')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const fileName = `Laporan_Stok_Produk_${new Date().toISOString().slice(0, 10)}.xlsx`
  return saveMobileExport(
    new Uint8Array(wbout),
    fileName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

export async function mobileExportStokPDF(barangList: any[], storeName = 'WariPOS') {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(`${storeName} - Laporan Stok Produk`, 14, 15)
  doc.setFontSize(9)
  doc.text(`Per Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 22)

  const headers = ['No', 'Kode', 'Nama Produk', 'Kategori', 'Harga Jual', 'Stok', 'Satuan']
  const rows = (barangList || []).map((b, idx) => [
    idx + 1,
    b.kd_barang || '-',
    b.nama_barang || '-',
    b.kategori_barang || '-',
    formatRupiah(Number(b.harga_barang || b.harga_jual || 0)),
    Number(b.stok || 0),
    b.satuan_barang || 'Pcs',
  ])

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [220, 38, 38] },
  })

  const pdfOutput = doc.output('arraybuffer')
  const fileName = `Laporan_Stok_${new Date().toISOString().slice(0, 10)}.pdf`
  return saveMobileExport(new Uint8Array(pdfOutput), fileName, 'application/pdf')
}

export async function mobileExportCashFlowExcel(items: any[], startDate: string, endDate: string) {
  const rows = (items || []).map((item, idx) => ({
    No: idx + 1,
    Tanggal: item.tanggal || '-',
    Kategori: item.kategori || '-',
    Tipe: item.tipe || '-',
    Keterangan: item.keterangan || '-',
    Nominal: Number(item.nominal || 0),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Arus Kas')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const fileName = `Arus_Kas_${startDate}_sd_${endDate}.xlsx`
  return saveMobileExport(
    new Uint8Array(wbout),
    fileName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}
