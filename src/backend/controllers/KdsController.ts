import { KdsModel } from '../models/KdsModel.js'
import { requireAuth } from '../utils/authGuard.js'

export class KdsController {
  // ─── KDS ORDERS ──────────────────────────────────────────────

  static getOrders(status?: string, dapur?: string) {
    try {
      const orders = KdsModel.getOrders(status, dapur)
      return { success: true, data: orders }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data order: ' + (error as Error).message }
    }
  }

  static getOrderById(id: number) {
    try {
      const order = KdsModel.getOrderById(id)
      if (!order) {
        return { success: false, message: 'Order tidak ditemukan' }
      }
      return { success: true, data: order }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data order: ' + (error as Error).message }
    }
  }

  static async createOrder(data: {
    kd_transaksi: string
    nomor_meja?: string | null
    nama_pelanggan?: string | null
    jenis_order?: string
    catatan?: string | null
    dapur?: string | null
    dibuat_oleh?: string | null
    username?: string
  }) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const result = KdsModel.createOrder({
        kd_transaksi: data.kd_transaksi,
        nomor_meja: data.nomor_meja,
        nama_pelanggan: data.nama_pelanggan,
        jenis_order: data.jenis_order,
        catatan: data.catatan,
        dapur: data.dapur,
        dibuat_oleh: data.dibuat_oleh,
      })
      return { success: true, message: 'Order berhasil dibuat', data: result }
    } catch (error) {
      return { success: false, message: 'Gagal membuat order: ' + (error as Error).message }
    }
  }

  static async updateOrderStatus(id: number, status: string, waktu?: string, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const order = KdsModel.getOrderById(id)
      if (!order) {
        return { success: false, message: 'Order tidak ditemukan' }
      }
      KdsModel.updateOrderStatus(id, status, waktu)
      return { success: true, message: 'Status order berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui status order: ' + (error as Error).message }
    }
  }

  static async deleteOrder(id: number) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      KdsModel.deleteOrder(id)
      return { success: true, message: 'Pesanan dapur berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus pesanan dapur: ' + (error as Error).message }
    }
  }

  static async clearOrders(status?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      KdsModel.clearOrders(status)
      return { success: true, message: 'Riwayat pesanan dapur berhasil dibersihkan' }
    } catch (error) {
      return { success: false, message: 'Gagal membersihkan riwayat dapur: ' + (error as Error).message }
    }
  }

  static async addOrderItem(data: {
    kds_order_id: number
    kd_barang: string
    nama_item: string
    qty?: number
    catatan?: string | null
    username?: string
  }) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      KdsModel.addOrderItem(data)
      return { success: true, message: 'Item order berhasil ditambahkan' }
    } catch (error) {
      return { success: false, message: 'Gagal menambahkan item order: ' + (error as Error).message }
    }
  }

  static async updateOrderItemStatus(id: number, status: string, waktu?: string, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      KdsModel.updateOrderItemStatus(id, status, waktu)
      return { success: true, message: 'Status item order berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui status item: ' + (error as Error).message }
    }
  }

  static getOrderItems(orderId: number) {
    try {
      const items = KdsModel.getOrderItems(orderId)
      return { success: true, data: items }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil item order: ' + (error as Error).message }
    }
  }

  static getOrdersSummary() {
    try {
      const summary = KdsModel.getOrdersSummary()
      return { success: true, data: summary }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil ringkasan order: ' + (error as Error).message }
    }
  }

  static getPendingOrders() {
    try {
      const orders = KdsModel.getPendingOrders()
      return { success: true, data: orders }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil pending order: ' + (error as Error).message }
    }
  }

  static getAveragePrepTime() {
    try {
      const avg = KdsModel.getAveragePrepTime()
      return { success: true, data: avg }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil rata-rata waktu persiapan: ' + (error as Error).message }
    }
  }

  // ─── FLOOR LAYOUTS ───────────────────────────────────────────

  static getFloorLayouts() {
    try {
      const layouts = KdsModel.getFloorLayouts()
      return { success: true, data: layouts }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data layout: ' + (error as Error).message }
    }
  }

  static getFloorLayoutById(id: number) {
    try {
      const layout = KdsModel.getFloorLayoutById(id)
      if (!layout) {
        return { success: false, message: 'Layout tidak ditemukan' }
      }
      return { success: true, data: layout }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data layout: ' + (error as Error).message }
    }
  }

  static async createFloorLayout(data: {
    nama: string
    kapasitas?: number
    width?: number
    height?: number
    username?: string
  }) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      if (!data.nama?.trim()) {
        return { success: false, message: 'Nama layout wajib diisi' }
      }
      const result = KdsModel.createFloorLayout(data)
      return { success: true, message: 'Layout berhasil dibuat', data: result }
    } catch (error) {
      return { success: false, message: 'Gagal membuat layout: ' + (error as Error).message }
    }
  }

  static async updateFloorLayout(id: number, data: {
    nama?: string
    kapasitas?: number
    width?: number
    height?: number
    is_active?: number
    username?: string
  }) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const layout = KdsModel.getFloorLayoutById(id)
      if (!layout) {
        return { success: false, message: 'Layout tidak ditemukan' }
      }
      KdsModel.updateFloorLayout(id, data)
      return { success: true, message: 'Layout berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui layout: ' + (error as Error).message }
    }
  }

  static async deleteFloorLayout(id: number) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const layout = KdsModel.getFloorLayoutById(id)
      if (!layout) {
        return { success: false, message: 'Layout tidak ditemukan' }
      }
      KdsModel.deleteFloorLayout(id)
      return { success: true, message: 'Layout berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus layout: ' + (error as Error).message }
    }
  }

  // ─── TABLES ──────────────────────────────────────────────────

  static getAllTables(layoutId?: number) {
    try {
      const tableList = KdsModel.getAllTables(layoutId)
      return { success: true, data: tableList }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data meja: ' + (error as Error).message }
    }
  }

  static getTableById(id: number) {
    try {
      const table = KdsModel.getTableById(id)
      if (!table) {
        return { success: false, message: 'Meja tidak ditemukan' }
      }
      return { success: true, data: table }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data meja: ' + (error as Error).message }
    }
  }

  static async createTable(data: {
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
    username?: string
  }) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      if (!data.nomor_meja?.trim()) {
        return { success: false, message: 'Nomor meja wajib diisi' }
      }
      const result = KdsModel.createTable(data)
      return { success: true, message: 'Meja berhasil dibuat', data: result }
    } catch (error) {
      return { success: false, message: 'Gagal membuat meja: ' + (error as Error).message }
    }
  }

  static async updateTable(id: number, data: {
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
    username?: string
  }) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const table = KdsModel.getTableById(id)
      if (!table) {
        return { success: false, message: 'Meja tidak ditemukan' }
      }
      KdsModel.updateTable(id, data)
      return { success: true, message: 'Meja berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui meja: ' + (error as Error).message }
    }
  }

  static async updateTableStatus(id: number, status: string, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const table = KdsModel.getTableById(id)
      if (!table) {
        return { success: false, message: 'Meja tidak ditemukan' }
      }
      KdsModel.updateTableStatus(id, status)
      return { success: true, message: 'Status meja berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui status meja: ' + (error as Error).message }
    }
  }

  static async deleteTable(id: number, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const table = KdsModel.getTableById(id)
      if (!table) {
        return { success: false, message: 'Meja tidak ditemukan' }
      }
      KdsModel.deleteTable(id)
      return { success: true, message: 'Meja berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus meja: ' + (error as Error).message }
    }
  }

  static getTablesSummary() {
    try {
      const summary = KdsModel.getTablesSummary()
      return { success: true, data: summary }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil ringkasan meja: ' + (error as Error).message }
    }
  }

  // ─── RESERVATIONS ────────────────────────────────────────────

  static getReservations(date?: string) {
    try {
      const reservations = KdsModel.getReservations(date)
      return { success: true, data: reservations }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data reservasi: ' + (error as Error).message }
    }
  }

  static getReservationById(id: number) {
    try {
      const reservation = KdsModel.getReservationById(id)
      if (!reservation) {
        return { success: false, message: 'Reservasi tidak ditemukan' }
      }
      return { success: true, data: reservation }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil data reservasi: ' + (error as Error).message }
    }
  }

  static async createReservation(data: {
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
    username?: string
  }) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      if (!data.nama_pelanggan?.trim()) {
        return { success: false, message: 'Nama pelanggan wajib diisi' }
      }
      if (!data.tgl_reservasi) {
        return { success: false, message: 'Tanggal reservasi wajib diisi' }
      }
      if (!data.jam_reservasi) {
        return { success: false, message: 'Jam reservasi wajib diisi' }
      }
      const nomor_reservasi = KdsModel.generateNomorReservasi()
      const result = KdsModel.createReservation({
        nomor_reservasi,
        nama_pelanggan: data.nama_pelanggan,
        no_telp: data.no_telp,
        email: data.email,
        jumlah_tamu: data.jumlah_tamu,
        tgl_reservasi: data.tgl_reservasi,
        jam_reservasi: data.jam_reservasi,
        jam_berakhir: data.jam_berakhir,
        table_id: data.table_id,
        catatan: data.catatan,
        sumber: data.sumber,
        deposit: data.deposit,
        dibuat_oleh: data.dibuat_oleh,
      })
      return { success: true, message: 'Reservasi berhasil dibuat', data: { nomor_reservasi, ...result } }
    } catch (error) {
      return { success: false, message: 'Gagal membuat reservasi: ' + (error as Error).message }
    }
  }

  static async updateReservationStatus(id: number, status: string, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const reservation = KdsModel.getReservationById(id)
      if (!reservation) {
        return { success: false, message: 'Reservasi tidak ditemukan' }
      }
      KdsModel.updateReservationStatus(id, status)
      return { success: true, message: 'Status reservasi berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui status reservasi: ' + (error as Error).message }
    }
  }

  static async cancelReservation(id: number, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const reservation = KdsModel.getReservationById(id)
      if (!reservation) {
        return { success: false, message: 'Reservasi tidak ditemukan' }
      }
      KdsModel.cancelReservation(id)
      return { success: true, message: 'Reservasi berhasil dibatalkan' }
    } catch (error) {
      return { success: false, message: 'Gagal membatalkan reservasi: ' + (error as Error).message }
    }
  }

  static async updateReservation(id: number, data: any, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const reservation = KdsModel.getReservationById(id)
      if (!reservation) {
        return { success: false, message: 'Reservasi tidak ditemukan' }
      }
      KdsModel.updateReservation(id, data)
      return { success: true, message: 'Reservasi berhasil diperbarui' }
    } catch (error) {
      return { success: false, message: 'Gagal memperbarui reservasi: ' + (error as Error).message }
    }
  }

  static async deleteReservation(id: number, username?: string) {
    const authError = await requireAuth()
    if (authError) return authError

    try {
      const reservation = KdsModel.getReservationById(id)
      if (!reservation) {
        return { success: false, message: 'Reservasi tidak ditemukan' }
      }
      KdsModel.deleteReservation(id)
      return { success: true, message: 'Reservasi berhasil dihapus' }
    } catch (error) {
      return { success: false, message: 'Gagal menghapus reservasi: ' + (error as Error).message }
    }
  }

  static getActiveReservations() {
    try {
      const reservations = KdsModel.getActiveReservations()
      return { success: true, data: reservations }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil reservasi aktif: ' + (error as Error).message }
    }
  }

  static getUpcomingReservations(limit: number = 10) {
    try {
      const reservations = KdsModel.getUpcomingReservations(limit)
      return { success: true, data: reservations }
    } catch (error) {
      return { success: false, message: 'Gagal mengambil reservasi mendatang: ' + (error as Error).message }
    }
  }
}
