import { db, sqlite } from '../../database/connection.js'
import { penjualan, penjualanDetail, barang, customer, kasDrawer, pembelian, pembelianDetail, supplier } from '../../database/schema.js'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

function salesStartDate(date: string) {
  const d = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10)
  return `${d} 00:00:00`
}

function salesEndDate(date: string) {
  const d = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10)
  return `${d} 23:59:59`
}

export class LaporanController {
  // Laporan Penjualan
  static getLaporanPenjualan(startDate: string, endDate: string) {
    try {
      const startDay = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const endDay = String(endDate || startDay).slice(0, 10)

      const result = sqlite.prepare(`
        SELECT p.kd_tansaksi_jual, p.tgl_wkt_transaksi, p.username_transaksi,
               COALESCE(p.total_qty, 0) AS total_qty,
               COALESCE(p.sub_total, 0) AS sub_total,
               COALESCE(p.discount_amount, 0) AS discount_amount,
               COALESCE(p.pajak, 0) AS pajak,
               COALESCE(p.yang_dibayar, 0) AS yang_dibayar,
               COALESCE(p.jenis_pembayaran, 'TUNAI') AS jenis_pembayaran,
               c.nama_customer
        FROM mediasoft_penjualan p
        LEFT JOIN mediasoft_customer c ON p.kd_customer = c.kd_customer
        WHERE date(substr(replace(p.tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
        ORDER BY p.tgl_wkt_transaksi DESC
      `).all(startDay, endDay) as any[]

      const returnSummary = sqlite.prepare(`
        SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
        FROM mediasoft_returns
        WHERE status = 'APPROVED'
          AND date(substr(replace(created_at, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as { count?: number; total?: number } | undefined

      const summary = {
        total_transaksi: result.length,
        total_qty: result.reduce((sum, r) => sum + (Number(r.total_qty) || 0), 0),
        total_penjualan: result.reduce((sum, r) => sum + (Number(r.sub_total) || 0) - (Number(r.discount_amount) || 0), 0),
        total_pajak: result.reduce((sum, r) => sum + (Number(r.pajak) || 0), 0),
        total_return: returnSummary?.total ?? 0,
        transaksi_return: returnSummary?.count ?? 0,
        total_bersih: result.reduce((sum, r) => sum + (Number(r.sub_total) || 0) - (Number(r.discount_amount) || 0), 0) - (returnSummary?.total ?? 0),
      }

      return { success: true, data: { transaksi: result, summary } }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Laporan Laba Rugi
  static getLaporanLabaRugi(startDate: string, endDate: string) {
    try {
      const startDay = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const endDay = String(endDate || startDay).slice(0, 10)

      const transaksi = sqlite.prepare(`
        SELECT p.kd_tansaksi_jual, p.tgl_wkt_transaksi, COALESCE(p.discount_amount, 0) AS discount_amount
        FROM mediasoft_penjualan p
        WHERE date(substr(replace(p.tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
      `).all(startDay, endDay) as any[]

      let total_penjualan = 0
      let total_modal = 0

      for (const t of transaksi) {
        const details = sqlite.prepare(`
          SELECT qty, harga_jual, harga_modal, disc
          FROM mediasoft_penjualan_detail
          WHERE kd_tansaksi_jual = ?
        `).all(t.kd_tansaksi_jual) as any[]

        for (const d of details) {
          const disc_amount = ((Number(d.harga_jual) || 0) * (Number(d.disc) || 0)) / 100
          total_penjualan += (Number(d.qty) || 0) * ((Number(d.harga_jual) || 0) - disc_amount)
          total_modal += (Number(d.qty) || 0) * (Number(d.harga_modal) || 0)
        }

        if (t.discount_amount) total_penjualan -= Number(t.discount_amount)
      }

      const returnSummary = sqlite.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM mediasoft_returns
        WHERE status = 'APPROVED'
          AND date(substr(replace(created_at, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as { total?: number } | undefined

      total_penjualan -= returnSummary?.total ?? 0

      const laba_kotor = total_penjualan - total_modal
      const margin_persen = total_penjualan > 0 ? (laba_kotor / total_penjualan) * 100 : 0

      return {
        success: true,
        data: {
          total_transaksi: transaksi.length,
          total_penjualan,
          total_return: returnSummary?.total ?? 0,
          total_modal,
          laba_kotor,
          margin_persen: Math.round(margin_persen * 100) / 100,
        },
      }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Laporan Produk Terlaris
  static getLaporanProdukTerlaris(startDate: string, endDate: string, limit: number = 10) {
    try {
      const startDay = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const endDay = String(endDate || startDay).slice(0, 10)

      const rows = sqlite.prepare(`
        SELECT d.kd_barang, COALESCE(b.nama_barang, d.kd_barang) AS nama_barang,
               SUM(COALESCE(d.qty, 0)) AS total_qty,
               SUM(COALESCE(d.total_harga_jual, 0)) AS total_penjualan
        FROM mediasoft_penjualan_detail d
        JOIN mediasoft_penjualan p ON d.kd_tansaksi_jual = p.kd_tansaksi_jual
        LEFT JOIN mediasoft_barang b ON d.kd_barang = b.kd_barang
        WHERE date(substr(replace(p.tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
        GROUP BY d.kd_barang
        ORDER BY total_qty DESC
        LIMIT ?
      `).all(startDay, endDay, limit) as any[]

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Laporan Stok Barang
  static getLaporanStok() {
    try {
      const result = db
        .select({
          kd_barang: barang.kd_barang,
          nama_barang: barang.nama_barang,
          stok: barang.stok,
          stok_minimum: barang.stok_minimum,
        })
        .from(barang)
        .orderBy(barang.stok)
        .all()

      const stokMenipis = result.filter((b) => (b.stok || 0) <= (b.stok_minimum || 0))
      const stokAman = result.filter((b) => (b.stok || 0) > (b.stok_minimum || 0))

      return {
        success: true,
        data: {
          all: result,
          stok_menipis: stokMenipis,
          stok_aman: stokAman,
        },
      }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Laporan Kas
  static getLaporanKas(startDate: string, endDate: string) {
    try {
      const result = db
        .select()
        .from(kasDrawer)
        .where(and(gte(kasDrawer.tgl_buka, startDate), lte(kasDrawer.tgl_buka, endDate)))
        .orderBy(desc(kasDrawer.tgl_buka))
        .all()

      const summary = {
        total_kas: result.length,
        total_modal_awal: result.reduce((sum, k) => sum + (k.modal_awal || 0), 0),
        total_penjualan: result.reduce((sum, k) => sum + (k.total_penjualan || 0), 0),
        total_pengeluaran: result.reduce((sum, k) => sum + (k.total_pengeluaran || 0), 0),
        total_selisih: result.reduce((sum, k) => sum + (k.selisih || 0), 0),
      }

      return { success: true, data: { kas: result, summary } }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Laporan Customer
  static getLaporanCustomer() {
    try {
      const result = db
        .select()
        .from(customer)
        .orderBy(desc(customer.total_belanja))
        .all()

      const summary = {
        total_customer: result.length,
        customer_aktif: result.filter((c) => c.status === 'Aktif').length,
        total_poin: result.reduce((sum, c) => sum + (c.poin || 0), 0),
        total_belanja: result.reduce((sum, c) => sum + (c.total_belanja || 0), 0),
      }

      return { success: true, data: { customers: result, summary } }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Laporan Pembelian
  static getLaporanPembelian(startDate: string, endDate: string) {
    try {
      const result = db
        .select({
          kd_pembelian: pembelian.kd_pembelian,
          tgl_pembelian: pembelian.tgl_pembelian,
          kd_suplier: pembelian.kd_suplier,
          nama_suplier: supplier.nama_suplier,
          total_qty: pembelian.total_qty,
          sub_total: pembelian.sub_total,
          yang_dibayar: pembelian.yang_dibayar,
          sisa_hutang: pembelian.sisa_hutang,
          status: pembelian.status,
          username: pembelian.username,
        })
        .from(pembelian)
        .leftJoin(supplier, eq(pembelian.kd_suplier, supplier.kd_suplier))
        .where(and(gte(pembelian.tgl_pembelian, startDate), lte(pembelian.tgl_pembelian, endDate)))
        .orderBy(desc(pembelian.tgl_pembelian))
        .all()

      const summary = {
        total_po: result.length,
        total_qty: result.reduce((sum, r) => sum + (r.total_qty || 0), 0),
        total_pembelian: result.reduce((sum, r) => sum + (r.sub_total || 0), 0),
        total_dibayar: result.reduce((sum, r) => sum + (r.yang_dibayar || 0), 0),
        total_hutang: result.reduce((sum, r) => sum + (r.sisa_hutang || 0), 0),
        lunas: result.filter(r => r.status === 'LUNAS').length,
        belum_lunas: result.filter(r => r.status !== 'LUNAS').length,
      }

      return { success: true, data: { pembelian: result, summary } }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan pembelian: ' + (error as Error).message }
    }
  }
}
