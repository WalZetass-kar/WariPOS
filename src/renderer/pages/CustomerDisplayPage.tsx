import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Monitor,
  Tv,
  ExternalLink,
  Copy,
  Eye,
  Megaphone,
  BellRing,
  RotateCcw,
  Volume2,
  CheckCircle2,
  Hash,
  MessageSquare,
  QrCode
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { useToast } from '../contexts/ToastContext'
import { api } from '../utils/api'
import {
  getQueueDisplayState,
  broadcastQueueState,
  setOrderReadyInQueue,
  resetDailyQueueSequence,
  getCurrentDailyQueueNumber,
  formatQueueNumber,
  playQueueCallSound,
  playChimeSound
} from '../utils/queueNumber'

export default function CustomerDisplayPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'customer' | 'queue' | 'controller'>('customer')
  const [openingCustomer, setOpeningCustomer] = useState(false)
  const [openingQueue, setOpeningQueue] = useState(false)

  // Queue Controller States
  const [queueState, setQueueState] = useState(getQueueDisplayState)
  const [callManualNum, setCallManualNum] = useState('')
  const [callManualTable, setCallManualTable] = useState('')
  const [runningTextInput, setRunningTextInput] = useState(queueState.runningText)
  const currentDailySeq = getCurrentDailyQueueNumber()

  const customerDisplayUrl = `${window.location.origin}${window.location.pathname}#/customer-display`
  const queueDisplayUrl = `${window.location.origin}${window.location.pathname}#/queue-display`

  useEffect(() => {
    const interval = setInterval(() => {
      setQueueState(getQueueDisplayState())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const copyUrl = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast(`URL ${label} berhasil disalin`, 'success')
    } catch {
      toast('Gagal menyalin URL', 'error')
    }
  }

  const openCustomerDisplay = async () => {
    setOpeningCustomer(true)
    try {
      const res = await api<any>('window:openCustomerDisplay')
      if (res?.success) {
        toast('Layar Customer Display dibuka di jendela baru', 'success')
        return
      }
    } catch {} finally {
      setOpeningCustomer(false)
    }

    try {
      const win = window.open(customerDisplayUrl, '_blank', 'noopener,noreferrer')
      if (win) {
        toast('Layar Customer Display dibuka di tab baru', 'success')
        return
      }
    } catch {}

    navigate('/customer-display')
  }

  const openQueueDisplay = async () => {
    setOpeningQueue(true)
    try {
      const res = await api<any>('window:openQueueDisplay')
      if (res?.success) {
        toast('Layar Antrian TV dibuka di jendela baru', 'success')
        return
      }
    } catch {} finally {
      setOpeningQueue(false)
    }

    try {
      const win = window.open(queueDisplayUrl, '_blank', 'noopener,noreferrer')
      if (win) {
        toast('Layar Antrian TV dibuka di tab baru', 'success')
        return
      }
    } catch {}

    navigate('/queue-display')
  }

  const handleManualCall = () => {
    const num = parseInt(callManualNum, 10)
    if (isNaN(num) || num <= 0) {
      toast('Masukkan nomor antrian yang valid', 'error')
      return
    }

    const updated = setOrderReadyInQueue(num, true)
    setQueueState(updated)
    toast(`Memanggil Antrian #${String(num).padStart(3, '0')}`, 'success')
    setCallManualNum('')
    setCallManualTable('')
  }

  const handleRepeatCall = () => {
    if (!queueState.lastCalledNumber) {
      toast('Belum ada antrian yang pernah dipanggil', 'error')
      return
    }
    const num = parseInt(queueState.lastCalledNumber.replace(/\D/g, ''), 10)
    if (num > 0) {
      playQueueCallSound(num, queueState.lastCalledNumber)
      toast(`Mengulangi panggilan nomor ${queueState.lastCalledNumber}`, 'info')
    }
  }

  const handleResetQueue = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset nomor urut antrian harian menjadi #000?')) {
      resetDailyQueueSequence()
      setQueueState(getQueueDisplayState())
      toast('Nomor antrian harian berhasil direset', 'success')
    }
  }

  const handleSaveRunningText = () => {
    const updated = broadcastQueueState({ runningText: runningTextInput })
    setQueueState(updated)
    toast('Teks berjalan TV Antrian berhasil diperbarui', 'success')
  }

  return (
    <div className="space-y-4 select-none font-sans pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-600/30">
            <Monitor size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Pusat Layar Display & Antrian</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kelola Customer Display kasir, Layar TV antrian pelanggan, dan pemanggilan suara
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'customer'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Monitor size={15} className={activeTab === 'customer' ? 'text-red-600' : ''} />
            <span>1. Layar Pelanggan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Tv size={15} className={activeTab === 'queue' ? 'text-amber-500' : ''} />
            <span>2. Layar TV Antrian</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('controller')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'controller'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Megaphone size={15} />
            <span>3. Kontrol Panggilan</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CUSTOMER DISPLAY ─────────────────────────────────── */}
      {activeTab === 'customer' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-18 h-18 p-4 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mb-4">
                  <Monitor size={40} />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">Customer Display (Monitor Kedua)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6 font-medium leading-relaxed">
                  Tampilan layar kedua yang menghadap ke pelanggan saat kasir menginput barang. Menampilkan nomor urut item <strong className="text-slate-700 dark:text-slate-300">#1, #2, #3</strong>, QRIS dinamis, total tagihan, dan tiket nomor antrian besar setelah transaksi selesai.
                </p>
                <div className="flex flex-wrap gap-2.5 justify-center">
                  <Button
                    icon={<ExternalLink size={14} />}
                    onClick={openCustomerDisplay}
                    loading={openingCustomer}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 border-0"
                  >
                    Buka di Jendela Baru
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Eye size={14} />}
                    onClick={() => navigate('/customer-display')}
                    className="font-bold text-xs border-slate-200 dark:border-slate-800"
                  >
                    Pratinjau Layar
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Copy size={14} />}
                    onClick={() => copyUrl(customerDisplayUrl, 'Customer Display')}
                    className="font-bold text-xs border-slate-200 dark:border-slate-800"
                  >
                    Salin URL
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Fitur Unggulan Customer Display" className="rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="space-y-3.5 mt-2">
                {[
                  { icon: <Hash size={18} className="text-red-500" />, title: 'Nomor Urut Item Terperinci', desc: 'Setiap item yang discan diberi badge #1, #2, #3 sehingga pembeli dapat mencocokkan total barang dengan cepat.' },
                  { icon: <BellRing size={18} className="text-amber-500" />, title: 'Tiket Nomor Antrian Besar', desc: 'Saat kasir menyelesaikan pembayaran, layar otomatis memunculkan kartu tiket nomor antrian raksasa.' },
                  { icon: <QrCode size={18} className="text-emerald-500" />, title: 'QRIS & Kembalian Realtime', desc: 'Tampilan barcode QRIS interaktif dan visual nominal kembalian yang jelas dan transparan.' },
                ].map((f, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                      {f.icon}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800 dark:text-white">{f.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="URL Layar Customer Display">
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">
                {customerDisplayUrl}
              </div>
              <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={() => copyUrl(customerDisplayUrl, 'Customer Display')}>
                Salin
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB 2: QUEUE TV DISPLAY ─────────────────────────────────── */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-18 h-18 p-4 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                  <Tv size={40} />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">Layar TV Antrian Publik (Queue Display)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6 font-medium leading-relaxed">
                  Layar tampilan rasio 16:9 untuk Smart TV atau monitor ruang tunggu pelanggan. Terbagi menjadi 2 kolom: <strong className="text-amber-500">Sedang Disiapkan</strong> dan <strong className="text-emerald-500">Siap Diambil</strong> dilengkapi dengan audio lonceng dan suara panggilan otomatis.
                </p>
                <div className="flex flex-wrap gap-2.5 justify-center">
                  <Button
                    icon={<ExternalLink size={14} />}
                    onClick={openQueueDisplay}
                    loading={openingQueue}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 border-0"
                  >
                    Buka di Layar TV / Jendela Baru
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Eye size={14} />}
                    onClick={() => navigate('/queue-display')}
                    className="font-bold text-xs border-slate-200 dark:border-slate-800"
                  >
                    Pratinjau Layar TV
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Copy size={14} />}
                    onClick={() => copyUrl(queueDisplayUrl, 'Queue TV Display')}
                    className="font-bold text-xs border-slate-200 dark:border-slate-800"
                  >
                    Salin URL Smart TV
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Cara Memasang di Smart TV" className="rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="space-y-3.5 mt-2">
                {[
                  { step: '1', title: 'Hubungkan Smart TV ke WiFi yang Sama', desc: 'Pastikan TV dan komputer kasir berada pada satu jaringan WiFi atau kabel LAN.' },
                  { step: '2', title: 'Buka Web Browser di Smart TV', desc: 'Buka aplikasi Browser di Android TV / Smart TV dan masukkan alamat URL Layar TV Antrian.' },
                  { step: '3', title: 'Mode Layar Penuh (Fullscreen)', desc: 'Tekan tombol fullscreen pada browser TV agar tampilan memenuhi seluruh layar tanpa toolbar.' },
                  { step: '4', title: 'Otomatis Sinkron & Suara Panggilan', desc: 'Setiap pesanan baru dari kasir atau KDS akan langsung terupdate dan suara bel akan berbunyi di TV.' },
                ].map((s, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                      {s.step}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800 dark:text-white">{s.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="URL Layar Antrian Smart TV">
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">
                {queueDisplayUrl}
              </div>
              <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={() => copyUrl(queueDisplayUrl, 'Queue TV Display')}>
                Salin
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB 3: QUEUE CONTROLLER & CALLER ────────────────────────── */}
      {activeTab === 'controller' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Quick Call Box */}
            <Card title="Panggil Nomor Antrian Manual" className="rounded-3xl border border-slate-200 dark:border-slate-800 p-5 lg:col-span-2">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Nomor Antrian (Angka):
                    </label>
                    <div className="relative">
                      <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        placeholder="Contoh: 42"
                        value={callManualNum}
                        onChange={e => setCallManualNum(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleManualCall()}
                        className="w-full h-11 pl-9 pr-3 text-sm font-black rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Nomor Meja (Opsional):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 05"
                      value={callManualTable}
                      onChange={e => setCallManualTable(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleManualCall()}
                      className="w-full h-11 px-3 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Button
                    icon={<Megaphone size={15} />}
                    onClick={handleManualCall}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 border-0"
                  >
                    Panggil Antrian Sekarang
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<RotateCcw size={14} />}
                    onClick={handleRepeatCall}
                    disabled={!queueState.lastCalledNumber}
                    className="font-bold text-xs border-slate-200 dark:border-slate-800"
                  >
                    Ulangi Panggilan Terakhir ({queueState.lastCalledNumber || '-'})
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Volume2 size={14} />}
                    onClick={() => playChimeSound()}
                    className="font-bold text-xs border-slate-200 dark:border-slate-800"
                  >
                    Tes Lonceng / Chime
                  </Button>
                </div>
              </div>
            </Card>

            {/* Daily Queue Sequence Status */}
            <Card title="Status Antrian Harian" className="rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="space-y-4 text-center py-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Urutan Terakhir Hari Ini</span>
                  <p className="text-4xl font-black text-red-600 font-mono tracking-tight my-1">
                    {formatQueueNumber(currentDailySeq)}
                  </p>
                  <p className="text-[11px] text-slate-500">Nomor ini otomatis berlanjut di kasir & KDS</p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<RotateCcw size={13} />}
                    onClick={handleResetQueue}
                    className="w-full text-xs font-bold"
                  >
                    Reset Urutan Antrian Harian
                  </Button>
                </div>
              </div>
            </Card>

          </div>

          {/* Running Text Editor */}
          <Card title="Pengaturan Teks Berjalan TV Antrian (Marquee)" className="rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="space-y-3">
              <div className="relative">
                <MessageSquare size={16} className="absolute left-3 top-3 text-slate-400" />
                <textarea
                  rows={2}
                  value={runningTextInput}
                  onChange={e => setRunningTextInput(e.target.value)}
                  placeholder="Ketik teks pengumuman atau promo yang akan berjalan di bagian bawah layar TV..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveRunningText}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm border-0"
                >
                  Simpan Teks Pengumuman TV
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
