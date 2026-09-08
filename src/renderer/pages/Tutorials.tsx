import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronRight,
  Clock,
  Search,
  FileText,
  Bookmark,
  Layers,
  ArrowLeft,
  Share2,
  HelpCircle,
} from 'lucide-react'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import Card from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import type { Tutorial } from '../../shared/types'
import { SkeletonPage } from '../components/Skeleton'

// Simple markdown-like renderer (bold, headings, lists, code blocks, alerts)
function renderContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-6 mb-3 first:mt-0 flex items-center gap-2">
          <span className="w-2 h-5 bg-red-600 rounded-full inline-block" />
          {renderInline(line.slice(3))}
        </h2>
      )
    }
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      )
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 ml-2 mb-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
          <span className="leading-relaxed">{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    if (/^\d+\./.test(line)) {
      const [num, ...rest] = line.split('. ')
      return (
        <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 mb-2.5">
          <span className="shrink-0 w-6 h-6 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center">
            {num}
          </span>
          <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">
            {renderInline(rest.join('. '))}
          </span>
        </div>
      )
    }
    if (line.trim() === '') return <div key={i} className="h-2" />
    return (
      <p key={i} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-2.5">
        {renderInline(line)}
      </p>
    )
  })
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*.+?\*\*|`.+?`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-extrabold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-700">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

