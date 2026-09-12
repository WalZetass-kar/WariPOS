import { describe, it, expect } from 'vitest'
import { calculateReceiptPdfHeight, type ReceiptData } from '../src/renderer/utils/receiptExporter'
import type { CartItem } from '../src/shared/types'

function createDummyCartItem(
  kd: string,
  nama: string,
  harga: number,
  qty: number,
  disc = 0
): CartItem {
  return {
    kd_barang: kd,
    nama_barang: nama,
    harga_jual: harga,
    qty,
    disc,
    barcode: `BAR-${kd}`,
  } as CartItem
}

function createDummyReceipt(cart: CartItem[], overrides: Partial<ReceiptData> = {}): ReceiptData {
  const subTotal = cart.reduce((acc, item) => {
    const disc = (item.harga_jual * (item.disc || 0)) / 100
    return acc + (item.harga_jual - disc) * item.qty
  }, 0)

  return {
    storeName: 'WariPOS Coffee & Resto',
    storeAddress: 'Jl. Merdeka No. 45, Bandung',
    storePhone: '081234567890',
    storeFooter: 'Terima kasih atas kunjungan Anda!',
    invoiceNumber: 'TRX-TEST-001',
    cashierName: 'Kasir 1',
    cart,
    subTotal,
    pajakAmount: Math.round(subTotal * 0.1),
    pajakPersen: 10,
    promoDiskon: 0,
    totalBayar: subTotal + Math.round(subTotal * 0.1),
    paidAmount: subTotal + Math.round(subTotal * 0.1) + 10000,
    kembalian: 10000,
    jenisBayar: 'TUNAI',
    ...overrides,
  }
}

