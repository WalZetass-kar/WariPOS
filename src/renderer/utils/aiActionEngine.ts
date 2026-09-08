import { api } from './api'
import type { Barang } from '../../shared/types'

export interface AiActionResult {
  executed: boolean
  actionType: 'RESTOCK' | 'RESTOCK_ALL' | 'CREATE_PRODUCT' | 'UPDATE_PRICE' | 'CREATE_PROMO' | 'BACKUP' | 'NAVIGATE' | 'NAVIGATE_LIST' | 'NONE'
  title: string
  message: string
  details?: Array<{ label: string; value: string }>
  navigateRoute?: string
  navigateLabel?: string
  success: boolean
  availableTabs?: Array<{ route: string; label: string; group: string }>
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

export interface NavDestination {
  route: string
  label: string
  group: string
  keywords: string[]
}

export const ALL_APP_TABS: NavDestination[] = [
  // Utama
  {
    route: '/',
    label: 'Dashboard Utama',
    group: 'Utama',
    keywords: ['dashboard utama', 'dashboard', 'beranda', 'home', 'halaman utama', 'ringkasan toko', 'menu utama'],
  },
  {
    route: '/assistant',
    label: 'Asisten AI',
    group: 'Utama',
    keywords: ['asisten ai', 'asisten', 'ai', 'bot', 'chat ai', 'konsultasi ai'],
  },
  {
    route: '/transaksi',
    label: 'Kasir POS',
    group: 'Utama',
    keywords: ['kasir pos', 'kasir', 'pos', 'transaksi', 'penjualan', 'jual', 'order', 'bayar', 'pesanan', 'point of sale'],
  },
  {
    route: '/shifts',
    label: 'Shift Kasir',
    group: 'Utama',
    keywords: ['shift kasir', 'shift', 'tutup shift', 'buka shift', 'ganti shift', 'rekap shift', 'jam kerja kasir'],
  },
  {
    route: '/riwayat',
    label: 'Riwayat Transaksi',
    group: 'Utama',
    keywords: ['riwayat transaksi', 'riwayat', 'history', 'struk lama', 'daftar transaksi', 'nota lama', 'rekam transaksi'],
  },
  {
    route: '/customer-display-page',
    label: 'Display & Antrian Pelanggan',
    group: 'Utama',
    keywords: ['display dan antrian', 'display antrian', 'antrian', 'antrean', 'nomor antrian', 'layar antrian', 'panggil antrian'],
  },
  {
    route: '/daily-notes',
    label: 'Catatan Harian',
    group: 'Utama',
    keywords: ['catatan harian', 'daily notes', 'memo', 'buku catatan', 'catatan toko'],
  },
  {
    route: '/queue-display',
    label: 'Layar TV Antrean Publik',
    group: 'Utama',
    keywords: ['queue display', 'tv antrean', 'layar tv antrian', 'layar antrean publik', 'tv display'],
  },
  {
    route: '/customer-display',
    label: 'Layar Hadap Pelanggan',
    group: 'Utama',
    keywords: ['customer display', 'layar hadap pelanggan', 'layar kedua', 'dual monitor'],
  },

  // Inventaris & Stok
  {
    route: '/produk',
    label: 'Katalog Produk & Stok',
    group: 'Inventaris & Stok',
    keywords: ['katalog produk', 'produk', 'barang', 'daftar barang', 'inventori', 'inventory', 'stok barang', 'item'],
  },
  {
    route: '/kategori',
    label: 'Kategori Produk',
    group: 'Inventaris & Stok',
    keywords: ['kategori produk', 'kategori barang', 'kategori', 'kelompok barang', 'golongan barang'],
  },
  {
    route: '/satuan',
    label: 'Satuan Unit',
    group: 'Inventaris & Stok',
    keywords: ['satuan unit', 'satuan barang', 'satuan', 'unit barang', 'unit', 'pcs'],
  },
  {
    route: '/pembelian',
    label: 'Pembelian Stok & Kulakan',
    group: 'Inventaris & Stok',
    keywords: ['pembelian stok', 'pembelian', 'kulakan', 'beli stok', 'purchase', 'po', 'order supplier', 'faktur beli'],
  },
  {
    route: '/stock-opname',
    label: 'Stok Opname Fisik',
    group: 'Inventaris & Stok',
    keywords: ['stock opname', 'stok opname', 'opname', 'audit stok', 'cek fisik stok', 'penyesuaian stok'],
  },
  {
    route: '/branch',
    label: 'Cabang & Transfer Stok',
    group: 'Inventaris & Stok',
    keywords: ['cabang dan transfer', 'transfer stok', 'cabang', 'multi cabang', 'outlet', 'toko cabang', 'kirim cabang'],
  },
  {
    route: '/price-list',
    label: 'Daftar Harga Produk',
    group: 'Inventaris & Stok',
    keywords: ['daftar harga', 'price list', 'pricelist', 'tabel harga', 'harga jual'],
  },
  {
    route: '/stock-history',
    label: 'Kartu Mutasi & Riwayat Stok',
    group: 'Inventaris & Stok',
    keywords: ['riwayat stok', 'mutasi stok', 'kartu stok', 'stock history', 'keluar masuk barang'],
  },
  {
    route: '/label-print',
    label: 'Cetak Label & Barcode',
    group: 'Inventaris & Stok',
    keywords: ['cetak label', 'print barcode', 'cetak barcode', 'barcode barang', 'label harga', 'label barcode'],
  },

  // Keuangan & Laporan
  {
    route: '/laporan',
    label: 'Laporan Penjualan & Keuangan',
    group: 'Keuangan & Laporan',
    keywords: ['laporan keuangan', 'laporan penjualan', 'laporan omzet', 'laporan', 'omzet', 'omset', 'laba rugi', 'profit', 'keuangan toko'],
  },
  {
    route: '/kas',
    label: 'Arus Kas & Petty Cash',
    group: 'Keuangan & Laporan',
    keywords: ['arus kas', 'petty cash', 'kas kecil', 'kas toko', 'uang kas', 'buku kas', 'kas masuk', 'kas keluar', 'kas'],
  },
  {
    route: '/debts',
    label: 'Manajemen Hutang & Piutang',
    group: 'Keuangan & Laporan',
    keywords: ['hutang piutang', 'hutang', 'piutang', 'debts', 'kasbon', 'bon', 'tempo', 'tagihan pelanggan'],
  },
  {
    route: '/accounting',
    label: 'Buku Akuntansi & Jurnal',
    group: 'Keuangan & Laporan',
    keywords: ['buku akuntansi', 'akuntansi', 'accounting', 'jurnal', 'buku besar', 'neraca', 'pembukuan'],
  },
  {
    route: '/returns',
    label: 'Retur Barang',
    group: 'Keuangan & Laporan',
    keywords: ['retur barang', 'retur', 'pengembalian barang', 'refund', 'kembalikan produk'],
  },
  {
    route: '/payment',
    label: 'Status Lisensi & Langganan',
    group: 'Keuangan & Laporan',
    keywords: ['status langganan', 'langganan', 'lisensi', 'paket lisensi', 'subscription', 'billing', 'tagihan lisensi', 'masa aktif'],
  },
  {
    route: '/promo',
    label: 'Promo & Voucher Diskon',
    group: 'Keuangan & Laporan',
    keywords: ['promo dan diskon', 'promo', 'diskon', 'voucher', 'kupon', 'promosi', 'potongan harga'],
  },
  {
    route: '/tax-report',
    label: 'Laporan Pajak & PPN',
    group: 'Keuangan & Laporan',
    keywords: ['laporan pajak', 'pajak', 'ppn', 'tax report', 'pajak penjualan'],
  },
  {
    route: '/cash-flow',
    label: 'Laporan Cash Flow',
    group: 'Keuangan & Laporan',
    keywords: ['cash flow', 'cashflow', 'aliran kas', 'laporan kas flow'],
  },
  {
    route: '/bank-account',
    label: 'Rekening Bank Toko',
    group: 'Keuangan & Laporan',
    keywords: ['rekening bank', 'akun bank', 'rekening toko', 'bank account', 'nomor rekening'],
  },
  {
    route: '/fixed-asset',
    label: 'Manajemen Aset Tetap',
    group: 'Keuangan & Laporan',
    keywords: ['aset tetap', 'fixed asset', 'aset toko', 'inventaris toko', 'penyusutan aset', 'asset'],
  },
  {
    route: '/budget',
    label: 'Anggaran & Budgeting',
    group: 'Keuangan & Laporan',
    keywords: ['anggaran dan budget', 'anggaran', 'budgeting', 'rencana biaya', 'budget'],
  },

  // Relasi & Member
  {
    route: '/customer',
    label: 'Data Pelanggan & Member',
    group: 'Relasi & Member',
    keywords: ['data pelanggan', 'pelanggan', 'customer', 'member', 'konsumen', 'poin member', 'crm'],
  },
  {
    route: '/supplier',
    label: 'Pemasok & Supplier',
    group: 'Relasi & Member',
    keywords: ['data supplier', 'supplier', 'pemasok', 'distributor', 'vendor', 'agen barang'],
  },
  {
    route: '/sales-commission',
    label: 'Komisi Sales',
    group: 'Relasi & Member',
    keywords: ['komisi sales', 'sales commission', 'komisi', 'bonus sales', 'insentif sales'],
  },
  {
    route: '/membership-card',
    label: 'Cetak Kartu Member',
    group: 'Relasi & Member',
    keywords: ['kartu member', 'cetak member', 'membership card', 'kartu pelanggan'],
  },
  {
    route: '/supplier-rating',
    label: 'Penilaian Supplier',
    group: 'Relasi & Member',
    keywords: ['rating supplier', 'penilaian supplier', 'evaluasi supplier', 'supplier rating'],
  },
  {
    route: '/customer-feedback',
    label: 'Ulasan & Feedback Pelanggan',
    group: 'Relasi & Member',
    keywords: ['feedback pelanggan', 'ulasan pelanggan', 'feedback', 'ulasan', 'rating toko', 'kepuasan pelanggan'],
  },

  // SDM & Karyawan
  {
    route: '/employee',
    label: 'Data Karyawan & Staf',
    group: 'SDM & Karyawan',
    keywords: ['data karyawan', 'karyawan', 'pegawai', 'staf', 'staff', 'employee', 'sdm'],
  },
  {
    route: '/employee-contract',
    label: 'Kontrak Kerja Karyawan',
    group: 'SDM & Karyawan',
    keywords: ['kontrak karyawan', 'kontrak kerja', 'kontrak pegawai', 'pkwt', 'surat kontrak'],
  },
  {
    route: '/attendance',
    label: 'Absensi & Kehadiran',
    group: 'SDM & Karyawan',
    keywords: ['absensi karyawan', 'absensi', 'kehadiran', 'presensi', 'jam kerja', 'absen'],
  },
  {
    route: '/payroll',
    label: 'Penggajian Karyawan (Payroll)',
    group: 'SDM & Karyawan',
    keywords: ['penggajian karyawan', 'payroll karyawan', 'payroll', 'gaji', 'slip gaji', 'upah kerja'],
  },
  {
    route: '/tip-pooling',
    label: 'Tip Pooling Karyawan',
    group: 'SDM & Karyawan',
    keywords: ['tip pooling', 'bagi tip', 'uang tip', 'distribusi tip', 'tip'],
  },
  {
    route: '/shift-schedule',
    label: 'Jadwal Shift Kerja',
    group: 'SDM & Karyawan',
    keywords: ['jadwal shift', 'jadwal kerja', 'roster karyawan', 'shift schedule'],
  },

  // Operasional & F&B
  {
    route: '/kitchen-display',
    label: 'Kitchen Display (KDS)',
    group: 'Operasional & F&B',
    keywords: ['kitchen display', 'kds', 'layar dapur', 'dapur', 'pesanan dapur', 'kitchen'],
  },
  {
    route: '/table-management',
    label: 'Manajemen Meja & Denah',
    group: 'Operasional & F&B',
    keywords: ['manajemen meja', 'denah meja', 'meja restoran', 'tata letak meja', 'meja', 'table management', 'table'],
  },
  {
    route: '/reservation',
    label: 'Reservasi Meja',
    group: 'Operasional & F&B',
    keywords: ['reservasi meja', 'reservasi', 'booking meja', 'pesan meja', 'reservation'],
  },
  {
    route: '/recipe',
    label: 'Resep & Bahan Baku',
    group: 'Operasional & F&B',
    keywords: ['resep bahan baku', 'resep produk', 'resep', 'bahan baku', 'recipe', 'komposisi', 'formula bom'],
  },
  {
    route: '/delivery',
    label: 'Kurir & Pengiriman',
    group: 'Operasional & F&B',
    keywords: ['kurir dan pengiriman', 'kurir', 'pengiriman', 'delivery', 'ongkir', 'antar pesanan', 'ekspedisi'],
  },

  // Alat, Pemasaran & Sistem
  {
    route: '/whatsapp',
    label: 'WhatsApp Notifikasi',
    group: 'Alat & Sistem',
    keywords: ['whatsapp notifikasi', 'whatsapp', 'wa gateway', 'kirim wa', 'pesan wa', 'notifikasi wa', 'wa'],
  },
  {
    route: '/hpp',
    label: 'Kalkulator HPP',
    group: 'Alat & Sistem',
    keywords: ['kalkulator hpp', 'hpp', 'harga pokok', 'hitung hpp', 'margin profit', 'modal barang'],
  },
  {
    route: '/tutorials',
    label: 'Tutorial & Panduan',
    group: 'Alat & Sistem',
    keywords: ['tutorial dan panduan', 'tutorial', 'panduan', 'buku panduan', 'help', 'bantuan penggunaan'],
  },
  {
    route: '/users',
    label: 'Kelola Pengguna & Kasir',
    group: 'Alat & Sistem',
    keywords: ['kelola pengguna', 'manajemen pengguna', 'users', 'user', 'pengguna', 'tambah kasir', 'hak akses kasir', 'akun kasir'],
  },
  {
    route: '/backup',
    label: 'Backup Database',
    group: 'Alat & Sistem',
    keywords: ['backup database', 'cadangan database', 'backup', 'restore database', 'ekspor database', 'impor database', 'cadangan data'],
  },
  {
    route: '/security',
    label: 'Log Keamanan Sistem',
    group: 'Alat & Sistem',
    keywords: ['log keamanan', 'security log', 'keamanan sistem', 'riwayat login', 'security', 'keamanan'],
  },
  {
    route: '/audit-trail',
    label: 'Jejak Audit (Audit Trail)',
    group: 'Alat & Sistem',
    keywords: ['audit trail', 'jejak audit', 'audit sistem', 'riwayat aktivitas', 'log aktivitas', 'audit'],
  },
  {
    route: '/license-admin',
    label: 'Developer & License Panel',
    group: 'Alat & Sistem',
    keywords: ['developer panel', 'license admin', 'developer', 'panel pengembang', 'lisensi admin', 'pusat lisensi'],
  },
  {
    route: '/settings',
    label: 'Pengaturan Sistem & Toko',
    group: 'Alat & Sistem',
    keywords: ['pengaturan sistem', 'pengaturan toko', 'settings', 'setting', 'pengaturan', 'konfigurasi', 'printer', 'struk belanja', 'identitas toko', 'profil toko'],
  },
  {
    route: '/campaign',
    label: 'Kampanye Pemasaran (Campaign)',
    group: 'Alat & Sistem',
    keywords: ['kampanye pemasaran', 'campaign', 'kampanye', 'promosi blast', 'broadcast promo', 'pemasaran'],
  },
  {
    route: '/storefront',
    label: 'Katalog Toko Online (Storefront)',
    group: 'Alat & Sistem',
    keywords: ['toko online', 'storefront', 'website toko', 'web katalog', 'online store'],
  },
  {
    route: '/print-queue',
    label: 'Antrean Cetak Printer',
    group: 'Alat & Sistem',
    keywords: ['antrean cetak', 'print queue', 'antrian cetak', 'antrean printer', 'antrian printer'],
  },
  {
    route: '/integrations',
    label: 'Integrasi Marketplace & API',
    group: 'Alat & Sistem',
    keywords: ['integrasi marketplace', 'integrasi api', 'integrasi', 'marketplace', 'ecommerce api', 'channel penjualan'],
  },
]

function findBestNavMatch(promptText: string): NavDestination | null {
  const text = cleanStr(promptText)

  const isNavIntent =
    text.includes('buka') ||
    text.includes('pergi ke') ||
    text.includes('masuk ke') ||
    text.includes('menuju') ||
    text.includes('arahin') ||
    text.includes('tampilkan') ||
    text.includes('lihat') ||
    text.startsWith('ke ') ||
    text.startsWith('tab ') ||
    text.startsWith('menu ') ||
    text.startsWith('halaman ') ||
    text.startsWith('layar ')

  if (!isNavIntent) return null

  // Strip prefixes to isolate query target
  const targetQuery = text
    .replace(/^(tolong|coba|bisa|mohon)\s+/i, '')
    .replace(/^(buka|pergi ke|masuk ke|menuju ke|arahin ke|tampilkan|lihat|pindah ke|ganti ke)\s+/i, '')
    .replace(/^(tab|menu|halaman|layar)\s+/i, '')
    .replace(/^(buka|ke)\s+/i, '')
    .trim()

  let bestMatch: NavDestination | null = null
  let maxScore = 0

  for (const tab of ALL_APP_TABS) {
    for (const kw of tab.keywords) {
      if (targetQuery === kw) {
        return tab
      }
      if (targetQuery.includes(kw) || text.includes(kw)) {
        const score = kw.length
        if (score > maxScore) {
          maxScore = score
          bestMatch = tab
        }
      }
    }
  }

  return bestMatch
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

    // 6. Tampilkan Daftar Seluruh Tab (Katalog Navigasi)
    if (
      text.includes('seluruh tab') ||
      text.includes('semua tab') ||
      text.includes('daftar tab') ||
      text.includes('daftar menu') ||
      text.includes('menu apa') ||
      text.includes('tab apa') ||
      text.includes('bisa buka apa') ||
      text.includes('buka seluruh') ||
      text.includes('buka semua') ||
      text.includes('semua menu') ||
      text === 'tab' ||
      text === 'menu'
    ) {
      return {
        executed: true,
        success: true,
        actionType: 'NAVIGATE_LIST',
        title: 'Katalog Navigasi: Seluruh Tab WariPOS',
        message: 'Asisten AI dapat membuka seluruh tab aplikasi WariPOS secara langsung. Silakan klik salah satu tab di bawah atau ketik perintah buka [nama tab].',
        availableTabs: ALL_APP_TABS.map(t => ({ route: t.route, label: t.label, group: t.group })),
        details: [
          { label: 'Total Tab Tersedia', value: `${ALL_APP_TABS.length} Halaman Menu` },
          { label: 'Modul Utama', value: 'Dashboard, Kasir POS, Shift, Riwayat, Antrian, Display' },
          { label: 'Modul Inventaris', value: 'Produk, Kategori, Satuan, Pembelian, Stok Opname, Cabang' },
          { label: 'Modul Keuangan', value: 'Laporan, Kas, Hutang/Piutang, Akuntansi, Retur, Pajak' },
          { label: 'Modul SDM & F&B', value: 'Karyawan, Absensi, Payroll, KDS Dapur, Meja, Resep' },
        ],
        navigateRoute: '/transaksi',
        navigateLabel: 'Buka Kasir POS',
      }
    }

    // 7. Navigasi Cepat ke Tab Tertentu
    const navMatch = findBestNavMatch(promptText)
    if (navMatch) {
      return {
        executed: true,
        success: true,
        actionType: 'NAVIGATE',
        title: `Navigasi: ${navMatch.label}`,
        message: `Membuka halaman ${navMatch.label} (${navMatch.group})...`,
        navigateRoute: navMatch.route,
        navigateLabel: `Buka ${navMatch.label}`,
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
