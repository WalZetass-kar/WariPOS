import { useEffect, useState, useCallback, useRef } from 'react'
import { ChefHat, Clock, Bell, BellOff, CheckCircle, Utensils, Play, Timer, Table2, RefreshCw, Megaphone, Trash2, AlertTriangle, CheckSquare } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatDateTime } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { cashierSound } from '../utils/sound'
import {
  setOrderReadyInQueue,
  completeOrderInQueue,
  playQueueCallSound
} from '../utils/queueNumber'

interface KdsOrderItem {
  id: number
  kds_order_id: number
  kd_barang: string
  nama_item: string
  qty: number
  catatan?: string | null
  status?: string
}

interface KdsOrder {
  id: number
  kd_transaksi: string
  nomor_meja?: string | null
  nomor_antrian: number
  nama_pelanggan?: string | null
  jenis_order?: string | null
  status: 'BARU' | 'DIMASAK' | 'SIAP' | 'DISAJIKAN' | 'SELESAI'
  catatan?: string | null
  waktu_masuk: string
  waktu_mulai_masak?: string | null
  waktu_selesai?: string | null
  dapur?: string | null
  items: KdsOrderItem[]
}

interface KdsPending {
  total: number
  baru: number
  dimasak: number
  siap: number
}

type KdsTab = 'SEMUA' | 'BARU' | 'DIMASAK' | 'SIAP' | 'DISAJIKAN' | 'SELESAI'

const statusConfig: Record<string, { border: string; badge: 'red' | 'yellow' | 'green' | 'blue' | 'gray'; bg: string }> = {
  BARU: { border: 'border-red-500', badge: 'red', bg: 'bg-red-50/60 dark:bg-red-950/20' },
  DIMASAK: { border: 'border-amber-500', badge: 'yellow', bg: 'bg-amber-50/60 dark:bg-amber-950/20' },
  SIAP: { border: 'border-emerald-500', badge: 'green', bg: 'bg-emerald-50/60 dark:bg-emerald-950/20' },
  DISAJIKAN: { border: 'border-blue-500', badge: 'blue', bg: 'bg-blue-50/60 dark:bg-blue-950/20' },
  SELESAI: { border: 'border-slate-300', badge: 'gray', bg: 'bg-slate-50 dark:bg-slate-900/30' },
}

