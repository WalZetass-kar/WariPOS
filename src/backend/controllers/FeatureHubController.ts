import { sqlite } from '../../database/connection.js'

type AnyRow = Record<string, any>

type StockHistoryDirection = 'masuk' | 'keluar' | 'neutral'
type StockHistoryJenis = 'masuk' | 'keluar' | 'adjustment' | 'transfer' | 'retur'

interface StockEvent {
  kd_barang: string
  nama_barang: string
  jenis: StockHistoryJenis
  delta: number
  keterangan: string
  username: string
  created_at: string
  sort_key: string
}

interface StockHistoryRow {
  id: number
  kd_barang: string
  nama_barang: string
  jenis: StockHistoryJenis
  qty: number
  stok_sebelum: number
  stok_sesudah: number
  keterangan: string
  username: string
  created_at: string
  direction: StockHistoryDirection
}

const DEFAULT_NOTIF_SETTINGS = {
  stok_menipis: 1,
  stok_habis: 1,
  hutang_jatuh_tempo: 1,
  lisensi_expire: 1,
  target_penjualan: 0,
  min_stok: 5,
  notif_wa: 0,
  wa_number: '',
  notif_in_app: 1,
  quiet_start: '22:00',
  quiet_end: '06:00',
}

function nowIso() {
  return new Date().toISOString()
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeDateTime(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return '1970-01-01 00:00:00'

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().replace('T', ' ').slice(0, 19)
  }

  return text.replace('T', ' ').slice(0, 19)
}

function normalizeDate(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return text.slice(0, 10)
}

