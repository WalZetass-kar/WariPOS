import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Volume2,
  VolumeX,
  Store,
  Flame,
  ChefHat,
  BellRing,
  Clock
} from 'lucide-react'
import {
  QueueDisplayState,
  getQueueDisplayState,
  playChimeSound
} from '../utils/queueNumber'
import { SkeletonPage } from '../components/Skeleton'

export default function QueueDisplay() {
  const [state, setState] = useState<QueueDisplayState>(getQueueDisplayState)
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())
  const [activeCallAlert, setActiveCallAlert] = useState<{ number: string; table?: string | null } | null>(null)

  // Live Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sync Listeners (BroadcastChannel, Storage, Polling)
  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('queue_display_channel')
      bc.onmessage = (event) => {
        if (event.data) {
          const incoming = event.data as QueueDisplayState
          setState(incoming)
          if (incoming.currentCalling) {
            triggerVisualCall(incoming.currentCalling.nomor_antrian_formatted, incoming.currentCalling.nomor_meja)
          }
        }
      }
    } catch {}

    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'zetass_queue_display_state' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setState(parsed)
          if (parsed.currentCalling) {
            triggerVisualCall(parsed.currentCalling.nomor_antrian_formatted, parsed.currentCalling.nomor_meja)
          }
        } catch {}
      }
    }
    window.addEventListener('storage', storageHandler)

    // Initial load
    setState(getQueueDisplayState())
    setLoading(false)

    // Fallback polling interval
    const interval = setInterval(() => {
      const current = getQueueDisplayState()
      setState(prev => {
        if (prev.lastUpdated !== current.lastUpdated) {
          return current
        }
        return prev
      })
    }, 1500)

    return () => {
      if (bc) bc.close()
      window.removeEventListener('storage', storageHandler)
      clearInterval(interval)
    }
  }, [])

  const triggerVisualCall = (number: string, table?: string | null) => {
    setActiveCallAlert({ number, table })
    setTimeout(() => {
      setActiveCallAlert(null)
    }, 7000)
  }

  const toggleSound = () => {
    setState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))
    playChimeSound()
  }

  if (loading) return <SkeletonPage rows={6} />

  const featuredReady = state.readyList[0]
  const otherReady = state.readyList.slice(1)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between select-none overflow-hidden font-sans">
      
      {/* ─── Top TV Header Bar (Tema Terang Bersih & Kontras) ──────── */}
      <header className="h-20 px-8 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white font-black shadow-sm">
            <Store size={26} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{state.storeName || 'WariPOS'}</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Monitor Antrian Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Layar Pemanggilan & Status Antrian Pelanggan</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={toggleSound}
            className={`px-3.5 py-2 rounded-xl border transition-colors flex items-center gap-2 text-xs font-bold ${
              state.soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
            title="Toggle Suara Panggilan"
          >
            {state.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{state.soundEnabled ? 'Suara Aktif' : 'Mute'}</span>
          </button>

          <div className="text-right border-l border-slate-200 pl-6">
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight leading-tight">
              {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </header>

      {/* ─── Hero Flash Notification Banner (when called) ─────────────── */}
      <AnimatePresence>
        {activeCallAlert && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xl"
          >
            <div className="p-5 rounded-2xl bg-emerald-600 text-white shadow-2xl border-2 border-emerald-400 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white text-emerald-700 flex items-center justify-center font-black shadow-sm">
                  <BellRing size={26} />
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-emerald-100 tracking-wider">Panggilan Pesanan Siap</p>
                  <h3 className="text-3xl font-black tracking-tight font-mono">
                    Nomor Antrian {activeCallAlert.number}
                  </h3>
                </div>
              </div>
              <div className="text-right pr-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-emerald-800 text-white text-xs font-black uppercase">
                  {activeCallAlert.table ? `Meja ${activeCallAlert.table}` : 'Silakan ke Kasir'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Queue Display: 2 Cards Pembatas Berdampingan ────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-0 z-10">
        
        {/* ─── CARD PEMBATAS 1: SEDANG DISIAPKAN (PREPARING) ───────── */}
        <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <Flame size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-amber-700 uppercase tracking-wider">Sedang Disiapkan</h2>
                <p className="text-xs text-slate-500 font-medium">Dalam proses peracikan / dapur</p>
              </div>
            </div>
            <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black font-mono">
              {state.preparingList.length} Antrian
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
            {state.preparingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                <ChefHat size={48} className="text-slate-300 mb-3" />
                <p className="text-base font-bold text-slate-600">Tidak Ada Antrian Persiapan</p>
                <p className="text-xs text-slate-400 mt-1">Semua pesanan saat ini sudah selesai diproses</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {state.preparingList.map((order, idx) => (
                  <div
                    key={order.id || idx}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50 text-center flex flex-col justify-between hover:border-amber-300 transition-colors shadow-sm"
                  >
                    <div>
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block mb-1">
                        Antrian
                      </span>
                      <p className="text-4xl font-black text-slate-900 font-mono tracking-tight">
                        {order.nomor_antrian_formatted}
                      </p>
                    </div>
                    {order.nomor_meja && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200">
                        <span className="text-xs font-bold text-slate-600">
                          Meja {order.nomor_meja}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── CARD PEMBATAS 2: SIAP DIAMBIL (READY FOR PICKUP) ────── */}
        <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-emerald-700 uppercase tracking-wider">Siap Diambil</h2>
                <p className="text-xs text-slate-500 font-medium">Silakan menuju counter kasir / pengambilan</p>
              </div>
            </div>
            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black font-mono">
              {state.readyList.length} Siap
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-4">
            {state.readyList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                <CheckCircle2 size={48} className="text-slate-300 mb-3" />
                <p className="text-base font-bold text-slate-600">Belum Ada Pesanan Siap</p>
                <p className="text-xs text-slate-400 mt-1">Nomor yang siap akan tampil di sini</p>
              </div>
            ) : (
              <>
                {/* Hero Featured Ready Card */}
                {featuredReady && (
                  <div className="p-8 rounded-2xl border-2 border-emerald-500 bg-emerald-50 text-center relative shadow-md">
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest block mb-1">
                      PANGGILAN UTAMA
                    </span>
                    <h3 className="text-7xl font-black text-emerald-800 font-mono tracking-tight my-2">
                      {featuredReady.nomor_antrian_formatted}
                    </h3>
                    <p className="text-sm text-emerald-700 font-bold mt-3 flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>{featuredReady.nomor_meja ? `Meja ${featuredReady.nomor_meja} · Silakan Diambil` : 'Pesanan Siap di Counter Kasir'}</span>
                    </p>
                  </div>
                )}

                {/* Secondary Ready Numbers Grid */}
                {otherReady.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                    {otherReady.map((order, idx) => (
                      <div
                        key={order.id || idx}
                        className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 text-center flex flex-col justify-between shadow-sm"
                      >
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                          Antrian Siap
                        </span>
                        <p className="text-3xl font-black text-emerald-800 font-mono my-1">
                          {order.nomor_antrian_formatted}
                        </p>
                        {order.nomor_meja && (
                          <span className="text-xs text-emerald-700 font-medium">Meja {order.nomor_meja}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

      </main>

      {/* ─── Bottom Running Text Marquee Footer (Tema Terang) ─────────── */}
      <footer className="h-12 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2 text-xs font-black text-red-600 shrink-0 pr-4 border-r border-slate-200">
          <span className="uppercase tracking-wider">Pengumuman:</span>
        </div>

        {/* Marquee Text */}
        <div className="flex-1 overflow-hidden whitespace-nowrap px-4">
          <div className="inline-block animate-marquee text-xs font-semibold text-slate-600">
            {state.runningText || 'Selamat Datang di Toko Kami · Harap Perhatikan Nomor Antrian Anda Saat Dipanggil · Terima Kasih Atas Kunjungan Anda'}
          </div>
        </div>

        <div className="shrink-0 text-[11px] font-black text-slate-400 pl-4 border-l border-slate-200 font-mono">
          WariPOS
        </div>
      </footer>
    </div>
  )
}
