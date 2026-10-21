import type { CartItem } from '../../../shared/types'

export interface SalePayload {
  username: string
  items: CartItem[]
  yang_dibayar: number
  jenis_pembayaran: 'TUNAI' | 'TRANSFER' | 'QRIS'
  kd_customer?: string
  pajak: number
  diskon_promo: number
  kode_promo?: string
  shift_id?: number
  tipe_pesanan?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  nomor_meja?: string
  catatan?: string
}

export interface QrisPayment {
  provider?: 'static' | 'midtrans'
  orderId: string
  qrImageUrl?: string
  qrString?: string
  transactionId?: string
  transactionStatus?: string
}

export interface QrisStatus {
  paid: boolean
  failed: boolean
  pending: boolean
  transactionStatus?: string
  fraudStatus?: string
}
