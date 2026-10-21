import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../src/database/schema'
import { BASE_SCHEMA_SQL } from '../../src/database/baseSchema'

/**
 * Database in memory untuk pengujian controller.
 *
 * Skema sama persis dengan aplikasi, jadi pengujian memakai tabel, kolom,
 * dan batasan yang sama dengan yang dipakai kasir di lapangan.
 */
export function createTestDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(BASE_SCHEMA_SQL)

  const db = drizzle(sqlite, { schema })

  return { sqlite, db }
}

export interface SeededStore {
  username: string
  shiftId: number
  productCode: string
  unitPrice: number
  costPrice: number
  initialStock: number
}

/** Isi data minimum untuk menjalankan satu transaksi penjualan. */
export function seedStore(sqlite: Database.Database): SeededStore {
  const username = 'kasir01'
  const productCode = 'BRG-001'

  sqlite.prepare(
    `INSERT INTO mediasoft_pengguna (nama_pengguna, nama_lengkap, kata_sandi, hak_akses, status_user, password_hash_type)
     VALUES (?, 'Kasir Satu', 'hash', 'kasir', 'Aktif', 'bcrypt')`,
  ).run(username)

  sqlite.prepare(
    `INSERT INTO mediasoft_kategori_barang (kd_kategori_barang, kategori_barang) VALUES (1, 'Umum')`,
  ).run()

  const unitId = sqlite.prepare(
    `INSERT INTO mediasoft_satuan (nama_satuan) VALUES ('Buah')`,
  ).run().lastInsertRowid as number

  sqlite.prepare(
    `INSERT INTO mediasoft_barang (kd_barang, nama_barang, stok, stok_minimum, kd_satuan, kd_kategori_barang, jenis_transaksi, barcode)
     VALUES (?, 'Kopi Susu', 25, 5, ?, 1, 'INCOME', '8991234567890')`,
  ).run(productCode, unitId)

  sqlite.prepare(
    `INSERT INTO mediasoft_harga (kd_barang, harga_barang, harga_modal, potongan) VALUES (?, 18000, 12000, 0)`,
  ).run(productCode)

  const shiftId = sqlite.prepare(
    `INSERT INTO mediasoft_shifts (shift_number, user_id, opening_balance, status, start_time)
     VALUES ('SHIFT-001', ?, 100000, 'OPEN', ?)`,
  ).run(username, new Date().toISOString()).lastInsertRowid as number

  return {
    username,
    shiftId,
    productCode,
    unitPrice: 18000,
    costPrice: 12000,
    initialStock: 25,
  }
}
