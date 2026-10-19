import { ExportService } from '../services/export.js'
import { LaporanController } from './LaporanController.js'

interface SalesBundle {
  success: boolean
  message?: string
  transaksi?: any[]
  context?: {
    startDate: string
    endDate: string
    summary?: any
    labaRugi?: any
    detailItems?: any[]
    produk?: any[]
    pembayaran?: any[]
  }
}

export class ExportController {
  /**
   * Ambil semua sumber data laporan penjualan satu kali agar CSV, PDF, dan XLSX
   * memakai filter, agregasi, dan angka yang sama dengan tampilan aplikasi.
   */
  private static buildSalesBundle(startDate: string, endDate: string): SalesBundle {
    const laporan = LaporanController.getLaporanPenjualan(startDate, endDate)
    if (!laporan.success || !laporan.data) {
      return { success: false, message: laporan.message || 'Gagal mengambil data laporan' }
    }

    const labaRugi = LaporanController.getLaporanLabaRugi(startDate, endDate)
    const detail = LaporanController.getLaporanDetailItem(startDate, endDate)
    const produk = LaporanController.getLaporanProdukTerlaris(startDate, endDate, 10000)
    const pembayaran = LaporanController.getLaporanPembayaran(startDate, endDate)

    return {
      success: true,
      transaksi: laporan.data.transaksi,
      context: {
        startDate,
        endDate,
        summary: laporan.data.summary,
        labaRugi: labaRugi.success ? labaRugi.data : null,
        detailItems: detail.success ? detail.data : [],
        produk: produk.success ? produk.data : [],
        pembayaran: pembayaran.success ? pembayaran.data : [],
      },
    }
  }

