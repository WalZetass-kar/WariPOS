import { db } from '../../database/connection.js'
import { kdsOrders, kdsOrderItems, floorLayouts, tables, reservations } from '../../database/schema.js'
import { eq, and, desc, gte, lte, sql, like } from 'drizzle-orm'

export class KdsModel {
  // ─── KDS ORDERS ──────────────────────────────────────────────

  static getOrders(status?: string, dapur?: string) {
    const conditions: any[] = []
    if (status && status !== 'SEMUA') conditions.push(eq(kdsOrders.status, status))
    if (dapur) conditions.push(eq(kdsOrders.dapur, dapur))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const orders = db.select().from(kdsOrders).where(where).orderBy(desc(kdsOrders.waktu_masuk)).all()
    return orders.map(order => ({
      ...order,
      items: this.getOrderItems(order.id),
    }))
  }

  static getOrderById(id: number) {
    return db.select().from(kdsOrders).where(eq(kdsOrders.id, id)).get()
  }

  static createOrder(data: {
    kd_transaksi: string
    nomor_meja?: string | null
    nama_pelanggan?: string | null
    jenis_order?: string
    catatan?: string | null
    dapur?: string | null
    dibuat_oleh?: string | null
  }) {
    const lastAntrian = db.select({ max: sql<number>`COALESCE(MAX(nomor_antrian), 0)` }).from(kdsOrders).get()
    const nomor_antrian = (lastAntrian?.max ?? 0) + 1
    return db.insert(kdsOrders).values({
      kd_transaksi: data.kd_transaksi,
      nomor_meja: data.nomor_meja || null,
      nomor_antrian,
      status: 'BARU',
      prioritas: 0,
      catatan: data.catatan || null,
      nama_pelanggan: data.nama_pelanggan || null,
      jenis_order: data.jenis_order || 'DINE_IN',
      waktu_masuk: new Date().toISOString(),
      waktu_mulai_masak: null,
      waktu_selesai: null,
      waktu_siap: null,
      waktu_disajikan: null,
      dapur: data.dapur || null,
      dibuat_oleh: data.dibuat_oleh || null,
    }).run()
  }

  static updateOrderStatus(id: number, status: string, waktu?: string) {
    const now = waktu || new Date().toISOString()
    const updateData: Record<string, any> = { status }
    if (status === 'DIMASAK') updateData.waktu_mulai_masak = now
    if (status === 'SIAP') updateData.waktu_siap = now
    if (status === 'DISAJIKAN') updateData.waktu_disajikan = now
    if (status === 'SELESAI') updateData.waktu_selesai = now
    return db.update(kdsOrders).set(updateData).where(eq(kdsOrders.id, id)).run()
  }

  static deleteOrder(id: number) {
    db.delete(kdsOrderItems).where(eq(kdsOrderItems.kds_order_id, id)).run()
    return db.delete(kdsOrders).where(eq(kdsOrders.id, id)).run()
  }

  static clearOrders(status?: string) {
    if (status && status !== 'SEMUA') {
      const ordersToDelete = db.select({ id: kdsOrders.id }).from(kdsOrders).where(eq(kdsOrders.status, status)).all()
      for (const o of ordersToDelete) {
        db.delete(kdsOrderItems).where(eq(kdsOrderItems.kds_order_id, o.id)).run()
      }
      return db.delete(kdsOrders).where(eq(kdsOrders.status, status)).run()
    } else {
      db.delete(kdsOrderItems).run()
      return db.delete(kdsOrders).run()
    }
  }

  static addOrderItem(data: {
    kds_order_id: number
    kd_barang: string
    nama_item: string
    qty?: number
    catatan?: string | null
  }) {
    return db.insert(kdsOrderItems).values({
      kds_order_id: data.kds_order_id,
      kd_barang: data.kd_barang,
      nama_item: data.nama_item,
      qty: data.qty ?? 1,
      catatan: data.catatan || null,
      status: 'BARU',
      waktu_mulai_masak: null,
      waktu_selesai: null,
    }).run()
  }

  static updateOrderItemStatus(id: number, status: string, waktu?: string) {
    const now = waktu || new Date().toISOString()
    const updateData: Record<string, any> = { status }
    if (status === 'DIMASAK') updateData.waktu_mulai_masak = now
    if (status === 'SIAP' || status === 'SELESAI') updateData.waktu_selesai = now
    return db.update(kdsOrderItems).set(updateData).where(eq(kdsOrderItems.id, id)).run()
  }

  static getOrderItems(orderId: number) {
    return db.select().from(kdsOrderItems)
      .where(eq(kdsOrderItems.kds_order_id, orderId))
      .all()
  }

  static getOrdersSummary() {
    const all = db.select().from(kdsOrders).all()
    return {
      total: all.length,
      BARU: all.filter(o => o.status === 'BARU').length,
      DIMASAK: all.filter(o => o.status === 'DIMASAK').length,
      SIAP: all.filter(o => o.status === 'SIAP').length,
      DISAJIKAN: all.filter(o => o.status === 'DISAJIKAN').length,
      SELESAI: all.filter(o => o.status === 'SELESAI').length,
    }
  }