export default function KitchenDisplay() {
  const toast = useToast()
  const [orders, setOrders] = useState<KdsOrder[]>([])
  const [pending, setPending] = useState<KdsPending>({ total: 0, baru: 0, dimasak: 0, siap: 0 })
  const [avgPrepTime, setAvgPrepTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<KdsTab>('SEMUA')
  const [soundOn, setSoundOn] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<KdsOrder | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ order: KdsOrder; action: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<KdsOrder | null>(null)
  const [clearModalOpen, setClearModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const prevCountRef = useRef(0)

  const load = useCallback(async (isManual = false) => {
    const [r1, r2, r3] = await Promise.all([
      api<KdsOrder[]>('kds:getOrders'),
      api<KdsPending>('kds:getPending'),
      api<number>('kds:getAvgPrepTime'),
    ])
    if (r1.success) {
      const data = r1.data ?? []
      setOrders(data)
      if (soundOn && prevCountRef.current > 0 && data.length > prevCountRef.current) {
        cashierSound.playScanBeep()
      }
      prevCountRef.current = data.length
    }
    if (r2.success) setPending(r2.data ?? { total: 0, baru: 0, dimasak: 0, siap: 0 })
    if (r3.success) setAvgPrepTime(r3.data ?? 0)
    setLoading(false)
    if (isManual) toast('Layar KDS diperbarui', 'success')
  }, [soundOn, toast])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(false), 10000)
    return () => clearInterval(interval)
  }, [load])

  const handleCallQueue = (order: KdsOrder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setOrderReadyInQueue(order.nomor_antrian, true)
    toast(`Memanggil Antrian #${order.nomor_antrian}`, 'success')
  }

  const handleUpdateStatus = async (order: KdsOrder, status: string) => {
    setActionLoading(true)
    const r = await api('kds:updateOrderStatus', order.id, status)
    setActionLoading(false)
    if (r.success) {
      toast(`Pesanan #${order.nomor_antrian} diubah menjadi ${status}`, 'success')

      // Sync with Public TV Queue Display
      if (status === 'SIAP') {
        setOrderReadyInQueue(order.nomor_antrian, true)
      } else if (status === 'SELESAI' || status === 'DISAJIKAN') {
        completeOrderInQueue(order.nomor_antrian)
      }

      setConfirmModal(null)
      setSelectedOrder(null)
      load()
    } else {
      toast((r.message as string) || 'Gagal mengubah status', 'error')
    }
  }

  const handleDeleteOrder = async (order: KdsOrder) => {
    setActionLoading(true)
    const r = await api('kds:deleteOrder', order.id)
    setActionLoading(false)
    if (r.success) {
      toast(`Pesanan #${order.nomor_antrian} berhasil dihapus`, 'success')
      setDeleteModal(null)
      setSelectedOrder(null)
      load()
    } else {
      toast((r.message as string) || 'Gagal menghapus pesanan', 'error')
    }
  }

  const handleClearOrders = async (targetStatus?: string) => {
    setActionLoading(true)
    const r = await api('kds:clearOrders', targetStatus)
    setActionLoading(false)
    if (r.success) {
      toast(targetStatus ? `Riwayat pesanan ${targetStatus} berhasil dibersihkan` : 'Seluruh antrian dapur berhasil dibersihkan', 'success')
      setClearModalOpen(false)
      load()
    } else {
      toast((r.message as string) || 'Gagal membersihkan riwayat', 'error')
    }
  }

  const elapsed = (createdAt: string) => {
    if (!createdAt) return '00:00'
    const diff = Math.max(0, Date.now() - new Date(createdAt).getTime())
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const filtered = orders.filter(o => {
    if (tab === 'SEMUA') {
      return o.status !== 'SELESAI'
    }
    return o.status === tab
  })

  const stats = [
    { label: 'Total Antrian', value: pending.total, icon: <ChefHat size={20} className="text-primary-500" /> },
    { label: 'Pesanan Baru', value: pending.baru, icon: <Bell size={20} className="text-red-500" /> },
    { label: 'Sedang Dimasak', value: pending.dimasak, icon: <Timer size={20} className="text-amber-500" /> },
    { label: 'Siap Saji', value: pending.siap, icon: <CheckCircle size={20} className="text-emerald-500" /> },
    { label: 'Rata-rata Prep', value: `${avgPrepTime}m`, icon: <Clock size={20} className="text-blue-500" /> },
  ]

  return (
    <div className="space-y-4">
      {loading ? (
        <>
          <SkeletonStatGrid count={5} />
          <SkeletonSpinner label="Memuat layar dapur KDS..." />
        </>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.map((s, i) => (
              <Card key={i} title={s.label} action={s.icon}>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
              {(['SEMUA', 'BARU', 'DIMASAK', 'SIAP', 'DISAJIKAN', 'SELESAI'] as KdsTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    tab === t
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {t === 'SEMUA' ? 'Antrian Aktif' : t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={() => setClearModalOpen(true)}
                className="font-bold text-xs"
              >
                Hapus Riwayat
              </Button>
              <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => load(true)}>
                Refresh
              </Button>
              <button
                onClick={() => setSoundOn(!soundOn)}
                className={`p-2.5 rounded-xl border transition-all ${
                  soundOn
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                }`}
                title={soundOn ? 'Nonaktifkan suara' : 'Aktifkan suara'}
              >
                {soundOn ? <Bell size={18} /> : <BellOff size={18} />}
              </button>
            </div>
          </div>

          {/* Order Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <div className="text-center py-16">
                    <ChefHat size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-700 dark:text-slate-200 font-bold text-base">Tidak ada antrian pesanan</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {tab === 'SEMUA' ? 'Semua pesanan masak sudah disajikan dengan rapi' : `Tidak ada pesanan dengan status ${tab}`}
                    </p>
                  </div>
                </Card>
              </div>
            ) : (
              filtered.map(order => {
                const cfg = statusConfig[order.status] ?? statusConfig.BARU
                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-4 space-y-3 cursor-pointer hover:shadow-xl transition-all flex flex-col justify-between`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-slate-900 dark:text-white">#{order.nomor_antrian}</span>
                          <Badge label={order.status} variant={cfg.badge} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 text-slate-500 text-xs font-mono font-bold bg-white/70 dark:bg-slate-900/70 px-2 py-1 rounded-lg">
                            <Clock size={13} />
                            {elapsed(order.waktu_mulai_masak || order.waktu_masuk)}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteModal(order)
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Hapus pesanan ini dari riwayat"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{order.nama_pelanggan || 'Pelanggan'}</span>
                        {order.nomor_meja && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-black">
                            {order.nomor_meja}
                          </span>
                        )}
                      </div>

                      {/* Items List */}
                      <div className="space-y-1.5 pt-1">
                        {(order.items ?? []).map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/40 last:border-0">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              <span className="font-black text-red-600 dark:text-red-400 mr-1.5">{item.qty}x</span>
                              {item.nama_item}
                            </span>
                            {item.catatan && <span className="text-[10px] italic text-amber-600">({item.catatan})</span>}
                          </div>
                        ))}
                      </div>

                      {order.catatan && (
                        <p className="text-xs italic text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 rounded-xl p-2 font-medium">
                          Catatan: {order.catatan}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                      <div className="flex gap-2">
                        {order.status === 'BARU' && (
                          <Button size="sm" icon={<Play size={14} />} onClick={(e) => { e.stopPropagation(); setConfirmModal({ order, action: 'DIMASAK' }); }} className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white border-0">
                            Mulai Masak
                          </Button>
                        )}
                        {order.status === 'DIMASAK' && (
                          <Button size="sm" variant="success" icon={<CheckCircle size={14} />} onClick={(e) => { e.stopPropagation(); setConfirmModal({ order, action: 'SIAP' }); }} className="w-full font-bold">
                            Siap Disajikan
                          </Button>
                        )}
                        {order.status === 'SIAP' && (
                          <Button size="sm" variant="secondary" icon={<Utensils size={14} />} onClick={(e) => { e.stopPropagation(); setConfirmModal({ order, action: 'DISAJIKAN' }); }} className="w-full font-bold">
                            Sajikan ke Meja
                          </Button>
                        )}
                        {order.status === 'DISAJIKAN' && (
                          <Button size="sm" variant="secondary" icon={<CheckSquare size={14} />} onClick={(e) => { e.stopPropagation(); setConfirmModal({ order, action: 'SELESAI' }); }} className="w-full font-bold">
                            Tandai Selesai
                          </Button>
                        )}
                        {order.status === 'SELESAI' && (
                          <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); setDeleteModal(order); }} className="w-full font-bold">
                            Hapus Riwayat
                          </Button>
                        )}
                      </div>

                      {/* Quick Call Button */}
                      {order.status !== 'SELESAI' && (
                        <button
                          type="button"
                          onClick={(e) => handleCallQueue(order, e)}
                          className="w-full py-1.5 px-2 rounded-xl bg-slate-900/10 dark:bg-slate-100/10 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          title="Panggil nomor antrian di Layar TV & Speaker"
                        >
                          <Megaphone size={13} />
                          <span>Panggil #{order.nomor_antrian}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Detail Modal */}
          <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Detail Pesanan #${selectedOrder?.nomor_antrian ?? ''}`} size="md">
            {selectedOrder && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{selectedOrder.nama_pelanggan || 'Pelanggan POS'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(selectedOrder.waktu_masuk)} · {selectedOrder.nomor_meja || 'Takeaway'}</p>
                  </div>
                  <Badge label={selectedOrder.status} variant={statusConfig[selectedOrder.status]?.badge ?? 'gray'} />
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        <span className="font-black text-red-600 mr-2">{item.qty}x</span> {item.nama_item}
                      </span>
                      {item.catatan && <span className="text-xs text-slate-400">{item.catatan}</span>}
                    </div>
                  ))}
                </div>
                {selectedOrder.catatan && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <p className="font-bold">Catatan Pesanan:</p>
                    <p>{selectedOrder.catatan}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {selectedOrder.status === 'BARU' && (
                    <Button className="flex-1 font-bold bg-amber-600 hover:bg-amber-700 text-white border-0" icon={<Play size={16} />} onClick={() => setConfirmModal({ order: selectedOrder, action: 'DIMASAK' })}>Mulai Masak</Button>
                  )}
                  {selectedOrder.status === 'DIMASAK' && (
                    <Button className="flex-1 font-bold" variant="success" icon={<CheckCircle size={16} />} onClick={() => setConfirmModal({ order: selectedOrder, action: 'SIAP' })}>Tandai Siap</Button>
                  )}
                  {selectedOrder.status === 'SIAP' && (
                    <Button className="flex-1 font-bold" variant="secondary" icon={<Utensils size={16} />} onClick={() => setConfirmModal({ order: selectedOrder, action: 'DISAJIKAN' })}>Sajikan ke Tamu</Button>
                  )}
                  {selectedOrder.status === 'DISAJIKAN' && (
                    <Button className="flex-1 font-bold" variant="secondary" icon={<CheckSquare size={16} />} onClick={() => setConfirmModal({ order: selectedOrder, action: 'SELESAI' })}>Tandai Selesai</Button>
                  )}
                  <Button
                    variant="danger"
                    icon={<Trash2 size={16} />}
                    onClick={() => setDeleteModal(selectedOrder)}
                    className="font-bold px-4"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            )}
          </Modal>

          {/* Confirm Action Modal */}
          <Modal
            open={!!confirmModal}
            onClose={() => setConfirmModal(null)}
            title="Konfirmasi Status Pesanan"
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmModal(null)} className="w-full sm:w-auto">Batal</Button>
                <Button loading={actionLoading} onClick={() => handleUpdateStatus(confirmModal!.order, confirmModal!.action)} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-0">Konfirmasi</Button>
              </>
            }
          >
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ubah status pesanan antrian <strong>#{confirmModal?.order.nomor_antrian}</strong> menjadi <strong>{confirmModal?.action}</strong>?
            </p>
          </Modal>

          {/* Single Delete Confirmation Modal */}
          <Modal
            open={!!deleteModal}
            onClose={() => setDeleteModal(null)}
            title="Hapus Pesanan dari KDS"
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleteModal(null)} className="w-full sm:w-auto">Batal</Button>
                <Button
                  loading={actionLoading}
                  variant="danger"
                  onClick={() => deleteModal && handleDeleteOrder(deleteModal)}
                  className="w-full sm:w-auto"
                >
                  Hapus Sekarang
                </Button>
              </>
            }
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Yakin ingin menghapus antrian pesanan <strong>#{deleteModal?.nomor_antrian} ({deleteModal?.nama_pelanggan || 'Pelanggan'})</strong> dari layar dapur?
              </p>
            </div>
          </Modal>

          {/* Clear History Modal */}
          <Modal
            open={clearModalOpen}
            onClose={() => setClearModalOpen(false)}
            title="Bersihkan Riwayat Layar Dapur"
            size="sm"
            footer={
              <Button variant="secondary" onClick={() => setClearModalOpen(false)} className="w-full sm:w-auto">Tutup</Button>
            }
          >
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih aksi pembersihan antrian untuk merapikan layar display dapur:
              </p>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleClearOrders('SELESAI')}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/30 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-600">
                    Hapus Pesanan Status Selesai
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Hanya membersihkan riwayat pesanan yang sudah selesai dimasak/disajikan</p>
                </div>
                <Trash2 size={16} className="text-slate-400 group-hover:text-red-600 shrink-0 ml-2" />
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleClearOrders('DISAJIKAN')}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/30 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-600">
                    Hapus Pesanan yang Sudah Disajikan
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Membersihkan pesanan yang sudah diantarkan ke meja tamu</p>
                </div>
                <Trash2 size={16} className="text-slate-400 group-hover:text-red-600 shrink-0 ml-2" />
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleClearOrders()}
                className="w-full p-3.5 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 hover:bg-red-100 text-left transition-all flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400">
                    Reset & Hapus Seluruh Antrian Dapur
                  </h4>
                  <p className="text-[11px] text-red-500/80 dark:text-red-400/70">Membersihkan semua kartu pesanan (termasuk pesanan baru & sedang dimasak)</p>
                </div>
                <Trash2 size={16} className="text-red-600 shrink-0 ml-2" />
              </button>
            </div>
          </Modal>
        </>
      )}
    </div>
  )
}

