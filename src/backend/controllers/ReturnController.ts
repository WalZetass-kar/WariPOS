import { sqlite } from '../../database/connection.js'
import { withTransaction } from '../utils/transaction.js'
import { CustomerModel } from '../models/CustomerModel.js'
import { WhatsAppController } from './WhatsAppController.js'

interface ReturnItemInput {
  kd_barang?: string
  barang_id?: string
  quantity?: number
  price?: number
  subtotal?: number
  reason?: string
}

interface ReturnPayload {
  penjualan_id?: string
  customer_id?: string | null
  total_amount?: number
  refund_method?: string
  reason?: string
  created_by?: string
  items?: ReturnItemInput[]
}

interface NormalizedReturnItem {
  barang_id: string
  quantity: number
  price: number
  subtotal: number
  reason: string | null
}

function ensureColumn(table: string, name: string, definition: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some(col => col.name === name)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
  }
}

function ensureTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT NOT NULL UNIQUE,
      penjualan_id TEXT NOT NULL,
      customer_id TEXT,
      total_amount REAL DEFAULT 0,
      refund_method TEXT DEFAULT 'TUNAI',
      reason TEXT,
      status TEXT DEFAULT 'PENDING',
      created_by TEXT,
      approved_by TEXT,
      stock_applied INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      approved_at TEXT,
      rejected_at TEXT
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_return_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      barang_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      reason TEXT
    )
  `)

  ensureColumn('mediasoft_returns', 'penjualan_id', 'TEXT')
  ensureColumn('mediasoft_returns', 'stock_applied', 'INTEGER DEFAULT 0')
  ensureColumn('mediasoft_returns', 'approved_at', 'TEXT')
  ensureColumn('mediasoft_returns', 'rejected_at', 'TEXT')
}

ensureTables()

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getSale(penjualanId: string) {
  return sqlite.prepare('SELECT * FROM mediasoft_penjualan WHERE kd_tansaksi_jual = ?').get(penjualanId) as
    | { kd_tansaksi_jual: string; kd_customer?: string | null }
    | undefined
}

function getSoldItem(penjualanId: string, kdBarang: string) {
  return sqlite.prepare(`
    SELECT
      d.kd_barang,
      COALESCE(b.nama_barang, d.kd_barang) AS nama_barang,
      COALESCE(SUM(d.qty), 0) AS sold_qty,
      COALESCE(MAX(d.harga_jual), 0) AS price
    FROM mediasoft_penjualan_detail d
    LEFT JOIN mediasoft_barang b ON b.kd_barang = d.kd_barang
    WHERE d.kd_tansaksi_jual = ? AND d.kd_barang = ?
    GROUP BY d.kd_barang
  `).get(penjualanId, kdBarang) as
    | { kd_barang: string; nama_barang: string; sold_qty: number; price: number }
    | undefined
}

function getReturnedQty(penjualanId: string, kdBarang: string) {
  const row = sqlite.prepare(`
    SELECT COALESCE(SUM(rd.quantity), 0) AS qty
    FROM mediasoft_return_details rd
    JOIN mediasoft_returns r ON r.id = rd.return_id
    WHERE r.penjualan_id = ?
      AND rd.barang_id = ?
      AND r.status IN ('PENDING', 'APPROVED')
  `).get(penjualanId, kdBarang) as { qty?: number } | undefined
  return toNumber(row?.qty)
}

export class ReturnController {
  static async create(data: ReturnPayload) {
    ensureTables()

    const penjualanId = String(data.penjualan_id ?? '').trim()
    if (!penjualanId) return { success: false, message: 'Pilih transaksi asli terlebih dahulu' }

    const sale = getSale(penjualanId)
    if (!sale) return { success: false, message: 'Transaksi asli tidak ditemukan' }

    const requestedItems = Array.isArray(data.items)
      ? data.items
        .map(item => ({
          kd_barang: String(item.kd_barang ?? item.barang_id ?? '').trim(),
          quantity: Math.trunc(toNumber(item.quantity)),
          reason: String(item.reason ?? data.reason ?? '').trim(),
          price: toNumber(item.price),
          subtotal: toNumber(item.subtotal),
        }))
        .filter(item => item.kd_barang && item.quantity > 0)
      : []

    if (!requestedItems.length) return { success: false, message: 'Pilih minimal 1 item dari transaksi asli' }

    const normalizedItems: NormalizedReturnItem[] = []
    for (const item of requestedItems) {
      const sold = getSoldItem(penjualanId, item.kd_barang)
      if (!sold) return { success: false, message: `Item ${item.kd_barang} tidak ada di transaksi asli` }

      const alreadyReturned = getReturnedQty(penjualanId, item.kd_barang)
      const remaining = toNumber(sold.sold_qty) - alreadyReturned
      if (item.quantity > remaining) {
        return {
          success: false,
          message: `Qty return ${sold.nama_barang} melebihi sisa yang bisa diretur (${remaining})`,
        }
      }

      const price = item.price > 0 ? item.price : toNumber(sold.price)
      normalizedItems.push({
        barang_id: item.kd_barang,
        quantity: item.quantity,
        price,
        subtotal: item.subtotal > 0 ? item.subtotal : price * item.quantity,
        reason: item.reason || null,
      })
    }

    const returnNumber = `RET-${Date.now()}`
    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0)

    const result = await withTransaction(() => {
      const insert = sqlite.prepare(`
        INSERT INTO mediasoft_returns
          (return_number, penjualan_id, customer_id, total_amount, refund_method, reason, created_by, status, stock_applied, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?)
      `).run(
        returnNumber,
        penjualanId,
        data.customer_id ?? sale.kd_customer ?? null,
        data.total_amount ? toNumber(data.total_amount) : totalAmount,
        data.refund_method ?? 'TUNAI',
        data.reason ?? '',
        data.created_by ?? null,
        new Date().toISOString(),
      )

      const returnId = Number(insert.lastInsertRowid)
      const detailStmt = sqlite.prepare(`
        INSERT INTO mediasoft_return_details (return_id, barang_id, quantity, price, subtotal, reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const item of normalizedItems) {
        detailStmt.run(returnId, item.barang_id, item.quantity, item.price, item.subtotal, item.reason)
      }

      return { id: returnId, return_number: returnNumber }
    })

    if (!result.success) return { success: false, message: result.error }
    return { success: true, data: result.data, message: 'Return dibuat dan menunggu approval' }
  }

  static getAll() {
    ensureTables()
    const data = sqlite.prepare(`
      SELECT
        r.*,
        p.kd_tansaksi_jual AS nomor_transaksi,
        c.nama_customer AS customer_name,
        COALESCE(COUNT(rd.id), 0) AS item_count
      FROM mediasoft_returns r
      LEFT JOIN mediasoft_penjualan p ON r.penjualan_id = p.kd_tansaksi_jual
      LEFT JOIN mediasoft_customer c ON r.customer_id = c.kd_customer
      LEFT JOIN mediasoft_return_details rd ON rd.return_id = r.id
      GROUP BY r.id
      ORDER BY r.created_at DESC, r.id DESC
    `).all()
    return { success: true, data }
  }

  static getDetails(id: number) {
    ensureTables()
    const data = sqlite.prepare(`
      SELECT rd.*, b.nama_barang
      FROM mediasoft_return_details rd
      LEFT JOIN mediasoft_barang b ON b.kd_barang = rd.barang_id
      WHERE rd.return_id = ?
      ORDER BY rd.id ASC
    `).all(id)
    return { success: true, data }
  }

  static async approve(id: number, userId: string | number) {
    ensureTables()
    const ret = sqlite.prepare('SELECT * FROM mediasoft_returns WHERE id = ?').get(id) as
      | { id: number; status: string; stock_applied?: number; customer_id?: string | null; return_number: string; total_amount?: number; refund_method?: string }
      | undefined
    if (!ret) return { success: false, message: 'Return tidak ditemukan' }
    if (ret.status !== 'PENDING') return { success: false, message: 'Return sudah diproses' }

    const details = sqlite.prepare('SELECT * FROM mediasoft_return_details WHERE return_id = ?').all(id) as Array<{
      barang_id: string
      quantity: number
    }>

    const result = await withTransaction(() => {
      if (!ret.stock_applied) {
        for (const detail of details) {
          sqlite.prepare('UPDATE mediasoft_barang SET stok = COALESCE(stok, 0) + ? WHERE kd_barang = ?')
            .run(toNumber(detail.quantity), detail.barang_id)
        }
      }

      sqlite.prepare(`
        UPDATE mediasoft_returns
        SET status = 'APPROVED',
            approved_by = ?,
            stock_applied = 1,
            approved_at = ?
        WHERE id = ?
      `).run(String(userId), new Date().toISOString(), id)
    })

    if (!result.success) return { success: false, message: result.error }

    if (ret.customer_id) {
      const customer = CustomerModel.getById(ret.customer_id) as any
      void WhatsAppController.sendReturnNotification({
        phone: customer?.no_telp,
        customerName: customer?.nama_customer,
        returnNumber: ret.return_number,
        total: toNumber(ret.total_amount),
        refundMethod: ret.refund_method,
      }).then(sendResult => {
        if (sendResult.attempted && !sendResult.success) {
          console.warn('WhatsApp return notification failed:', sendResult.message)
        }
      }).catch(error => {
        console.warn('WhatsApp return notification skipped:', error)
      })
    }

    return { success: true, message: 'Return disetujui dan stok sudah dikembalikan' }
  }
  
  static reject(id: number, userId: string | number) {
    ensureTables()
    const ret = sqlite.prepare('SELECT status FROM mediasoft_returns WHERE id = ?').get(id) as { status?: string } | undefined
    if (!ret) return { success: false, message: 'Return tidak ditemukan' }
    if (ret.status !== 'PENDING') return { success: false, message: 'Return sudah diproses' }

    sqlite.prepare(`
      UPDATE mediasoft_returns
      SET status = 'REJECTED', approved_by = ?, rejected_at = ?
      WHERE id = ?
    `).run(String(userId), new Date().toISOString(), id)
    return { success: true, message: 'Return ditolak' }
  }
  
  static async delete(id: number) {
    ensureTables()
    const ret = sqlite.prepare('SELECT status FROM mediasoft_returns WHERE id = ?').get(id) as { status?: string } | undefined
    if (!ret) return { success: false, message: 'Return tidak ditemukan' }

    const details = sqlite.prepare('SELECT barang_id, quantity FROM mediasoft_return_details WHERE return_id = ?').all(id) as Array<{
      barang_id: string
      quantity: number
    }>

    const result = await withTransaction(() => {
      // If the return was approved, revert the added stock
      if (ret.status === 'APPROVED') {
        for (const detail of details) {
          sqlite.prepare('UPDATE mediasoft_barang SET stok = MAX(0, COALESCE(stok, 0) - ?) WHERE kd_barang = ?')
            .run(toNumber(detail.quantity), detail.barang_id)
        }
      }

      sqlite.prepare('DELETE FROM mediasoft_return_details WHERE return_id = ?').run(id)
      sqlite.prepare('DELETE FROM mediasoft_returns WHERE id = ?').run(id)
    })

    if (!result.success) return { success: false, message: result.error }
    return { success: true, message: ret.status === 'APPROVED' ? 'Return berhasil dihapus dan stok barang telah disesuaikan kembali' : 'Return berhasil dihapus' }
  }
}
