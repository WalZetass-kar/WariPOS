import React from 'react'
import { Pause, Trash2 } from 'lucide-react'
import Modal from '../../components/Modal'
import { formatRupiah } from '../../utils/format'
import type { CartItem } from '../../../shared/types'

interface HeldCartsModalProps {
  open: boolean
  heldCarts: any[]
  cart: CartItem[]
  onClose: () => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
  toast: any
}

export default function HeldCartsModal({
  open, heldCarts, cart, onClose, onResume, onDelete, toast
}: HeldCartsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Daftar Transaksi Hold (${heldCarts.length})`} size="sm">
      <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
        {heldCarts.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Pause size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">Tidak Ada Transaksi Di-Hold</p>
          </div>
        ) : heldCarts.map(held => (
          <div key={held.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                {held.items.length} Item — {formatRupiah(held.total)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {held.customerName && <span>{held.customerName} · </span>}
                {new Date(held.heldAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (cart.length > 0) {
                    toast('Keranjang saat ini harus dikosongkan atau di-hold dulu', 'error')
                    return
                  }
                  onResume(held.id)
                }}
                className="px-3 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition-colors shadow-sm"
              >
                Lanjutkan
              </button>
              <button
                type="button"
                onClick={() => onDelete(held.id)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
