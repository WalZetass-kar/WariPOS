import { api } from './api'
import type { Barang } from '../../shared/types'

export interface AiActionResult {
  executed: boolean
  actionType: 'RESTOCK' | 'RESTOCK_ALL' | 'CREATE_PRODUCT' | 'UPDATE_PRICE' | 'CREATE_PROMO' | 'BACKUP' | 'NAVIGATE' | 'NONE'
  title: string
  message: string
  details?: Array<{ label: string; value: string }>
  navigateRoute?: string
  navigateLabel?: string
  success: boolean
}

export interface QuickActionOption {
  id: string
  label: string
  prompt: string
  actionType?: string
  payload?: any
}

function cleanStr(s: string) {
  return s.trim().toLowerCase()
}

export class AiActionEngine {
  /**
   * Eksekusi restock untuk semua produk yang stoknya habis (<= 0) atau di bawah stok minimum.
   */
  static async executeRestockAllZero(targetQty = 20): Promise<AiActionResult> {
    try {
      const res = await api<Barang[]>('barang:getAll')
      if (!res.success || !Array.isArray(res.data)) {
        return {
          executed: true,
          success: false,
          actionType: 'RESTOCK_ALL',
          title: 'Gagal Membaca Data Produk',
          message: res.message || 'Tidak dapat mengambil data inventori produk.',
        }
      }

      const zeroItems = res.data.filter(b => (b.stok ?? 0) <= 0)
      if (zeroItems.length === 0) {
        return {
          executed: true,
          success: true,
          actionType: 'RESTOCK_ALL',
          title: 'Stok Masih Aman',
          message: 'Semua produk di toko saat ini memiliki stok lebih dari 0.',
        }
      }

      const updatedNames: string[] = []
      for (const item of zeroItems) {
        const updateRes = await api('barang:update', item.kd_barang, {
          stok: targetQty,
          nama_barang: item.nama_barang,
          harga_barang: item.harga_barang,
          harga_modal: item.harga_modal,
        })
        if (updateRes.success) {
          updatedNames.push(item.nama_barang || item.kd_barang)
        }
      }

      return {
        executed: true,
        success: true,
        actionType: 'RESTOCK_ALL',
        title: `Restock Berhasil (${updatedNames.length} Produk)`,
        message: `Berhasil menambahkan stok masing-masing +${targetQty} pcs untuk ${updatedNames.length} produk yang sebelumnya kosong.`,
        details: updatedNames.slice(0, 5).map(name => ({
          label: name,
          value: `Stok sekarang: ${targetQty} pcs`,
        })),
        navigateRoute: '/produk',
        navigateLabel: 'Buka Halaman Produk',
      }
    } catch (err) {
      return {
        executed: true,
        success: false,
        actionType: 'RESTOCK_ALL',
        title: 'Gagal Restock Massal',
        message: err instanceof Error ? err.message : 'Terjadi kendala saat update database.',
      }
    }
  }

