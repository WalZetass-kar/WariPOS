import { db } from '../../database/connection.js'
import { penjualan, penjualanDetail, barang } from '../../database/schema.js'
import { and, desc, eq, gte, sql } from 'drizzle-orm'

export class PenjualanModel {
  static getAll() {
    return db.select().from(penjualan).orderBy(desc(penjualan.tgl_wkt_transaksi)).all()
  }

  static getDetail(kd: string) {
    const header = db.select().from(penjualan).where(eq(penjualan.kd_tansaksi_jual, kd)).get()
    const details = db
      .select({
        kd_trans_jual_detail: penjualanDetail.kd_trans_jual_detail,
        kd_barang: penjualanDetail.kd_barang,
        nama_barang: barang.nama_barang,
        harga_jual: penjualanDetail.harga_jual,
        qty: penjualanDetail.qty,
        disc: penjualanDetail.disc,
        total_harga_jual: penjualanDetail.total_harga_jual,
      })
      .from(penjualanDetail)
      .leftJoin(barang, eq(penjualanDetail.kd_barang, barang.kd_barang))
      .where(eq(penjualanDetail.kd_tansaksi_jual, kd))
      .all()
    return { header, details }
  }

  static create(header: typeof penjualan.$inferInsert, details: (typeof penjualanDetail.$inferInsert)[]) {
    db.insert(penjualan).values(header).run()
    for (const d of details) {
      if (!d.kd_barang || !Number.isInteger(Number(d.qty)) || Number(d.qty) <= 0) {
        throw new Error(`Qty transaksi tidak valid untuk barang ${d.kd_barang ?? '-'}`)
      }
      db.insert(penjualanDetail).values(d).run()
      if (d.kd_barang && d.qty) {
        // SECURITY: Use atomic UPDATE to prevent race conditions in stock levels
        const result = db.update(barang)
          .set({ stok: sql`${barang.stok} - ${d.qty}` })
          .where(and(eq(barang.kd_barang, d.kd_barang), gte(barang.stok, d.qty)))
          .run()

        if (result.changes === 0) {
          throw new Error(`Stok tidak mencukupi untuk barang ${d.kd_barang} atau barang tidak ditemukan`)
        }
      }
    }
  }
}
