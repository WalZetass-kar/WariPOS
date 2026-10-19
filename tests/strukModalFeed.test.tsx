import React, { createRef } from 'react'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import StrukModal from '../src/renderer/components/transaksi/StrukModal'
import type { CartItem } from '../src/shared/types'

vi.mock('../src/renderer/contexts/ToastContext', () => ({ useToast: () => vi.fn() }))

const PAPER_HEIGHT = 300
const PRINTER_LIP = 30
let offsetHeightSpy: PropertyDescriptor | undefined

beforeAll(() => {
  offsetHeightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => PAPER_HEIGHT })
})

afterAll(() => {
  if (offsetHeightSpy) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeightSpy)
})

const cart = [
  { kd_barang: 'A1', nama_barang: 'Kopi Susu Gula Aren', harga_jual: 18000, qty: 2, disc: 0 },
  { kd_barang: 'B2', nama_barang: 'Roti Bakar Coklat', harga_jual: 15000, qty: 1, disc: 10 },
] as CartItem[]

function renderModal() {
  return render(
    <StrukModal
      open
      cart={cart}
      subTotal={49500}
      pajakAmount={0}
      pajakPersen={0}
      totalBayar={49500}
      promoDiskon={0}
      paidAmount={50000}
      kembalian={500}
      lastKd="TRX-001"
      jenisBayar="TUNAI"
      selectedCustomer={null}
      poinEarned={0}
      user={{ nama_pengguna: 'kasir1' }}
      strukRef={createRef<HTMLDivElement>()}
      manualWaPhone=""
      btPrinting={false}
      bluetoothPrinterConnected={false}
      onClose={() => {}}
      onSendWhatsApp={() => {}}
      onHandlePrint={() => {}}
      onHandleBluetoothPrint={() => {}}
      onChangeManualWaPhone={() => {}}
    />
  )
}

describe('StrukModal paper feed', () => {
  it('keeps receipt text visible inside the paper while it is still feeding', () => {
    renderModal()
    const paperItem = screen.getAllByText('Kopi Susu Gula Aren')[0]
    // Text must ride on the paper, not wait for a separate fade that ends after the feed.
    let node: HTMLElement | null = paperItem
    while (node) {
      expect(node.style.opacity === '0').toBe(false)
      node = node.parentElement
    }
    expect(screen.getAllByText('Roti Bakar Coklat').length).toBeGreaterThan(0)
  })

  it('feeds with compositor transforms instead of an animated clip-path', () => {
    const { container } = renderModal()
    const animated = Array.from(container.ownerDocument.querySelectorAll<HTMLElement>('[style]'))
    expect(animated.some(el => el.style.clipPath)).toBe(false)

    const feedDistance = PAPER_HEIGHT + PRINTER_LIP
    const window_ = animated.find(el => el.style.transform.includes(`translateY(-${feedDistance}px)`))
    const paper = animated.find(el => el.style.transform.includes(`translateY(${feedDistance}px)`))
    expect(window_).toBeDefined()
    expect(paper).toBeDefined()
    expect(window_!.contains(paper!)).toBe(true)
  })
})
