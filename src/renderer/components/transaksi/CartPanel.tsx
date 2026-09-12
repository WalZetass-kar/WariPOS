import React from 'react'
import { ShoppingCart, Pause, Play, Bluetooth, Settings, Minus, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatRupiah } from '../../utils/format'
import { CartItem } from '../../../shared/types'

interface CartPanelProps {
  cart: CartItem[]
  totalCartQty: number
  heldCarts: any[]
  bluetoothPrinterConnected: boolean
  onHold: () => void
  onShowHeld: () => void
  onShowBtPrinter: () => void
  onShowSettings: () => void
  onUpdateQty: (kd: string, delta: number) => void
  onRemoveItem: (kd: string) => void
  isMobileSheet?: boolean
}

export default function CartPanel({
  cart, totalCartQty, heldCarts, bluetoothPrinterConnected, onHold, onShowHeld, onShowBtPrinter, onShowSettings, onUpdateQty, onRemoveItem, isMobileSheet = false
}: CartPanelProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-3 shrink-0">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-red-600" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">Keranjang Belanja</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
            {totalCartQty} Item
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onHold}
            disabled={cart.length === 0}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-600 transition-colors disabled:opacity-30"
            title="Hold Transaksi (Ctrl+H)"
          >
            <Pause size={16} />
          </button>

          {heldCarts.length > 0 && (
            <button
              type="button"
              onClick={onShowHeld}
              className="relative p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600 transition-colors"
              title="Lihat Transaksi Hold"
            >
              <Play size={16} />
              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-amber-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                {heldCarts.length}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onShowBtPrinter}
            className={`p-1.5 rounded-lg transition-colors ${
              bluetoothPrinterConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-red-600'
            }`}
            title="Hubungkan Printer Bluetooth Thermal"
          >
            <Bluetooth size={16} />
          </button>

          <button
            type="button"
            onClick={onShowSettings}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-red-600 transition-colors"
            title="Pengaturan Struk"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className={`overflow-y-auto scrollbar-thin space-y-2 pr-1 ${isMobileSheet ? 'max-h-60' : 'max-h-[34vh] xl:max-h-[40vh] 2xl:max-h-[46vh]'}`}>
        {cart.length === 0 ? (
          <div className="py-6 text-center text-slate-400 space-y-1">
            <ShoppingCart size={24} className="mx-auto opacity-30" />
            <p className="text-xs font-semibold">Keranjang Belanja Kosong</p>
            <p className="text-[11px]">Klik produk untuk menambahkan item</p>
          </div>
        ) : (
          <AnimatePresence>
            {cart.map(item => {
              const disc = (item.harga_jual * item.disc) / 100
              const total = (item.harga_jual - disc) * item.qty
              return (
                <motion.div
                  key={item.kd_barang}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.nama_barang}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatRupiah(item.harga_jual)} {item.disc > 0 && <span className="text-red-600">(-{item.disc}%)</span>}
                    </p>
                    <p className="text-xs font-extrabold text-red-600 dark:text-red-400 mt-0.5">{formatRupiah(total)}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.kd_barang, -1)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.kd_barang, 1)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.kd_barang)}
                      className="ml-1 w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                      title="Hapus Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
