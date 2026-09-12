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
    const active = sqlite.prepare('SELECT id FROM mediasoft_shifts WHERE user_id = ? AND status = ? LIMIT 1').get(userId, 'OPEN')
    if (active) return { success: false, message: 'Masih ada shift aktif untuk user ini' }
    const shiftNumber = `SHIFT${Date.now()}`
    const result = sqlite.prepare('INSERT INTO mediasoft_shifts (shift_number, user_id, start_time, opening_balance) VALUES (?, ?, CURRENT_TIMESTAMP, ?)').run(shiftNumber, userId, data.opening_balance)
    return { success: true, data: { id: result.lastInsertRowid, shift_number: shiftNumber } }
  }

  static close(id: number, data: any) {
    ensureTable()
    const shift = sqlite.prepare('SELECT * FROM mediasoft_shifts WHERE id = ?').get(id) as any
    if (!shift) return { success: false, message: 'Shift tidak ditemukan' }
    if (shift.status !== 'OPEN') return { success: false, message: 'Shift sudah ditutup' }
    const sales = sqlite.prepare('SELECT COUNT(*) as count, COALESCE(SUM(yang_dibayar), 0) as total FROM mediasoft_penjualan WHERE shift_id = ?').get(id) as any
    const expected = Number(shift.opening_balance ?? 0) + Number(sales.total ?? 0)
    const difference = data.closing_balance - expected
    
    sqlite.prepare('UPDATE mediasoft_shifts SET end_time = CURRENT_TIMESTAMP, closing_balance = ?, expected_balance = ?, difference = ?, total_sales = ?, total_transactions = ?, notes = ?, status = ? WHERE id = ?').run(data.closing_balance, expected, difference, sales.total, sales.count, data.notes, 'CLOSED', id)
    return { success: true, data: { difference } }
  }

  static getCurrent(userId: string | number) {
    ensureTable()
    const data = sqlite.prepare('SELECT * FROM mediasoft_shifts WHERE user_id = ? AND status = ? ORDER BY start_time DESC LIMIT 1').get(userId, 'OPEN')
    return { success: true, data }
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
