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

/**
 * DEFINISI METRIK (dipakai konsisten oleh laporan di UI, CSV, PDF, dan XLSX)
 *
 * omzet_kotor        = SUM(sub_total)  -> nilai item setelah diskon item, sebelum diskon invoice & pajak
 * diskon            = SUM(discount_amount) -> diskon level invoice/promo
 * penjualan_bersih  = omzet_kotor - diskon -> pendapatan barang/jasa, TANPA pajak
 * pajak             = SUM(pajak)
 * total_dibayar     = penjualan_bersih + pajak -> grand total yang harus dibayar pelanggan
 * retur             = SUM(total_amount) retur APPROVED pada periode retur
 * penjualan_setelah_retur = penjualan_bersih - retur
 * rata_rata         = penjualan_bersih / jumlah transaksi
 *
 * CATATAN: `yang_dibayar` pada tabel penjualan adalah uang yang diserahkan pembeli
 * (termasuk kembalian), BUKAN omzet. Nilai yang benar adalah yang_dibayar - kembalian.
 */
function asNumber(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Retur dan kas menyimpan timestamp ISO UTC (`...Z`), sementara penjualan
 * menyimpan waktu lokal. Ekspresi ini menormalkan semuanya ke tanggal lokal
 * agar batas periode tidak bergeser satu hari.
 */
function localDateExpression(column: string): string {
  return `date(CASE WHEN ${column} LIKE '%Z' THEN datetime(${column}, 'localtime') ELSE replace(substr(${column}, 1, 19), 'T', ' ') END)`
}

function returnDateExpression(alias = ''): string {
  return localDateExpression(alias ? `${alias}.created_at` : 'created_at')
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
               COALESCE(p.kembalian, 0) AS kembalian,
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
          AND ${returnDateExpression()} BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as { count?: number; total?: number } | undefined

      const totalReturQty = sqlite.prepare(`
        SELECT COALESCE(SUM(rd.quantity), 0) AS qty
        FROM mediasoft_return_details rd
        JOIN mediasoft_returns r ON r.id = rd.return_id
        WHERE r.status = 'APPROVED'
          AND ${returnDateExpression('r')} BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as { qty?: number } | undefined

      // Turunan per transaksi agar seluruh format memakai angka yang sama.
      const transaksi = result.map(row => {
        const omzetKotor = asNumber(row.sub_total)
        const diskon = asNumber(row.discount_amount)
        const pajak = asNumber(row.pajak)
        const penjualanBersih = omzetKotor - diskon
        const grandTotal = penjualanBersih + pajak
        const dibayar = Math.max(0, asNumber(row.yang_dibayar) - asNumber(row.kembalian))
        return {
          ...row,
          omzet_kotor: round2(omzetKotor),
          penjualan_bersih: round2(penjualanBersih),
          grand_total: round2(grandTotal),
          dibayar: round2(dibayar),
          kembalian: round2(asNumber(row.kembalian)),
          // Tidak ada kolom status pembatalan pada skema penjualan.
          // Status di sini diturunkan dari kecukupan pembayaran yang tercatat.
          status_pembayaran: dibayar + 0.01 >= grandTotal ? 'LUNAS' : 'KURANG BAYAR',
        }
      })

      const totalTransaksi = transaksi.length
      const omzetKotor = transaksi.reduce((sum, r) => sum + r.omzet_kotor, 0)
      const totalDiskon = transaksi.reduce((sum, r) => sum + asNumber(r.discount_amount), 0)
      const totalPajak = transaksi.reduce((sum, r) => sum + asNumber(r.pajak), 0)
      const penjualanBersih = round2(omzetKotor - totalDiskon)
      const totalDibayar = round2(penjualanBersih + totalPajak)
      const totalRetur = round2(returnSummary?.total ?? 0)
      const totalQty = transaksi.reduce((sum, r) => sum + asNumber(r.total_qty), 0)
      const returQty = asNumber(totalReturQty?.qty)

      const summary = {
        // field lama (dipertahankan untuk kompatibilitas UI)
        total_transaksi: totalTransaksi,
        total_qty: totalQty,
        total_penjualan: penjualanBersih,
        total_pajak: totalPajak,
        total_return: totalRetur,
        transaksi_return: returnSummary?.count ?? 0,
        total_bersih: round2(penjualanBersih - totalRetur),
        // field eksplisit
        omzet_kotor: round2(omzetKotor),
        total_diskon: round2(totalDiskon),
        penjualan_bersih: penjualanBersih,
        grand_total: totalDibayar,
        total_dibayar: totalDibayar,
        total_retur: totalRetur,
        penjualan_setelah_retur: round2(penjualanBersih - totalRetur),
        total_qty_retur: returQty,
        qty_bersih: totalQty - returQty,
        rata_rata_transaksi: totalTransaksi ? round2(penjualanBersih / totalTransaksi) : 0,
      }

      return { success: true, data: { transaksi, summary } }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Detail item per transaksi (untuk sheet Detail Item / CSV detail)
  static getLaporanDetailItem(startDate: string, endDate: string) {
    try {
      const startDay = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const endDay = String(endDate || startDay).slice(0, 10)

      const rows = sqlite.prepare(`
        SELECT d.kd_tansaksi_jual, p.tgl_wkt_transaksi, p.username_transaksi,
               d.kd_barang, COALESCE(b.nama_barang, d.kd_barang) AS nama_barang,
               COALESCE(d.qty, 0) AS qty,
               COALESCE(d.harga_jual, 0) AS harga_jual,
               COALESCE(d.disc, 0) AS disc_persen,
               COALESCE(d.harga_disc, 0) AS diskon_item,
               COALESCE(d.total_harga_jual, 0) AS total_harga_jual,
               COALESCE(d.harga_modal, 0) AS harga_modal
        FROM mediasoft_penjualan_detail d
        JOIN mediasoft_penjualan p ON p.kd_tansaksi_jual = d.kd_tansaksi_jual
        LEFT JOIN mediasoft_barang b ON b.kd_barang = d.kd_barang
        WHERE date(substr(replace(p.tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
        ORDER BY p.tgl_wkt_transaksi ASC, d.kd_tansaksi_jual ASC, d.kd_trans_jual_detail ASC
      `).all(startDay, endDay) as any[]

      const items = rows.map(row => ({
        ...row,
        qty: asNumber(row.qty),
        harga_jual: round2(asNumber(row.harga_jual)),
        harga_modal: round2(asNumber(row.harga_modal)),
        diskon_item: round2(asNumber(row.diskon_item)),
        total_harga_jual: round2(asNumber(row.total_harga_jual)),
      }))

      return { success: true, data: items }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil detail item: ' + (error as Error).message }
    }
  }

  // Laporan pembayaran per metode
  static getLaporanPembayaran(startDate: string, endDate: string) {
    try {
      const startDay = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const endDay = String(endDate || startDay).slice(0, 10)

      const rows = sqlite.prepare(`
        SELECT COALESCE(p.jenis_pembayaran, 'TUNAI') AS metode_pembayaran,
               COUNT(*) AS jumlah_transaksi,
               COALESCE(SUM(COALESCE(p.sub_total, 0) - COALESCE(p.discount_amount, 0)), 0) AS penjualan_bersih,
               COALESCE(SUM(COALESCE(p.pajak, 0)), 0) AS pajak,
               COALESCE(SUM(COALESCE(p.sub_total, 0) + COALESCE(p.pajak, 0) - COALESCE(p.discount_amount, 0)), 0) AS total_dibayar
        FROM mediasoft_penjualan p
        WHERE date(substr(replace(p.tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
        GROUP BY COALESCE(p.jenis_pembayaran, 'TUNAI')
        ORDER BY total_dibayar DESC
      `).all(startDay, endDay) as any[]

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan pembayaran: ' + (error as Error).message }
    }
  }

  // Laporan Laba Rugi
  static getLaporanLabaRugi(startDate: string, endDate: string) {
    try {
      const startDay = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const endDay = String(endDate || startDay).slice(0, 10)

      // Satu query agregat: menghindari duplikasi saat join header x detail.
      const totals = sqlite.prepare(`
        SELECT COUNT(DISTINCT p.kd_tansaksi_jual) AS total_transaksi,
               COALESCE(SUM(COALESCE(d.total_harga_jual, 0)), 0) AS total_penjualan,
               COALESCE(SUM(COALESCE(d.qty, 0) * COALESCE(d.harga_modal, 0)), 0) AS total_modal,
               COALESCE(SUM(COALESCE(d.qty, 0)), 0) AS total_qty
        FROM mediasoft_penjualan_detail d
        JOIN mediasoft_penjualan p ON p.kd_tansaksi_jual = d.kd_tansaksi_jual
        WHERE date(substr(replace(p.tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as any

      const discountRow = sqlite.prepare(`
        SELECT COALESCE(SUM(COALESCE(discount_amount, 0)), 0) AS total_diskon
        FROM mediasoft_penjualan
        WHERE date(substr(replace(tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as any

      const returnSummary = sqlite.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM mediasoft_returns
        WHERE status = 'APPROVED'
          AND ${returnDateExpression()} BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as { total?: number } | undefined

      const expenseRow = sqlite.prepare(`
        SELECT COALESCE(SUM(jumlah), 0) AS total
        FROM mediasoft_kas_transaksi
        WHERE jenis = 'KELUAR'
          AND ${localDateExpression('tgl_transaksi')} BETWEEN date(?) AND date(?)
      `).get(startDay, endDay) as { total?: number } | undefined

      const totalQty = asNumber(totals?.total_qty)
      const hpp = round2(asNumber(totals?.total_modal))
      const penjualanKotor = round2(asNumber(totals?.total_penjualan))
      const totalDiskon = round2(asNumber(discountRow?.total_diskon))
      const totalRetur = round2(returnSummary?.total ?? 0)
      const penjualanSetelahDiskon = round2(penjualanKotor - totalDiskon)
      const labaKotor = round2(penjualanSetelahDiskon - hpp)
      const penjualanBersih = round2(penjualanSetelahDiskon - totalRetur)
      // HPP barang yang diretur tidak tercatat pada tabel retur, sehingga laba
      // setelah retur dihitung dari pendapatan bersih dikurangi HPP penjualan.
      const labaSetelahRetur = round2(penjualanBersih - hpp)
      const totalPengeluaran = round2(asNumber(expenseRow?.total))
      const labaBersihOperasional = round2(labaSetelahRetur - totalPengeluaran)
      const marginPersen = penjualanSetelahDiskon > 0 ? (labaKotor / penjualanSetelahDiskon) * 100 : 0

      return {
        success: true,
        data: {
          total_transaksi: asNumber(totals?.total_transaksi),
          total_qty: totalQty,
          total_penjualan: penjualanSetelahDiskon,
          total_diskon: totalDiskon,
          total_return: totalRetur,
          total_hpp: hpp,
          total_modal: hpp, // alias lama
          laba_kotor: labaKotor,
          penjualan_setelah_retur: penjualanBersih,
          laba_setelah_retur: labaSetelahRetur,
          total_pengeluaran: totalPengeluaran,
          laba_bersih_operasional: labaBersihOperasional,
          margin_persen: Math.round(marginPersen * 100) / 100,
        },
      }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }

  // Laporan Produk Terlaris (qty & omzet bersih setelah retur)
  static getLaporanProdukTerlaris(startDate: string, endDate: string, limit: number = 10) {
    try {
      const startDay = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
      const endDay = String(endDate || startDay).slice(0, 10)
      const safeLimit = Math.max(1, Math.min(10000, Math.trunc(asNumber(limit)) || 10))

      const rows = sqlite.prepare(`
        SELECT d.kd_barang, COALESCE(b.nama_barang, d.kd_barang) AS nama_barang,
               SUM(COALESCE(d.qty, 0)) AS total_qty,
               SUM(COALESCE(d.total_harga_jual, 0)) AS total_penjualan,
               SUM(COALESCE(d.qty, 0) * COALESCE(d.harga_modal, 0)) AS total_modal
        FROM mediasoft_penjualan_detail d
        JOIN mediasoft_penjualan p ON d.kd_tansaksi_jual = p.kd_tansaksi_jual
        LEFT JOIN mediasoft_barang b ON d.kd_barang = b.kd_barang
        WHERE date(substr(replace(p.tgl_wkt_transaksi, 'T', ' '), 1, 10)) BETWEEN date(?) AND date(?)
        GROUP BY d.kd_barang
      `).all(startDay, endDay) as any[]

      const returnRows = sqlite.prepare(`
        SELECT rd.barang_id AS kd_barang,
               COALESCE(SUM(rd.quantity), 0) AS qty_retur,
               COALESCE(SUM(rd.subtotal), 0) AS nilai_retur
        FROM mediasoft_return_details rd
        JOIN mediasoft_returns r ON r.id = rd.return_id
        WHERE r.status = 'APPROVED'
          AND ${returnDateExpression('r')} BETWEEN date(?) AND date(?)
        GROUP BY rd.barang_id
      `).all(startDay, endDay) as any[]

      const returnMap = new Map<string, { qty: number; nilai: number }>()
      for (const row of returnRows) {
        returnMap.set(String(row.kd_barang), {
          qty: asNumber(row.qty_retur),
          nilai: asNumber(row.nilai_retur),
        })
      }

      const items = rows.map(row => {
        const retur = returnMap.get(String(row.kd_barang)) ?? { qty: 0, nilai: 0 }
        const qtyTerjual = asNumber(row.total_qty)
        const omzetKotor = asNumber(row.total_penjualan)
        const modal = asNumber(row.total_modal)
        return {
          kd_barang: row.kd_barang,
          nama_barang: row.nama_barang,
          total_qty: qtyTerjual,
          total_penjualan: round2(omzetKotor),
          total_modal: round2(modal),
          qty_retur: retur.qty,
          nilai_retur: round2(retur.nilai),
          net_qty: qtyTerjual - retur.qty,
          net_penjualan: round2(omzetKotor - retur.nilai),
          net_modal: round2(modal),
          net_laba: round2(omzetKotor - retur.nilai - modal),
        }
      })

      items.sort((a, b) => b.net_qty - a.net_qty || b.net_penjualan - a.net_penjualan)

      return { success: true, data: items.slice(0, safeLimit) }
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
