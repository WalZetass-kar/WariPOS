import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Calculator, History, Trash2, TrendingUp, Package,
  AlertCircle, ChevronDown, ChevronUp, Rocket,
} from 'lucide-react'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useDemo } from '../contexts/DemoContext'
import ConfirmDialog from '../components/ConfirmDialog'
import type { HppCalculation } from '../../shared/types'
import { SkeletonSpinner } from '../components/Skeleton'

const DEMO_LIMIT = 10

function formatRupiah(n: number) {
  return 'Rp ' + (n ?? 0).toLocaleString('id-ID')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Usage Badge for demo users ─────────────────────────────────────────────

interface UsageBadgeProps {
  count: number
  isDemo: boolean
  onUpgrade: () => void
}

function UsageBadge({ count, isDemo, onUpgrade }: UsageBadgeProps) {
  if (!isDemo) return null
  const remaining = Math.max(0, DEMO_LIMIT - count)
  const pct = Math.min(100, Math.round((count / DEMO_LIMIT) * 100))
  const isWarning = remaining <= 3
  const isDanger = remaining === 0

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2
      ${isDanger
        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
        : isWarning
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
          : 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/30'
      }`}
    >
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className={isDanger ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-primary-600'}>
          {isDanger ? 'Limit habis' : `Sisa ${remaining}x hitung HPP`}
        </span>
        <span className={`tabular-nums ${isDanger ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-primary-500'}`}>
          {count}/{DEMO_LIMIT}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700
            ${isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isDanger && (
        <button
          onClick={onUpgrade}
          className="mt-1 w-full flex items-center justify-center gap-2 py-2 rounded-xl
            bg-gradient-to-r from-primary-600 to-primary-500 text-white text-xs font-bold
            shadow-lg shadow-primary-500/30 hover:from-primary-700 hover:to-primary-600 transition-all"
        >
          <Rocket size={12} />
          Upgrade untuk akses tidak terbatas
        </button>
      )}
    </div>
  )
}

// ─── Result Card ─────────────────────────────────────────────────────────────

interface ResultCardProps {
  result: HppCalculation
}

function ResultCard({ result }: ResultCardProps) {
  const hargaJual = result.total_hpp * 1.3 // margin 30%

  return (
    <div className="rounded-2xl border border-primary-200 dark:border-primary-800/30 bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/10 dark:to-primary-900/10 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center">
          <Calculator size={16} className="text-white" />
        </div>
        <div>
          <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold uppercase tracking-wide">Hasil Kalkulasi</p>
          <p className="text-sm font-bold text-slate-800 dark:text-white">{result.nama_produk}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/70 dark:bg-slate-800/50 p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Modal</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatRupiah(result.modal)}</p>
        </div>
        <div className="rounded-xl bg-white/70 dark:bg-slate-800/50 p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Biaya Lain</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatRupiah(result.biaya_lain)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-500 p-3 text-center shadow-lg shadow-primary-500/20">
          <p className="text-xs text-white/70 mb-1">Total HPP</p>
          <p className="text-sm font-bold text-white">{formatRupiah(result.total_hpp)}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white/60 dark:bg-slate-800/40 p-3 border border-primary-100 dark:border-primary-800/20">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={12} className="text-primary-500" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rekomendasi Harga Jual (margin 30%)</span>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-xl font-extrabold text-primary-600 dark:text-primary-400">
            {formatRupiah(Math.ceil(hargaJual))}
          </span>
          <span className="text-xs text-slate-400 mb-0.5">≈ HPP × 1.3</span>
        </div>
      </div>
    </div>
  )
}

// ─── History Row ─────────────────────────────────────────────────────────────

interface HistoryRowProps {
  item: HppCalculation
  onDelete: (item: HppCalculation) => void
}