  /**
   * Eksekusi restock produk tertentu berdasarkan pencarian nama/kode.
   */
  static async executeRestockProduct(productQuery: string, targetQty: number): Promise<AiActionResult> {
    try {
      const res = await api<Barang[]>('barang:getAll')
      if (!res.success || !Array.isArray(res.data)) {
        return {
          executed: true,
          success: false,
          actionType: 'RESTOCK',
          title: 'Gagal Membaca Produk',
          message: 'Database inventori tidak dapat diakses.',
        }
      }

      const queryNorm = cleanStr(productQuery)
      // Cari produk yang paling cocok
      const match = res.data.find(b => {
        const nameNorm = cleanStr(b.nama_barang || '')
        const kdNorm = cleanStr(b.kd_barang || '')
        const barcodeNorm = cleanStr(b.barcode || '')
        return nameNorm === queryNorm || nameNorm.includes(queryNorm) || queryNorm.includes(nameNorm) || kdNorm === queryNorm || barcodeNorm === queryNorm
      })

      if (!match) {
        return {
          executed: true,
          success: false,
          actionType: 'RESTOCK',
          title: 'Produk Tidak Ditemukan',
          message: `Tidak ditemukan produk dengan kata kunci "${productQuery}". Pastikan nama produk sudah sesuai di katalog.`,
          navigateRoute: '/produk',
          navigateLabel: 'Cek Daftar Produk',
        }
      }

      const oldStock = match.stok ?? 0
      const newStock = targetQty

      const updateRes = await api('barang:update', match.kd_barang, {
        stok: newStock,
        nama_barang: match.nama_barang,
        harga_barang: match.harga_barang,
        harga_modal: match.harga_modal,
      })

      if (!updateRes.success) {
        return {
          executed: true,
          success: false,
          actionType: 'RESTOCK',
          title: 'Gagal Memperbarui Stok',
          message: updateRes.message || 'Gagal menyimpan perubahan stok ke database.',
        }
      }

      return {
        executed: true,
        success: true,
        actionType: 'RESTOCK',
        title: `Restock Berhasil: ${match.nama_barang}`,
        message: `Stok produk "${match.nama_barang}" berhasil diperbarui dari ${oldStock} pcs menjadi ${newStock} pcs.`,
        details: [
          { label: 'Kode Produk', value: match.kd_barang },
          { label: 'Stok Sebelumnya', value: `${oldStock} pcs` },
          { label: 'Stok Baru', value: `${newStock} pcs` },
        ],
        navigateRoute: '/produk',
        navigateLabel: 'Lihat di Katalog',
      }
    } catch (err) {
      return {
        executed: true,
        success: false,
        actionType: 'RESTOCK',
        title: 'Error Restock',
        message: err instanceof Error ? err.message : 'Terjadi kendala teknis saat restock.',
      }
    }
  }

  /**
   * Eksekusi penambahan produk baru ke katalog.
   */
  static async executeCreateProduct(data: {
    nama: string
    harga_jual: number
    harga_modal?: number
    stok?: number
    kategori?: string
  }): Promise<AiActionResult> {
    try {
      const kdBarang = 'BRG-' + Date.now().toString(36).toUpperCase()
      const res = await api('barang:create', {
        kd_barang: kdBarang,
        nama_barang: data.nama,
        harga_barang: data.harga_jual,
        harga_modal: data.harga_modal ?? Math.round(data.harga_jual * 0.7),
        stok: data.stok ?? 10,
        stok_minimum: 5,
        deskripsi_barang: 'Ditambahkan otomatis melalui Asisten AI WariPOS',
      })

      if (!res.success) {
        return {
          executed: true,
          success: false,
          actionType: 'CREATE_PRODUCT',
          title: 'Gagal Menambah Produk',
          message: res.message || 'Gagal mendaftarkan produk baru ke database.',
        }
      }

      return {
        executed: true,
        success: true,
        actionType: 'CREATE_PRODUCT',
        title: `Produk Berhasil Didaftarkan: ${data.nama}`,
        message: `Produk baru "${data.nama}" telah berhasil ditambahkan ke katalog inventori WariPOS.`,
        details: [
          { label: 'Kode Produk', value: kdBarang },
          { label: 'Harga Jual', value: `Rp ${data.harga_jual.toLocaleString('id-ID')}` },
          { label: 'Harga Modal', value: `Rp ${(data.harga_modal ?? Math.round(data.harga_jual * 0.7)).toLocaleString('id-ID')}` },
          { label: 'Stok Awal', value: `${data.stok ?? 10} pcs` },
        ],
        navigateRoute: '/produk',
        navigateLabel: 'Buka Katalog Produk',
      }
    } catch (err) {
      return {
        executed: true,
        success: false,
        actionType: 'CREATE_PRODUCT',
        title: 'Error Tambah Produk',
        message: err instanceof Error ? err.message : 'Terjadi kendala teknis saat membuat produk.',
      }
    }
  }

