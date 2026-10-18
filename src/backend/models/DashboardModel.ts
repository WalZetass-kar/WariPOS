import { db } from '../../database/connection.js'
import { penjualan, barang, penjualanDetail } from '../../database/schema.js'
import { sql, lte } from 'drizzle-orm'

function dateKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function recordDateKey(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}(?:$| )/.test(text)) return text.slice(0, 10)
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return dateKey(parsed)
  return text.slice(0, 10)
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function saleAmount(row: { sub_total?: unknown; discount_amount?: unknown }) {
  return toNumber(row.sub_total) - toNumber(row.discount_amount)
}

function recordHourKey(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const match = text.match(/(?:^|[T\s])(\d{2}):(\d{2})/)
  if (match) {
    const hour = Number(match[1])
    return Number.isFinite(hour) ? hour : null
  }
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.getHours()
  return null
}

export class DashboardModel {
  static getSummary() {
    const now = new Date()
    const todayStr = dateKey(now)
    const weekAgo = dateKey(new Date(now.getTime() - 6 * 86400000))
    const monthStr = todayStr.slice(0, 7)

    const allSales = db.select().from(penjualan).all()

    const todaySales = allSales.filter(s => recordDateKey(s.tgl_wkt_transaksi) === todayStr)
    const weekSales = allSales.filter(s => recordDateKey(s.tgl_wkt_transaksi) >= weekAgo)
    const monthSales = allSales.filter(s => recordDateKey(s.tgl_wkt_transaksi).slice(0, 7) === monthStr)

    const sum = (arr: typeof allSales) => arr.reduce((a, b) => a + saleAmount(b), 0)

    const totalBarang = db.select({ count: sql<number>`count(*)` }).from(barang).get()
    const lowStock = db.select().from(barang).where(lte(barang.stok, 5)).all()
    const lowStockOrdered = [...lowStock].sort((a, b) => toNumber(a.stok) - toNumber(b.stok))

    const yesterdayStr = dateKey(new Date(now.getTime() - 86400000))
    const yesterdaySales = allSales.filter(s => recordDateKey(s.tgl_wkt_transaksi) === yesterdayStr)
    const yesterdayTotal = sum(yesterdaySales)
    const yesterdayCount = yesterdaySales.length
    const todayQtySold = todaySales.reduce((acc, s) => acc + toNumber(s.total_qty), 0)

    // Last 7 days chart data
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000)
      const dateStr = dateKey(d)
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
      const total = allSales.filter(s => recordDateKey(s.tgl_wkt_transaksi) === dateStr).reduce((a, b) => a + saleAmount(b), 0)
      return { label, total }
    })

    // Last 30 days chart data
    const chartData30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getTime() - (29 - i) * 86400000)
      const dateStr = dateKey(d)
      const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      const total = allSales.filter(s => recordDateKey(s.tgl_wkt_transaksi) === dateStr).reduce((a, b) => a + saleAmount(b), 0)
      return { label, total }
    })

    const hourlySales = Array.from({ length: 24 }, (_, hour) => {
      const hourSales = todaySales.filter(s => recordHourKey(s.tgl_wkt_transaksi) === hour)
      return {
        hour: `${String(hour).padStart(2, '0')}:00`,
        count: hourSales.length,
        total: hourSales.reduce((sum, sale) => sum + saleAmount(sale), 0),
      }
    })

    const recentTransactions = db.all(sql`
      SELECT
        p.kd_tansaksi_jual,
        p.tgl_wkt_transaksi,
        p.username_transaksi,
        COALESCE(c.nama_customer, 'Pelanggan Umum') AS nama_customer,
        COALESCE(p.total_qty, 0) AS total_qty,
        COALESCE(p.sub_total, 0) - COALESCE(p.discount_amount, 0) AS total_penjualan,
        p.jenis_pembayaran
      FROM mediasoft_penjualan p
      LEFT JOIN mediasoft_customer c ON c.kd_customer = p.kd_customer
      ORDER BY p.tgl_wkt_transaksi DESC, p.kd_tansaksi_jual DESC
      LIMIT 5
    `)

    // Top 5 produk terlaris (minggu ini)
    let topProducts: any[] = []
    
    try {
      topProducts = db.all(sql`
        SELECT 
          pd.kd_barang,
          b.nama_barang,
          b.foto_barang,
          SUM(pd.qty) as total_qty,
          SUM(pd.harga_jual * pd.qty) as total_revenue
        FROM mediasoft_penjualan_detail pd
        LEFT JOIN mediasoft_barang b ON pd.kd_barang = b.kd_barang
        WHERE pd.kd_tansaksi_jual IN (
          SELECT kd_tansaksi_jual FROM mediasoft_penjualan 
          WHERE substr(tgl_wkt_transaksi, 1, 10) >= ${weekAgo}
        )
        GROUP BY pd.kd_barang, b.nama_barang
        ORDER BY total_qty DESC
        LIMIT 5
      `)
    } catch (e) {
      console.error('Error fetching top products:', e)
    }

    // Prediction Logic: Simple 3-day moving average for tomorrow's sales
    const last3Days = chartData.slice(-3)
    const predictedTomorrow = Math.round(last3Days.reduce((a, b) => a + b.total, 0) / 3)

    return {
      today: { count: todaySales.length, total: sum(todaySales) },
      week: { count: weekSales.length, total: sum(weekSales) },
      month: { count: monthSales.length, total: sum(monthSales) },
      totalBarang: totalBarang?.count ?? 0,
      lowStockCount: lowStock.length,
      chartData,
      chartData30,
      predictedTomorrow,
      todayQtySold,
      yesterdayTotal,
      yesterdayCount,
      hourlySales,
      recentTransactions: recentTransactions.map((transaction: any) => ({
        kd_tansaksi_jual: transaction.kd_tansaksi_jual,
        tgl_wkt_transaksi: transaction.tgl_wkt_transaksi,
        username_transaksi: transaction.username_transaksi,
        nama_customer: transaction.nama_customer,
        total_qty: toNumber(transaction.total_qty),
        total_penjualan: toNumber(transaction.total_penjualan),
        jenis_pembayaran: transaction.jenis_pembayaran ?? null,
      })),
      alertSummary: {
        stockOutCount: lowStockOrdered.filter(item => toNumber(item.stok) <= 0).length,
        lowStockCount: lowStock.length,
        todayTransactionCount: todaySales.length,
        todayRevenue: sum(todaySales),
      },
      topProducts: topProducts.map(p => ({
        kd_barang: p.kd_barang,
        nama_barang: p.nama_barang,
        foto_barang: p.foto_barang ?? null,
        total_qty: toNumber(p.total_qty),
        total_revenue: toNumber(p.total_revenue),
      })),
      lowStockProducts: lowStockOrdered.slice(0, 5).map(b => ({
        kd_barang: b.kd_barang,
        nama_barang: b.nama_barang,
        stok: b.stok,
        stok_minimum: b.stok_minimum,
      })),
    }
  }
}
