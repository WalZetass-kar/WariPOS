import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createTestDatabase, seedStore, type SeededStore } from './helpers/testDb'

const harness = createTestDatabase()

vi.mock('../src/database/connection.js', () => ({
  sqlite: harness.sqlite,
  db: harness.db,
  reopenDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}))

const { PenjualanController } = await import('../src/backend/controllers/PenjualanController')
const { demoSession } = await import('../src/backend/services/demoSessionManager')

let store: SeededStore

beforeAll(() => {
  store = seedStore(harness.sqlite)
})

afterAll(() => {
  harness.sqlite.close()
})

beforeEach(() => {
  demoSession.setSession(store.username, 'kasir')
  harness.sqlite.prepare(`UPDATE mediasoft_barang SET stok = ? WHERE kd_barang = ?`).run(store.initialStock, store.productCode)
  harness.sqlite.prepare(`DELETE FROM mediasoft_penjualan`).run()
  harness.sqlite.prepare(`DELETE FROM mediasoft_penjualan_detail`).run()
})

function cart(quantity = 2) {
  return {
    username: store.username,
    shift_id: store.shiftId,
    jenis_pembayaran: 'TUNAI',
    yang_dibayar: 100000,
    items: [
      {
        kd_barang: store.productCode,
        qty: quantity,
        harga_jual: store.unitPrice,
        disc: 0,
      },
    ],
  }
}

describe('PenjualanController.create', () => {
  it('rejects a transaction without an open shift', async () => {
    const result = await PenjualanController.create({ ...cart(), shift_id: undefined } as any)

    expect(result.success).toBe(false)
    expect((result as any).error_code).toBe('SHIFT_REQUIRED')
  })

  it('rejects an empty cart', async () => {
    const result = await PenjualanController.create({ ...cart(), items: [] } as any)

    expect(result.success).toBe(false)
    expect(result.message).toMatch(/Keranjang kosong/i)
  })

  it('rejects a transaction when the stock is not enough', async () => {
    const result = await PenjualanController.create(cart(999) as any)

    expect(result.success).toBe(false)
  })

  it('ignores the price sent by the client and uses the price from the database', async () => {
    const result = await PenjualanController.create({
      ...cart(2),
      items: [{ kd_barang: store.productCode, qty: 2, harga_jual: 1, disc: 0 }],
    } as any)

    expect(result.success).toBe(true)
    const header = harness.sqlite
      .prepare(`SELECT * FROM mediasoft_penjualan WHERE kd_tansaksi_jual = ?`)
      .get((result as any).kd_transaksi) as any
    expect(header.sub_total).toBe(36000)
    expect(header.total_qty).toBe(2)
  })

  it('writes the sale header, the detail, and takes the stock', async () => {
    const result = await PenjualanController.create(cart(3) as any)

    expect(result.success).toBe(true)

    const header = harness.sqlite
      .prepare(`SELECT * FROM mediasoft_penjualan WHERE kd_tansaksi_jual = ?`)
      .get((result as any).kd_transaksi) as any
    expect(header).toBeTruthy()
    expect(header.total_qty).toBe(3)
    expect(header.sub_total).toBe(54000)

    const details = harness.sqlite
      .prepare(`SELECT * FROM mediasoft_penjualan_detail WHERE kd_tansaksi_jual = ?`)
      .all((result as any).kd_transaksi) as any[]
    expect(details).toHaveLength(1)
    expect(details[0].harga_jual).toBe(store.unitPrice)
    expect(details[0].harga_modal).toBe(store.costPrice)

    const product = harness.sqlite
      .prepare(`SELECT stok FROM mediasoft_barang WHERE kd_barang = ?`)
      .get(store.productCode) as any
    expect(product.stok).toBe(store.initialStock - 3)
  })

  it('uses a transaction code that starts with FJ and the date', async () => {
    const result = await PenjualanController.create(cart(1) as any)

    expect((result as any).kd_transaksi).toMatch(/^FJ-\d{8}-/)
  })
})
