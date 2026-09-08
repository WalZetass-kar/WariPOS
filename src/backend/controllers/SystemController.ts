import { sqlite } from '../../database/connection.js'
import { requireAuth } from '../utils/authGuard.js'
import { BackupController } from './BackupController.js'
import { demoSession } from '../services/demoSessionManager.js'

const ADMIN_ROLES = ['developer', 'super_admin', 'admin']

export class SystemController {
  /**
   * Reset all data (transactions, products, customers, etc.)
   * Keeps users and identitas
   */
  static async resetData(username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    const role = demoSession.getRole()
    if (!role || !ADMIN_ROLES.includes(role)) {
      return { success: false, message: 'Akses ditolak. Hanya admin yang dapat mereset data.' }
    }

    try {
      // Auto backup before reset
      const backupFile = BackupController.autoBackup('reset_data')
      if (!backupFile) {
        return { success: false, message: 'Gagal membuat backup sebelum reset. Operasi dibatalkan untuk keamanan data.' }
      }

      // Start transaction
      sqlite.exec('BEGIN TRANSACTION')

      // Delete all transactional data
      const tables = [
        'mediasoft_penjualan_detail',
        'mediasoft_penjualan',
        'mediasoft_pembelian_detail',
        'mediasoft_pembelian',
        'mediasoft_harga',
        'mediasoft_barang',
        'mediasoft_kategori_barang',
        'mediasoft_satuan',
        'mediasoft_customer',
        'mediasoft_supplier',
        'mediasoft_kas_transaksi',
        'mediasoft_kas_drawer',
        'mediasoft_notifikasi',
        'mediasoft_backup',
        'mediasoft_activity_log',
        'mediasoft_product_images',
        'mediasoft_daily_notes',
        'mediasoft_petty_cash',
        'mediasoft_notification_settings',
        'mediasoft_stock_history',
      ]

      for (const table of tables) {
        sqlite.prepare(`DELETE FROM ${table}`).run()
      }

      // Reset auto-increment counters
      sqlite.prepare('DELETE FROM sqlite_sequence WHERE name LIKE "mediasoft_%"').run()

      // Commit transaction
      sqlite.exec('COMMIT')

      return { success: true, message: 'Semua data berhasil direset' }
    } catch (error) {
      sqlite.exec('ROLLBACK')
      return { success: false, message: String(error) }
    }
  }

