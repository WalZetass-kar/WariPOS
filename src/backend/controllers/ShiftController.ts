import { sqlite } from '../../database/connection.js'

function ensureTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_number TEXT NOT NULL,
      user_id TEXT NOT NULL,
      start_time TEXT DEFAULT CURRENT_TIMESTAMP,
      end_time TEXT,
      opening_balance REAL DEFAULT 0,
      closing_balance REAL DEFAULT 0,
      expected_balance REAL DEFAULT 0,
      difference REAL DEFAULT 0,
      total_sales REAL DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'OPEN'
    )
  `)
}

export class ShiftController {
  static open(data: any) {
    ensureTable()
    const userId = String(data.user_id ?? '').trim()
    if (!userId) return { success: false, message: 'User shift wajib diisi' }
    const active = sqlite.prepare(`
      SELECT id FROM mediasoft_shifts 
      WHERE status = 'OPEN' 
        AND (
          user_id = ? 
          OR user_id IN (
            SELECT email FROM mediasoft_pengguna WHERE nama_pengguna = ?
            UNION
            SELECT nama_pengguna FROM mediasoft_pengguna WHERE email = ?
          )
          OR (LOWER(?) GLOB '*mi*al*' AND LOWER(user_id) GLOB '*mi*al*')
        )
      LIMIT 1
    `).get(userId, userId, userId, userId)
    if (active) return { success: false, message: 'Masih ada shift aktif untuk user ini' }
    const shiftNumber = `SHIFT${Date.now()}`
    const result = sqlite.prepare('INSERT INTO mediasoft_shifts (shift_number, user_id, start_time, opening_balance) VALUES (?, ?, CURRENT_TIMESTAMP, ?)').run(shiftNumber, userId, data.opening_balance)
    
    try {
      const openDrawer = sqlite.prepare("SELECT kd_kas FROM mediasoft_kas_drawer WHERE username = ? AND status = 'OPEN' LIMIT 1").get(userId)
      if (!openDrawer) {
        sqlite.prepare(`
          INSERT INTO mediasoft_kas_drawer (kd_kas, tgl_buka, username, modal_awal, total_penjualan, total_pengeluaran, total_pemasukan, saldo_akhir, selisih, status, catatan)
          VALUES (?, CURRENT_TIMESTAMP, ?, ?, 0, 0, 0, 0, 0, 'OPEN', ?)
        `).run(`KAS-${shiftNumber}`, userId, Number(data.opening_balance || 0), `Otomatis sinkron dari Shift ${shiftNumber}`)
      }
    } catch (e: any) {
      console.warn('[ShiftController] Sync kas drawer open:', e.message)
    }

    return { success: true, data: { id: result.lastInsertRowid, shift_number: shiftNumber } }
  }

  static close(idOrData: any, maybeData?: any) {
    ensureTable()
    let id: number
    let data: any
    if (typeof idOrData === 'object' && idOrData !== null) {
      id = Number(idOrData.id)
      data = idOrData
    } else {
      id = Number(idOrData)
      data = maybeData || {}
    }
    const shift = sqlite.prepare('SELECT * FROM mediasoft_shifts WHERE id = ?').get(id) as any
    if (!shift) return { success: false, message: 'Shift tidak ditemukan' }
    if (shift.status !== 'OPEN') return { success: false, message: 'Shift sudah ditutup' }

    // Hitung rincian penjualan: tunai vs non-tunai (bersih dari kembalian)
    const sales = sqlite.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN LOWER(jenis_pembayaran) LIKE '%tunai%' THEN (yang_dibayar - kembalian) ELSE 0 END), 0) as total_tunai,
        COALESCE(SUM(CASE WHEN LOWER(jenis_pembayaran) NOT LIKE '%tunai%' THEN (yang_dibayar - kembalian) ELSE 0 END), 0) as total_nontunai,
        COALESCE(SUM(yang_dibayar - kembalian), 0) as total_sales
      FROM mediasoft_penjualan 
      WHERE shift_id = ?
    `).get(id) as any

    // Ambil mutasi kas masuk dan kas keluar dari laci kas
    const drawer = sqlite.prepare(`
      SELECT total_pemasukan, total_pengeluaran 
      FROM mediasoft_kas_drawer 
      WHERE (kd_kas = ? OR (username = ? AND status = 'OPEN'))
      ORDER BY tgl_buka DESC LIMIT 1
    `).get(`KAS-${shift.shift_number}`, shift.user_id) as any

    const totalTunai = Number(sales?.total_tunai || 0)
    const totalNonTunai = Number(sales?.total_nontunai || 0)
    const totalSales = Number(sales?.total_sales || 0)
    const totalTransactions = Number(sales?.count || 0)
    const totalPemasukan = Number(drawer?.total_pemasukan || 0)
    const totalPengeluaran = Number(drawer?.total_pengeluaran || 0)

    // Uang fisik yang seharusnya ada di laci: Modal Awal + Tunai + Kas Masuk - Kas Keluar
    const expected = Number(shift.opening_balance ?? 0) + totalTunai + totalPemasukan - totalPengeluaran
    const closingBalance = Number(data.closing_balance || 0)
    const difference = closingBalance - expected
    
    sqlite.prepare(`
      UPDATE mediasoft_shifts 
      SET end_time = CURRENT_TIMESTAMP, 
          closing_balance = ?, 
          expected_balance = ?, 
          difference = ?, 
          total_sales = ?, 
          total_transactions = ?, 
          notes = ?, 
          status = 'CLOSED' 
      WHERE id = ?
    `).run(closingBalance, expected, difference, totalSales, totalTransactions, data.notes || '', id)

    try {
      sqlite.prepare(`
        UPDATE mediasoft_kas_drawer
        SET tgl_tutup = CURRENT_TIMESTAMP,
            saldo_akhir = ?,
            selisih = ?,
            status = 'CLOSED',
            catatan = COALESCE(catatan, '') || ' (Ditutup bersamaan dengan Shift)'
        WHERE (kd_kas = ? OR (username = ? AND status = 'OPEN'))
      `).run(closingBalance, difference, `KAS-${shift.shift_number}`, shift.user_id)
    } catch (e: any) {
      console.warn('[ShiftController] Sync kas drawer close:', e.message)
    }

    return { 
      success: true, 
      data: { 
        difference, 
        expected, 
        total_tunai: totalTunai, 
        total_nontunai: totalNonTunai, 
        total_sales: totalSales, 
        total_pemasukan: totalPemasukan, 
        total_pengeluaran: totalPengeluaran 
      } 
    }
  }

  static getCurrent(userId: string | number) {
    ensureTable()
    const strUserId = String(userId ?? '').trim()
    if (!strUserId) return { success: true, data: null }
    const shift = sqlite.prepare(`
      SELECT * FROM mediasoft_shifts 
      WHERE status = 'OPEN' 
        AND (
          user_id = ? 
          OR user_id IN (
            SELECT email FROM mediasoft_pengguna WHERE nama_pengguna = ?
            UNION
            SELECT nama_pengguna FROM mediasoft_pengguna WHERE email = ?
          )
          OR (LOWER(?) GLOB '*mi*al*' AND LOWER(user_id) GLOB '*mi*al*')
        )
      ORDER BY start_time DESC LIMIT 1
    `).get(strUserId, strUserId, strUserId, strUserId) as any

    if (!shift) return { success: true, data: null }

    const sales = sqlite.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN LOWER(jenis_pembayaran) LIKE '%tunai%' THEN (yang_dibayar - kembalian) ELSE 0 END), 0) as total_tunai,
        COALESCE(SUM(CASE WHEN LOWER(jenis_pembayaran) NOT LIKE '%tunai%' THEN (yang_dibayar - kembalian) ELSE 0 END), 0) as total_nontunai,
        COALESCE(SUM(yang_dibayar - kembalian), 0) as total_sales
      FROM mediasoft_penjualan 
      WHERE shift_id = ?
    `).get(shift.id) as any

    const drawer = sqlite.prepare(`
      SELECT total_pemasukan, total_pengeluaran 
      FROM mediasoft_kas_drawer 
      WHERE (kd_kas = ? OR (username = ? AND status = 'OPEN'))
      ORDER BY tgl_buka DESC LIMIT 1
    `).get(`KAS-${shift.shift_number}`, shift.user_id) as any

    const totalTunai = Number(sales?.total_tunai || 0)
    const totalNonTunai = Number(sales?.total_nontunai || 0)
    const totalSales = Number(sales?.total_sales || 0)
    const totalTransactions = Number(sales?.count || 0)
    const totalPemasukan = Number(drawer?.total_pemasukan || 0)
    const totalPengeluaran = Number(drawer?.total_pengeluaran || 0)
    const expectedCash = Number(shift.opening_balance || 0) + totalTunai + totalPemasukan - totalPengeluaran

    return { 
      success: true, 
      data: {
        ...shift,
        total_tunai: totalTunai,
        total_nontunai: totalNonTunai,
        total_sales: totalSales,
        total_transactions: totalTransactions,
        total_pemasukan: totalPemasukan,
        total_pengeluaran: totalPengeluaran,
        expected_cash: expectedCash,
      } 
    }
  }

  static getAll() {
    ensureTable()
    const data = sqlite.prepare('SELECT s.*, u.nama_lengkap FROM mediasoft_shifts s LEFT JOIN mediasoft_pengguna u ON s.user_id = u.nama_pengguna ORDER BY s.start_time DESC').all()
    return { success: true, data }
  }
  
  static delete(id: number) {
    ensureTable()
    try {
      const shift = sqlite.prepare('SELECT status FROM mediasoft_shifts WHERE id = ?').get(id) as any
      if (!shift) {
        return { success: false, message: 'Shift tidak ditemukan' }
      }
      if (shift.status === 'OPEN') {
        return { success: false, message: 'Tidak dapat menghapus shift yang masih terbuka' }
      }

      const runDelete = sqlite.transaction(() => {
        // Lepas referensi shift_id di penjualan agar tidak memicu foreign key constraint failed
        sqlite.prepare('UPDATE mediasoft_penjualan SET shift_id = NULL WHERE shift_id = ?').run(id)
        sqlite.prepare('DELETE FROM mediasoft_shifts WHERE id = ?').run(id)
      })

      runDelete()
      return { success: true, message: 'Riwayat shift berhasil dihapus' }
    } catch (err) {
      console.error('[ShiftController.delete] Error:', err)
      return { success: false, message: String(err) }
    }
  }
}
