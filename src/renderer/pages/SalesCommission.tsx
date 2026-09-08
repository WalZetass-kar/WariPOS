import { useState, useEffect, useCallback, useMemo } from 'react'
import { TrendingUp, Search, DollarSign, Users, Target, Award, Calendar, Settings2, Receipt, CheckCircle, Clock, ChevronRight, FileSpreadsheet } from 'lucide-react'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { StatCardSkeleton, CommissionListSkeleton } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDateTime } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

interface CommissionData {
  username: string
  nama_lengkap: string
  total_transaksi: number
  total_penjualan: number
  komisi_persen: number
  total_komisi: number
  target_bulanan: number
  pencapaian: number
}

interface StaffSaleDetail {
  kd_penjualan: string
  tgl_wkt_transaksi: string
  nama_customer: string
  jenis_pembayaran: string
  sub_total: number
  discount_amount: number
  yang_dibayar: number
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function SalesCommission() {
  const toast = useToast()
  const currentDate = new Date()
  const [data, setData] = useState<CommissionData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  // Custom rate overrides per staff
  const [customRates, setCustomRates] = useState<Record<string, { komisi_persen: number; target_bulanan: number }>>(() => {
    try {
      const saved = localStorage.getItem('wari_commission_custom_rates')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Payout tracking per staff per month: key `${username}_${year}_${month}`
  const [payouts, setPayouts] = useState<Record<string, { paid: boolean; paidAt?: string }>>(() => {
    try {
      const saved = localStorage.getItem('wari_commission_payouts')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Transaction details modal
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailStaff, setDetailStaff] = useState<CommissionData | null>(null)
  const [staffSales, setStaffSales] = useState<StaffSaleDetail[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Rate edit modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<CommissionData | null>(null)
  const [editRate, setEditRate] = useState('2')
  const [editTarget, setEditTarget] = useState('10000000')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<CommissionData[]>('salesCommission:getAll', search, selectedMonth, selectedYear, customRates)
    if (r.success) setData(r.data ?? [])
    setLoading(false)
  }, [search, selectedMonth, selectedYear, customRates])

  useEffect(() => { load() }, [load])

  const totalKomisi = data.reduce((s, d) => s + d.total_komisi, 0)
  const totalPenjualan = data.reduce((s, d) => s + d.total_penjualan, 0)
  const avgPencapaian = data.length > 0 ? data.reduce((s, d) => s + d.pencapaian, 0) / data.length : 0

  const handleOpenDetail = async (staff: CommissionData) => {
    setDetailStaff(staff)
    setDetailModalOpen(true)
    setLoadingDetail(true)
    const r = await api<StaffSaleDetail[]>('salesCommission:getStaffDetail', staff.username, selectedMonth, selectedYear)
    if (r.success) {
      setStaffSales(r.data ?? [])
    } else {
      setStaffSales([])
    }
    setLoadingDetail(false)
  }

  const handleOpenEditRate = (staff: CommissionData) => {
    setEditingStaff(staff)
    setEditRate(String(staff.komisi_persen))
    setEditTarget(String(staff.target_bulanan))
    setEditModalOpen(true)
  }

  const handleSaveRate = () => {
    if (!editingStaff) return
    const rateVal = Math.max(0, Math.min(100, parseFloat(editRate) || 0))
    const targetVal = Math.max(0, parseFloat(editTarget) || 0)

    const next = {
      ...customRates,
      [editingStaff.username]: {
        komisi_persen: rateVal,
        target_bulanan: targetVal,
      }
    }
    setCustomRates(next)
    localStorage.setItem('wari_commission_custom_rates', JSON.stringify(next))
    toast(`Pengaturan komisi untuk @${editingStaff.username} berhasil disimpan`, 'success')
    setEditModalOpen(false)
    load()
  }

  const togglePayout = (username: string) => {
    const key = `${username}_${selectedYear}_${selectedMonth}`
    const isPaid = Boolean(payouts[key]?.paid)
    const next = {
      ...payouts,
      [key]: {
        paid: !isPaid,
        paidAt: !isPaid ? new Date().toISOString() : undefined,
      }
    }
    setPayouts(next)
    localStorage.setItem('wari_commission_payouts', JSON.stringify(next))
    toast(
      !isPaid
        ? `Komisi ${username} ditandai LUNAS`
        : `Status pembayaran ${username} dibatalkan`,
      'info'
    )
  }

  return (
    <div className="space-y-4 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-sm shadow-red-600/30">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Komisi Sales & Kasir</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tracking insentif, pencapaian target penjualan, dan status pencairan</p>
          </div>
        </div>

        {/* Month & Year Selectors */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white shadow-sm outline-none focus:border-red-600 cursor-pointer"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white shadow-sm outline-none focus:border-red-600 cursor-pointer"
          >
            {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-4 p-4 border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Omset Sales</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{formatRupiah(totalPenjualan)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <Award size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimasi Komisi</p>
            <p className="text-lg font-black text-red-600 dark:text-red-400">{formatRupiah(totalKomisi)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Target size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rata-rata Target</p>
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">{avgPencapaian.toFixed(0)}%</p>
          </div>
        </Card>
      </div>

      {/* Search Filter */}
      <Card className="p-3 border-slate-200 dark:border-slate-800">
        <Input
          placeholder="Cari nama staff / kasir..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          icon={<Search size={14} />}
        />
      </Card>

      {/* Staff Commission List */}
      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <CommissionListSkeleton count={4} />
        </>
      ) : data.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800">
          <div className="py-12 text-center text-slate-400">
            <Users size={40} className="mx-auto mb-2 opacity-25" />
            <p className="text-sm font-bold">Belum ada data transaksi penjualan pada periode ini.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.sort((a, b) => b.total_penjualan - a.total_penjualan).map((d, idx) => {
            const payoutKey = `${d.username}_${selectedYear}_${selectedMonth}`
            const isPaid = Boolean(payouts[payoutKey]?.paid)

            return (
              <Card key={d.username} className="border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Staff Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${
                      idx === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-sm' :
                      idx === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                      idx === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600' :
                      'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>{idx + 1}</div>
                    
                    <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-600 font-black shrink-0">
                      {d.nama_lengkap.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{d.nama_lengkap}</p>
                        {isPaid ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                            Lunas
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                            Belum Dicairkan
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">@{d.username} · Komisi {d.komisi_persen}%</p>
                    </div>
                  </div>

                  {/* Financial Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Transaksi</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">{d.total_transaksi}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Total Omset</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">{formatRupiah(d.total_penjualan)}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Komisi</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatRupiah(d.total_komisi)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl flex flex-col justify-center items-end">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Target</p>
                      <Badge label={`${d.pencapaian.toFixed(0)}%`} variant={d.pencapaian >= 100 ? 'green' : d.pencapaian >= 70 ? 'yellow' : 'red'} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(d)}
                      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Lihat Riwayat Transaksi"
                    >
                      <Receipt size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditRate(d)}
                      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Atur Target & % Komisi"
                    >
                      <Settings2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePayout(d.username)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                      }`}
                    >
                      {isPaid ? 'Batal Lunas' : 'Tandai Lunas'}
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal: Transaction Breakdown */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Rincian Transaksi: ${detailStaff?.nama_lengkap ?? ''}`}
      >
        <div className="space-y-3 p-1">
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-xs">
            <div>
              <span className="text-slate-400">Periode:</span>{' '}
              <span className="font-bold text-slate-800 dark:text-white">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
            </div>
            <div>
              <span className="text-slate-400">Total Transaksi:</span>{' '}
              <span className="font-bold text-red-600">{staffSales.length} Nota</span>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {loadingDetail ? (
              <div className="py-8 text-center text-xs text-slate-400">Memuat rincian nota...</div>
            ) : staffSales.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Tidak ada nota transaksi.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Nota / Tanggal</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Pelanggan</th>
                    <th className="px-3 py-2 text-right font-bold text-slate-600 dark:text-slate-300">Total Belanja</th>
                    <th className="px-3 py-2 text-right font-bold text-slate-600 dark:text-slate-300">Est. Komisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {staffSales.map(s => {
                    const komisiNota = Math.round((s.sub_total * (detailStaff?.komisi_persen ?? 2)) / 100)
                    return (
                      <tr key={s.kd_penjualan} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{s.kd_penjualan}</div>
                          <div className="text-[10px] text-slate-400">{formatDateTime(s.tgl_wkt_transaksi)}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{s.nama_customer}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                          {formatRupiah(s.sub_total)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-600">
                          {formatRupiah(komisiNota)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Edit Commission Rate & Target */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Atur Komisi: ${editingStaff?.nama_lengkap ?? ''}`}
      >
        <div className="space-y-3.5 p-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Persentase Komisi (%)</label>
            <Input
              type="number"
              value={editRate}
              onChange={e => setEditRate(e.target.value)}
              placeholder="Contoh: 2.5"
            />
            <p className="text-[11px] text-slate-400">Komisi dihitung dari omset penjualan staf bersangkutan.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Penjualan Bulanan (Rp)</label>
            <Input
              type="number"
              value={editTarget}
              onChange={e => setEditTarget(e.target.value)}
              placeholder="Contoh: 15000000"
            />
            <p className="text-[11px] text-slate-400">Dipakai untuk mengukur persentase target pencapaian bulanan.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveRate}>
              Simpan Pengaturan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

