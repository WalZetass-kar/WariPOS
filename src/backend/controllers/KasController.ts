import { KasModel } from '../models/KasModel.js'
import { sqlite } from '../../database/connection.js'
import type { KasDrawer, KasTransaksi } from '../../shared/types'
import { requireAuth } from '../utils/authGuard.js'

export class KasController {
  // Kas Drawer Management
  static getActiveKas(username: string) {
    try {
      const kas = KasModel.getActiveKas(username)
      return { success: true, data: kas }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data kas: ' + (error as Error).message }
    }
  }

  static getAllKas() {
    try {
      const kasList = KasModel.getAllKas()
      return { success: true, data: kasList }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data kas: ' + (error as Error).message }
    }
  }

  static getKasById(kd_kas: string) {
    try {
      const kas = KasModel.getKasById(kd_kas)
      if (!kas) {
        return { success: false, message: 'Kas tidak ditemukan' }
      }
      return { success: true, data: kas }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data kas: ' + (error as Error).message }
    }
  }

  static async bukaKas(username: string, modal_awal: number, catatan?: string) {
    const authError = await requireAuth();
    if (authError) return authError;

    try {
      // Check if user already has active kas
      const activeKas = KasModel.getActiveKas(username)
      if (activeKas) {
        return { success: false, message: 'Anda masih memiliki kas yang belum ditutup' }
      }

      if (modal_awal < 0) {
        return { success: false, message: 'Modal awal tidak boleh negatif' }
      }

      const kd_kas = KasModel.generateKode()
      const tgl_buka = new Date().toISOString()

      KasModel.createKas({
        kd_kas,
        tgl_buka,
        username,
        modal_awal,
        catatan: catatan || null,
      })

      // Sync dengan shift aktif jika belum ada
      try {
        const activeShift = sqlite.prepare(`
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
          LIMIT 1
        `).get(username, username, username, username)
        if (!activeShift) {
          const shiftNumber = `SHIFT${Date.now()}`
          sqlite.prepare(`
            INSERT INTO mediasoft_shifts (shift_number, user_id, start_time, opening_balance)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
          `).run(shiftNumber, username, modal_awal)
        }
      } catch (shiftErr: any) {
        console.warn('[KasController] Sync shift open:', shiftErr.message)
      }

      return { success: true, message: 'Kas berhasil dibuka', data: { kd_kas } }
    } catch (error) {
      return { success: false, message: 'Gagal membuka kas: ' + (error as Error).message }
    }
  }

  static tutupKas(kd_kas: string, saldo_akhir_fisik: number, catatan?: string) {
    try {
      const kas = KasModel.getKasById(kd_kas)
      if (!kas) {
        return { success: false, message: 'Kas tidak ditemukan' }
      }

      if (kas.status === 'CLOSED') {
        return { success: false, message: 'Kas sudah ditutup' }
      }

      const tgl_tutup = new Date().toISOString()
      const saldo_sistem = (kas.modal_awal || 0) + (kas.total_penjualan || 0) + (kas.total_pemasukan || 0) - (kas.total_pengeluaran || 0)
      const selisih = saldo_akhir_fisik - saldo_sistem

      KasModel.tutupKas(kd_kas, {
        tgl_tutup,
        saldo_akhir: saldo_akhir_fisik,
        selisih,
        status: 'CLOSED',
        catatan: catatan || kas.catatan,
      })

      // Sync tutup shift aktif terkait
      try {
        sqlite.prepare(`
          UPDATE mediasoft_shifts
          SET end_time = CURRENT_TIMESTAMP,
              closing_balance = ?,
              expected_balance = ?,
              difference = ?,
              status = 'CLOSED',
              notes = COALESCE(notes, '') || ' (Ditutup bersamaan dari Kas)'
          WHERE status = 'OPEN' AND (
            user_id = ? 
            OR user_id IN (
              SELECT email FROM mediasoft_pengguna WHERE nama_pengguna = ?
              UNION
              SELECT nama_pengguna FROM mediasoft_pengguna WHERE email = ?
            )
            OR (LOWER(?) GLOB '*mi*al*' AND LOWER(user_id) GLOB '*mi*al*')
          )
        `).run(saldo_akhir_fisik, saldo_sistem, selisih, kas.username, kas.username, kas.username, kas.username)
      } catch (shiftErr: any) {
        console.warn('[KasController] Sync shift close:', shiftErr.message)
      }

      return {
        success: true,
        message: 'Kas berhasil ditutup',
        data: { saldo_sistem, saldo_akhir_fisik, selisih },
      }
    } catch (error) {
      return { success: false, message: 'Gagal menutup kas: ' + (error as Error).message }
    }
  }