  static getPendingOrders() {
    return db.select().from(kdsOrders)
      .where(and(
        sql`${kdsOrders.status} IN ('BARU', 'DIMASAK')`
      ))
      .orderBy(desc(kdsOrders.prioritas), desc(kdsOrders.waktu_masuk))
      .all()
  }

  static getAveragePrepTime() {
    const completed = db.select().from(kdsOrders)
      .where(and(
        eq(kdsOrders.status, 'SELESAI'),
        sql`${kdsOrders.waktu_mulai_masak} IS NOT NULL`,
        sql`${kdsOrders.waktu_selesai} IS NOT NULL`
      ))
      .all()

    if (completed.length === 0) return 0

    const totalMinutes = completed.reduce((sum, o) => {
      const start = new Date(o.waktu_mulai_masak!).getTime()
      const end = new Date(o.waktu_selesai!).getTime()
      return sum + (end - start) / 60000
    }, 0)

    return Math.round(totalMinutes / completed.length)
  }

  // ─── FLOOR LAYOUTS ───────────────────────────────────────────

  static getFloorLayouts() {
    return db.select().from(floorLayouts).orderBy(desc(floorLayouts.created_at)).all()
  }

  static getFloorLayoutById(id: number) {
    return db.select().from(floorLayouts).where(eq(floorLayouts.id, id)).get()
  }

  static createFloorLayout(data: {
    nama: string
    kapasitas?: number
    width?: number
    height?: number
  }) {
    return db.insert(floorLayouts).values({
      nama: data.nama,
      kapasitas: data.kapasitas ?? 0,
      width: data.width ?? 800,
      height: data.height ?? 600,
      is_active: 1,
      created_at: new Date().toISOString(),
    }).run()
  }

  static updateFloorLayout(id: number, data: {
    nama?: string
    kapasitas?: number
    width?: number
    height?: number
    is_active?: number
  }) {
    return db.update(floorLayouts).set(data).where(eq(floorLayouts.id, id)).run()
  }

  static deleteFloorLayout(id: number) {
    db.update(tables).set({ floor_layout_id: null }).where(eq(tables.floor_layout_id, id)).run()
    return db.delete(floorLayouts).where(eq(floorLayouts.id, id)).run()
  }

  // ─── TABLES ──────────────────────────────────────────────────

  static getAllTables(layoutId?: number) {
    const where = layoutId ? eq(tables.floor_layout_id, layoutId) : undefined
    return db.select().from(tables).where(where).orderBy(desc(tables.created_at)).all()
  }

  static getTableById(id: number) {
    return db.select().from(tables).where(eq(tables.id, id)).get()
  }

  static createTable(data: {
    floor_layout_id?: number | null
    nomor_meja: string
    label?: string | null
    kapasitas?: number
    posisi_x?: number
    posisi_y?: number
    bentuk?: string
    lebar?: number
    tinggi?: number
    qr_code?: string | null
    catatan?: string | null
  }) {
    return db.insert(tables).values({
      floor_layout_id: data.floor_layout_id ?? null,
      nomor_meja: data.nomor_meja,
      label: data.label || null,
      kapasitas: data.kapasitas ?? 4,
      posisi_x: data.posisi_x ?? 0,
      posisi_y: data.posisi_y ?? 0,
      bentuk: data.bentuk ?? 'persegi',
      lebar: data.lebar ?? 60,
      tinggi: data.tinggi ?? 60,
      status: 'KOSONG',
      qr_code: data.qr_code || null,
      catatan: data.catatan || null,
      created_at: new Date().toISOString(),
    }).run()
  }

  static updateTable(id: number, data: {
    nomor_meja?: string
    label?: string | null
    kapasitas?: number
    posisi_x?: number
    posisi_y?: number
    bentuk?: string
    lebar?: number
    tinggi?: number
    qr_code?: string | null
    catatan?: string | null
    floor_layout_id?: number | null
  }) {
    return db.update(tables).set(data).where(eq(tables.id, id)).run()
  }

  static updateTableStatus(id: number, status: string) {
    return db.update(tables).set({ status }).where(eq(tables.id, id)).run()
  }

  static deleteTable(id: number) {
    return db.delete(tables).where(eq(tables.id, id)).run()
  }

  static getTablesSummary() {
    const all = db.select().from(tables).all()
    return {
      total: all.length,
      KOSONG: all.filter(t => t.status === 'KOSONG').length,
      TERISI: all.filter(t => t.status === 'TERISI').length,
      RESERVASI: all.filter(t => t.status === 'RESERVASI').length,
      MAINTENANCE: all.filter(t => t.status === 'MAINTENANCE').length,
    }
  }

  // ─── RESERVATIONS ────────────────────────────────────────────

  static getReservations(date?: string) {
    const where = date ? like(reservations.tgl_reservasi, `%${date}%`) : undefined
    const list = db.select().from(reservations).where(where).orderBy(desc(reservations.tgl_reservasi)).all()
    return list.map(r => {
      let tableInfo: any = null
      if (r.table_id) {
        tableInfo = db.select().from(tables).where(eq(tables.id, r.table_id)).get()
      }
      return {
        ...r,
        nomor_meja: tableInfo?.nomor_meja,
        label_meja: tableInfo?.label,
      }
    })
  }

