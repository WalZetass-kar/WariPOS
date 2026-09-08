import { Keyboard, X } from 'lucide-react'
import Button from './Button'

interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { group: 'Kasir', items: [
    { keys: 'F1', desc: 'Fokus ke pencarian produk' },
    { keys: 'F2', desc: 'Fokus ke jumlah bayar' },
    { keys: 'F5', desc: 'Proses pembayaran' },
    { keys: 'Esc', desc: 'Bersihkan keranjang (dengan konfirmasi)' },
    { keys: 'Enter', desc: 'Tambah produk pertama dari hasil cari' },
  ]},
  { group: 'Global', items: [
    { keys: 'Ctrl + K', desc: 'Quick search (pencarian cepat)' },
    { keys: 'Ctrl + Z', desc: 'Undo aksi terakhir (hapus produk)' },
    { keys: 'Ctrl + /', desc: 'Tampilkan bantuan keyboard shortcut' },
    { keys: 'Ctrl + H', desc: 'Hold / park transaksi' },
    { keys: 'Ctrl + Shift + F', desc: 'Fullscreen customer display' },
  ]},
  { group: 'Barcode', items: [
    { keys: 'Scan', desc: 'Scan barcode otomatis menambah ke keranjang' },
    { keys: 'Enter', desc: 'Konfirmasi barcode dari keyboard scanner' },
  ]},
]

export default function KeyboardShortcutsModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden modal-card-animate"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-primary-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {SHORTCUTS.map(group => (
            <div key={group.group}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">{group.group}</p>
              <div className="space-y-1.5">
                {group.items.map(s => (
                  <div key={s.keys + s.desc} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{s.desc}</span>
                    <kbd className="shrink-0 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="secondary" onClick={onClose} size="sm">Tutup</Button>
        </div>
      </div>
    </div>
  )
}