// Extract category from title or content
function getTutorialCategory(t: Tutorial): string {
  const text = `${t.title} ${t.content}`.toLowerCase()
  if (text.includes('kasir') || text.includes('transaksi') || text.includes('struk') || text.includes('bayar')) return 'Kasir & POS'
  if (text.includes('stok') || text.includes('produk') || text.includes('barang') || text.includes('cabang') || text.includes('gudang')) return 'Inventaris & Stok'
  if (text.includes('pajak') || text.includes('ppn') || text.includes('promo') || text.includes('diskon')) return 'Pajak & Promo'
  if (text.includes('loyalty') || text.includes('poin') || text.includes('pelanggan') || text.includes('member')) return 'Member & Loyalty'
  if (text.includes('whatsapp') || text.includes('fonnte') || text.includes('notifikasi')) return 'WhatsApp & Pesan'
  return 'Fitur & Sistem'
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

interface FormModalProps {
  initial?: Tutorial | null
  onClose: () => void
  onSave: () => void
}

function FormModal({ initial, onClose, onSave }: FormModalProps) {
  const toast = useToast()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return toast('Judul panduan wajib diisi', 'error')
    if (!content.trim()) return toast('Konten panduan wajib diisi', 'error')
    setSaving(true)
    const r = initial
      ? await api('tutorial:update', initial.id, { title: title.trim(), content: content.trim() })
      : await api('tutorial:create', { title: title.trim(), content: content.trim() })
    setSaving(false)
    if (r.success) {
      toast(r.message as string || 'Panduan berhasil disimpan', 'success')
      onSave()
    } else {
      toast(r.message as string || 'Gagal menyimpan panduan', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            {initial ? 'Edit Panduan Pengguna' : 'Tambah Panduan Pengguna Baru'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Judul Panduan *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm outline-none focus:border-red-600 font-bold"
              placeholder="Contoh: Cara Membuat Promo dan Diskon Kasir"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Isi Petunjuk / Konten *</label>
              <span className="text-[11px] text-slate-400">Format: **tebal**, ## Subjudul, 1. Langkah, - List</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-xs sm:text-sm outline-none focus:border-red-600 font-mono resize-none leading-relaxed"
              placeholder="Tuliskan petunjuk langkah demi langkah disini..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-md disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
            {saving ? 'Menyimpan...' : 'Simpan Panduan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Tutorials Component ───────────────────────────────────────────────

export default function Tutorials() {
  const toast = useToast()
  const { user } = useAuth()
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Semua')
  const [selected, setSelected] = useState<Tutorial | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Tutorial | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Tutorial | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = ['developer', 'admin'].includes(user?.hak_akses ?? '')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<Tutorial[]>('tutorial:getAll')
    if (r.success) {
      let data = r.data ?? []
      
      // Auto-seed default tutorials if none exist
      if (data.length === 0 && isAdmin) {
        const defaultTutorials = [
          { title: 'Cara Menggunakan Fitur Kasir POS & Barcode', content: '## Panduan Transaksi Kasir POS\n\nFitur kasir digunakan untuk melayani penjualan cepat dengan barcode scanner, pencarian manual, dan berbagai metode pembayaran.\n\n### Langkah Transaksi:\n1. Pilih produk dari daftar atau scan barcode barang dengan scanner\n2. Atur jumlah (qty) produk atau klik tanda plus/minus pada keranjang\n3. Pilih data pelanggan jika ingin mencatat poin loyalty dan riwayat belanja\n4. Masukkan kupon promo atau diskon jika tersedia\n5. Pilih metode bayar: TUNAI, TRANSFER, atau QRIS Dinamis\n6. Masukkan nominal uang yang diterima, lalu klik Selesaikan Transaksi\n7. Cetak struk belanja ke printer thermal atau kirim otomatis ke WhatsApp pelanggan' },
          { title: 'Cara Mengatur Pajak & PPN Transaksi', content: '## Pengaturan Pajak/PPN Toko\n\nFitur ini digunakan untuk mengelola persentase pajak yang akan diterapkan pada setiap transaksi kasir.\n\n### Cara Menggunakan:\n1. Buka menu Pajak dari sidebar\n2. Klik tombol Tambah Pajak untuk membuat jenis tarif baru\n3. Masukkan nama pajak (contoh: PPN 11%)\n4. Masukkan persentase pajak (contoh: 11)\n5. Klik Simpan dan aktifkan toggle pada jenis pajak yang akan digunakan' },
          { title: 'Cara Membuat Promo dan Kode Diskon', content: '## Program Promo dan Diskon\n\nBuat berbagai penawaran khusus untuk menarik lebih banyak transaksi belanja.\n\n### Jenis Promo yang Didukung:\n- **Persentase (%)**: Potongan diskon berdasarkan persentase total belanja\n- **Nominal Tetap (Rp)**: Potongan langsung nominal tertentu\n- **Beli X Gratis Y**: Promo bundling produk\n- **Happy Hour**: Promo otomatis yang aktif di jam-jam tertentu\n\n### Langkah Membuat Promo:\n1. Buka menu Promo dari sidebar navigasi\n2. Klik Buat Promo Baru\n3. Masukkan kode voucher (contoh: DISKON50)\n4. Tentukan minimal belanja dan kuota pemakaian\n5. Simpan dan bagikan kode promo ke pelanggan Anda' },
          { title: 'Manajemen Multi Cabang dan Gudang', content: '## Manajemen Cabang & Gudang\n\nKelola persediaan stok barang secara terpusat untuk berbagai lokasi cabang toko dan gudang penyimpanan.\n\n### Fitur Utama:\n1. **Tambah Lokasi**: Tambahkan cabang toko retail atau gudang logistik\n2. **Transfer Stok**: Pindahkan barang antar cabang dengan nomor dokumen resmi\n3. **Laporan per Cabang**: Pantau kinerja penjualan masing-masing outlet secara terpisah' },
          { title: 'Program Loyalty Poin & Member Pelanggan', content: '## Program Member & Loyalty Poin\n\nBerikan penghargaan bagi pelanggan setia agar terus berbelanja di toko Anda.\n\n### Aturan Poin:\n- Pelanggan memperoleh 1 poin untuk setiap transaksi Rp 10.000\n- Poin yang terkumpul dapat dipotongkan langsung sebagai diskon pada saat checkout kasir\n- Tersedia tier member: **Bronze**, **Silver**, **Gold**, dan **Platinum**' },
          { title: 'Konfigurasi Notifikasi WhatsApp Gateway', content: '## Notifikasi WhatsApp Gateway Fonnte\n\nKirim struk digital otomatis dan notifikasi status langsung ke ponsel pelanggan.\n\n### Langkah Menghubungkan:\n1. Daftar akun di situs resmi fonnte.com\n2. Hubungkan nomor WhatsApp toko Anda dengan scan QR di dashboard Fonnte\n3. Salin API Token dari Fonnte ke menu WhatsApp di aplikasi POS\n4. Aktifkan toggle pemicu notifikasi untuk transaksi kasir baru, retur, dan stok minimum' },
        ]
        
        for (const t of defaultTutorials) {
          await api('tutorial:create', t)
        }
        const r2 = await api<Tutorial[]>('tutorial:getAll')
        if (r2.success) data = r2.data ?? []
      }
      
      setTutorials(data)
      if (data.length > 0 && !selected) {
        setSelected(data[0])
      }
    }
    setLoading(false)
  }, [isAdmin, selected])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const r = await api('tutorial:delete', deleteTarget.id)
    setDeleting(false)
    if (r.success) {
      toast('Panduan berhasil dihapus', 'success')
      if (selected?.id === deleteTarget.id) setSelected(null)
      setDeleteTarget(null)
      load()
    } else {
      toast(r.message as string || 'Gagal menghapus panduan', 'error')
    }
  }

  const categories = ['Semua', 'Kasir & POS', 'Inventaris & Stok', 'Pajak & Promo', 'Member & Loyalty', 'WhatsApp & Pesan', 'Fitur & Sistem']

  const filtered = tutorials.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase())
    const cat = getTutorialCategory(t)
    const matchCat = categoryFilter === 'Semua' || cat === categoryFilter
    return matchSearch && matchCat
  })

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BookOpen className="text-red-600" size={24} />
            Pusat Panduan & Tutorial
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Panduan lengkap penggunaan fitur POS kasir, inventaris, promosi, dan integrasi sistem.
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            icon={<Plus size={15} />}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs border-0 w-full sm:w-auto"
          >
            Tambah Panduan
          </Button>
        )}
      </div>

      {/* Search & Categories Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                categoryFilter === c
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari materi panduan..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-red-600"
          />
        </div>
      </div>

      {/* Main Content: Responsive Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left List Column */}
        <div className={`lg:col-span-4 space-y-2.5 ${selected && 'hidden lg:block'}`}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400">
              <HelpCircle size={32} className="mx-auto mb-2 opacity-40 text-red-500" />
              <p className="text-xs font-bold">Tidak ada panduan ditemukan</p>
              <p className="text-[11px] mt-0.5">Coba cari dengan kata kunci lain</p>
            </div>
          ) : (
            filtered.map(t => {
              const isSelected = selected?.id === t.id
              const cat = getTutorialCategory(t)
              return (
                <div
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {cat}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock size={10} /> {formatDate(t.created_at)}
                    </span>
                  </div>
                  <h3 className={`text-xs sm:text-sm font-bold leading-snug ${isSelected ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                    {t.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {t.content.replace(/[#*`-]/g, '')}
                  </p>
                </div>
              )
            })
          )}
        </div>

        {/* Right Article Detail Column */}
        <div className={`lg:col-span-8 ${!selected && 'hidden lg:block'}`}>
          {!selected ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 flex flex-col items-center justify-center min-h-[380px]">
              <FileText size={48} className="mb-3 opacity-30 text-slate-400" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Pilih salah satu panduan</p>
              <p className="text-xs text-slate-400 mt-1">Pilih judul di kolom kiri untuk membaca panduan lengkap</p>
            </div>
          ) : (
            <div className="p-5 sm:p-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              {/* Mobile Back Button & Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelected(null)}
                      className="lg:hidden p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      {getTutorialCategory(selected)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatDate(selected.created_at)}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {selected.title}
                  </h2>
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { setEditTarget(selected); setShowForm(true) }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Panduan"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(selected)}
                      className="p-2 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Hapus Panduan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Rendered Guide Body */}
              <div className="space-y-3 pt-1">
                {renderContent(selected.content)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <FormModal
          initial={editTarget}
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false)
            load().then(() => {
              if (editTarget) {
                const updated = tutorials.find(t => t.id === editTarget.id)
                if (updated) setSelected(updated)
              }
            })
          }}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Panduan Pengguna"
        message={`Apakah Anda yakin ingin menghapus panduan "${deleteTarget?.title ?? ''}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Panduan"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