function HistoryRow({ item, onDelete }: HistoryRowProps) {
  const [open, setOpen] = useState(false)
  const margin30 = item.total_hpp * 1.3

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-400/10 flex items-center justify-center shrink-0">
          <Package size={15} className="text-primary-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{item.nama_produk}</p>
          <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{formatRupiah(item.total_hpp)}</p>
          <p className="text-xs text-slate-400">HPP</p>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700/50">
          <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs mb-3">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-2">
              <p className="text-slate-400 mb-0.5">Modal</p>
              <p className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(item.modal)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-2">
              <p className="text-slate-400 mb-0.5">Biaya Lain</p>
              <p className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(item.biaya_lain)}</p>
            </div>
            <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-2">
              <p className="text-primary-500 mb-0.5">Rekomendasi</p>
              <p className="font-semibold text-primary-600">{formatRupiah(Math.ceil(margin30))}</p>
            </div>
          </div>
          <button
            onClick={() => onDelete(item)}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={11} /> Hapus riwayat ini
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Hpp() {
  const toast = useToast()
  const { user } = useAuth()
  const { openPricing, state } = useDemo()
  const isDemo = user?.hak_akses === 'demo'

  // Form state
  const [namaProduk, setNamaProduk] = useState('')
  const [modal, setModal] = useState('')
  const [biayaLain, setBiayaLain] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [lastResult, setLastResult] = useState<HppCalculation | null>(null)

  // History & usage
  const [history, setHistory] = useState<HppCalculation[]>([])
  const [usageCount, setUsageCount] = useState(0)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<HppCalculation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const username = user?.nama_pengguna ?? ''

  const loadData = useCallback(async () => {
    setLoadingHistory(true)
    const [histR, usageR] = await Promise.all([
      api<HppCalculation[]>('hpp:getHistory', username),
      api<{ count: number }>('hpp:getUsageCount', username),
    ])
    if (histR.success) setHistory(histR.data ?? [])
    if (usageR.success) setUsageCount(usageR.data?.count ?? 0)
    setLoadingHistory(false)
  }, [username])

  useEffect(() => { loadData() }, [loadData])

  const handleCalculate = async () => {
    if (!namaProduk.trim()) return toast('Nama produk wajib diisi', 'error')
    const modalNum = parseFloat(modal) || 0
    const biayaNum = parseFloat(biayaLain) || 0
    if (modalNum <= 0 && biayaNum <= 0) return toast('Modal atau biaya lain harus diisi', 'error')

    // Demo limit pre-check (UX only — real guard is in backend)
    if (isDemo && usageCount >= DEMO_LIMIT) {
      openPricing('usage_limit')
      return
    }

    setCalculating(true)
    const r = await api<HppCalculation & {
      count: number; limit: number | null; remaining: number | null
      hpp_limit_reached?: boolean
    }>('hpp:calculate', {
      username,
      nama_produk: namaProduk.trim(),
      modal: modalNum,
      biaya_lain: biayaNum,
    })
    setCalculating(false)

    if (r.success && r.data) {
      setLastResult(r.data)
      setUsageCount(r.data.count ?? usageCount + 1)
      toast('HPP berhasil dihitung')
      loadData()
      // Scroll to result
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    } else if ((r as any).data?.hpp_limit_reached || (r.message ?? '').includes('demo')) {
      // Backend blocked — trigger pricing popup
      openPricing('usage_limit')
    } else {
      toast(r.message as string || 'Gagal menghitung HPP', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const r = await api('hpp:delete', deleteTarget.id, username)
    setDeleting(false)
    if (r.success) {
      toast('Riwayat dihapus')
      setDeleteTarget(null)
      loadData()
      if (lastResult?.id === deleteTarget.id) setLastResult(null)
    } else {
      toast(r.message as string || 'Gagal menghapus', 'error')
    }
  }

  const handleUpgrade = () => openPricing('usage_limit')

  const remaining = Math.max(0, DEMO_LIMIT - usageCount)
  const isLimitReached = isDemo && usageCount >= DEMO_LIMIT

  if (loadingHistory) return <SkeletonSpinner />

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:h-[calc(100vh-8rem)] xl:flex-row">

      {/* ─── Left: Form ─────────────────────────────────────────── */}
      <div className="flex w-full shrink-0 flex-col gap-3 xl:w-80">
        {/* Header card */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Calculator size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white">Kalkulator HPP</h1>
              <p className="text-xs text-slate-400">Harga Pokok Produksi</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            <strong>HPP = Modal + Biaya Lain</strong><br />
            Gunakan sebagai dasar penetapan harga jual.
          </p>
        </div>

        {/* Demo usage badge */}
        <UsageBadge count={usageCount} isDemo={isDemo} onUpgrade={handleUpgrade} />

        {/* Form */}
        <div className="glass-card flex-1 space-y-3 p-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Nama Produk
            </label>
            <input
              value={namaProduk}
              onChange={e => setNamaProduk(e.target.value)}
              disabled={isLimitReached}
              placeholder="Contoh: Kue Bolu Coklat"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Modal (Rp)
              <span className="ml-1 font-normal normal-case text-slate-400">bahan baku + tenaga kerja</span>
            </label>
            <input
              type="number"
              min={0}
              value={modal}
              onChange={e => setModal(e.target.value)}
              disabled={isLimitReached}
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Biaya Lain (Rp)
              <span className="ml-1 font-normal normal-case text-slate-400">kemasan, ongkir, dll</span>
            </label>
            <input
              type="number"
              min={0}
              value={biayaLain}
              onChange={e => setBiayaLain(e.target.value)}
              disabled={isLimitReached}
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
            />
          </div>

          {/* Live preview */}
          {(parseFloat(modal) > 0 || parseFloat(biayaLain) > 0) && (
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/20 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">Preview HPP</span>
              <span className="text-sm font-bold text-primary-600">
                {formatRupiah((parseFloat(modal) || 0) + (parseFloat(biayaLain) || 0))}
              </span>
            </div>
          )}

          <button
            onClick={isLimitReached ? handleUpgrade : handleCalculate}
            disabled={calculating}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md
              ${isLimitReached
                ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-700 hover:to-primary-600 shadow-primary-500/30'
                : 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-700 hover:to-primary-600 shadow-primary-500/30 disabled:opacity-60'
              }`}
          >
            {calculating
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menghitung...</>
              : isLimitReached
                ? <><Rocket size={14} /> Upgrade untuk Lanjutkan</>
                : <><Calculator size={14} /> Hitung HPP</>
            }
          </button>

          {isDemo && !isLimitReached && (
            <p className="text-center text-xs text-slate-400">
              Akun demo: sisa <strong className={remaining <= 3 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}>{remaining}x</strong> kalkulasi
            </p>
          )}
        </div>
      </div>

      {/* ─── Right: Result + History ────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:overflow-y-auto xl:pr-1 scrollbar-thin">

        {/* Result */}
        <div ref={resultRef}>
          {lastResult ? (
            <ResultCard result={lastResult} />
          ) : (
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center text-slate-400 py-10">
              <Calculator size={40} className="mb-2 opacity-20" />
              <p className="text-sm">Isi form di kiri dan klik <strong>Hitung HPP</strong></p>
              <p className="text-xs mt-1 text-slate-300">Hasil akan tampil di sini</p>
            </div>
          )}
        </div>

        {/* History */}
        <div className="glass-card p-4 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Riwayat Kalkulasi
            </h2>
            <span className="ml-auto text-xs text-slate-400">{history.length} data</span>
          </div>

          {loadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <AlertCircle size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Belum ada riwayat kalkulasi</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(item => (
                <HistoryRow key={item.id} item={item} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Riwayat HPP"
        message={`Riwayat kalkulasi ${deleteTarget?.nama_produk ?? ''} akan dihapus.`}
        confirmText="Hapus"
        variant="danger"
        loading={deleting}
      >
        {deleteTarget && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Total HPP</span><span className="font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(deleteTarget.total_hpp)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Tanggal</span><span className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(deleteTarget.created_at)}</span></div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
