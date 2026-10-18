import { useState, useEffect, useMemo } from 'react'
import { Clock, DollarSign, TrendingUp, Eye, Trash2, Plus, AlertCircle, ShieldAlert, CheckCircle2, ArrowUpRight, Wallet, LayoutGrid, List, Table, Search } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import Badge from '../components/Badge'
import { SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDateTime } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

export default function Shifts() {
  const toast = useToast()
  const { user } = useAuth()
  const [shifts, setShifts] = useState<any[]>([])
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [modal, setModal] = useState<'open' | 'close' | 'detail' | null>(null)
  const [selectedShift, setSelectedShift] = useState<any>(null)
  const [deleteShift, setDeleteShift] = useState<any>(null)
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'table'>('list')
  const [search, setSearch] = useState('')

  const loadShifts = async () => {
    try {
      const r = await api<any[]>('shift:getAll')
      if (r.success) {
        const validData = (r.data ?? []).filter(item => item && item.id)
        setShifts(validData)
      }
      const curr = await api<any>('shift:getCurrent', user?.nama_pengguna)
      if (curr.success) setCurrentShift(curr.data)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => { loadShifts() }, [])

  const handleOpenShift = async () => {
    if (!openingBalance) return toast('Masukkan modal awal', 'error')
    setLoading(true)
    const r = await api('shift:open', { user_id: user?.nama_pengguna, opening_balance: parseFloat(openingBalance) })
    setLoading(false)
    if (r.success) {
      toast('Shift berhasil dibuka')
      setModal(null)
      setOpeningBalance('')
      loadShifts()
      window.dispatchEvent(new CustomEvent('app:refresh'))
    } else {
      toast(r.message || 'Gagal buka shift', 'error')
    }
  }

  const handleCloseShift = async () => {
    if (!closingBalance) return toast('Masukkan saldo akhir', 'error')
    setLoading(true)
    const r = await api<{ difference: number }>('shift:close', currentShift.id, {
      opening_balance: currentShift.opening_balance,
      closing_balance: parseFloat(closingBalance),
      notes
    })
    setLoading(false)
    if (r.success) {
      toast(`Shift ditutup. Selisih: ${formatRupiah(r.data?.difference ?? 0)}`)
      setModal(null)
      setClosingBalance('')
      setNotes('')
      loadShifts()
      window.dispatchEvent(new CustomEvent('app:refresh'))
    } else {
      toast(r.message || 'Gagal tutup shift', 'error')
    }
  }
  
  const handleDelete = async () => {
    if (!deleteShift) return
    setLoading(true)
    const r = await api('shift:delete', deleteShift.id)
    setLoading(false)
    if (r.success) {
      toast('Shift berhasil dihapus')
      setDeleteShift(null)
      loadShifts()
      window.dispatchEvent(new CustomEvent('app:refresh'))
    } else {
      toast(r.message || 'Gagal menghapus shift', 'error')
    }
  }

  return (
    <div className="space-y-5 select-none">
      {loadingData ? (
        <SkeletonSpinner label="Memuat data shift kasir..." />
      ) : (
        <>
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Manajemen Shift & Rekap Kas</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-red-600/10 text-red-600 dark:bg-red-950/60 dark:text-red-400 text-[11px] font-bold border border-red-600/20">
                  {currentShift ? '1 Shift Aktif' : 'Shift Nonaktif'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Kontrol pembukaan/penutupan laci kasir, hitung saldo awal/akhir, dan audit selisih kas harian.
              </p>
            </div>

            {!currentShift ? (
              <Button
                onClick={() => setModal('open')}
                icon={<Plus size={16} />}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold border-0 shadow-md shadow-red-600/20"
              >
                Buka Shift Baru
              </Button>
            ) : (
              <Button
                onClick={() => setModal('close')}
                variant="danger"
                icon={<Clock size={16} />}
                className="w-full sm:w-auto font-bold shadow-md shadow-red-600/20"
              >
                Tutup Shift Saat Ini
              </Button>
            )}
          </div>

          {/* Active Shift Card Banner */}
          {currentShift && (
            <div className="rounded-2xl bg-slate-900 text-white p-5 sm:p-6 border border-slate-800 shadow-md relative overflow-hidden">
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Shift Kasir Aktif
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">{currentShift.shift_number}</h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Kasir: <strong className="text-slate-200">{currentShift.nama_lengkap || user?.nama_lengkap || user?.nama_pengguna}</strong> · Dibuka: {formatDateTime(currentShift.start_time)}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="bg-slate-800/90 px-4 py-2.5 rounded-xl border border-slate-700/60">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Modal Awal Laci</p>
                    <h3 className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5">{formatRupiah(currentShift.opening_balance)}</h3>
                  </div>
                  <Button
                    onClick={() => setModal('close')}
                    variant="danger"
                    icon={<Clock size={16} />}
                    className="w-full sm:w-auto font-bold shadow-sm"
                  >
                    Tutup Shift
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Shift Header & View Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Riwayat Shift Kasir Toko</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{shifts.length} catatan shift kasir tercatat</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 sm:w-56">
                <Input
                  placeholder="Cari shift atau kasir..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  icon={<Search size={14} />}
                />
              </div>

              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Tampilan List"
                >
                  <List size={16} />
                  <span className="hidden md:inline">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Tampilan Grid"
                >
                  <LayoutGrid size={16} />
                  <span className="hidden md:inline">Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Tampilan Tabel"
                >
                  <Table size={16} />
                  <span className="hidden md:inline">Tabel</span>
                </button>
              </div>
            </div>
          </div>

          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {shifts.filter(s => {
                if (!search.trim()) return true
                const q = search.toLowerCase()
                return (
                  String(s.shift_number || '').toLowerCase().includes(q) ||
                  String(s.nama_lengkap || '').toLowerCase().includes(q) ||
                  String(s.status || '').toLowerCase().includes(q)
                )
              }).length === 0 ? (
                <div className="py-14 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <Clock size={36} className="mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum ada riwayat shift kasir</p>
                </div>
              ) : (
                shifts.filter(s => {
                  if (!search.trim()) return true
                  const q = search.toLowerCase()
                  return (
                    String(s.shift_number || '').toLowerCase().includes(q) ||
                    String(s.nama_lengkap || '').toLowerCase().includes(q) ||
                    String(s.status || '').toLowerCase().includes(q)
                  )
                }).map(shift => (
                  <div
                    key={shift.id}
                    onClick={() => { setSelectedShift(shift); setModal('detail') }}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-mono font-bold text-xs shrink-0 border border-primary-200/50 dark:border-primary-800/40">
                        <Clock size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {shift.shift_number}
                          </p>
                          <Badge label={shift.status} variant={shift.status === 'OPEN' ? 'green' : 'blue'} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                          <span>Kasir: <strong className="text-slate-700 dark:text-slate-300">{shift.nama_lengkap || 'Kasir'}</strong></span>
                          <span>·</span>
                          <span>Mulai: {formatDateTime(shift.start_time)}</span>
                          {shift.end_time && (
                            <>
                              <span>·</span>
                              <span>Selesai: {formatDateTime(shift.end_time)}</span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          <span>Modal: {formatRupiah(shift.opening_balance)}</span>
                          {shift.difference ? (
                            <span className={`ml-2 font-bold ${(shift.difference || 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              · Selisih: {formatRupiah(shift.difference)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right flex items-center gap-3">
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium">Penjualan</p>
                        <p className="font-extrabold text-sm sm:text-base text-primary-600 dark:text-primary-400">
                          {formatRupiah(shift.total_sales || 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedShift(shift)
                            setModal('detail')
                          }}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-slate-400 hover:text-primary-600 transition-colors"
                          title="Lihat Detail Shift"
                        >
                          <Eye size={16} />
                        </button>
                        {shift.status === 'CLOSED' && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setDeleteShift(shift)
                            }}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition-colors"
                            title="Hapus Data Shift"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shifts.filter(s => {
                if (!search.trim()) return true
                const q = search.toLowerCase()
                return (
                  String(s.shift_number || '').toLowerCase().includes(q) ||
                  String(s.nama_lengkap || '').toLowerCase().includes(q) ||
                  String(s.status || '').toLowerCase().includes(q)
                )
              }).length === 0 ? (
                <div className="col-span-full py-14 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <Clock size={36} className="mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum ada riwayat shift kasir</p>
                </div>
              ) : (
                shifts.filter(s => {
                  if (!search.trim()) return true
                  const q = search.toLowerCase()
                  return (
                    String(s.shift_number || '').toLowerCase().includes(q) ||
                    String(s.nama_lengkap || '').toLowerCase().includes(q) ||
                    String(s.status || '').toLowerCase().includes(q)
                  )
                }).map(shift => (
                  <div
                    key={shift.id}
                    onClick={() => { setSelectedShift(shift); setModal('detail') }}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {shift.shift_number}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">Kasir: <strong className="text-slate-700 dark:text-slate-300">{shift.nama_lengkap || 'Kasir'}</strong></p>
                      </div>
                      <Badge label={shift.status} variant={shift.status === 'OPEN' ? 'green' : 'blue'} />
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <p>Mulai: {formatDateTime(shift.start_time)}</p>
                      {shift.end_time && <p>Selesai: {formatDateTime(shift.end_time)}</p>}
                      <p>Modal Awal: {formatRupiah(shift.opening_balance)}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Penjualan</span>
                        <span className="font-extrabold text-base text-primary-600 dark:text-primary-400">{formatRupiah(shift.total_sales || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedShift(shift)
                            setModal('detail')
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary-600"
                        >
                          <Eye size={15} />
                        </button>
                        {shift.status === 'CLOSED' && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setDeleteShift(shift)
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-xs min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-950 font-extrabold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">No Shift</th>
                      <th className="px-4 py-3 text-left">Kasir</th>
                      <th className="px-4 py-3 text-left">Waktu Mulai</th>
                      <th className="px-4 py-3 text-left">Waktu Selesai</th>
                      <th className="px-4 py-3 text-right">Modal Awal</th>
                      <th className="px-4 py-3 text-right">Penjualan</th>
                      <th className="px-4 py-3 text-right">Selisih Kas</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {shifts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-400 font-bold">
                          Belum ada riwayat data shift kasir
                        </td>
                      </tr>
                    ) : (
                      shifts.map(shift => (
                        <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{shift.shift_number}</td>
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{shift.nama_lengkap}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(shift.start_time)}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{shift.end_time ? formatDateTime(shift.end_time) : '-'}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">{formatRupiah(shift.opening_balance)}</td>
                          <td className="px-4 py-3 text-right font-extrabold text-primary-600 dark:text-primary-400">{formatRupiah(shift.total_sales || 0)}</td>
                          <td className={`px-4 py-3 text-right font-black ${(shift.difference || 0) > 0 ? 'text-emerald-600' : (shift.difference || 0) < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {shift.difference ? formatRupiah(shift.difference) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge label={shift.status} variant={shift.status === 'OPEN' ? 'green' : 'blue'} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => { setSelectedShift(shift); setModal('detail') }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors" title="Lihat Detail Shift">
                                <Eye size={15} />
                              </button>
                              {shift.status === 'CLOSED' && (
                                <button onClick={() => setDeleteShift(shift)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors" title="Hapus Data Shift">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Modal Buka Shift */}
          <Modal
            open={modal === 'open'}
            onClose={() => setModal(null)}
            title="Buka Shift Kasir Baru"
            size="sm"
            footer={
              <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
                <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto font-bold">
                  Batal
                </Button>
                <Button
                  loading={loading}
                  onClick={handleOpenShift}
                  className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold border-0 shadow-sm"
                >
                  Buka Shift Sekarang
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Cashier & Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Kasir Bertugas</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{user?.nama_lengkap || user?.nama_pengguna || 'Kasir'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Waktu Pembukaan</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                </div>
              </div>

              {/* Opening Balance Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Modal Awal di Laci Kas (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(e.target.value)}
                    placeholder="0"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-base outline-none focus:ring-2 focus:ring-primary-500/30 transition"
                    autoFocus
                  />
                </div>
                {openingBalance && !isNaN(Number(openingBalance)) && Number(openingBalance) > 0 && (
                  <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-1">
                    Terbilang: {formatRupiah(Number(openingBalance))}
                  </p>
                )}
              </div>

              {/* Preset Quick Chips */}
              <div>
                <span className="text-[11px] font-extrabold uppercase text-slate-400 block mb-1.5">Pilihan Cepat Nominal</span>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 50000, 100000, 200000, 500000, 1000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOpeningBalance(String(val))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                        Number(openingBalance) === val
                          ? 'bg-primary-50 dark:bg-primary-950/50 border-primary-500 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {val === 0 ? 'Rp 0 (Kosong)' : formatRupiah(val)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note / Tip */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-900/60 p-2.5 rounded-lg">
                Modal awal adalah uang tunai receh/pecahan yang dimasukkan ke laci kasir sebelum melayani transaksi pembeli untuk keperluan uang kembalian.
              </p>
            </div>
          </Modal>

          {/* Modal Tutup Shift */}
          <Modal
            open={modal === 'close'}
            onClose={() => setModal(null)}
            title="Tutup Shift Kasir & Rekap Kas"
            size="sm"
            footer={
              <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
                <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto font-bold">
                  Batal
                </Button>
                <Button
                  loading={loading}
                  onClick={handleCloseShift}
                  variant="danger"
                  className="w-full sm:w-auto font-bold shadow-sm"
                >
                  Tutup Shift Sekarang
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {currentShift && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">No Shift:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{currentShift.shift_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Modal Awal Laci:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatRupiah(currentShift.opening_balance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Penjualan Tunai:</span>
                    <span className="font-extrabold text-primary-600 dark:text-primary-400">{formatRupiah(currentShift.total_sales || 0)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800 font-bold">
                    <span>Estimasi Kas di Laci:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatRupiah((currentShift.opening_balance || 0) + (currentShift.total_sales || 0))}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Saldo Fisik Akhir di Laci Kas (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                  <input
                    type="number"
                    value={closingBalance}
                    onChange={e => setClosingBalance(e.target.value)}
                    placeholder="Hitung seluruh uang fisik di laci..."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-base outline-none focus:ring-2 focus:ring-primary-500/30 transition"
                    autoFocus
                  />
                </div>
                {closingBalance && !isNaN(Number(closingBalance)) && currentShift && (
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs flex justify-between items-center font-bold">
                    <span>Selisih Fisik vs Sistem:</span>
                    {(() => {
                      const exp = (currentShift.opening_balance || 0) + (currentShift.total_sales || 0)
                      const diff = Number(closingBalance) - exp
                      if (diff === 0) return <span className="text-emerald-600 dark:text-emerald-400">Pas (Sesuai)</span>
                      if (diff > 0) return <span className="text-emerald-600 dark:text-emerald-400">Lebih {formatRupiah(diff)}</span>
                      return <span className="text-red-600 dark:text-red-400">Kurang {formatRupiah(Math.abs(diff))}</span>
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Catatan Penutupan Shift (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Tuliskan catatan selisih uang atau operasional jika ada..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/30 transition resize-none font-medium"
                />
              </div>
            </div>
          </Modal>

          {/* Modal Detail Shift */}
          <Modal open={modal === 'detail'} onClose={() => setModal(null)} title={`Detail Rekap Shift: ${selectedShift?.shift_number}`} size="md">
            {selectedShift && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-[10px] font-extrabold uppercase text-slate-400">Kasir</p><p className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedShift.nama_lengkap}</p></div>
                  <div><p className="text-[10px] font-extrabold uppercase text-slate-400">Status Shift</p><Badge label={selectedShift.status} variant={selectedShift.status === 'OPEN' ? 'green' : 'blue'} /></div>
                  <div><p className="text-[10px] font-extrabold uppercase text-slate-400">Waktu Mulai</p><p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{formatDateTime(selectedShift.start_time)}</p></div>
                  <div><p className="text-[10px] font-extrabold uppercase text-slate-400">Waktu Selesai</p><p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{selectedShift.end_time ? formatDateTime(selectedShift.end_time) : '-'}</p></div>
                </div>
                
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500 font-medium">Modal Awal</span><span className="font-bold text-slate-900 dark:text-white">{formatRupiah(selectedShift.opening_balance)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-medium">Total Penjualan Tunai</span><span className="font-extrabold text-red-600 dark:text-red-400">{formatRupiah(selectedShift.total_sales || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-medium">Total Transaksi Diproses</span><span className="font-bold text-slate-900 dark:text-white">{selectedShift.total_transactions || 0} Struk</span></div>
                  {selectedShift.status === 'CLOSED' && (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500 font-medium">Saldo Fisik Akhir</span><span className="font-bold text-slate-900 dark:text-white">{formatRupiah(selectedShift.closing_balance)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 font-medium">Saldo Sistem (Expected)</span><span className="font-bold text-slate-900 dark:text-white">{formatRupiah(selectedShift.expected_balance)}</span></div>
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800"><span className="font-black">Selisih Kas</span><span className={`font-black ${(selectedShift.difference || 0) > 0 ? 'text-emerald-600' : (selectedShift.difference || 0) < 0 ? 'text-red-600' : 'text-slate-500'}`}>{formatRupiah(selectedShift.difference)}</span></div>
                    </>
                  )}
                </div>
                
                {selectedShift.notes && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-bold">Catatan Kasir: </span>{selectedShift.notes}
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Modal Delete Shift */}
          <Modal open={!!deleteShift} onClose={() => setDeleteShift(null)} title="Hapus Data Shift" size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleteShift(null)} className="w-full sm:w-auto font-bold">Batal</Button>
                <Button variant="danger" loading={loading} onClick={handleDelete} className="w-full sm:w-auto font-bold">Hapus Shift</Button>
              </>
            }
          >
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3">Apakah Anda yakin ingin menghapus data rekapan shift ini?</p>
            {deleteShift && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-400">No Shift:</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">{deleteShift.shift_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kasir:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{deleteShift.nama_lengkap}</span>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  )
}