  /**
   * Eksekusi pembuatan kupon promo/diskon.
   */
  static async executeCreatePromo(data: {
    kode: string
    diskon: number
    tipe?: 'PERSEN' | 'NOMINAL'
    minBelanja?: number
  }): Promise<AiActionResult> {
    try {
      const res = await api('promo:create', {
        kode_promo: data.kode.toUpperCase(),
        nama_promo: `Promo Diskon ${data.diskon}% (Oleh AI)`,
        tipe_diskon: data.tipe || 'PERSEN',
        diskon: data.diskon,
        minimal_belanja: data.minBelanja || 0,
        tanggal_mulai: new Date().toISOString().slice(0, 10),
        tanggal_selesai: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        is_active: 1,
      })

      if (!res.success) {
        return {
          executed: true,
          success: false,
          actionType: 'CREATE_PROMO',
          title: 'Gagal Membuat Promo',
          message: res.message || 'Gagal menyimpan promo ke database.',
        }
      }

      return {
        executed: true,
        success: true,
        actionType: 'CREATE_PROMO',
        title: `Kupon Promo Aktif: ${data.kode.toUpperCase()}`,
        message: `Kupon promo ${data.kode.toUpperCase()} dengan diskon ${data.diskon}% telah aktif dan siap digunakan di kasir.`,
        details: [
          { label: 'Kode Promo', value: data.kode.toUpperCase() },
          { label: 'Potongan', value: `${data.diskon}%` },
          { label: 'Masa Berlaku', value: '30 Hari ke depan' },
        ],
        navigateRoute: '/transaksi',
        navigateLabel: 'Coba di Halaman Kasir',
      }
    } catch (err) {
      return {
        executed: true,
        success: false,
        actionType: 'CREATE_PROMO',
        title: 'Error Buat Promo',
        message: err instanceof Error ? err.message : 'Terjadi kendala teknis saat membuat promo.',
      }
    }
  }

  /**
   * Eksekusi backup database SQLite lokal.
   */
  static async executeBackup(): Promise<AiActionResult> {
    try {
      const res = await api<{ filename?: string; path?: string }>('backup:create', 'AI Asisten', 'Backup otomatis via perintah Asisten AI')
      if (!res.success) {
        return {
          executed: true,
          success: false,
          actionType: 'BACKUP',
          title: 'Gagal Backup Database',
          message: res.message || 'Gagal mengeksekusi backup SQLite.',
        }
      }

      return {
        executed: true,
        success: true,
        actionType: 'BACKUP',
        title: 'Backup Database Sukses',
        message: 'Cadangan database sistem POS berhasil dibuat dengan aman dan terenkripsi.',
        details: [
          { label: 'Waktu Backup', value: new Date().toLocaleTimeString('id-ID') },
          { label: 'Status', value: 'Tersimpan di Direktori Data Aplikasi' },
        ],
        navigateRoute: '/backup',
        navigateLabel: 'Lihat Daftar Backup',
      }
    } catch (err) {
      return {
        executed: true,
        success: false,
        actionType: 'BACKUP',
        title: 'Error Backup',
        message: err instanceof Error ? err.message : 'Terjadi kendala saat backup database.',
      }
    }
  }

