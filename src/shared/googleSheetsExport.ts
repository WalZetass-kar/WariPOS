import type { DashboardSummary } from './types'

export interface GoogleSheetsPayload {
  app: string
  action: 'append_dashboard' | 'test'
  generatedAt: string
  sheets: Array<{
    name: string
    rows: Array<Array<string | number>>
  }>
}

function sanitizeSheetCell(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim()
}

export function dashboardSummaryToSheetsPayload(summary: DashboardSummary): GoogleSheetsPayload {
  const generatedAt = new Date().toLocaleString('id-ID')
  const topProducts = summary.topProducts || []
  const lowStockProducts = summary.lowStockProducts || []
  const chartData = summary.chartData || []
  const hourlySales = summary.hourlySales || []
  const recentTransactions = summary.recentTransactions || []
  const alertSummary = summary.alertSummary || {
    stockOutCount: 0,
    lowStockCount: summary.lowStockCount || 0,
    todayTransactionCount: summary.today.count,
    todayRevenue: summary.today.total,
  }

  return {
    app: 'WariPOS',
    action: 'append_dashboard',
    generatedAt,
    sheets: [
      {
        name: 'Ringkasan',
        rows: [
          ['WariPOS'],
          ['Export Dashboard', generatedAt],
          [],
          ['Ringkasan', 'Transaksi', 'Pemasukan'],
          ['Hari Ini', summary.today.count, summary.today.total],
          ['Minggu Ini', summary.week.count, summary.week.total],
          ['Bulan Ini', summary.month.count, summary.month.total],
          ['Rata-rata Harian Minggu Ini', '', Math.round(summary.week.total / 7)],
          ['Prediksi Besok', '', summary.predictedTomorrow || 0],
          ['Produk Habis', '', alertSummary.stockOutCount],
          ['Stok Menipis', '', alertSummary.lowStockCount],
        ],
      },
      {
        name: 'Penjualan 7 Hari',
        rows: [
          ['Tanggal', 'Pemasukan'],
          ...chartData.map(item => [item.label, item.total]),
        ],
      },
      {
        name: 'Jam Ramai Hari Ini',
        rows: [
          ['Jam', 'Jumlah Transaksi', 'Pemasukan'],
          ...hourlySales.map(item => [item.hour, item.count, item.total]),
        ],
      },
      {
        name: 'Transaksi Terbaru',
        rows: [
          ['No. Transaksi', 'Tanggal', 'Kasir', 'Customer', 'Qty', 'Total', 'Pembayaran'],
          ...recentTransactions.map(transaction => [
            transaction.kd_tansaksi_jual,
            transaction.tgl_wkt_transaksi || '',
            transaction.username_transaksi || '-',
            transaction.nama_customer || 'Pelanggan Umum',
            transaction.total_qty,
            transaction.total_penjualan,
            transaction.jenis_pembayaran || '-',
          ]),
        ],
      },
      {
        name: 'Produk Terlaris',
        rows: [
          ['Kode', 'Nama Produk', 'Qty Terjual', 'Pemasukan'],
          ...topProducts.map(product => [
            product.kd_barang || '',
            product.nama_barang || 'Produk',
            product.total_qty,
            product.total_revenue,
          ]),
        ],
      },
      {
        name: 'Ringkasan Alert',
        rows: [
          ['Jenis', 'Jumlah'],
          ['Produk Habis', alertSummary.stockOutCount],
          ['Stok Menipis', alertSummary.lowStockCount],
          ['Transaksi Hari Ini', alertSummary.todayTransactionCount],
          ['Pendapatan Hari Ini', alertSummary.todayRevenue],
        ],
      },
      {
        name: 'Stok Menipis',
        rows: [
          ['Kode', 'Nama Produk', 'Stok', 'Stok Minimum'],
          ...lowStockProducts.map(product => [
            product.kd_barang,
            product.nama_barang || 'Produk',
            product.stok ?? 0,
            product.stok_minimum ?? 0,
          ]),
        ],
      },
    ],
  }
}

export function dashboardSummaryToTsv(summary: DashboardSummary) {
  const payload = dashboardSummaryToSheetsPayload(summary)
  const rows = payload.sheets.flatMap((sheet, index) => [
    ...(index === 0 ? [] : [[]]),
    [sheet.name],
    ...sheet.rows,
  ])

  return rows.map(row => row.map(sanitizeSheetCell).join('\t')).join('\n')
}

export function testGoogleSheetsPayload(): GoogleSheetsPayload {
  return {
    app: 'WariPOS',
    action: 'test',
    generatedAt: new Date().toLocaleString('id-ID'),
    sheets: [
      {
        name: 'Test Koneksi',
        rows: [
          ['Status', 'Waktu'],
          ['OK', new Date().toISOString()],
        ],
      },
    ],
  }
}