  static getReservationById(id: number) {
    const r = db.select().from(reservations).where(eq(reservations.id, id)).get()
    if (!r) return null
    let tableInfo: any = null
    if (r.table_id) {
      tableInfo = db.select().from(tables).where(eq(tables.id, r.table_id)).get()
    }
    return {
      ...r,
      nomor_meja: tableInfo?.nomor_meja,
      label_meja: tableInfo?.label,
    }
  }

  static createReservation(data: {
    nomor_reservasi: string
    nama_pelanggan: string
    no_telp?: string | null
    email?: string | null
    jumlah_tamu?: number
    tgl_reservasi: string
    jam_reservasi: string
    jam_berakhir?: string | null
    table_id?: number | null
    catatan?: string | null
    sumber?: string
    deposit?: number
    dibuat_oleh?: string | null
  }) {
    return db.insert(reservations).values({
      nomor_reservasi: data.nomor_reservasi,
      nama_pelanggan: data.nama_pelanggan,
      no_telp: data.no_telp || null,
      email: data.email || null,
      jumlah_tamu: data.jumlah_tamu ?? 1,
      tgl_reservasi: data.tgl_reservasi,
      jam_reservasi: data.jam_reservasi,
      jam_berakhir: data.jam_berakhir || null,
      table_id: data.table_id || null,
      catatan: data.catatan || null,
      status: 'MENUNGGU',
      sumber: data.sumber || 'MANUAL',
      deposit: data.deposit ?? 0,
      dibuat_oleh: data.dibuat_oleh || null,
      created_at: new Date().toISOString(),
      updated_at: null,
    }).run()
  }

  static updateReservationStatus(id: number, status: string) {
    const r = this.getReservationById(id)
    if (r?.table_id) {
      if (status === 'HADIR') {
        db.update(tables).set({ status: 'TERISI' }).where(eq(tables.id, r.table_id)).run()
      } else if (status === 'KONFIRMASI') {
        db.update(tables).set({ status: 'RESERVASI' }).where(eq(tables.id, r.table_id)).run()
      } else if (status === 'SELESAI' || status === 'BATAL') {
        db.update(tables).set({ status: 'KOSONG' }).where(eq(tables.id, r.table_id)).run()
      }
    }
    return db.update(reservations).set({
      status,
      updated_at: new Date().toISOString(),
    }).where(eq(reservations.id, id)).run()
  }

  static cancelReservation(id: number) {
    const r = this.getReservationById(id)
    if (r?.table_id) {
      db.update(tables).set({ status: 'KOSONG' }).where(eq(tables.id, r.table_id)).run()
    }
    return db.update(reservations).set({
      status: 'BATAL',
      updated_at: new Date().toISOString(),
    }).where(eq(reservations.id, id)).run()
  }

  static updateReservation(id: number, data: {
    nama_pelanggan?: string
    no_telp?: string | null
    email?: string | null
    jumlah_tamu?: number
    tgl_reservasi?: string
    jam_reservasi?: string
    jam_berakhir?: string | null
    table_id?: number | null
    catatan?: string | null
    status?: string
    deposit?: number
  }) {
    const old = this.getReservationById(id)
    if (old?.table_id && data.table_id !== undefined && old.table_id !== data.table_id) {
      db.update(tables).set({ status: 'KOSONG' }).where(eq(tables.id, old.table_id)).run()
      if (data.table_id) {
        const nextStatus = data.status === 'HADIR' ? 'TERISI' : 'RESERVASI'
        db.update(tables).set({ status: nextStatus }).where(eq(tables.id, data.table_id)).run()
      }
    }
    const updateData: Record<string, any> = {
      ...data,
      updated_at: new Date().toISOString(),
    }
    return db.update(reservations).set(updateData).where(eq(reservations.id, id)).run()
  }

  static deleteReservation(id: number) {
    const r = this.getReservationById(id)
    if (r?.table_id && (r.status === 'KONFIRMASI' || r.status === 'HADIR')) {
      db.update(tables).set({ status: 'KOSONG' }).where(eq(tables.id, r.table_id)).run()
    }
    return db.delete(reservations).where(eq(reservations.id, id)).run()
  }

  static getActiveReservations() {
    return db.select().from(reservations)
      .where(and(
        sql`${reservations.status} IN ('MENUNGGU', 'KONFIRMASI', 'HADIR')`
      ))
      .orderBy(desc(reservations.tgl_reservasi))
      .all()
  }

  static getUpcomingReservations(limit: number = 10) {
    return db.select().from(reservations)
      .where(and(
        gte(reservations.tgl_reservasi, new Date().toISOString().split('T')[0]),
        sql`${reservations.status} IN ('MENUNGGU', 'KONFIRMASI')`
      ))
      .orderBy(reservations.tgl_reservasi)
      .limit(limit)
      .all()
  }

  static generateNomorReservasi(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `RSV${year}${month}${day}${random}`
  }
}
