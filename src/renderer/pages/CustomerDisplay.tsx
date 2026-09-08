import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  CheckCircle2,
  QrCode,
  Store,
  CreditCard,
  Hash,
  Award,
  BellRing,
  ShoppingBag
} from 'lucide-react'
import { formatRupiah } from '../utils/format'
import { SkeletonPage } from '../components/Skeleton'
import { playChimeSound } from '../utils/queueNumber'

interface DisplayItem {
  nama_barang: string
  qty: number
  harga_jual: number
  disc: number
}

interface CustomerDisplayData {
  items: DisplayItem[]
  subtotal: number
  total: number
  storeName: string
  qrisImage?: string | null
  qrisString?: string | null
  paymentMethod?: string | null
  status?: 'idle' | 'scanning' | 'paying_qris' | 'success'
  paidAmount?: number
  kembalian?: number
  nomor_antrian?: number | string
  nomor_meja?: string | null
  nama_pelanggan?: string | null
  jenis_order?: string | null
  poinEarned?: number
}

export default function CustomerDisplay() {
  const [data, setData] = useState<CustomerDisplayData>({
    items: [],
    subtotal: 0,
    total: 0,
    storeName: 'WariPOS',
    status: 'idle',
  })
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())
  const prevItemsLengthRef = useRef(0)

  useEffect(() => {
    const clockTimer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(clockTimer)
  }, [])

  useEffect(() => {
    // 1. BroadcastChannel for instant cross-tab / cross-window sync
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('customer_display_channel')
      bc.onmessage = (event) => {
        if (event.data) {
          setData(prev => {
            const next = { ...prev, ...event.data }
            if (next.items && next.items.length > prevItemsLengthRef.current) {
              playChimeSound()
            }
            prevItemsLengthRef.current = next.items?.length || 0
            return next
          })
        }
      }
    } catch {}

    // 2. Window Message listener
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'customer-display-update') {
        setData(prev => ({ ...prev, ...e.data.payload }))
      }
    }
    window.addEventListener('message', handler)

    // 3. LocalStorage storage event listener
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'customer_display_data' && e.newValue) {
        try {
          setData(JSON.parse(e.newValue))
        } catch {}
      }
    }
    window.addEventListener('storage', storageHandler)

    // Initial load from storage
    const stored = localStorage.getItem('customer_display_data')
    if (stored) {
      try { setData(JSON.parse(stored)) } catch {}
    }
    setLoading(false)

    // Fallback polling interval
    const interval = setInterval(() => {
      const currentStored = localStorage.getItem('customer_display_data')
      if (currentStored) {
        try {
          const parsed = JSON.parse(currentStored)
          setData(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(parsed)) return parsed
            return prev
          })
        } catch {}
      }
    }, 800)

    return () => {
      if (bc) bc.close()
      window.removeEventListener('message', handler)
      window.removeEventListener('storage', storageHandler)
      clearInterval(interval)
    }
  }, [])

  const lastItem = data.items[data.items.length - 1]

  if (loading) return <SkeletonPage rows={6} />

  // ─── Screen: Payment Success & Ticket Voucher (Light Theme) ───────
  if (data.status === 'success') {
    const queueFormatted = data.nomor_antrian
      ? String(data.nomor_antrian).startsWith('#')
        ? String(data.nomor_antrian)
        : `#${String(data.nomor_antrian).padStart(3, '0')}`
      : '#001'

    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-center p-6 select-none font-sans">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xl relative"
        >
          {/* Top Check Icon */}
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black shadow-sm">
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>

          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            Pembayaran Berhasil
          </h2>
          <p className="text-xs text-slate-500 font-medium mb-6">
            Terima kasih telah berbelanja di <span className="text-slate-900 font-bold">{data.storeName}</span>
          </p>

          {/* Queue Ticket Box (Solid Red Card Pembatas) */}
          <div className="p-6 rounded-2xl bg-red-600 text-white mb-6 text-center shadow-md">
            <span className="text-xs font-black uppercase tracking-widest text-red-100 block mb-1">
              NOMOR ANTRIAN ANDA
            </span>
            <p className="text-6xl font-black font-mono tracking-tight my-2">
              {queueFormatted}
            </p>
            <div className="mt-3 pt-3 border-t border-red-500 text-xs font-bold text-red-100 flex items-center justify-center gap-2">
              <BellRing size={15} className="shrink-0" />
              <span>
                {data.nomor_meja
                  ? `Pesanan Meja ${data.nomor_meja} · Silakan kembali ke meja`
                  : 'Pesanan sedang disiapkan, silakan perhatikan layar antrian'}
              </span>
            </div>
          </div>

          {/* Payment Breakdown Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2.5 text-left mb-5 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Total Tagihan ({data.items.length} Item)</span>
              <span className="text-sm font-black text-slate-900 font-mono">{formatRupiah(data.total)}</span>
            </div>
            {data.paidAmount !== undefined && data.paidAmount > 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Pembayaran ({data.paymentMethod || 'TUNAI'})</span>
                <span className="font-mono text-slate-800 font-semibold">{formatRupiah(data.paidAmount)}</span>
              </div>
            )}
            {data.kembalian !== undefined && data.kembalian > 0 && (
              <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 font-bold">
                <span className="text-emerald-700">Kembalian</span>
                <span className="text-base text-emerald-700 font-mono font-black">{formatRupiah(data.kembalian)}</span>
              </div>
            )}
            {data.poinEarned !== undefined && data.poinEarned > 0 && (
              <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 font-bold text-amber-700">
                <span className="flex items-center gap-1.5">
                  <Award size={15} />
                  <span>Poin Member Didapat:</span>
                </span>
                <span>+{data.poinEarned} Poin</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 font-semibold flex items-center justify-center gap-1.5">
            <span>Struk transaksi telah tercetak otomatis</span>
          </p>
        </motion.div>
      </div>
    )
  }

  // ─── Active Shopping & Scanning Screen (Tema Terang dengan Card Pembatas) ───
  const currentQueueFormatted = data.nomor_antrian
    ? String(data.nomor_antrian).startsWith('#')
      ? String(data.nomor_antrian)
      : `#${String(data.nomor_antrian).padStart(3, '0')}`
    : '#001'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col select-none font-sans">
      
      {/* ─── Top Header Bar (Tema Terang Bersih & Kontras) ──────────── */}
      <header className="h-20 px-8 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black shadow-sm">
            <Store size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-black text-xl text-slate-900 tracking-tight">
                {data.storeName || 'WariPOS'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider">
                Layar Pelanggan
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {data.items.length > 0 ? `${data.items.length} macam produk di keranjang` : 'Selamat Datang! Siap melayani pesanan Anda'}
            </p>
          </div>
        </div>

        {/* Header Right: Queue Status Card & Live Clock */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-right">
            <span className="text-[10px] text-red-600 font-black uppercase tracking-wider block">
              Antrian Anda
            </span>
            <span className="text-base font-black font-mono text-red-700">
              {currentQueueFormatted} {data.nomor_meja ? `· Meja ${data.nomor_meja}` : ''}
            </span>
          </div>

          <div className="text-right border-l border-slate-200 pl-4">
            <p className="text-base font-black font-mono text-slate-900 leading-tight">
              {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
              {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </header>

      {/* ─── Main Content: 2 Cards Pembatas Berdampingan ────────────── */}
      <div className="flex-1 p-6 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
        
        {/* ─── CARD PEMBATAS 1: Daftar Produk Belanjaan ────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Card Header Row */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-red-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Daftar Produk Belanja ({data.items.length} Macam)
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Urutan Scan Kasir
            </span>
          </div>

          {/* Product Items List (Setiap Produk Memiliki Card Pembatas Sendiri) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 scrollbar-thin">
            {data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-24">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 text-slate-400 shadow-sm">
                  <ShoppingBag size={32} />
                </div>
                <p className="text-lg font-black text-slate-700">Selamat Datang di {data.storeName}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Barang belanjaan Anda akan otomatis muncul di sini</p>
              </div>
            ) : (
              data.items.map((item, idx) => {
                const discAmount = (item.harga_jual * (item.disc || 0)) / 100
                const itemTotal = (item.harga_jual - discAmount) * item.qty
                const isLast = idx === data.items.length - 1
                const sequenceNum = idx + 1

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border-2 transition-all shadow-sm ${
                      isLast
                        ? 'bg-red-50/80 border-red-500 shadow-md ring-2 ring-red-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Sequence Number badge + Product Name + Details */}
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black font-mono shrink-0 shadow-sm ${
                          isLast
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 border border-slate-300 text-slate-700'
                        }`}>
                          #{sequenceNum}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 truncate">
                              {item.nama_barang}
                            </h3>
                            {item.disc > 0 && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-black uppercase">
                                Diskon {item.disc}%
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 font-medium">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-800 font-mono">
                              {item.qty} pcs
                            </span>
                            <span>×</span>
                            <span className="font-mono">{formatRupiah(item.harga_jual)}</span>
                            {isLast && (
                              <span className="text-[10px] font-bold text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded-full">
                                Baru Di-scan
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Subtotal Amount */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                          Subtotal
                        </span>
                        <span className="text-lg font-black font-mono text-slate-900">
                          {formatRupiah(itemTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ─── CARD PEMBATAS 2: Ringkasan & Total Pembayaran ──────────── */}
        <div className="w-full lg:w-[400px] xl:w-[440px] flex flex-col justify-between gap-4 shrink-0">
          
          {/* Sub-Card: QRIS / Status Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            {data.status === 'paying_qris' || data.qrisImage ? (
              <div className="text-center">
                <p className="text-xs font-black text-red-600 uppercase tracking-wider mb-3 flex items-center justify-center gap-2">
                  <QrCode size={18} />
                  <span>Silakan Pindai QRIS untuk Bayar</span>
                </p>
                {data.qrisImage ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl inline-block mb-3 shadow-md">
                    <img src={data.qrisImage} alt="QRIS Code" className="w-44 h-44 object-contain" />
                  </div>
                ) : (
                  <div className="w-44 h-44 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-slate-400 mb-3">
                    <QrCode size={36} className="text-red-500 mb-2 animate-pulse" />
                    <span className="text-xs font-bold">Membuat QRIS...</span>
                  </div>
                )}
                <p className="text-xs text-slate-500 font-medium">
                  BCA, Mandiri, BRI, BNI, GoPay, OVO, Dana, ShopeePay
                </p>
              </div>
            ) : lastItem ? (
              <div>
                <div className="flex items-center justify-between mb-2 text-xs font-black">
                  <span className="text-red-600 uppercase tracking-wider">Item Baru Ditambahkan</span>
                  <span className="text-slate-500 font-mono">Item #{data.items.length}</span>
                </div>
                <p className="text-base font-black text-slate-900 truncate mb-1">{lastItem.nama_barang}</p>
                <div className="flex items-baseline justify-between pt-3 border-t border-slate-100 mt-2">
                  <span className="text-xs text-slate-500 font-mono">{lastItem.qty} × {formatRupiah(lastItem.harga_jual)}</span>
                  <span className="text-xl font-black font-mono text-red-600">
                    {formatRupiah((lastItem.harga_jual - (lastItem.harga_jual * (lastItem.disc || 0)) / 100) * lastItem.qty)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <CreditCard size={32} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-bold text-slate-700">Kasir Siap Melayani</p>
                <p className="text-xs text-slate-400 mt-0.5">Silakan scan barang belanjaan Anda</p>
              </div>
            )}
          </div>

          {/* Sub-Card: Subtotal Breakdown & Grand Total */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-2.5 text-xs font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({data.items.length} Item)</span>
                <span className="text-slate-900 font-mono font-bold">{formatRupiah(data.subtotal)}</span>
              </div>
            </div>

            {/* Huge Grand Total Card Pembatas */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md text-left border border-slate-800">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">
                TOTAL PEMBAYARAN
              </span>
              <p className="text-5xl font-black text-red-500 font-mono tracking-tight">
                {formatRupiah(data.total)}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