function monthLabel(monthKey: string) {
  const parsed = new Date(`${monthKey}-01T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return monthKey
  return parsed.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function upsertNotifSettings(data: AnyRow) {
  sqlite.prepare(`
    INSERT INTO mediasoft_notification_settings (
      id, stok_menipis, stok_habis, hutang_jatuh_tempo, lisensi_expire,
      target_penjualan, min_stok, notif_wa, wa_number, notif_in_app,
      quiet_start, quiet_end, created_at, updated_at
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM mediasoft_notification_settings WHERE id = 1), ?), ?
    )
    ON CONFLICT(id) DO UPDATE SET
      stok_menipis = excluded.stok_menipis,
      stok_habis = excluded.stok_habis,
      hutang_jatuh_tempo = excluded.hutang_jatuh_tempo,
      lisensi_expire = excluded.lisensi_expire,
      target_penjualan = excluded.target_penjualan,
      min_stok = excluded.min_stok,
      notif_wa = excluded.notif_wa,
      wa_number = excluded.wa_number,
      notif_in_app = excluded.notif_in_app,
      quiet_start = excluded.quiet_start,
      quiet_end = excluded.quiet_end,
      updated_at = excluded.updated_at
  `).run(
    data.stok_menipis ? 1 : 0,
    data.stok_habis ? 1 : 0,
    data.hutang_jatuh_tempo ? 1 : 0,
    data.lisensi_expire ? 1 : 0,
    data.target_penjualan ? 1 : 0,
    toNumber(data.min_stok, DEFAULT_NOTIF_SETTINGS.min_stok),
    data.notif_wa ? 1 : 0,
    String(data.wa_number ?? ''),
    data.notif_in_app ? 1 : 0,
    String(data.quiet_start ?? DEFAULT_NOTIF_SETTINGS.quiet_start),
    String(data.quiet_end ?? DEFAULT_NOTIF_SETTINGS.quiet_end),
    nowIso(),
    nowIso(),
  )
}

function ensureNotifSettingsRow() {
  const row = sqlite.prepare('SELECT * FROM mediasoft_notification_settings WHERE id = 1').get() as AnyRow | undefined
  if (!row) {
    upsertNotifSettings(DEFAULT_NOTIF_SETTINGS)
  }
}

function collectPriceRows(kdKategori?: number, search?: string) {
  const filters: string[] = []
  const params: unknown[] = []

  if (Number(kdKategori) > 0) {
    filters.push('b.kd_kategori_barang = ?')
    params.push(Number(kdKategori))
  }

  const query = String(search ?? '').trim()
  if (query) {
    filters.push(`(
      b.kd_barang LIKE ? OR
      b.nama_barang LIKE ? OR
      COALESCE(b.barcode, '') LIKE ? OR
      COALESCE(k.kategori_barang, '') LIKE ?
    )`)
    const term = `%${query}%`
    params.push(term, term, term, term)
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

  return sqlite.prepare(`
    SELECT
      b.kd_barang,
      b.nama_barang,
      COALESCE(h.harga_barang, 0) AS harga_barang,
      COALESCE(b.stok, 0) AS stok,
      COALESCE(k.kategori_barang, '-') AS kategori_barang,
      b.barcode
    FROM mediasoft_barang b
    LEFT JOIN mediasoft_harga h ON h.kd_barang = b.kd_barang
    LEFT JOIN mediasoft_kategori_barang k ON k.kd_kategori_barang = b.kd_kategori_barang
    ${where}
    ORDER BY b.nama_barang COLLATE NOCASE ASC
  `).all(...params) as AnyRow[]
}

function collectMembershipRows(search?: string) {
  const filters: string[] = []
  const params: unknown[] = []
  const query = String(search ?? '').trim()
  if (query) {
    filters.push(`(
      c.kd_customer LIKE ? OR
      c.nama_customer LIKE ? OR
      COALESCE(c.no_telp, '') LIKE ? OR
      COALESCE(c.email, '') LIKE ?
    )`)
    const term = `%${query}%`
    params.push(term, term, term, term)
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

  return sqlite.prepare(`
    SELECT
      c.kd_customer,
      c.nama_customer,
      c.no_telp,
      COALESCE(c.poin, 0) AS poin,
      COALESCE(c.total_belanja, 0) AS total_belanja,
      COALESCE(c.status, 'Aktif') AS status,
      COALESCE(c.tgl_daftar, CURRENT_TIMESTAMP) AS created_at,
      'MBR-' || c.kd_customer AS member_card_id
    FROM mediasoft_customer c
    ${where}
    ORDER BY COALESCE(c.total_belanja, 0) DESC, c.nama_customer COLLATE NOCASE ASC
  `).all(...params) as AnyRow[]
}

function collectCashFlowRows(startDate?: string, endDate?: string) {
  const start = normalizeDate(startDate) || '0000-00-00'
  const end = normalizeDate(endDate) || '9999-99-99'
  const rows: AnyRow[] = []

  const pettyCash = sqlite.prepare(`
    SELECT id, tanggal, keterangan, kategori, jumlah, jenis, username, created_at
    FROM mediasoft_petty_cash
    WHERE date(tanggal) BETWEEN date(?) AND date(?)
    ORDER BY tanggal DESC, created_at DESC, id DESC
  `).all(start, end) as AnyRow[]
  for (const item of pettyCash) {
    rows.push({
      tanggal: normalizeDateTime(item.tanggal || item.created_at),
      keterangan: item.keterangan,
      kategori: item.kategori,
      jenis: String(item.jenis ?? 'keluar').toLowerCase() === 'masuk' ? 'masuk' : 'keluar',
      jumlah: toNumber(item.jumlah),
      sumber: item.username || 'Petty Cash',
    })
  }

  const kasRows = sqlite.prepare(`
    SELECT tgl_transaksi, jenis, jumlah, keterangan, username
    FROM mediasoft_kas_transaksi
    WHERE date(tgl_transaksi) BETWEEN date(?) AND date(?)
    ORDER BY tgl_transaksi DESC, kd_kas_transaksi DESC
  `).all(start, end) as AnyRow[]
  for (const item of kasRows) {
    rows.push({
      tanggal: normalizeDateTime(item.tgl_transaksi),
      keterangan: item.keterangan || 'Transaksi kas',
      kategori: String(item.jenis ?? '').toUpperCase() === 'MASUK' ? 'Pemasukan Kas' : 'Pengeluaran Kas',
      jenis: String(item.jenis ?? '').toUpperCase() === 'MASUK' ? 'masuk' : 'keluar',
      jumlah: toNumber(item.jumlah),
      sumber: item.username || 'Kas',
    })
  }

  const salesRows = sqlite.prepare(`
    SELECT
      p.kd_tansaksi_jual,
      p.tgl_wkt_transaksi,
      p.username_transaksi,
      COALESCE(p.yang_dibayar, 0) AS yang_dibayar,
      COALESCE(p.sub_total, 0) AS sub_total,
      COALESCE(p.pajak, 0) AS pajak,
      COALESCE(p.discount_amount, 0) AS discount_amount,
      COALESCE(c.nama_customer, '-') AS nama_customer
    FROM mediasoft_penjualan p
    LEFT JOIN mediasoft_customer c ON c.kd_customer = p.kd_customer
    WHERE date(p.tgl_wkt_transaksi) BETWEEN date(?) AND date(?)
    ORDER BY p.tgl_wkt_transaksi DESC, p.kd_tansaksi_jual DESC
  `).all(start, end) as AnyRow[]
  for (const sale of salesRows) {
    rows.push({
      tanggal: normalizeDateTime(sale.tgl_wkt_transaksi),
      keterangan: `Penjualan ${sale.kd_tansaksi_jual}${sale.nama_customer && sale.nama_customer !== '-' ? ` • ${sale.nama_customer}` : ''}`,
      kategori: 'Penjualan',
      jenis: 'masuk',
      jumlah: toNumber(sale.yang_dibayar),
      sumber: sale.username_transaksi || 'Kasir',
    })
  }

  const purchaseRows = sqlite.prepare(`
    SELECT
      p.kd_tansaksi_beli AS kd_pembelian,
      p.tgl_wkt_transaksi AS tgl_pembelian,
      p.username_transaksi AS username,
      COALESCE(p.yang_dibayar, 0) AS yang_dibayar,
      COALESCE(p.sub_total, 0) AS sub_total,
      COALESCE(s.nama_suplier, '-') AS nama_suplier
    FROM mediasoft_pembelian p
    LEFT JOIN mediasoft_supplier s ON s.kd_suplier = p.kd_suplier
    WHERE date(p.tgl_wkt_transaksi) BETWEEN date(?) AND date(?)
    ORDER BY p.tgl_wkt_transaksi DESC, p.kd_tansaksi_beli DESC
  `).all(start, end) as AnyRow[]
  for (const purchase of purchaseRows) {
    rows.push({
      tanggal: normalizeDateTime(purchase.tgl_pembelian),
      keterangan: `Pembelian ${purchase.kd_pembelian}${purchase.nama_suplier && purchase.nama_suplier !== '-' ? ` • ${purchase.nama_suplier}` : ''}`,
      kategori: 'Pembelian',
      jenis: 'keluar',
      jumlah: toNumber(purchase.yang_dibayar),
      sumber: purchase.username || 'Pembelian',
    })
  }

  return rows.sort((a, b) => normalizeDateTime(b.tanggal).localeCompare(normalizeDateTime(a.tanggal)))
}

function collectStockEvents(): StockEvent[] {
  const events: StockEvent[] = []

  const salesRows = sqlite.prepare(`
    SELECT
      p.kd_tansaksi_jual AS ref,
      p.tgl_wkt_transaksi AS created_at,
      COALESCE(p.username_transaksi, '') AS username,
      d.kd_barang,
      COALESCE(b.nama_barang, d.kd_barang, '-') AS nama_barang,
      COALESCE(d.qty, 0) AS qty
    FROM mediasoft_penjualan p
    JOIN mediasoft_penjualan_detail d ON d.kd_tansaksi_jual = p.kd_tansaksi_jual
    LEFT JOIN mediasoft_barang b ON b.kd_barang = d.kd_barang
    WHERE COALESCE(d.kd_barang, '') != ''
  `).all() as AnyRow[]
  for (const row of salesRows) {
    events.push({
      kd_barang: String(row.kd_barang),
      nama_barang: String(row.nama_barang ?? row.kd_barang ?? '-'),
      jenis: 'keluar',
      delta: -Math.abs(toNumber(row.qty)),
      keterangan: `Penjualan ${row.ref}`,
      username: String(row.username ?? ''),
      created_at: String(row.created_at ?? nowIso()),
      sort_key: normalizeDateTime(row.created_at ?? nowIso()),
    })
  }

  const purchaseRows = sqlite.prepare(`
    SELECT
      p.kd_tansaksi_beli AS ref,
      p.tgl_wkt_transaksi AS created_at,
      COALESCE(p.username_transaksi, '') AS username,
      d.kd_barang,
      COALESCE(b.nama_barang, d.kd_barang, '-') AS nama_barang,
      COALESCE(d.qty, 0) AS qty
    FROM mediasoft_pembelian p
    JOIN mediasoft_pembelian_detail d ON d.kd_tansaksi_beli = p.kd_tansaksi_beli
    LEFT JOIN mediasoft_barang b ON b.kd_barang = d.kd_barang
    WHERE COALESCE(d.kd_barang, '') != ''
  `).all() as AnyRow[]
  for (const row of purchaseRows) {
    events.push({
      kd_barang: String(row.kd_barang),
      nama_barang: String(row.nama_barang ?? row.kd_barang ?? '-'),
      jenis: 'masuk',
      delta: Math.abs(toNumber(row.qty)),
      keterangan: `Pembelian ${row.ref}`,
      username: String(row.username ?? ''),
      created_at: String(row.created_at ?? nowIso()),
      sort_key: normalizeDateTime(row.created_at ?? nowIso()),
    })
  }

  const returnRows = sqlite.prepare(`
    SELECT
      r.return_number AS ref,
      COALESCE(r.approved_at, r.created_at) AS created_at,
      COALESCE(r.approved_by, r.created_by, '') AS username,
      d.barang_id AS kd_barang,
      COALESCE(b.nama_barang, d.barang_id, '-') AS nama_barang,
      COALESCE(d.quantity, 0) AS qty
    FROM mediasoft_returns r
    JOIN mediasoft_return_details d ON d.return_id = r.id
    LEFT JOIN mediasoft_barang b ON b.kd_barang = d.barang_id
    WHERE COALESCE(r.stock_applied, 0) = 1 AND UPPER(COALESCE(r.status, '')) = 'APPROVED'
  `).all() as AnyRow[]
  for (const row of returnRows) {
    events.push({
      kd_barang: String(row.kd_barang),
      nama_barang: String(row.nama_barang ?? row.kd_barang ?? '-'),
      jenis: 'retur',
      delta: Math.abs(toNumber(row.qty)),
      keterangan: `Return ${row.ref}`,
      username: String(row.username ?? ''),
      created_at: String(row.created_at ?? nowIso()),
      sort_key: normalizeDateTime(row.created_at ?? nowIso()),
    })
  }

  const opnameRows = sqlite.prepare(`
    SELECT
      o.opname_number AS ref,
      COALESCE(o.approved_by, o.created_by, '') AS username,
      COALESCE(o.opname_date, o.created_at) AS created_at,
      d.barang_id AS kd_barang,
      COALESCE(b.nama_barang, d.barang_id, '-') AS nama_barang,
      COALESCE(d.difference, 0) AS difference
    FROM mediasoft_stock_opname o
    JOIN mediasoft_stock_opname_details d ON d.opname_id = o.id
    LEFT JOIN mediasoft_barang b ON b.kd_barang = d.barang_id
    WHERE UPPER(COALESCE(o.status, '')) = 'APPROVED'
  `).all() as AnyRow[]
  for (const row of opnameRows) {
    const diff = toNumber(row.difference)
    events.push({
      kd_barang: String(row.kd_barang),
      nama_barang: String(row.nama_barang ?? row.kd_barang ?? '-'),
      jenis: 'adjustment',
      delta: diff,
      keterangan: `Stok opname ${row.ref}`,
      username: String(row.username ?? ''),
      created_at: String(row.created_at ?? nowIso()),
      sort_key: normalizeDateTime(row.created_at ?? nowIso()),
    })
  }

  const transferRows = sqlite.prepare(`
    SELECT
      st.id AS ref,
      st.created_at,
      COALESCE(st.transferred_by, '') AS username,
      st.kd_barang,
      COALESCE(b.nama_barang, st.kd_barang, '-') AS nama_barang,
      COALESCE(st.qty, 0) AS qty,
      COALESCE(fb.name, 'Cabang Asal') AS from_branch,
      COALESCE(tb.name, 'Cabang Tujuan') AS to_branch
    FROM mediasoft_stock_transfers st
    LEFT JOIN mediasoft_barang b ON b.kd_barang = st.kd_barang
    LEFT JOIN mediasoft_branches fb ON fb.id = st.from_branch_id
    LEFT JOIN mediasoft_branches tb ON tb.id = st.to_branch_id
  `).all() as AnyRow[]
  for (const row of transferRows) {
    events.push({
      kd_barang: String(row.kd_barang),
      nama_barang: String(row.nama_barang ?? row.kd_barang ?? '-'),
      jenis: 'transfer',
      delta: 0,
      keterangan: `Transfer ${row.from_branch} → ${row.to_branch} (${toNumber(row.qty)})`,
      username: String(row.username ?? ''),
      created_at: String(row.created_at ?? nowIso()),
      sort_key: normalizeDateTime(row.created_at ?? nowIso()),
    })
  }

  return events.sort((a, b) => b.sort_key.localeCompare(a.sort_key))
}

function buildStockHistoryRows(search?: string, filterJenis?: string) {
  const stockMap = new Map<string, number>()
  const products = sqlite.prepare(`
    SELECT kd_barang, COALESCE(nama_barang, kd_barang) AS nama_barang, COALESCE(stok, 0) AS stok
    FROM mediasoft_barang
  `).all() as AnyRow[]

  for (const product of products) {
    stockMap.set(String(product.kd_barang), toNumber(product.stok))
  }

  const searchTerm = String(search ?? '').trim().toLowerCase()
  const jenisFilter = String(filterJenis ?? '').trim()
  const rows: StockHistoryRow[] = []

  const grouped = new Map<string, StockEvent[]>()
  for (const event of collectStockEvents()) {
    const list = grouped.get(event.kd_barang) ?? []
    list.push(event)
    grouped.set(event.kd_barang, list)
  }

  let id = 1
  for (const [kdBarang, events] of grouped.entries()) {
    let current = stockMap.get(kdBarang) ?? 0
    for (const event of events.sort((a, b) => b.sort_key.localeCompare(a.sort_key))) {
      const after = current
      const before = current - event.delta
      current = before

      const direction: StockHistoryDirection = event.delta > 0 ? 'masuk' : event.delta < 0 ? 'keluar' : 'neutral'
      const row: StockHistoryRow = {
        id: id++,
        kd_barang: event.kd_barang,
        nama_barang: event.nama_barang,
        jenis: event.jenis,
        qty: Math.abs(event.delta) || toNumber((event as AnyRow).qty),
        stok_sebelum: before,
        stok_sesudah: after,
        keterangan: event.keterangan,
        username: event.username || '-',
        created_at: event.created_at,
        direction,
      }

      if (jenisFilter && row.jenis !== jenisFilter) continue
      const haystack = [row.kd_barang, row.nama_barang, row.keterangan, row.username, row.jenis].join(' ').toLowerCase()
      if (searchTerm && !haystack.includes(searchTerm)) continue
      rows.push(row)
    }
  }

  return rows.sort((a, b) => normalizeDateTime(b.created_at).localeCompare(normalizeDateTime(a.created_at)))
}

function maybeSupplierRating(totalTransaksi: number, totalPembelian: number, lastOrder?: string | null) {
  if (totalTransaksi <= 0 && totalPembelian <= 0) return { rating: 0, rata_rata_hari_kirim: 0 }

  const volumeScore = Math.min(2, Math.log10(totalPembelian + 1) / 3)
  const transactionScore = Math.min(2, totalTransaksi / 10)
  const recencyScore = lastOrder
    ? Math.max(0, 1 - Math.min(180, (Date.now() - new Date(lastOrder).getTime()) / 86400000) / 180)
    : 0

  const rating = Math.max(1, Math.min(5, Number((2 + volumeScore + transactionScore + recencyScore).toFixed(1))))
  const rata_rata_hari_kirim = Math.max(1, Math.round(10 - Math.min(6, transactionScore * 2) - Math.min(3, volumeScore)))
  return { rating, rata_rata_hari_kirim }
}

export class FeatureHubController {
  // ─── DAILY NOTES ────────────────────────────────────────────────────
  static getDailyNotes(filterDate?: string, search?: string) {
    try {
      const filters: string[] = []
      const params: unknown[] = []

      const date = normalizeDate(filterDate)
      if (date) {
        filters.push('tanggal = ?')
        params.push(date)
      }

      const query = String(search ?? '').trim()
      if (query) {
        filters.push(`(
          judul LIKE ? OR
          isi LIKE ? OR
          username LIKE ? OR
          jenis LIKE ?
        )`)
        const term = `%${query}%`
        params.push(term, term, term, term)
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const data = sqlite.prepare(`
        SELECT *
        FROM mediasoft_daily_notes
        ${where}
        ORDER BY tanggal DESC, created_at DESC, id DESC
      `).all(...params)

      return { success: true, data }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil daily notes: ' + (error as Error).message }
    }
  }

  static createDailyNote(data: AnyRow) {
    try {
      const tanggal = normalizeDate(data.tanggal) || normalizeDate(nowIso())
      const judul = String(data.judul ?? '').trim()
      const isi = String(data.isi ?? '').trim()
      const jenis = String(data.jenis ?? 'info').trim() || 'info'
      const username = String(data.username ?? '').trim()

      if (!judul) return { success: false, message: 'Judul catatan wajib diisi' }
      if (!isi) return { success: false, message: 'Isi catatan wajib diisi' }

      const createdAt = nowIso()
      const result = sqlite.prepare(`
        INSERT INTO mediasoft_daily_notes (tanggal, judul, isi, jenis, username, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(tanggal, judul, isi, jenis, username, createdAt, createdAt)

      return { success: true, data: { id: result.lastInsertRowid }, message: 'Catatan berhasil disimpan' }
    } catch (error) {
      return { success: false, message: 'Gagal menyimpan catatan: ' + (error as Error).message }
    }
  }

  static updateDailyNote(id: number, data: AnyRow) {
    try {
      const existing = sqlite.prepare('SELECT id FROM mediasoft_daily_notes WHERE id = ?').get(Number(id)) as AnyRow | undefined
      if (!existing) return { success: false, message: 'Catatan tidak ditemukan' }

      const tanggal = normalizeDate(data.tanggal) || normalizeDate(nowIso())
      const judul = String(data.judul ?? '').trim()
      const isi = String(data.isi ?? '').trim()
      const jenis = String(data.jenis ?? 'info').trim() || 'info'

      if (!judul) return { success: false, message: 'Judul catatan wajib diisi' }
      if (!isi) return { success: false, message: 'Isi catatan wajib diisi' }

      sqlite.prepare(`
        UPDATE mediasoft_daily_notes
        SET tanggal = ?, judul = ?, isi = ?, jenis = ?, updated_at = ?
        WHERE id = ?
      `).run(tanggal, judul, isi, jenis, nowIso(), Number(id))

      return { success: true, message: 'Catatan berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui catatan: ' + (error as Error).message }
    }
  }

  static deleteDailyNote(id: number) {
    try {
      const result = sqlite.prepare('DELETE FROM mediasoft_daily_notes WHERE id = ?').run(Number(id))
      if (!result.changes) return { success: false, message: 'Catatan tidak ditemukan' }
      return { success: true, message: 'Catatan berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus catatan: ' + (error as Error).message }
    }
  }

  // ─── PETTY CASH ─────────────────────────────────────────────────────
  static getPettyCash(startDate?: string, endDate?: string, search?: string) {
    try {
      const filters: string[] = []
      const params: unknown[] = []
      const start = normalizeDate(startDate)
      const end = normalizeDate(endDate)
      if (start) { filters.push('date(tanggal) >= date(?)'); params.push(start) }
      if (end) { filters.push('date(tanggal) <= date(?)'); params.push(end) }

      const query = String(search ?? '').trim()
      if (query) {
        filters.push(`(
          keterangan LIKE ? OR
          kategori LIKE ? OR
          username LIKE ? OR
          jenis LIKE ?
        )`)
        const term = `%${query}%`
        params.push(term, term, term, term)
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const data = sqlite.prepare(`
        SELECT *
        FROM mediasoft_petty_cash
        ${where}
        ORDER BY tanggal DESC, created_at DESC, id DESC
      `).all(...params)

      return { success: true, data }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil petty cash: ' + (error as Error).message }
    }
  }

  static createPettyCash(data: AnyRow) {
    try {
      const tanggal = normalizeDate(data.tanggal) || normalizeDate(nowIso())
      const keterangan = String(data.keterangan ?? '').trim()
      const kategori = String(data.kategori ?? '').trim() || 'Lainnya'
      const jumlah = toNumber(data.jumlah)
      const jenis = String(data.jenis ?? 'keluar').trim() || 'keluar'
      const username = String(data.username ?? '').trim()

      if (!keterangan) return { success: false, message: 'Keterangan wajib diisi' }
      if (jumlah <= 0) return { success: false, message: 'Jumlah harus lebih dari 0' }

      const createdAt = nowIso()
      const result = sqlite.prepare(`
        INSERT INTO mediasoft_petty_cash (tanggal, keterangan, kategori, jumlah, jenis, username, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tanggal, keterangan, kategori, jumlah, jenis, username, createdAt, createdAt)

      return { success: true, data: { id: result.lastInsertRowid }, message: 'Petty cash berhasil disimpan' }
    } catch (error) {
      return { success: false, message: 'Gagal menyimpan petty cash: ' + (error as Error).message }
    }
  }

  static deletePettyCash(id: number) {
    try {
      const result = sqlite.prepare('DELETE FROM mediasoft_petty_cash WHERE id = ?').run(Number(id))
      if (!result.changes) return { success: false, message: 'Data petty cash tidak ditemukan' }
      return { success: true, message: 'Data petty cash berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus petty cash: ' + (error as Error).message }
    }
  }

  // ─── NOTIFICATION SETTINGS ─────────────────────────────────────────
  static getNotificationSettings() {
    try {
      ensureNotifSettingsRow()
      const row = sqlite.prepare('SELECT * FROM mediasoft_notification_settings WHERE id = 1').get() as AnyRow | undefined
      return {
        success: true,
        data: row ? {
          stok_menipis: !!row.stok_menipis,
          stok_habis: !!row.stok_habis,
          hutang_jatuh_tempo: !!row.hutang_jatuh_tempo,
          lisensi_expire: !!row.lisensi_expire,
          target_penjualan: !!row.target_penjualan,
          min_stok: toNumber(row.min_stok, DEFAULT_NOTIF_SETTINGS.min_stok),
          notif_wa: !!row.notif_wa,
          wa_number: String(row.wa_number ?? ''),
          notif_in_app: !!row.notif_in_app,
          quiet_start: String(row.quiet_start ?? DEFAULT_NOTIF_SETTINGS.quiet_start),
          quiet_end: String(row.quiet_end ?? DEFAULT_NOTIF_SETTINGS.quiet_end),
        } : { ...DEFAULT_NOTIF_SETTINGS },
      }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil pengaturan notifikasi: ' + (error as Error).message }
    }
  }

  static saveNotificationSettings(data: AnyRow) {
    try {
      upsertNotifSettings({
        ...DEFAULT_NOTIF_SETTINGS,
        ...data,
      })
      return { success: true, data: this.getNotificationSettings().data, message: 'Pengaturan notifikasi disimpan' }
    } catch (error) {
      return { success: false, message: 'Gagal menyimpan pengaturan notifikasi: ' + (error as Error).message }
    }
  }

  // ─── PRODUCT LOOKUPS / PRICE UPDATES ───────────────────────────────
  static getPriceList(kdKategori?: number, search?: string) {
    try {
      const data = collectPriceRows(kdKategori, search)
      return { success: true, data }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil price list: ' + (error as Error).message }
    }
  }

  static getProductsByCategory(kdKategori?: number) {
    try {
      const data = collectPriceRows(kdKategori)
      return { success: true, data }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil produk per kategori: ' + (error as Error).message }
    }
  }

  static batchUpdatePrice(payload: AnyRow) {
    try {
      const kdKategori = toNumber(payload.kd_kategori ?? payload.kd_kategori_barang)
      if (kdKategori <= 0) return { success: false, message: 'Kategori produk wajib dipilih' }

      const mode = String(payload.mode ?? 'increase')
      const value = toNumber(payload.value)
      if (!['increase', 'decrease', 'set'].includes(mode)) return { success: false, message: 'Mode update harga tidak valid' }
      if (value <= 0) return { success: false, message: 'Nilai perubahan harga harus lebih dari 0' }

      const rows = sqlite.prepare(`
        SELECT b.kd_barang, COALESCE(h.harga_barang, 0) AS harga_barang
        FROM mediasoft_barang b
        LEFT JOIN mediasoft_harga h ON h.kd_barang = b.kd_barang
        WHERE b.kd_kategori_barang = ?
      `).all(kdKategori) as AnyRow[]

      if (!rows.length) return { success: false, message: 'Tidak ada produk pada kategori ini' }

      const update = sqlite.transaction(() => {
        const stmt = sqlite.prepare(`
          UPDATE mediasoft_harga
          SET harga_barang = ?, updated_at = ?
          WHERE kd_barang = ?
        `)
        for (const row of rows) {
          const current = toNumber(row.harga_barang)
          let next = current
          if (mode === 'increase') next = current + (current * value / 100)
          else if (mode === 'decrease') next = Math.max(0, current - (current * value / 100))
          else next = value

          const updatedAt = nowIso()
          const exists = sqlite.prepare('SELECT kd_barang FROM mediasoft_harga WHERE kd_barang = ?').get(row.kd_barang) as AnyRow | undefined
          if (exists) {
            stmt.run(Math.round(next), updatedAt, row.kd_barang)
          } else {
            sqlite.prepare(`
              INSERT INTO mediasoft_harga (kd_barang, harga_barang, potongan, harga_modal)
              VALUES (?, ?, 0, 0)
            `).run(row.kd_barang, Math.round(next))
          }
        }
      })
      update()

      return { success: true, message: `${rows.length} harga produk berhasil diperbarui` }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui harga: ' + (error as Error).message }
    }
  }

  // ─── BRANCH STOCK / TRANSFER ───────────────────────────────────────
  static getProductsByBranch(branchId: number) {
    try {
      const id = Number(branchId)
      if (!Number.isFinite(id) || id <= 0) return { success: false, message: 'Branch tidak valid' }

      const rows = sqlite.prepare(`
        SELECT
          b.kd_barang,
          b.nama_barang,
          COALESCE(s.jumlah, CASE WHEN ? = 1 THEN b.stok ELSE 0 END, 0) AS stok,
          COALESCE(h.harga_barang, 0) AS harga_barang,
          COALESCE(k.kategori_barang, '-') AS kategori_barang,
          b.barcode
        FROM mediasoft_barang b
        LEFT JOIN mediasoft_harga h ON h.kd_barang = b.kd_barang
        LEFT JOIN mediasoft_kategori_barang k ON k.kd_kategori_barang = b.kd_kategori_barang
        LEFT JOIN mediasoft_stok s ON s.kd_barang = b.kd_barang AND s.branch_id = ?
        ORDER BY b.nama_barang COLLATE NOCASE ASC
      `).all(id, id) as AnyRow[]

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil produk branch: ' + (error as Error).message }
    }
  }

  static transferStock(payload: AnyRow) {
    try {
      const fromBranch = toNumber(payload.from_branch ?? payload.fromBranch)
      const toBranch = toNumber(payload.to_branch ?? payload.toBranch)
      const items = Array.isArray(payload.items) ? payload.items : []
      const note = String(payload.note ?? '').trim()
      const username = String(payload.username ?? payload.transferred_by ?? '').trim()

      if (!fromBranch || !toBranch) return { success: false, message: 'Branch asal dan tujuan wajib dipilih' }
      if (fromBranch === toBranch) return { success: false, message: 'Branch asal dan tujuan tidak boleh sama' }
      if (items.length === 0) return { success: false, message: 'Item transfer kosong' }

      const transfer = sqlite.transaction(() => {
        for (const raw of items) {
          const kdBarang = String(raw.kd_barang ?? '').trim()
          const qty = Math.max(1, Math.round(toNumber(raw.qty, 1)))
          if (!kdBarang) throw new Error('Kode barang transfer tidak valid')

          let source = sqlite.prepare(`
            SELECT jumlah FROM mediasoft_stok WHERE kd_barang = ? AND branch_id = ?
          `).get(kdBarang, fromBranch) as AnyRow | undefined

          if (!source && fromBranch === 1) {
            const product = sqlite.prepare('SELECT stok FROM mediasoft_barang WHERE kd_barang = ?').get(kdBarang) as AnyRow | undefined
            const stock = toNumber(product?.stok)
            sqlite.prepare(`
              INSERT OR IGNORE INTO mediasoft_stok (kd_barang, jumlah, branch_id)
              VALUES (?, ?, 1)
            `).run(kdBarang, stock)
            source = sqlite.prepare(`
              SELECT jumlah FROM mediasoft_stok WHERE kd_barang = ? AND branch_id = ?
            `).get(kdBarang, fromBranch) as AnyRow | undefined
          }

          const available = toNumber(source?.jumlah)
          if (available < qty) {
            throw new Error(`Stok ${kdBarang} tidak mencukupi di branch asal`)
          }

          sqlite.prepare(`
            UPDATE mediasoft_stok
            SET jumlah = jumlah - ?
            WHERE kd_barang = ? AND branch_id = ?
          `).run(qty, kdBarang, fromBranch)

          const target = sqlite.prepare(`
            SELECT jumlah FROM mediasoft_stok WHERE kd_barang = ? AND branch_id = ?
          `).get(kdBarang, toBranch) as AnyRow | undefined

          if (target) {
            sqlite.prepare(`
              UPDATE mediasoft_stok
              SET jumlah = jumlah + ?
              WHERE kd_barang = ? AND branch_id = ?
            `).run(qty, kdBarang, toBranch)
          } else {
            sqlite.prepare(`
              INSERT INTO mediasoft_stok (kd_barang, jumlah, branch_id)
              VALUES (?, ?, ?)
            `).run(kdBarang, qty, toBranch)
          }

          sqlite.prepare(`
            INSERT INTO mediasoft_stock_transfers (
              from_branch_id, to_branch_id, kd_barang, qty, notes, transferred_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(fromBranch, toBranch, kdBarang, qty, note, username)
        }
      })

      transfer()
      return { success: true, message: 'Transfer stok berhasil disimpan' }
    } catch (error) {
      return { success: false, message: 'Gagal transfer stok: ' + (error as Error).message }
    }
  }

  // ─── REPORT-LIKE READS ─────────────────────────────────────────────
  static getCashFlow(startDate?: string, endDate?: string) {
    try {
      const data = collectCashFlowRows(startDate, endDate)
      return { success: true, data }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil arus kas: ' + (error as Error).message }
    }
  }

  static getTaxSummary(startDate?: string, endDate?: string) {
    try {
      const start = normalizeDate(startDate) || '0000-00-00'
      const end = normalizeDate(endDate) || '9999-99-99'

      const salesRows = sqlite.prepare(`
        SELECT
          substr(tgl_wkt_transaksi, 1, 7) AS month_key,
          COUNT(*) AS total_transaksi,
          COALESCE(SUM(COALESCE(sub_total, 0)), 0) AS total_penjualan,
          COALESCE(SUM(COALESCE(pajak, 0)), 0) AS total_pajak
        FROM mediasoft_penjualan
        WHERE date(tgl_wkt_transaksi) BETWEEN date(?) AND date(?)
        GROUP BY substr(tgl_wkt_transaksi, 1, 7)
        ORDER BY month_key ASC
      `).all(start, end) as AnyRow[]

      const returnRows = sqlite.prepare(`
        SELECT
          substr(COALESCE(approved_at, created_at), 1, 7) AS month_key,
          COALESCE(SUM(COALESCE(total_amount, 0)), 0) AS total_return
        FROM mediasoft_returns
        WHERE UPPER(COALESCE(status, '')) = 'APPROVED'
          AND date(COALESCE(approved_at, created_at)) BETWEEN date(?) AND date(?)
        GROUP BY substr(COALESCE(approved_at, created_at), 1, 7)
        ORDER BY month_key ASC
      `).all(start, end) as AnyRow[]

      const returnMap = new Map<string, number>()
      for (const row of returnRows) {
        returnMap.set(String(row.month_key ?? ''), toNumber(row.total_return))
      }

      const rows = salesRows.map(row => {
        const monthKey = String(row.month_key ?? '')
        return {
          bulan: monthLabel(monthKey),
          total_transaksi: toNumber(row.total_transaksi),
          total_penjualan: toNumber(row.total_penjualan),
          total_pajak: toNumber(row.total_pajak),
          total_return: returnMap.get(monthKey) ?? 0,
          pajak_bersih: Math.max(0, toNumber(row.total_pajak) - (returnMap.get(monthKey) ?? 0)),
        }
      })

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan pajak: ' + (error as Error).message }
    }
  }

  static getSalesCommissions(search?: string, month?: number, year?: number, customRates?: Record<string, { komisi_persen?: number; target_bulanan?: number }>) {
    try {
      const targetYear = year || new Date().getFullYear()
      const targetMonth = month || (new Date().getMonth() + 1)
      const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
      const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1
      const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

      const salesRows = sqlite.prepare(`
        SELECT
          username_transaksi AS username,
          COUNT(*) AS total_transaksi,
          COALESCE(SUM(COALESCE(sub_total, 0) - COALESCE(discount_amount, 0)), 0) AS total_penjualan
        FROM mediasoft_penjualan
        WHERE date(tgl_wkt_transaksi) >= date(?) AND date(tgl_wkt_transaksi) < date(?)
        GROUP BY username_transaksi
      `).all(startDate, endDate) as AnyRow[]

      const salesMap = new Map<string, { total_transaksi: number; total_penjualan: number }>()
      for (const row of salesRows) {
        salesMap.set(String(row.username ?? ''), {
          total_transaksi: toNumber(row.total_transaksi),
          total_penjualan: toNumber(row.total_penjualan),
        })
      }

      const query = String(search ?? '').trim().toLowerCase()
      const users = sqlite.prepare(`
        SELECT nama_pengguna, nama_lengkap, hak_akses
        FROM mediasoft_pengguna
        WHERE COALESCE(status_user, 'Aktif') = 'Aktif'
        ORDER BY nama_lengkap COLLATE NOCASE ASC
      `).all() as AnyRow[]

      const rows = users
        .map(user => {
          const uName = String(user.nama_pengguna ?? '')
          const sales = salesMap.get(uName) ?? { total_transaksi: 0, total_penjualan: 0 }
          const role = String(user.hak_akses ?? '').toLowerCase()
          const custom = customRates?.[uName]
          const komisiPersen = custom?.komisi_persen !== undefined ? custom.komisi_persen : (role === 'kasir' ? 2 : role === 'operator' ? 1.5 : role === 'admin' ? 1 : 0)
          const targetBulanan = custom?.target_bulanan !== undefined ? custom.target_bulanan : (role === 'kasir' ? 10000000 : role === 'operator' ? 15000000 : role === 'admin' ? 5000000 : 0)
          const totalKomisi = Math.round((sales.total_penjualan * komisiPersen) / 100)
          const pencapaian = targetBulanan > 0 ? (sales.total_penjualan / targetBulanan) * 100 : 0

          return {
            username: user.nama_pengguna,
            nama_lengkap: user.nama_lengkap ?? user.nama_pengguna,
            total_transaksi: sales.total_transaksi,
            total_penjualan: sales.total_penjualan,
            komisi_persen: komisiPersen,
            total_komisi: totalKomisi,
            target_bulanan: targetBulanan,
            pencapaian,
          }
        })
        .filter(row => !query || [row.username, row.nama_lengkap].some(value => String(value ?? '').toLowerCase().includes(query)))
        .sort((a, b) => b.total_penjualan - a.total_penjualan)

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil komisi sales: ' + (error as Error).message }
    }
  }

  static getStaffSalesDetail(username: string, month?: number, year?: number) {
    try {
      const targetYear = year || new Date().getFullYear()
      const targetMonth = month || (new Date().getMonth() + 1)
      const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
      const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1
      const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

      const rows = sqlite.prepare(`
        SELECT
          kd_penjualan,
          tgl_wkt_transaksi,
          nama_customer,
          jenis_pembayaran,
          sub_total,
          discount_amount,
          yang_dibayar
        FROM mediasoft_penjualan
        WHERE username_transaksi = ? AND date(tgl_wkt_transaksi) >= date(?) AND date(tgl_wkt_transaksi) < date(?)
        ORDER BY tgl_wkt_transaksi DESC
      `).all(username, startDate, endDate)
      return { success: true, data: rows }
    } catch (e) {
      return { success: false, message: String(e) }
    }
  }

  static getSupplierRatings(search?: string) {
    try {
      const query = String(search ?? '').trim().toLowerCase()
      const suppliers = sqlite.prepare(`
        SELECT
          s.kd_suplier,
          s.nama_suplier,
          s.no_telp_hp,
          COALESCE(COUNT(p.kd_tansaksi_beli), 0) AS total_transaksi,
          COALESCE(SUM(COALESCE(p.sub_total, 0)), 0) AS total_pembelian,
          MAX(p.tgl_wkt_transaksi) AS last_order
        FROM mediasoft_supplier s
        LEFT JOIN mediasoft_pembelian p ON p.kd_suplier = s.kd_suplier
        GROUP BY s.kd_suplier
        ORDER BY COALESCE(SUM(COALESCE(p.sub_total, 0)), 0) DESC, s.nama_suplier COLLATE NOCASE ASC
      `).all() as AnyRow[]

      const rows = suppliers
        .map(row => {
          const metrics = maybeSupplierRating(toNumber(row.total_transaksi), toNumber(row.total_pembelian), row.last_order)
          return {
            kd_supplier: row.kd_suplier,
            nama_supplier: row.nama_suplier,
            no_telp: row.no_telp_hp ?? null,
            rating: metrics.rating,
            total_pembelian: toNumber(row.total_pembelian),
            total_transaksi: toNumber(row.total_transaksi),
            rata_rata_hari_kirim: metrics.rata_rata_hari_kirim,
            last_order: row.last_order ?? null,
          }
        })
        .filter(row => !query || [row.kd_supplier, row.nama_supplier, row.no_telp].some(value => String(value ?? '').toLowerCase().includes(query)))

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil rating supplier: ' + (error as Error).message }
    }
  }

  static getMemberships(search?: string) {
    try {
      const rows = collectMembershipRows(search)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil membership: ' + (error as Error).message }
    }
  }

  static getStockHistory(search?: string, filterJenis?: string) {
    try {
      const data = buildStockHistoryRows(search, filterJenis)
      return { success: true, data }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil riwayat stok: ' + (error as Error).message }
    }
  }
}