  // Kas Transaksi Management
  static getTransaksiByKas(kd_kas: string) {
    try {
      const transaksi = KasModel.getTransaksiByKas(kd_kas)
      return { success: true, data: transaksi }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil transaksi: ' + (error as Error).message }
    }
  }

  static addPengeluaran(kd_kas: string, jumlah: number, keterangan: string, username: string) {
    try {
      const kas = KasModel.getKasById(kd_kas)
      if (!kas) {
        return { success: false, message: 'Kas tidak ditemukan' }
      }

      if (kas.status === 'CLOSED') {
        return { success: false, message: 'Kas sudah ditutup, tidak bisa menambah pengeluaran' }
      }

      if (jumlah <= 0) {
        return { success: false, message: 'Jumlah pengeluaran harus lebih dari 0' }
      }

      if (!keterangan?.trim()) {
        return { success: false, message: 'Keterangan wajib diisi' }
      }

      KasModel.addTransaksi({
        kd_kas,
        jenis: 'KELUAR',
        jumlah,
        keterangan,
        username,
      })

      // Update total pengeluaran di kas drawer
      KasModel.updateTotalPengeluaran(kd_kas, jumlah)

      return { success: true, message: 'Pengeluaran berhasil dicatat' }
    } catch (error) {
      return { success: false, message: 'Gagal mencatat pengeluaran: ' + (error as Error).message }
    }
  }

  static addPemasukan(kd_kas: string, jumlah: number, keterangan: string, username: string) {
    try {
      const kas = KasModel.getKasById(kd_kas)
      if (!kas) {
        return { success: false, message: 'Kas tidak ditemukan' }
      }

      if (kas.status === 'CLOSED') {
        return { success: false, message: 'Kas sudah ditutup' }
      }

      if (jumlah <= 0) {
        return { success: false, message: 'Jumlah pemasukan harus lebih dari 0' }
      }

      KasModel.addTransaksi({
        kd_kas,
        jenis: 'MASUK',
        jumlah,
        keterangan: keterangan || 'Pemasukan',
        username,
      })

      KasModel.updateTotalPemasukan(kd_kas, jumlah)

      return { success: true, message: 'Pemasukan berhasil dicatat' }
    } catch (error) {
      return { success: false, message: 'Gagal mencatat pemasukan: ' + (error as Error).message }
    }
  }

  static updateTotalPenjualan(kd_kas: string, amount: number) {
    try {
      KasModel.updateTotalPenjualan(kd_kas, amount)
      return { success: true }
    } catch (error) {
      return { success: false, message: 'Gagal update total penjualan: ' + (error as Error).message }
    }
  }

  static deleteTransaksi(kd_kas_transaksi: number) {
    try {
      KasModel.deleteTransaksi(kd_kas_transaksi)
      return { success: true, message: 'Transaksi berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus transaksi: ' + (error as Error).message }
    }
  }
  
  static deleteKas(kd_kas: string) {
    try {
      const kas = KasModel.getKasById(kd_kas)
      if (!kas) {
        return { success: false, message: 'Kas tidak ditemukan' }
      }
      
      if (kas.status === 'OPEN') {
        return { success: false, message: 'Tidak dapat menghapus kas yang masih terbuka' }
      }
      
      // Hapus transaksi terkait dulu
      KasModel.deleteTransaksiByKas(kd_kas)
      
      // Hapus kas
      KasModel.deleteKas(kd_kas)
      
      return { success: true, message: 'Riwayat kas berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus kas: ' + (error as Error).message }
    }
  }

  static getLaporanKas(startDate: string, endDate: string) {
    try {
      const laporan = KasModel.getLaporanKas(startDate, endDate)
      return { success: true, data: laporan }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil laporan: ' + (error as Error).message }
    }
  }
}
