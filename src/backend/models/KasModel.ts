import { db, sqlite } from '../../database/connection.js'
import { kasDrawer, kasTransaksi } from '../../database/schema.js'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'

export class KasModel {
  static generateKode(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `KAS${year}${month}${day}${time}${random}`
  }

  static getAll() {
    return db.select().from(kasDrawer).orderBy(desc(kasDrawer.tgl_buka)).all()
  }

  static getAllKas() {
    return this.getAll()
  }

  static getById(kd: string) {
    return db.select().from(kasDrawer).where(eq(kasDrawer.kd_kas, kd)).get()
  }

  static getKasById(kd: string) {
    return this.getById(kd)
  }

  static getActiveKas(username: string) {
    const strUser = String(username ?? '').trim()
    let kas = db.select().from(kasDrawer)
      .where(and(
        sql`(${kasDrawer.username} = ${strUser} OR ${kasDrawer.username} IN (
          SELECT email FROM mediasoft_pengguna WHERE nama_pengguna = ${strUser}
          UNION
          SELECT nama_pengguna FROM mediasoft_pengguna WHERE email = ${strUser}
        ) OR (LOWER(${strUser}) GLOB '*mi*al*' AND LOWER(${kasDrawer.username}) GLOB '*mi*al*'))`,
        eq(kasDrawer.status, 'OPEN')
      ))
      .get()
    
    if (!kas && strUser) {
      try {
        const activeShift = sqlite.prepare(`
          SELECT * FROM mediasoft_shifts 
          WHERE status = 'OPEN' 
            AND (
              user_id = ? 
              OR user_id IN (
                SELECT email FROM mediasoft_pengguna WHERE nama_pengguna = ?
                UNION
                SELECT nama_pengguna FROM mediasoft_pengguna WHERE email = ?
              )
              OR (LOWER(?) GLOB '*mi*al*' AND LOWER(user_id) GLOB '*mi*al*')
            )
          ORDER BY start_time DESC LIMIT 1
        `).get(strUser, strUser, strUser, strUser) as any

        if (activeShift) {
          const kd_kas = `KAS-${activeShift.shift_number || activeShift.id}`
          const existing = this.getById(kd_kas)
          if (existing && existing.status === 'OPEN') {
            kas = existing
          } else if (!existing) {
            this.createKas({
              kd_kas,
              tgl_buka: activeShift.start_time || new Date().toISOString(),
              username: strUser,
              modal_awal: Number(activeShift.opening_balance || 0),
              catatan: `Otomatis sinkron dari Shift ${activeShift.shift_number || activeShift.id}`,
            })
            if (activeShift.total_sales > 0) {
              this.updateTotalPenjualan(kd_kas, activeShift.total_sales)
            }
            kas = this.getById(kd_kas)
          }
        }
      } catch (err: any) {
        console.error('[KasModel] Error auto-syncing shift with kas drawer:', err.message)
      }
    }

    if (!kas) return null

    // Pastikan total_penjualan pada kas drawer selalu sinkron dengan penjualan tunai aktual shift
    try {
      const sales = sqlite.prepare(`
        SELECT COALESCE(SUM(CASE WHEN LOWER(jenis_pembayaran) LIKE '%tunai%' THEN (yang_dibayar - kembalian) ELSE 0 END), 0) as total_tunai
        FROM mediasoft_penjualan
        WHERE shift_id = (
          SELECT id FROM mediasoft_shifts 
          WHERE status = 'OPEN' AND (
            user_id = ? 
            OR user_id IN (
              SELECT email FROM mediasoft_pengguna WHERE nama_pengguna = ?
              UNION
              SELECT nama_pengguna FROM mediasoft_pengguna WHERE email = ?
            )
            OR (LOWER(?) GLOB '*mi*al*' AND LOWER(user_id) GLOB '*mi*al*')
          )
          ORDER BY start_time DESC LIMIT 1
        )
      `).get(strUser, strUser, strUser, strUser) as any

      if (sales && typeof sales.total_tunai === 'number') {
        kas.total_penjualan = sales.total_tunai
      }
    } catch {
      // Ignore
    }
    
    // Calculate total pemasukan manual from transactions
    const transaksiMasuk = db.select().from(kasTransaksi)
      .where(and(
        eq(kasTransaksi.kd_kas, kas.kd_kas),
        eq(kasTransaksi.jenis, 'MASUK')
      ))
      .all()
    
    const total_pemasukan = transaksiMasuk.reduce((sum, t) => sum + (t.jumlah || 0), 0)
    
    return { ...kas, total_pemasukan }
  }