  /**
   * Check database connection
   */
  static checkDb() {
    try {
      const result = sqlite.prepare('SELECT 1 as test').get()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  /**
   * Seed rich sample data for instant demonstration and onboarding
   */
  static async seedSampleData() {
    try {
      sqlite.exec('BEGIN TRANSACTION')

      // 1. Categories
      const categories = [
        { id: 1, name: 'Minuman Kopi' },
        { id: 2, name: 'Minuman Non-Kopi' },
        { id: 3, name: 'Makanan & Snack' },
        { id: 4, name: 'Bahan Baku' },
        { id: 5, name: 'Retail & Sembako' },
      ]
      const insertCat = sqlite.prepare(`
        INSERT OR IGNORE INTO mediasoft_kategori_barang (kd_kategori_barang, kategori_barang)
        VALUES (?, ?)
      `)
      for (const c of categories) {
        insertCat.run(c.id, c.name)
      }

      // 2. Units (Satuan)
      const units = [
        { id: 1, name: 'Pcs' },
        { id: 2, name: 'Cup' },
        { id: 3, name: 'Porsi' },
        { id: 4, name: 'Botol' },
        { id: 5, name: 'Kg' },
        { id: 6, name: 'Liter' },
      ]
      const insertUnit = sqlite.prepare(`
        INSERT OR IGNORE INTO mediasoft_satuan (kd_satuan, nama_satuan)
        VALUES (?, ?)
      `)
      for (const u of units) {
        insertUnit.run(u.id, u.name)
      }

      // 3. Products & Pricing
      const sampleProducts = [
        { kd: 'BRG-001', nama: 'Kopi Susu Gula Aren', cat: 1, unit: 2, harga_modal: 8000, harga_jual: 18000, stok: 120, barcode: '899100100101', min_stok: 10 },
        { kd: 'BRG-002', nama: 'Espresso Double Shot', cat: 1, unit: 2, harga_modal: 6000, harga_jual: 15000, stok: 95, barcode: '899100100102', min_stok: 10 },
        { kd: 'BRG-003', nama: 'Caramel Macchiato', cat: 1, unit: 2, harga_modal: 10000, harga_jual: 24000, stok: 80, barcode: '899100100103', min_stok: 8 },
        { kd: 'BRG-004', nama: 'Americano Iced', cat: 1, unit: 2, harga_modal: 5000, harga_jual: 16000, stok: 150, barcode: '899100100104', min_stok: 15 },
        { kd: 'BRG-005', nama: 'Matcha Latte Premium', cat: 2, unit: 2, harga_modal: 9000, harga_jual: 22000, stok: 75, barcode: '899100100105', min_stok: 8 },
        { kd: 'BRG-006', nama: 'Earl Grey Milk Tea', cat: 2, unit: 2, harga_modal: 8500, harga_jual: 20000, stok: 90, barcode: '899100100106', min_stok: 10 },
        { kd: 'BRG-007', nama: 'Croissant Butter Cokelat', cat: 3, unit: 1, harga_modal: 12000, harga_jual: 25000, stok: 40, barcode: '899100100107', min_stok: 5 },
        { kd: 'BRG-008', nama: 'Nasi Goreng Spesial Telur', cat: 3, unit: 3, harga_modal: 14000, harga_jual: 28000, stok: 60, barcode: '899100100108', min_stok: 5 },
        { kd: 'BRG-009', nama: 'French Fries Cheese', cat: 3, unit: 3, harga_modal: 8000, harga_jual: 18000, stok: 50, barcode: '899100100109', min_stok: 8 },
        { kd: 'BRG-010', nama: 'Air Mineral 600ml', cat: 2, unit: 4, harga_modal: 2500, harga_jual: 5000, stok: 200, barcode: '899100100110', min_stok: 24 },
        { kd: 'RAW-001', nama: 'Biji Kopi Arabika 1kg', cat: 4, unit: 5, harga_modal: 140000, harga_jual: 180000, stok: 25, barcode: '899200100101', min_stok: 5 },
        { kd: 'RAW-002', nama: 'Susu Fresh Milk 1L', cat: 4, unit: 6, harga_modal: 16000, harga_jual: 22000, stok: 60, barcode: '899200100102', min_stok: 10 },
        { kd: 'RAW-003', nama: 'Gula Aren Cair 1L', cat: 4, unit: 6, harga_modal: 25000, harga_jual: 35000, stok: 30, barcode: '899200100103', min_stok: 5 },
        { kd: 'RET-001', nama: 'Minyak Goreng Pouch 2L', cat: 5, unit: 4, harga_modal: 31000, harga_jual: 36000, stok: 45, barcode: '899300100101', min_stok: 10 },
        { kd: 'RET-002', nama: 'Beras Pandan Wangi 5kg', cat: 5, unit: 1, harga_modal: 68000, harga_jual: 78000, stok: 35, barcode: '899300100102', min_stok: 8 },
      ]

      const insertBarang = sqlite.prepare(`
        INSERT OR REPLACE INTO mediasoft_barang (kd_barang, nama_barang, kd_kategori_barang, kd_satuan, stok, stok_minimum, barcode, jenis_transaksi)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'INCOME')
      `)
      const insertHarga = sqlite.prepare(`
        INSERT OR REPLACE INTO mediasoft_harga (kd_barang, harga_modal, harga_barang, potongan)
        VALUES (?, ?, ?, 0)
      `)

      for (const p of sampleProducts) {
        insertBarang.run(p.kd, p.nama, p.cat, p.unit, p.stok, p.min_stok, p.barcode)
        insertHarga.run(p.kd, p.harga_modal, p.harga_jual)
      }

      // 4. Recipes (BOM)
      sqlite.prepare(`
        INSERT OR REPLACE INTO mediasoft_recipes (id, kd_barang, nama_resep, hasil_produksi, satuan_hasil, biaya_produksi, harga_jual, margin, kategori, is_active, created_at)
        VALUES (1, 'BRG-001', 'Resep Kopi Susu Gula Aren Standar', 1, 'Cup', 6500, 18000, 63.8, 'MINUMAN', 1, datetime('now'))
      `).run()

      sqlite.prepare(`DELETE FROM mediasoft_recipe_ingredients WHERE recipe_id = 1`).run()
      sqlite.prepare(`
        INSERT INTO mediasoft_recipe_ingredients (recipe_id, kd_barang, nama_bahan, qty, satuan, harga_per_unit, sub_total)
        VALUES 
          (1, 'RAW-001', 'Biji Kopi Arabika', 0.02, 'Kg', 140000, 2800),
          (1, 'RAW-002', 'Susu Fresh Milk', 0.15, 'Liter', 16000, 2400),
          (1, 'RAW-003', 'Gula Aren Cair', 0.03, 'Liter', 25000, 750)
      `).run()

      // 5. Floor Layouts & Restaurant Tables
      sqlite.prepare(`
        INSERT OR REPLACE INTO mediasoft_floor_layouts (id, nama, kapasitas, width, height, is_active, created_at)
        VALUES 
          (1, 'Lantai 1 - Utama (AC)', 40, 800, 600, 1, datetime('now')),
          (2, 'Lantai 2 - Rooftop Outdoor', 30, 800, 600, 1, datetime('now'))
      `).run()

      const tables = [
        { id: 1, layout: 1, no: 'Meja 01', label: 'Meja 1 (Depan Bar)', cap: 4, x: 50, y: 50, status: 'KOSONG' },
        { id: 2, layout: 1, no: 'Meja 02', label: 'Meja 2 (Jendela)', cap: 2, x: 150, y: 50, status: 'KOSONG' },
        { id: 3, layout: 1, no: 'Meja 03', label: 'Meja 3 (Tengah)', cap: 4, x: 250, y: 50, status: 'KOSONG' },
        { id: 4, layout: 1, no: 'Meja VIP 1', label: 'Ruang VIP 1', cap: 8, x: 400, y: 80, status: 'KOSONG' },
        { id: 5, layout: 2, no: 'Meja RT-01', label: 'Rooftop Meja 1', cap: 4, x: 100, y: 100, status: 'KOSONG' },
      ]
      const insertTable = sqlite.prepare(`
        INSERT OR REPLACE INTO mediasoft_tables (id, floor_layout_id, nomor_meja, label, kapasitas, posisi_x, posisi_y, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      for (const t of tables) {
        insertTable.run(t.id, t.layout, t.no, t.label, t.cap, t.x, t.y, t.status)
      }

      // 6. Customers & Loyalty
      const customers = [
        { kd: 'CUST-001', nama: 'Budi Santoso', telp: '081234567890', poin: 350, total: 3500000 },
        { kd: 'CUST-002', nama: 'Siti Rahmawati', telp: '081398765432', poin: 180, total: 1800000 },
        { kd: 'CUST-003', nama: 'Andi Pratama', telp: '085711223344', poin: 90, total: 900000 },
      ]
      const insertCust = sqlite.prepare(`
        INSERT OR REPLACE INTO mediasoft_customer (kd_customer, nama_customer, no_telp, poin, total_belanja, status)
        VALUES (?, ?, ?, ?, ?, 'Aktif')
      `)
      for (const c of customers) {
        insertCust.run(c.kd, c.nama, c.telp, c.poin, c.total)
      }

      // 7. Suppliers
      const suppliers = [
        { kd: 'SUP-001', nama: 'PT Kopi Nusantara Abadi', telp: '021-5551234', alamat: 'Jakarta Barat' },
        { kd: 'SUP-002', nama: 'CV Sumber Susu Segar', telp: '022-7778899', alamat: 'Bandung' },
        { kd: 'SUP-003', nama: 'Distributor Sembako Jaya', telp: '021-8889900', alamat: 'Tangerang' },
      ]
      const insertSup = sqlite.prepare(`
        INSERT OR REPLACE INTO mediasoft_supplier (kd_suplier, nama_suplier, no_telp_hp, alamat_suplier, status)
        VALUES (?, ?, ?, ?, 'Aktif')
      `)
      for (const s of suppliers) {
        insertSup.run(s.kd, s.nama, s.telp, s.alamat)
      }

      // 8. Past Sales (Transactions for 7 days history)
      const now = new Date()
      for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
        const txDate = new Date(now)
        txDate.setDate(txDate.getDate() - dayOffset)
        const dateStr = txDate.toISOString().split('T')[0]

        // 3 to 6 transactions per day
        const txCount = 4 + (dayOffset % 3)
        for (let i = 1; i <= txCount; i++) {
          const hours = String(9 + (i * 2) % 12).padStart(2, '0')
          const mins = String(10 + (i * 7) % 50).padStart(2, '0')
          const timeStr = `${dateStr} ${hours}:${mins}:00`
          const kdTx = `FJ-${dateStr.replace(/-/g, '')}-SMPL${dayOffset}${i}`
          
          const qty = 2 + (i % 2)
          const price = 18000
          const subtotal = qty * price
          const payType = i % 3 === 0 ? 'QRIS' : i % 3 === 1 ? 'TUNAI' : 'TRANSFER'

          sqlite.prepare(`
            INSERT OR REPLACE INTO mediasoft_penjualan (kd_tansaksi_jual, tgl_wkt_transaksi, username_transaksi, total_qty, sub_total, pajak, yang_dibayar, kembalian, jenis_pembayaran, kd_customer, discount_amount)
            VALUES (?, ?, 'admin', ?, ?, 0, ?, 0, ?, 'CUST-001', 0)
          `).run(kdTx, timeStr, qty, subtotal, subtotal, payType)

          sqlite.prepare(`
            INSERT OR REPLACE INTO mediasoft_penjualan_detail (kd_tansaksi_jual, kd_barang, harga_modal, harga_jual, qty, disc, harga_disc, total_harga_jual, nama_pengguna, tgl_waktu_input)
            VALUES (?, 'BRG-001', 8000, 18000, ?, 0, 0, ?, 'admin', ?)
          `).run(kdTx, qty, subtotal, timeStr)
        }
      }

      sqlite.exec('COMMIT')
      return { success: true, message: 'Data demo toko berhasil dimuat lengkap! (20+ produk, meja, customer, resep, dan riwayat penjualan)' }
    } catch (error) {
      sqlite.exec('ROLLBACK')
      return { success: false, message: `Gagal memuat data demo: ${String(error)}` }
    }
  }
}

