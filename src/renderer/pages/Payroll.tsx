import { useEffect, useState } from 'react'
import { DollarSign, Search, Eye, CheckCircle, Users, TrendingUp, Printer, RefreshCw, X, FileText } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDate } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

interface PayrollRow {
  id: number
  employee_id: number
  periode_bulan: number
  periode_tahun: number
  nama_karyawan?: string
  nik?: string
  jabatan?: string
  departemen?: string
  gaji_pokok: number
  tunjangan: number
  uang_makan: number
  uang_transport: number
  lembur: number
  bonus: number
  potongan: number
  potongan_bpjs: number
  total_gaji: number
  status: 'DRAFT' | 'DISETUJUI' | 'DIBAYAR'
  tgl_dibayar?: string | null
  tgl_dibuat?: string
}

interface Summary {
  total_gaji: number
  total_karyawan: number
  rata_rata: number
}

interface SlipData {
  payroll: PayrollRow
  employee: any
  details: any[]
  total_penambah: number
  total_pengurang: number
}

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const statusVariant = (s: string): 'green' | 'blue' | 'gray' => {
  if (s === 'DIBAYAR') return 'green'
  if (s === 'DISETUJUI') return 'blue'
  return 'gray'
}

export default function Payroll() {
  const toast = useToast()
  const [data, setData] = useState<PayrollRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [bulan, setBulan] = useState(new Date().getMonth() + 1)
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [slipModal, setSlipModal] = useState<SlipData | null>(null)
  const [search, setSearch] = useState('')

  const load = async (isManual = false) => {
    try {
      const [r1, r2] = await Promise.all([
        api<PayrollRow[]>('payroll:getAll', bulan, tahun),
        api<any>('payroll:getSummary', bulan, tahun),
      ])
      if (r1.success) setData(Array.isArray(r1.data) ? r1.data : [])
      else setData([])

      if (r2.success && r2.data && typeof r2.data === 'object') {
        setSummary({
          total_gaji: Number(r2.data.total_gaji) || 0,
          total_karyawan: Number(r2.data.total_karyawan) || 0,
          rata_rata: Number(r2.data.rata_rata) || 0,
        })
      } else {
        setSummary({ total_gaji: 0, total_karyawan: 0, rata_rata: 0 })
      }
    } catch (err) {
      console.warn('[Payroll] Load error:', err)
      setData([])
      setSummary({ total_gaji: 0, total_karyawan: 0, rata_rata: 0 })
    } finally {
      setLoadingData(false)
      if (isManual) toast('Data payroll diperbarui', 'success')
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (!loadingData) load() }, [bulan, tahun])

  const handleGenerate = async () => {
    setLoading(true)
    const r = await api('payroll:create', {
      periode_bulan: bulan,
      periode_tahun: tahun,
      auto_generate: true,
    })
    setLoading(false)
    if (r.success) {
      toast(r.message as string, 'success')
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    setLoading(true)
    const r = await api('payroll:updateStatus', id, status)
    setLoading(false)
    if (r.success) {
      toast(r.message as string, 'success')
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const openSlip = async (p: PayrollRow) => {
    if (!p) return
    const r = await api<SlipData>('payroll:getSlip', p.id)
    if (r.success && r.data && r.data.payroll) {
      setSlipModal(r.data)
    } else {
      // Construct fallback slip safely
      setSlipModal({
        payroll: p,
        employee: {
          nama_lengkap: p.nama_karyawan || 'Karyawan',
          nik: p.nik || '-',
          jabatan: p.jabatan || '-',
          departemen: p.departemen || '-',
        },
        details: [],
        total_penambah: (p.gaji_pokok || 0) + (p.tunjangan || 0) + (p.uang_makan || 0) + (p.uang_transport || 0) + (p.lembur || 0) + (p.bonus || 0),
        total_pengurang: (p.potongan || 0) + (p.potongan_bpjs || 0),
      })
    }
  }

  const filtered = data.filter(p =>
    (p.nama_karyawan ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.nik ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.jabatan ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {loadingData ? (
        <>
          <SkeletonStatGrid count={3} />
          <SkeletonSpinner label="Memuat data penggajian karyawan..." />
        </>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card title="Total Pengeluaran Gaji" action={<DollarSign size={18} className="text-red-500" />}>
              <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{formatRupiah(summary?.total_gaji ?? 0)}</p>
              <p className="text-xs text-slate-400 mt-1">Periode: {months[bulan - 1]} {tahun}</p>
            </Card>
            <Card title="Total Karyawan Terdaftar" action={<Users size={18} className="text-emerald-500" />}>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{summary?.total_karyawan ?? data.length} Orang</p>
              <p className="text-xs text-slate-400 mt-1">Karyawan aktif dalam payroll</p>
            </Card>
            <Card title="Rata-rata Gaji" action={<TrendingUp size={18} className="text-blue-500" />}>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{formatRupiah(summary?.rata_rata ?? 0)}</p>
              <p className="text-xs text-slate-400 mt-1">Rata-rata take home pay</p>
            </Card>
          </div>

          <Card title="Manajemen Gaji & Slip Payroll">
            {/* Filters and Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={bulan}
                  onChange={e => setBulan(parseInt(e.target.value))}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <input
                  type="number"
                  value={tahun}
                  onChange={e => setTahun(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <Input
                  placeholder="Cari nama karyawan / NIK..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="max-w-xs text-xs"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => load(true)}>
                  Refresh
                </Button>
                <Button icon={<DollarSign size={16} />} loading={loading} onClick={handleGenerate} className="bg-red-600 hover:bg-red-700 text-white border-0 font-bold">
                  Generate Gaji Otomatis
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[850px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Karyawan</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Jabatan</th>
                      <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Gaji Pokok</th>
                      <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Tunjangan</th>
                      <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Potongan BPJS</th>
                      <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Diterima</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 sm:px-4 py-12 text-center text-slate-400 text-sm">
                          Belum ada data payroll untuk periode {months[bulan - 1]} {tahun}.<br />
                          Klik tombol <strong>&quot;Generate Gaji Otomatis&quot;</strong> di atas untuk membuat slip gaji semua karyawan.
                        </td>
                      </tr>
                    ) : (
                      filtered.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-3 sm:px-4 py-3">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{p.nama_karyawan || 'Karyawan'}</p>
                            <p className="text-xs text-slate-400">{p.nik || '-'}</p>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{p.jabatan || '-'}</td>
                          <td className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-slate-700 dark:text-slate-300">{formatRupiah(p.gaji_pokok || 0)}</td>
                          <td className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-slate-700 dark:text-slate-300">{formatRupiah((p.tunjangan || 0) + (p.uang_makan || 0) + (p.uang_transport || 0))}</td>
                          <td className="px-3 sm:px-4 py-3 text-right text-xs text-red-600 font-medium">{formatRupiah((p.potongan_bpjs || 0) + (p.potongan || 0))}</td>
                          <td className="px-3 sm:px-4 py-3 text-right font-black text-slate-900 dark:text-white">{formatRupiah(p.total_gaji || 0)}</td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <Badge label={p.status || 'DRAFT'} variant={statusVariant(p.status || 'DRAFT')} />
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openSlip(p)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 text-xs font-bold"
                                title="Lihat & Cetak Slip Gaji"
                              >
                                <FileText size={15} className="text-blue-600" />
                                <span>Slip</span>
                              </button>
                              {p.status === 'DRAFT' && (
                                <button
                                  onClick={() => handleUpdateStatus(p.id, 'DISETUJUI')}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors"
                                  title="Setujui Payroll"
                                >
                                  <CheckCircle size={15} />
                                </button>
                              )}
                              {p.status === 'DISETUJUI' && (
                                <button
                                  onClick={() => handleUpdateStatus(p.id, 'DIBAYAR')}
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors"
                                  title="Tandai Sudah Dibayar"
                                >
                                  <DollarSign size={15} />
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
            </div>
          </Card>

          {/* Slip Gaji Modal */}
          <Modal
            open={!!slipModal}
            onClose={() => setSlipModal(null)}
            title="Slip Gaji Karyawan"
            size="md"
            footer={
              <div className="flex gap-2 w-full">
                <Button variant="secondary" onClick={() => setSlipModal(null)} className="flex-1">Tutup</Button>
                <Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()} className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0 font-bold">Cetak Slip Gaji</Button>
              </div>
            }
          >
            {slipModal && slipModal.payroll && (
              <div className="space-y-4 p-2 bg-white dark:bg-slate-900 rounded-xl text-slate-800 dark:text-slate-100">
                {/* Header Struk Slip */}
                <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
                  <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">SLIP GAJI KARYAWAN</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Periode: {months[(slipModal.payroll.periode_bulan || bulan) - 1]} {slipModal.payroll.periode_tahun || tahun}</p>
                </div>

                {/* Employee details */}
                <div className="grid grid-cols-2 gap-2 text-xs py-1">
                  <div>
                    <span className="text-slate-400">Nama:</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{slipModal.employee?.nama_lengkap || slipModal.payroll.nama_karyawan || 'Karyawan'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">NIK:</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{slipModal.employee?.nik || slipModal.payroll.nik || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Jabatan:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{slipModal.employee?.jabatan || slipModal.payroll.jabatan || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Status Pembayaran:</span>
                    <Badge label={slipModal.payroll.status || 'DRAFT'} variant={statusVariant(slipModal.payroll.status || 'DRAFT')} />
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2 text-xs border-t border-slate-200 dark:border-slate-800 pt-3">
                  <p className="font-bold text-slate-500 uppercase text-[10px]">Komponen Penghasilan</p>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Gaji Pokok</span>
                    <span className="font-bold">{formatRupiah(slipModal.payroll.gaji_pokok || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Tunjangan & Operasional</span>
                    <span className="font-bold">{formatRupiah((slipModal.payroll.tunjangan || 0) + (slipModal.payroll.uang_makan || 0) + (slipModal.payroll.uang_transport || 0))}</span>
                  </div>
                  {(slipModal.payroll.lembur || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>Uang Lembur</span>
                      <span className="font-bold">{formatRupiah(slipModal.payroll.lembur || 0)}</span>
                    </div>
                  )}
                  {(slipModal.payroll.bonus || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>Bonus Prestasi</span>
                      <span className="font-bold">{formatRupiah(slipModal.payroll.bonus || 0)}</span>
                    </div>
                  )}

                  <p className="font-bold text-slate-500 uppercase text-[10px] pt-2">Komponen Potongan</p>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-red-600">
                    <span>BPJS & Potongan</span>
                    <span className="font-bold">-{formatRupiah((slipModal.payroll.potongan_bpjs || 0) + (slipModal.payroll.potongan || 0))}</span>
                  </div>
                </div>

                {/* Total Net Pay */}
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold uppercase">Gaji Bersih (Take Home Pay)</span>
                    <p className="text-[10px] text-slate-400">Total ditransfer ke rekening karyawan</p>
                  </div>
                  <span className="text-lg font-black text-emerald-800 dark:text-emerald-200">{formatRupiah(slipModal.payroll.total_gaji || 0)}</span>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  )
}

