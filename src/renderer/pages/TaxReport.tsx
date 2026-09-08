import { useState, useEffect, useCallback } from 'react'
import { FileText, Calendar, FileSpreadsheet, TrendingUp, TrendingDown } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import { StatCardSkeleton, FilterBarSkeleton, TaxTableSkeleton } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

interface TaxSummary {
  bulan: string
  total_transaksi: number
  total_penjualan: number
  total_pajak: number
  total_return: number
  pajak_bersih: number
}

const today = new Date().toISOString().split('T')[0]
const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]

export default function TaxReport() {
  const toast = useToast()
  const [data, setData] = useState<TaxSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ start: yearStart, end: today })
  const [exportLoading, setExportLoading] = useState(false)
  const [pajakPersen, setPajakPersen] = useState(11)

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      api<TaxSummary[]>('taxReport:getSummary', dateRange.start, dateRange.end),
      api<any>('identitas:get'),
    ])
    if (r1.success) setData(r1.data ?? [])
    if (r2.success && r2.data?.pajak_persen) setPajakPersen(r2.data.pajak_persen)
    setLoading(false)
  }, [dateRange])

  useEffect(() => { load() }, [load])

  const handleExport = async () => {
    setExportLoading(true)
    const r = await api('export:taxReportExcel', data, dateRange.start, dateRange.end)
    setExportLoading(false)
    if (r.success) toast(r.message || 'Laporan pajak berhasil di-export', 'success')
    else toast(r.message as string ?? 'Export gagal', 'error')
  }

  const totalPenjualan = data.reduce((s, d) => s + d.total_penjualan, 0)
  const totalPajak = data.reduce((s, d) => s + d.total_pajak, 0)
  const totalReturn = data.reduce((s, d) => s + d.total_return, 0)
  const pajakBersih = totalPajak - (totalReturn * pajakPersen / (100 + pajakPersen))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white">
          <FileText size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Laporan Pajak</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Rekap PPN untuk pelaporan pajak ({pajakPersen}%)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Penjualan</p>
          <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">{formatRupiah(totalPenjualan)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">PPN Dipungut</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatRupiah(totalPajak)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">PPN Return</p>
          <p className="text-lg font-bold text-red-600 mt-1">{formatRupiah(totalReturn * pajakPersen / (100 + pajakPersen))}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">PPN Bersih</p>
          <p className="text-lg font-bold text-primary-600 mt-1">{formatRupiah(pajakBersih)}</p>
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

      <Card>
        {loading ? (
          <TaxTableSkeleton rows={6} />
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <FileText size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Belum ada data pajak pada periode ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                <tr>
                  {['Bulan', 'Total Transaksi', 'Total Penjualan', 'PPN Dipungut', 'Return', 'PPN Bersih'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.map((row, i) => (
                  <tr key={row.bulan} className={`hover:bg-primary-50/50 dark:hover:bg-slate-700/30 ${i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{row.bulan}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.total_transaksi.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(row.total_penjualan)}</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-bold">{formatRupiah(row.total_pajak)}</td>
                    <td className="px-4 py-2.5 text-red-600">{formatRupiah(row.total_return)}</td>
                    <td className="px-4 py-2.5 font-bold text-primary-600">{formatRupiah(row.pajak_bersih)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold">
                <tr>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">Total</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{data.reduce((s, d) => s + d.total_transaksi, 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatRupiah(totalPenjualan)}</td>
                  <td className="px-4 py-3 text-emerald-600">{formatRupiah(totalPajak)}</td>
                  <td className="px-4 py-3 text-red-600">{formatRupiah(totalReturn)}</td>
                  <td className="px-4 py-3 text-primary-600">{formatRupiah(pajakBersih)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
