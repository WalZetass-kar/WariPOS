import { Keyboard } from 'lucide-react'
import Modal from './Modal'
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pintasan Keyboard (Shortcuts)"
      subtitle="Navigasi cepat transaksi kasir & sistem"
      icon={<Keyboard size={20} />}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose} size="sm">
          Tutup
        </Button>
      }
    >
      <div className="space-y-4">
        {SHORTCUTS.map(group => (
          <div key={group.group} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                {group.group}
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="space-y-1 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-2 border border-slate-100 dark:border-slate-800/80">
              {group.items.map(s => (
                <div
                  key={s.keys + s.desc}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {s.desc}
                  </span>
                  <kbd className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-[0_1.5px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_1.5px_0_0_rgba(255,255,255,0.05)] text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

