import React from 'react'
import { UserCircle, X } from 'lucide-react'
import type { Customer } from '../../../shared/types'

interface CustomerSelectorProps {
  customers: Customer[]
  selectedCustomer: Customer | null
  customerSearch: string
  showCustomerDrop: boolean
  customerRef: React.RefObject<HTMLDivElement>
  onSelectCustomer: (customer: Customer | null) => void
  onClearCustomer: () => void
  onSearchChange: (search: string) => void
  onToggleDropdown: () => void
}

export default function CustomerSelector({
  customers, selectedCustomer, customerSearch, showCustomerDrop, customerRef, onSelectCustomer, onClearCustomer, onSearchChange, onToggleDropdown
}: CustomerSelectorProps) {
  const filteredCustomers = customers.filter(c =>
    c.status === 'Aktif' &&
    (c.nama_customer.toLowerCase().includes(customerSearch.toLowerCase()) ||
     (c.no_telp ?? '').includes(customerSearch))
  ).slice(0, 8)

  return (
    <div ref={customerRef} className="relative">
      <div
        onClick={onToggleDropdown}
        className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 transition-colors hover:border-primary-600/40"
      >
        <UserCircle size={20} className={selectedCustomer ? 'text-primary-600' : 'text-slate-400'} />
        <span className={`flex-1 text-xs truncate ${selectedCustomer ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500'}`}>
          {selectedCustomer ? `${selectedCustomer.nama_customer} · ${selectedCustomer.poin ?? 0} Poin` : 'Pilih Pelanggan / Member (Opsional)'}
        </span>
        {selectedCustomer && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClearCustomer() }}
            className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showCustomerDrop && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input
              autoFocus
              placeholder="Cari nama / no. telepon..."
              value={customerSearch}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full rounded-xl border-0 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-600/30"
            />
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            {filteredCustomers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Tidak ada customer cocok</p>
            ) : filteredCustomers.map(c => (
              <button
                key={c.kd_customer}
                type="button"
                onClick={() => { onSelectCustomer(c) }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left border-b border-slate-100 dark:border-slate-800/50 last:border-0"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{c.nama_customer}</p>
                  <p className="text-[11px] text-slate-400">{c.no_telp ?? '-'}</p>
                </div>
                <span className="text-xs text-amber-600 font-bold">{c.poin ?? 0} Poin</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