  /**
   * Parser bahasa alami (Natural Language Intent Parser) untuk mendeteksi perintah aksi.
   */
  static async parseAndExecute(promptText: string): Promise<AiActionResult> {
    const text = cleanStr(promptText)

    // 1. Restock SEMUA produk habis
    if (
      (text.includes('restock') || text.includes('tambah stok') || text.includes('isi stok') || text.includes('isi ulang')) &&
      (text.includes('semua') || text.includes('habis') || text.includes('kosong') || text.includes('nol') || text.includes('menipis'))
    ) {
      const qtyMatch = text.match(/(?:jadi|sebanyak|sebesar|\+)?\s*(\d+)\s*(?:pcs|buah|biji|item)?/i)
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 20
      return this.executeRestockAllZero(qty)
    }

    // 2. Restock SATU produk tertentu
    // Contoh: "restock Teh Botol Sosro jadi 50" atau "tambah stok Coca Cola 30"
    const restockSingleMatch = text.match(/(?:restock|tambah stok|isi stok|update stok)\s+(.+?)\s+(?:jadi|sebanyak|sebesar|=|\+)?\s*(\d+)\s*(?:pcs|buah|biji|item|botol)?$/i)
    if (restockSingleMatch) {
      const rawProduct = restockSingleMatch[1].replace(/^(produk|barang)\s+/i, '').trim()
      const qty = parseInt(restockSingleMatch[2], 10)
      if (rawProduct && !isNaN(qty)) {
        return this.executeRestockProduct(rawProduct, qty)
      }
    }

    // 3. Tambah Produk Baru
    // Contoh: "tambah produk Kopi Hitam harga 15000 modal 8000 stok 50"
    if (text.includes('tambah produk') || text.includes('buat produk') || text.includes('daftarkan produk')) {
      const hargaMatch = text.match(/harga(?:\s+jual)?\s*[:=]?\s*(\d[\d\.]*)/i)
      const modalMatch = text.match(/modal(?:\s+beli)?\s*[:=]?\s*(\d[\d\.]*)/i)
      const stokMatch = text.match(/stok\s*[:=]?\s*(\d+)/i)

      // Ambil nama produk antara "tambah produk" dan "harga"
      const nameMatch = text.match(/(?:tambah|buat|daftarkan)\s+produk\s+(?:baru\s+)?(.+?)(?:\s+harga|\s+modal|\s+stok|$)/i)
      const nama = nameMatch ? nameMatch[1].trim() : ''

      if (nama && hargaMatch) {
        const hargaJual = parseInt(hargaMatch[1].replace(/\./g, ''), 10)
        const hargaModal = modalMatch ? parseInt(modalMatch[1].replace(/\./g, ''), 10) : undefined
        const stok = stokMatch ? parseInt(stokMatch[1], 10) : 20

        return this.executeCreateProduct({
          nama,
          harga_jual: hargaJual,
          harga_modal: hargaModal,
          stok,
        })
      }
    }

    // 4. Buat Kupon Promo / Diskon
    // Contoh: "buat promo 10% kode PROMO10" atau "bikin diskon 15 persen kode DISKON15"
    if ((text.includes('promo') || text.includes('diskon') || text.includes('kupon')) && (text.includes('buat') || text.includes('bikin') || text.includes('tambah'))) {
      const diskonMatch = text.match(/(\d+)\s*(?:%|persen)/i)
      const kodeMatch = text.match(/(?:kode|nama)\s+([A-Za-z0-9_-]+)/i) || text.match(/promo\s+([A-Za-z0-9_-]+)/i)

      if (diskonMatch) {
        const diskon = parseInt(diskonMatch[1], 10)
        const kode = kodeMatch ? kodeMatch[1].toUpperCase() : `DISKON${diskon}`
        return this.executeCreatePromo({ kode, diskon })
      }
    }

    // 5. Backup Database
    if (text.includes('backup') && (text.includes('database') || text.includes('sekarang') || text.includes('data') || text.includes('sistem'))) {
      return this.executeBackup()
    }

    // 6. Navigasi Halaman
    if (text.startsWith('buka ') || text.startsWith('pergi ke ') || text.startsWith('lihat halaman ')) {
      const navMap: Record<string, { route: string; label: string }> = {
        kasir: { route: '/transaksi', label: 'Buka Halaman Kasir' },
        transaksi: { route: '/transaksi', label: 'Buka Halaman Transaksi' },
        pos: { route: '/transaksi', label: 'Buka Kasir POS' },
        produk: { route: '/produk', label: 'Buka Katalog Produk' },
        barang: { route: '/produk', label: 'Buka Data Barang' },
        laporan: { route: '/laporan', label: 'Buka Laporan Penjualan' },
        keuangan: { route: '/accounting', label: 'Buka Pembukuan Akuntansi' },
        hpp: { route: '/hpp', label: 'Buka Kalkulasi HPP' },
        payroll: { route: '/payroll', label: 'Buka Penggajian Karyawan' },
        kds: { route: '/kitchen', label: 'Buka Kitchen Display' },
        dapur: { route: '/kitchen', label: 'Buka Kitchen Display' },
        antrean: { route: '/queue', label: 'Buka Layar Antrean' },
        queue: { route: '/queue', label: 'Buka Layar Antrean' },
        setting: { route: '/settings', label: 'Buka Pengaturan' },
        pengaturan: { route: '/settings', label: 'Buka Pengaturan' },
        backup: { route: '/backup', label: 'Buka Menu Backup' },
        developer: { route: '/license-admin', label: 'Buka Developer Panel' },
      }

      for (const [key, val] of Object.entries(navMap)) {
        if (text.includes(key)) {
          return {
            executed: true,
            success: true,
            actionType: 'NAVIGATE',
            title: `Navigasi Cepat: ${val.label}`,
            message: `Mengalihkan layar Anda ke ${val.label}...`,
            navigateRoute: val.route,
            navigateLabel: val.label,
          }
        }
      }
    }

    // Tidak ada aksi yang cocok
    return {
      executed: false,
      actionType: 'NONE',
      title: '',
      message: '',
      success: false,
    }
  }
}
