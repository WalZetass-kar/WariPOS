import { useState, useEffect, useCallback } from 'react'
import { ArrowUpDown, TrendingUp, TrendingDown, Search, Calendar, FileSpreadsheet } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import { StatCardSkeleton, FilterBarSkeleton, CashFlowSkeleton } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

interface CashFlowItem {
  tanggal: string
  keterangan: string
  kategori: string
  jenis: 'masuk' | 'keluar'
  jumlah: number
  sumber: string
}

const today = new Date().toISOString().split('T')[0]
const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

export default function CashFlow() {
  const toast = useToast()
  const [items, setItems] = useState<CashFlowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ start: firstDay, end: today })
  const [exportLoading, setExportLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<CashFlowItem[]>('cashFlow:getAll', dateRange.start, dateRange.end)
    if (r.success) setItems(r.data ?? [])
    setLoading(false)
  }, [dateRange])

  useEffect(() => { load() }, [load])

  const totalMasuk = items.filter(i => i.jenis === 'masuk').reduce((s, i) => s + i.jumlah, 0)
  const totalKeluar = items.filter(i => i.jenis === 'keluar').reduce((s, i) => s + i.jumlah, 0)
  const net = totalMasuk - totalKeluar

  const handleExport = async () => {
    setExportLoading(true)
    const r = await api('export:cashFlowExcel', items, dateRange.start, dateRange.end)
    setExportLoading(false)
    if (r.success) toast(r.message || 'Cash flow berhasil di-export', 'success')
    else toast(r.message as string ?? 'Export gagal', 'error')
  }

  const groupedByDate = items.reduce<Record<string, CashFlowItem[]>>((acc, item) => {
    const key = item.tanggal.slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white">
          <ArrowUpDown size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Arus Kas</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cashflow statement — uang masuk vs keluar per periode</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Kas Masuk</p>
            <p className="text-lg font-bold text-emerald-600">{formatRupiah(totalMasuk)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shrink-0">
            <TrendingDown size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Kas Keluar</p>
            <p className="text-lg font-bold text-red-600">{formatRupiah(totalKeluar)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl ${net >= 0 ? 'bg-primary-500' : 'bg-amber-500'} flex items-center justify-center text-white shrink-0`}>
            <ArrowUpDown size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Arus Kas Bersih</p>
            <p className={`text-lg font-bold ${net >= 0 ? 'text-primary-600' : 'text-amber-600'}`}>{formatRupiah(net)}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <Input label="Dari" type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="w-40" />
          <Input label="Sampai" type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="w-40" />
          <div className="flex-1" />
          <Button variant="secondary" icon={<FileSpreadsheet size={14} />} onClick={handleExport} loading={exportLoading}>Export Excel</Button>
        </div>
      </Card>

      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <FilterBarSkeleton />
          <CashFlowSkeleton days={3} />
        </>
      ) : items.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-slate-400">
            <ArrowUpDown size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Belum ada data arus kas pada periode ini</p>
          </div>
        </Card>
      ) : (
        Object.entries(groupedByDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayItems]) => {
          const dayMasuk = dayItems.filter(i => i.jenis === 'masuk').reduce((s, i) => s + i.jumlah, 0)
          const dayKeluar = dayItems.filter(i => i.jenis === 'keluar').reduce((s, i) => s + i.jumlah, 0)
          return (
            <Card key={date}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400" />
                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                    {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-600 font-semibold">+{formatRupiah(dayMasuk)}</span>
                  <span className="text-red-600 font-semibold">-{formatRupiah(dayKeluar)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {dayItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge label={item.kategori} variant={item.jenis === 'masuk' ? 'green' : 'red'} />
                      <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{item.keterangan}</span>
                      <span className="text-[10px] text-slate-400">{item.sumber}</span>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${item.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {item.jenis === 'masuk' ? '+' : '-'}{formatRupiah(item.jumlah)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
