import { useSyncExternalStore } from 'react'
import type { CartItem, Customer } from '../../shared/types'

export interface CartStoreState {
  cart: CartItem[]
  selectedCustomer: Customer | null
  jenisBayar: 'TUNAI' | 'TRANSFER' | 'QRIS'
  bayar: string
  promoCode: string
  promoDiskon: number
  promoMsg: string
}

let currentCartState: CartStoreState = {
  cart: [],
  selectedCustomer: null,
  jenisBayar: 'TUNAI',
  bayar: '',
  promoCode: '',
  promoDiskon: 0,
  promoMsg: '',
}

const cartListeners = new Set<() => void>()

function emitCartChange() {
  cartListeners.forEach((listener) => listener())
}

export function useCartStore() {
  const state = useSyncExternalStore(
    (onStoreChange) => {
      cartListeners.add(onStoreChange)
      return () => {
        cartListeners.delete(onStoreChange)
      }
    },
    () => currentCartState,
    () => currentCartState
  )

  return {
    ...state,
    addToCart: (newItem: CartItem) => {
      const existing = currentCartState.cart.find((i) => i.kd_barang === newItem.kd_barang)
      if (existing) {
        currentCartState = {
          ...currentCartState,
          cart: currentCartState.cart.map((i) =>
            i.kd_barang === newItem.kd_barang ? { ...i, qty: i.qty + 1 } : i
          ),
        }
      } else {
        currentCartState = { ...currentCartState, cart: [...currentCartState.cart, newItem] }
      }
      emitCartChange()
    },

    removeFromCart: (kdBarang: string) => {
      currentCartState = {
        ...currentCartState,
        cart: currentCartState.cart.filter((i) => i.kd_barang !== kdBarang),
      }
      emitCartChange()
    },

    updateQty: (kdBarang: string, qty: number) => {
      currentCartState = {
        ...currentCartState,
        cart:
          qty <= 0
            ? currentCartState.cart.filter((i) => i.kd_barang !== kdBarang)
            : currentCartState.cart.map((i) => (i.kd_barang === kdBarang ? { ...i, qty } : i)),
      }
      emitCartChange()
    },

    clearCart: () => {
      currentCartState = {
        ...currentCartState,
        cart: [],
        bayar: '',
        promoCode: '',
        promoDiskon: 0,
        promoMsg: '',
      }
      emitCartChange()
    },

    setSelectedCustomer: (customer: Customer | null) => {
      currentCartState = { ...currentCartState, selectedCustomer: customer }
      emitCartChange()
    },

    setJenisBayar: (jenis: 'TUNAI' | 'TRANSFER' | 'QRIS') => {
      currentCartState = { ...currentCartState, jenisBayar: jenis }
      emitCartChange()
    },

    setBayar: (bayar: string) => {
      currentCartState = { ...currentCartState, bayar }
      emitCartChange()
    },

    setPromo: (code: string, diskon: number, msg: string) => {
      currentCartState = { ...currentCartState, promoCode: code, promoDiskon: diskon, promoMsg: msg }
      emitCartChange()
    },

    clearPromo: () => {
      currentCartState = { ...currentCartState, promoCode: '', promoDiskon: 0, promoMsg: '' }
      emitCartChange()
    },
  }
}