  // ─── PENJUALAN ────────────────────────────────────────────────────
  static async exportPenjualanExcel(startDate: string, endDate: string, customPath?: string) {
    try {
      const bundle = this.buildSalesBundle(startDate, endDate)
      if (!bundle.success || !bundle.context) {
        return { success: false, message: bundle.message }
      }
      return ExportService.exportLaporanPenjualanExcel(bundle.transaksi ?? [], customPath, bundle.context)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportPenjualanPDF(startDate: string, endDate: string, customPath?: string) {
    try {
      const bundle = this.buildSalesBundle(startDate, endDate)
      if (!bundle.success || !bundle.context) {
        return { success: false, message: bundle.message }
      }
      return ExportService.exportLaporanPenjualanPDF(bundle.transaksi ?? [], customPath, bundle.context)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportPenjualanCSV(startDate: string, endDate: string, customPath?: string) {
    try {
      const bundle = this.buildSalesBundle(startDate, endDate)
      if (!bundle.success || !bundle.context) {
        return { success: false, message: bundle.message }
      }
      return ExportService.exportLaporanPenjualanCSV(bundle.transaksi ?? [], customPath, bundle.context)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static async exportDetailItemCSV(startDate: string, endDate: string, customPath?: string) {
    try {
      const detail = LaporanController.getLaporanDetailItem(startDate, endDate)
      if (!detail.success) return { success: false, message: detail.message || 'Gagal mengambil detail item' }
      return ExportService.exportLaporanDetailItemCSV(detail.data ?? [], customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static async exportPembayaranCSV(startDate: string, endDate: string, customPath?: string) {
    try {
      const rows = LaporanController.getLaporanPembayaran(startDate, endDate)
      if (!rows.success) return { success: false, message: rows.message || 'Gagal mengambil laporan pembayaran' }
      return ExportService.exportLaporanPembayaranCSV(rows.data as any[], customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  // ─── PRODUK TERLARIS ──────────────────────────────────────────────
  static async exportProdukCSV(startDate: string, endDate: string, customPath?: string) {
    try {
      const rows = LaporanController.getLaporanProdukTerlaris(startDate, endDate, 10000)
      if (!rows.success) return { success: false, message: rows.message || 'Gagal mengambil produk terlaris' }
      return ExportService.exportLaporanProdukCSV(rows.data as any[], customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static async exportProdukExcel(startDate: string, endDate: string, customPath?: string) {
    try {
      const rows = LaporanController.getLaporanProdukTerlaris(startDate, endDate, 10000)
      if (!rows.success) return { success: false, message: rows.message || 'Gagal mengambil produk terlaris' }
      return ExportService.exportLaporanProdukExcel(rows.data as any[], customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportProdukPDF(startDate: string, endDate: string, customPath?: string) {
    try {
      const rows = LaporanController.getLaporanProdukTerlaris(startDate, endDate, 10000)
      if (!rows.success) return { success: false, message: rows.message || 'Gagal mengambil produk terlaris' }
      return ExportService.exportLaporanProdukPDF(rows.data as any[], customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ─── LABA RUGI ────────────────────────────────────────────────────
  static async exportLabaRugiCSV(startDate: string, endDate: string, customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanLabaRugi(startDate, endDate)
      if (!laporan.success || !laporan.data) {
        return { success: false, message: laporan.message || 'Gagal mengambil laporan laba rugi' }
      }
      return ExportService.exportLaporanLabaRugiCSV(laporan.data, customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static async exportLabaRugiExcel(startDate: string, endDate: string, customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanLabaRugi(startDate, endDate)
      if (!laporan.success || !laporan.data) {
        return { success: false, message: laporan.message || 'Gagal mengambil laporan laba rugi' }
      }
      return ExportService.exportLaporanLabaRugiExcel(laporan.data, customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportLabaRugiPDF(startDate: string, endDate: string, customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanLabaRugi(startDate, endDate)
      if (!laporan.success || !laporan.data) {
        return { success: false, message: laporan.message || 'Gagal mengambil laporan laba rugi' }
      }
      return ExportService.exportLaporanLabaRugiPDF(laporan.data, customPath, { startDate, endDate })
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ─── PERSEDIAAN ───────────────────────────────────────────────────
  static async exportStokExcel(customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanStok()
      if (!laporan.success || !laporan.data) {
        return { success: false, message: 'Gagal mengambil data laporan' }
      }

      return ExportService.exportLaporanStokExcel(laporan.data.all, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportStokPDF(customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanStok()
      if (!laporan.success || !laporan.data) {
        return { success: false, message: 'Gagal mengambil data laporan' }
      }

      return ExportService.exportLaporanStokPDF(laporan.data.all, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportStokCSV(customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanStok()
      if (!laporan.success || !laporan.data) {
        return { success: false, message: 'Gagal mengambil data laporan' }
      }
      return ExportService.exportLaporanStokCSV(laporan.data.all, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  // ─── CUSTOMER ─────────────────────────────────────────────────────
  static async exportCustomerCSV(customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanCustomer()
      if (!laporan.success || !laporan.data) {
        return { success: false, message: 'Gagal mengambil data laporan' }
      }
      return ExportService.exportLaporanCustomerCSV(laporan.data.customers, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }

  static async exportCustomerExcel(customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanCustomer()
      if (!laporan.success || !laporan.data) {
        return { success: false, message: 'Gagal mengambil data laporan' }
      }
      return ExportService.exportLaporanCustomerExcel(laporan.data.customers, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportCustomerPDF(customPath?: string) {
    try {
      const laporan = LaporanController.getLaporanCustomer()
      if (!laporan.success || !laporan.data) {
        return { success: false, message: 'Gagal mengambil data laporan' }
      }
      return ExportService.exportLaporanCustomerPDF(laporan.data.customers, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ─── GENERIC (arus kas, pajak, price list) ───────────────────────
  static async exportCashFlowExcel(data: any[], startDate: string, endDate: string, customPath?: string) {
    try {
      const rows = Array.isArray(data) ? data : []
      const filename = `arus_kas_${startDate}_sampai_${endDate}`
      return ExportService.exportToExcel(rows, filename, 'Arus Kas', customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportPriceListPDF(products: any[], categoryName: string, customPath?: string) {
    try {
      const rows = Array.isArray(products) ? products : []
      if (rows.length === 0) {
        return { success: false, message: 'Tidak ada data produk untuk di-export' }
      }

      const title = `Price List ${categoryName ? `- ${categoryName}` : ''}`.trim()
      const headers = ['Kode', 'Nama Produk', 'Kategori', 'Stok', 'Harga']
      const data = rows.map(item => [
        item.kd_barang ?? '-',
        item.nama_barang ?? '-',
        item.kategori_barang ?? '-',
        Number(item.stok ?? 0),
        Number(item.harga_barang ?? 0),
      ])

      return ExportService.exportToPDF(title, headers, data, 'price_list', 'landscape', customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportTaxReportExcel(data: any[], startDate: string, endDate: string, customPath?: string) {
    try {
      const rows = Array.isArray(data) ? data : []
      const filename = `laporan_pajak_${startDate}_sampai_${endDate}`
      return ExportService.exportToExcel(rows, filename, 'Pajak', customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  // ─── GENERIC EXPORT ───────────────────────────────────────────────
  static async exportToExcel(data: any[], filename: string, sheetName?: string, customPath?: string) {
    try {
      return ExportService.exportToExcel(data, filename, sheetName, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportToPDF(
    title: string,
    headers: string[],
    data: any[][],
    filename: string,
    orientation?: 'portrait' | 'landscape',
    customPath?: string
  ) {
    try {
      return ExportService.exportToPDF(title, headers, data, filename, orientation, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export: ' + (error as Error).message }
    }
  }

  static async exportToCSV(data: any[], filename: string, customPath?: string) {
    try {
      return ExportService.exportToCSV(data, filename, customPath)
    } catch (error) {
      return { success: false, message: 'Gagal export CSV: ' + (error as Error).message }
    }
  }
}
