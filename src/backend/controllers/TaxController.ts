import { sqlite } from '../../database/connection.js'

function initTable() {
  try {
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_tax_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rate REAL NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    const existing = sqlite.prepare('SELECT COUNT(*) as count FROM mediasoft_tax_settings').get() as any
    if (existing?.count === 0) {
      sqlite.prepare('INSERT INTO mediasoft_tax_settings (name, rate, is_active) VALUES (?, ?, ?)').run('PPN 10%', 10, 1)
    }
  } catch (e) {
    console.error('Failed to init tax table:', e)
  }
}
initTable()

export class TaxController {
  private static validateRate(rate: unknown) {
    const value = Number(rate)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return null
    }
    return value
  }

  static getActiveRate(): number {
    const identitas = sqlite.prepare('SELECT pajak_persen FROM mediasoft_identitas LIMIT 1').get() as { pajak_persen?: number | null } | undefined
    if (identitas && typeof identitas.pajak_persen === 'number') {
      return Math.max(0, Math.min(100, identitas.pajak_persen))
    }
    const active = sqlite.prepare('SELECT rate FROM mediasoft_tax_settings WHERE is_active = 1 LIMIT 1').get() as { rate?: number } | undefined
    if (active && typeof active.rate === 'number') {
      return Math.max(0, Math.min(100, active.rate))
    }
    return 0
  }

  static getActive() {
    return sqlite.prepare('SELECT * FROM mediasoft_tax_settings WHERE is_active = 1').get()
  }

  static getAll() {
    const data = sqlite.prepare('SELECT * FROM mediasoft_tax_settings ORDER BY name').all()
    return { success: true, data }
  }

  static setActiveRate(rate: number) {
    const val = Math.max(0, Math.min(100, Number(rate) || 0))
    try {
      sqlite.transaction(() => {
        const existing = sqlite.prepare('SELECT id FROM mediasoft_tax_settings WHERE is_active = 1 LIMIT 1').get() as { id: number } | undefined
        if (existing) {
          sqlite.prepare('UPDATE mediasoft_tax_settings SET rate = ?, name = ? WHERE id = ?').run(val, `PPN ${val}%`, existing.id)
        } else {
          sqlite.prepare('INSERT INTO mediasoft_tax_settings (name, rate, is_active) VALUES (?, ?, 1)').run(`PPN ${val}%`, val)
        }
        try {
          sqlite.prepare('UPDATE mediasoft_identitas SET pajak_persen = ?').run(val)
        } catch { /* ignore if column/table absent */ }
      })()
      return { success: true, message: 'Tarif PPN berhasil diperbarui', data: { rate: val } }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static setActive(id: number) {
    try {
      const run = sqlite.transaction(() => {
        const tax = sqlite.prepare('SELECT id FROM mediasoft_tax_settings WHERE id = ?').get(id)
        if (!tax) throw new Error('Pajak tidak ditemukan')
        sqlite.prepare('UPDATE mediasoft_tax_settings SET is_active = 0').run()
        sqlite.prepare('UPDATE mediasoft_tax_settings SET is_active = 1 WHERE id = ?').run(id)
      })
      run()
      return { success: true }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static create(data: any) {
    const rate = this.validateRate(data.rate)
    if (rate === null) return { success: false, message: 'Persentase pajak harus 0-100' }
    const name = String(data.name || '').trim()
    if (!name) return { success: false, message: 'Nama pajak wajib diisi' }
    const result = sqlite.prepare('INSERT INTO mediasoft_tax_settings (name, rate) VALUES (?, ?)').run(name, rate)
    return { success: true, data: { id: result.lastInsertRowid } }
  }

  static update(id: number, data: any) {
    const rate = this.validateRate(data.rate)
    if (rate === null) return { success: false, message: 'Persentase pajak harus 0-100' }
    const name = String(data.name || '').trim()
    if (!name) return { success: false, message: 'Nama pajak wajib diisi' }
    const result = sqlite.prepare('UPDATE mediasoft_tax_settings SET name = ?, rate = ? WHERE id = ?').run(name, rate, id)
    if (result.changes === 0) return { success: false, message: 'Pajak tidak ditemukan' }
    return { success: true }
  }

  static delete(id: number) {
    const tax = sqlite.prepare('SELECT is_active FROM mediasoft_tax_settings WHERE id = ?').get(id) as any
    if (!tax) return { success: false, message: 'Pajak tidak ditemukan' }

    sqlite.prepare('DELETE FROM mediasoft_tax_settings WHERE id = ?').run(id)

    if (tax.is_active === 1) {
      const next = sqlite.prepare('SELECT id FROM mediasoft_tax_settings LIMIT 1').get() as any
      if (next) sqlite.prepare('UPDATE mediasoft_tax_settings SET is_active = 1 WHERE id = ?').run(next.id)
    }

    return { success: true }
  }
}