describe('Receipt Layout Engine Tests', () => {
  it('Scenario 1: 1 produk dengan nama pendek', () => {
    const cart = [createDummyCartItem('001', 'Americano', 18000, 1)]
    const receipt = createDummyReceipt(cart)
    const height = calculateReceiptPdfHeight(receipt)

    expect(height).toBeGreaterThanOrEqual(75)
    expect(receipt.cart.length).toBe(1)
  })

  it('Scenario 2: 2-3 produk standar', () => {
    const cart = [
      createDummyCartItem('001', 'Americano', 18000, 2),
      createDummyCartItem('002', 'Croissant Butter', 22000, 1),
      createDummyCartItem('003', 'Mineral Water', 8000, 3),
    ]
    const receipt = createDummyReceipt(cart)
    const height = calculateReceiptPdfHeight(receipt)

    expect(height).toBeGreaterThan(75)
    expect(cart.length).toBe(3)
  })

  it('Scenario 3: Produk dengan nama panjang yang membutuhkan wrapping', () => {
    const shortCart = [createDummyCartItem('001', 'Kopi Susu', 15000, 1)]
    const longCart = [
      createDummyCartItem(
        '002',
        'Caramel Macchiato Double Shot Oatmilk Extra Vanilla Foam Large Size',
        48000,
        1
      ),
    ]

    const shortReceipt = createDummyReceipt(shortCart)
    const longReceipt = createDummyReceipt(longCart)

    const shortHeight = calculateReceiptPdfHeight(shortReceipt)
    const longHeight = calculateReceiptPdfHeight(longReceipt)

    // Produk panjang menghasilkan tinggi struk yang lebih besar karena wrapping
    expect(longHeight).toBeGreaterThan(shortHeight)
  })

  it('Scenario 4: Produk dengan nama sangat panjang (3 baris)', () => {
    const veryLongName =
      'Paket Komplit Super Hemat Keluarga Besar Bahagia Sejahtera Spesial Ayam Bakar Taliwang Pedas Manis Gurih Renyah Mantap Jiwa'
    const cart = [createDummyCartItem('001', veryLongName, 125000, 1)]
    const receipt = createDummyReceipt(cart)
    const height = calculateReceiptPdfHeight(receipt)

    expect(height).toBeGreaterThan(120)
  })

  it('Scenario 5: Transaksi dengan 10+ produk beragam', () => {
    const cart: CartItem[] = []
    for (let i = 1; i <= 15; i++) {
      cart.push(
        createDummyCartItem(
          `KD-${i}`,
          `Menu Spesial Warung Nomor ${i} Rasa Gurih Nikmat`,
          15000 + i * 1000,
          i % 3 + 1
        )
      )
    }
    const receipt = createDummyReceipt(cart)
    const height = calculateReceiptPdfHeight(receipt)

    // 15 items should scale dynamic height proportionally
    expect(height).toBeGreaterThan(200)
  })

  it('Scenario 6: Kuantitas 1 digit maupun banyak digit', () => {
    const cart = [
      createDummyCartItem('001', 'Permen Mint', 1000, 1),
      createDummyCartItem('002', 'Cangkir Kertas Takeaway', 500, 1500),
    ]
    const receipt = createDummyReceipt(cart)
    const height = calculateReceiptPdfHeight(receipt)

    expect(height).toBeGreaterThanOrEqual(75)
  })

  it('Scenario 7: Harga kecil maupun harga puluhan juta rupiah', () => {
    const cart = [
      createDummyCartItem('001', 'Kantong Plastik Ramah Lingkungan', 200, 1),
      createDummyCartItem('002', 'Mesin Espresso Komersial 2 Group', 45000000, 1),
    ]
    const receipt = createDummyReceipt(cart)
    const height = calculateReceiptPdfHeight(receipt)

    expect(height).toBeGreaterThanOrEqual(75)
    expect(receipt.totalBayar).toBeGreaterThan(45000000)
  })

  it('Scenario 8: Kombinasi produk nama pendek dan nama panjang', () => {
    const cart = [
      createDummyCartItem('001', 'Es Teh', 5000, 4),
      createDummyCartItem(
        '002',
        'Signature Roasted Hazelnut Latte Double Shot Arabica Blend Gayo Sumatra',
        38000,
        2
      ),
      createDummyCartItem('003', 'Air Putih', 3000, 1),
    ]
    const receipt = createDummyReceipt(cart)
    const height = calculateReceiptPdfHeight(receipt)

    expect(height).toBeGreaterThan(120)
  })

  it('Scenario 9: Verifikasi pertumbuhan tinggi dinamis monoton (Monotonic Growth)', () => {
    const cart1 = [createDummyCartItem('001', 'Menu A', 10000, 1)]
    const cart5 = Array.from({ length: 5 }, (_, i) =>
      createDummyCartItem(`00${i}`, `Menu A${i}`, 10000, 1)
    )
    const cart10 = Array.from({ length: 10 }, (_, i) =>
      createDummyCartItem(`00${i}`, `Menu A${i}`, 10000, 1)
    )

    const h1 = calculateReceiptPdfHeight(createDummyReceipt(cart1))
    const h5 = calculateReceiptPdfHeight(createDummyReceipt(cart5))
    const h10 = calculateReceiptPdfHeight(createDummyReceipt(cart10))

    expect(h5).toBeGreaterThanOrEqual(h1)
    expect(h10).toBeGreaterThan(h5)
  })

  it('Scenario 10: Verifikasi seluruh section di bawah daftar produk memiliki ruang aman', () => {
    const cart = [
      createDummyCartItem('001', 'Americano Iced', 16000, 3),
      createDummyCartItem('002', 'Caramel Macchiato', 24000, 2),
    ]
    const receipt = createDummyReceipt(cart, {
      promoDiskon: 5000,
      pajakAmount: 9600,
      pajakPersen: 10,
      poinEarned: 10,
      tableNumber: '12',
      orderType: 'DINE IN',
    })

    const height = calculateReceiptPdfHeight(receipt)
    expect(height).toBeGreaterThanOrEqual(130)
  })
})
