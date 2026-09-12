import { sqlite } from '../../database/connection.js'

export class StockOpnameController {
  static create(data: any) {
    const opnameNumber = `OPN${Date.now()}`
    try {
      const items = Array.isArray(data.items) ? data.items : []

      const save = sqlite.transaction(() => {
        const result = sqlite.prepare('INSERT INTO mediasoft_stock_opname (opname_number, opname_date, notes, created_by, status, total_items, total_difference) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          opnameNumber,
          data.opname_date,
          data.notes || null,
          data.created_by || null,
          'PENDING',
          0,
          0
        )
        const opnameId = Number(result.lastInsertRowid)
        let totalDiff = 0
        
        for (const item of items) {
          const barangId = String(item.barang_id || item.kd_barang || '').trim()
          const systemStock = Number(item.system_stock ?? item.stok_sistem ?? 0)
          const physicalStock = Number(item.physical_stock ?? item.stok_fisik ?? 0)
          if (!barangId || !Number.isFinite(systemStock) || !Number.isFinite(physicalStock) || physicalStock < 0) {
            throw new Error('Item opname tidak valid')
          }
          const product = sqlite.prepare('SELECT kd_barang FROM mediasoft_barang WHERE kd_barang = ? LIMIT 1').get(barangId)
          if (!product) throw new Error(`Barang ${barangId} tidak ditemukan`)

          const diff = physicalStock - systemStock
          totalDiff += Math.abs(diff)
          sqlite.prepare('INSERT INTO mediasoft_stock_opname_details (opname_id, barang_id, system_stock, physical_stock, difference, notes) VALUES (?, ?, ?, ?, ?, ?)').run(opnameId, barangId, systemStock, physicalStock, diff, item.notes || null)
        }
        
        if (items.length > 0) {
          sqlite.prepare('UPDATE mediasoft_stock_opname SET total_items = ?, total_difference = ? WHERE id = ?').run(items.length, totalDiff, opnameId)
        }
        return opnameId
      })

      const opnameId = save()
      return { success: true, data: { id: opnameId, opname_number: opnameNumber } }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static approve(id: number, userId: number) {
    try {
      const approve = sqlite.transaction(() => {
        const opname = sqlite.prepare('SELECT status FROM mediasoft_stock_opname WHERE id = ?').get(id) as any
        if (!opname) throw new Error('Opname tidak ditemukan')
        if (opname.status === 'APPROVED') throw new Error('Opname sudah disetujui')

        const details = sqlite.prepare('SELECT * FROM mediasoft_stock_opname_details WHERE opname_id = ?').all(id) as any[]
        if (!details.length) throw new Error('Detail opname kosong')
        
        for (const detail of details) {
          const physicalStock = Number(detail.physical_stock)
          if (!Number.isFinite(physicalStock) || physicalStock < 0) throw new Error('Stok fisik opname tidak valid')
          const result = sqlite.prepare('UPDATE mediasoft_barang SET stok = ? WHERE kd_barang = ?').run(physicalStock, detail.barang_id)
          if (result.changes === 0) throw new Error(`Barang ${detail.barang_id} tidak ditemukan`)
        }
        
        sqlite.prepare('UPDATE mediasoft_stock_opname SET status = ?, approved_by = ? WHERE id = ?').run('APPROVED', userId, id)
      })

      approve()
      return { success: true }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static getAll() {
    const data = sqlite.prepare('SELECT so.*, u.nama_lengkap as created_by_name FROM mediasoft_stock_opname so LEFT JOIN mediasoft_pengguna u ON so.created_by = u.nama_pengguna ORDER BY so.opname_date DESC').all()
    return { success: true, data }
  }

  static getDetails(id: number) {
    return sqlite.prepare('SELECT sod.*, b.nama_barang FROM mediasoft_stock_opname_details sod LEFT JOIN mediasoft_barang b ON sod.barang_id = b.kd_barang WHERE sod.opname_id = ?').all(id)
  }
  
  static delete(id: number) {
    const opname = sqlite.prepare('SELECT status FROM mediasoft_stock_opname WHERE id = ?').get(id) as any
    if (!opname) {
      return { success: false, error: 'Opname tidak ditemukan' }
    }
    if (opname.status === 'APPROVED') {
      return { success: false, error: 'Tidak dapat menghapus opname yang sudah diapprove' }
    }
    
    sqlite.prepare('DELETE FROM mediasoft_stock_opname_details WHERE opname_id = ?').run(id)
    sqlite.prepare('DELETE FROM mediasoft_stock_opname WHERE id = ?').run(id)
    
    return { success: true }
  }
  
  static addItem(data: any) {
    try {
      const add = sqlite.transaction(() => {
        const opname = sqlite.prepare('SELECT status FROM mediasoft_stock_opname WHERE id = ?').get(data.opname_id) as any
        if (!opname) throw new Error('Opname tidak ditemukan')
        if (opname.status === 'APPROVED') throw new Error('Tidak bisa menambah item pada opname yang sudah disetujui')

        const systemStock = Number(data.stok_sistem)
        const physicalStock = Number(data.stok_fisik)
        if (!data.kd_barang || !Number.isFinite(systemStock) || !Number.isFinite(physicalStock) || physicalStock < 0) {
          throw new Error('Item opname tidak valid')
        }
        const diff = physicalStock - systemStock
        sqlite.prepare('INSERT INTO mediasoft_stock_opname_details (opname_id, barang_id, system_stock, physical_stock, difference) VALUES (?, ?, ?, ?, ?)').run(data.opname_id, data.kd_barang, systemStock, physicalStock, diff)
        
        const totals = sqlite.prepare('SELECT COUNT(*) as total_items, SUM(ABS(difference)) as total_diff FROM mediasoft_stock_opname_details WHERE opname_id = ?').get(data.opname_id) as any
        sqlite.prepare('UPDATE mediasoft_stock_opname SET total_items = ?, total_difference = ? WHERE id = ?').run(totals.total_items, totals.total_diff || 0, data.opname_id)
      })

      add()
      return { success: true }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }
  
  static getItems(opnameId: number) {
    const items = sqlite.prepare('SELECT sod.*, b.nama_barang FROM mediasoft_stock_opname_details sod LEFT JOIN mediasoft_barang b ON sod.barang_id = b.kd_barang WHERE sod.opname_id = ?').all(opnameId)
    return { success: true, data: items }
  }
}
