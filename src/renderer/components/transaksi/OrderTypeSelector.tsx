import React from 'react'
import { UtensilsCrossed, ShoppingBag, Bike } from 'lucide-react'

interface OrderTypeSelectorProps {
  tipePesanan: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  nomorMeja: string
  availableTables: Array<{ id: number; nomor_meja: string; label?: string; status: string }>
  onChangeTipe: (tipe: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') => void
  onChangeMeja: (meja: string) => void
}

export default function OrderTypeSelector({
  tipePesanan, nomorMeja, availableTables, onChangeTipe, onChangeMeja
}: OrderTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-1">
        {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => onChangeTipe(type)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tipePesanan === type
                ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            {type === 'DINE_IN' ? <UtensilsCrossed size={13} /> : type === 'TAKEAWAY' ? <ShoppingBag size={13} /> : <Bike size={13} />}
            <span>{type === 'DINE_IN' ? 'Dine In' : type === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'}</span>
          </button>
        ))}
      </div>

      {tipePesanan === 'DINE_IN' && (
        <div className="flex items-center gap-2 pt-0.5">
          <select
            value={nomorMeja}
            onChange={e => onChangeMeja(e.target.value)}
            className="w-full text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-white outline-none focus:border-primary-600"
          >
            <option value="">-- Pilih Nomor Meja (Opsional) --</option>
            {availableTables.map(t => (
              <option key={t.id} value={t.nomor_meja}>
                {t.nomor_meja} {t.label ? `(${t.label})` : ''} - {t.status}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