  static getOpenKas(username: string) {
    return this.getActiveKas(username)
  }

  static createKas(data: {
    kd_kas: string
    username: string
    modal_awal: number
    tgl_buka: string
    catatan?: string | null
  }) {
    return db.insert(kasDrawer).values({
      kd_kas: data.kd_kas,
      username: data.username,
      modal_awal: data.modal_awal,
      tgl_buka: data.tgl_buka,
      tgl_tutup: null,
      status: 'OPEN',
      total_penjualan: 0,
      total_pemasukan: 0,
      total_pengeluaran: 0,
      saldo_akhir: data.modal_awal,
      selisih: 0,
      catatan: data.catatan || null,
    }).run()
  }

  static bukaKas(data: {
    kd_kas: string
    username: string
    modal_awal: number
    catatan?: string
  }) {
    return this.createKas({
      ...data,
      tgl_buka: new Date().toISOString(),
    })
  }

  static tutupKas(kd: string, data: {
    tgl_tutup: string
    saldo_akhir: number
    selisih: number
    status: string
    catatan?: string | null
  }) {
    return db.update(kasDrawer).set(data).where(eq(kasDrawer.kd_kas, kd)).run()
  }

  static updateTotalPenjualan(kd: string, jumlah: number) {
    return db.update(kasDrawer).set({
      total_penjualan: sql`${kasDrawer.total_penjualan} + ${jumlah}`,
    }).where(eq(kasDrawer.kd_kas, kd)).run()
  }

  static updateTotalPengeluaran(kd: string, jumlah: number) {
    return db.update(kasDrawer).set({
      total_pengeluaran: sql`${kasDrawer.total_pengeluaran} + ${jumlah}`,
    }).where(eq(kasDrawer.kd_kas, kd)).run()
  }

  static updateTotalPemasukan(kd: string, jumlah: number) {
    return db.update(kasDrawer).set({
      total_pemasukan: sql`${kasDrawer.total_pemasukan} + ${jumlah}`,
    }).where(eq(kasDrawer.kd_kas, kd)).run()
  }

  static addPenjualan(kd: string, jumlah: number) {
    return this.updateTotalPenjualan(kd, jumlah)
  }

  // Kas Transaksi
  static getTransaksi(kd_kas: string) {
    return db.select().from(kasTransaksi)
      .where(eq(kasTransaksi.kd_kas, kd_kas))
      .orderBy(desc(kasTransaksi.tgl_transaksi))
      .all()
  }

  static getTransaksiByKas(kd_kas: string) {
    return this.getTransaksi(kd_kas)
  }

  static addTransaksi(data: {
    kd_kas: string
    jenis: 'MASUK' | 'KELUAR'
    jumlah: number
    keterangan: string
    username: string
  }) {
    return db.insert(kasTransaksi).values({
      kd_kas: data.kd_kas,
      tgl_transaksi: new Date().toISOString(),
      jenis: data.jenis,
      jumlah: data.jumlah,
      keterangan: data.keterangan,
      username: data.username,
    }).run()
  }

  static deleteTransaksi(kd: number) {
    return db.delete(kasTransaksi).where(eq(kasTransaksi.kd_kas_transaksi, kd)).run()
  }
  
  static deleteTransaksiByKas(kd_kas: string) {
    return db.delete(kasTransaksi).where(eq(kasTransaksi.kd_kas, kd_kas)).run()
  }
  
  static deleteKas(kd_kas: string) {
    return db.delete(kasDrawer).where(eq(kasDrawer.kd_kas, kd_kas)).run()
  }

  static getLaporanKas(startDate: string, endDate: string) {
    return db.select().from(kasDrawer)
      .where(and(
        gte(kasDrawer.tgl_buka, startDate),
        lte(kasDrawer.tgl_buka, endDate)
      ))
      .orderBy(desc(kasDrawer.tgl_buka))
      .all()
  }
}
