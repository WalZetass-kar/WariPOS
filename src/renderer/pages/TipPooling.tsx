import { useEffect, useState } from 'react'
import { Plus, Search, DollarSign, Users, History, HandCoins } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDate } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

interface TipPool {
  id_tip: number
  tgl: string
  total_tip: number
  jumlah_karyawan: number
  tip_per_orang: number
  status: 'DRAFT' | 'DIDISTRIBUSIKAN'
  created_at: string
  updated_at: string
}

interface Distribution {
  id_distribusi: number
  id_tip: number
  id_karyawan: number
  karyawan_nama?: string
  jumlah: number
  created_at: string
}

interface Employee {
  id_karyawan: number
  nik: string
  nama_lengkap: string
  status_karyawan: string
}

export default function TipPooling() {
  const toast = useToast()
  const { user } = useAuth()
  const [data, setData] = useState<TipPool[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [modal, setModal] = useState<'add' | 'distribute' | 'history' | null>(null)
  const [form, setForm] = useState({ tgl: new Date().toISOString().split('T')[0], total_tip: '' })
  const [distributeTarget, setDistributeTarget] = useState<TipPool | null>(null)
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [historyTarget, setHistoryTarget] = useState<TipPool | null>(null)

  const load = async () => {
    const [r1, r2] = await Promise.all([
      api<TipPool[]>('tip:getAll'),
      api<Employee[]>('employee:getAll'),
    ])
    if (r1.success) setData(r1.data ?? [])
    if (r2.success) setEmployees(r2.data ?? [])
    setLoadingData(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    const total = Number(form.total_tip) || 0
    if (!form.tgl || total <= 0) return toast('Tanggal dan total tip (minimal Rp 1) wajib diisi', 'error')
    setLoading(true)
    const r = await api('tip:create', form.tgl, total)
    setLoading(false)
    if (r.success) {
      toast(r.message as string)
      setModal(null)
      setForm({ tgl: new Date().toISOString().split('T')[0], total_tip: '' })
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const openDistribute = async (t: TipPool) => {
    setDistributeTarget(t)
    setModal('distribute')
  }

  const handleDistribute = async () => {
    if (!distributeTarget) return
    setLoading(true)
    const r = await api('tip:distribute', distributeTarget.id_tip)
    setLoading(false)
    if (r.success) {
      toast(r.message as string)
      setModal(null)
      setDistributeTarget(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const openHistory = async (t: TipPool) => {
    setHistoryTarget(t)
    const r = await api<Distribution[]>('tip:getDistributions', t.id_tip)
    if (r.success) setDistributions(r.data ?? [])
    else setDistributions([])
    setModal('history')
  }

  return (
    <div className="space-y-4">
      {loadingData ? (
        <SkeletonSpinner label="Memuat data tip pooling..." />
      ) : (
        <>
          <Card>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1" />
              <Button
                icon={<Plus size={16} />}
                onClick={() => {
                  setForm({ tgl: new Date().toISOString().split('T')[0], total_tip: '' })
                  setModal('add')
                }}
              >
                Buat Tip Pooling
              </Button>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[600px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                      <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Tip</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Jml Karyawan</th>
                      <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Tip/Orang</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 sm:px-4 py-10 text-center text-slate-400 text-sm">
                          Belum ada data tip pooling
                        </td>
                      </tr>
                    ) : (
                      data.map(t => (
                        <tr key={t.id_tip} className="hover:bg-primary-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-3 sm:px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(t.tgl)}</td>
                          <td className="px-3 sm:px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">{formatRupiah(t.total_tip)}</td>
                          <td className="px-3 sm:px-4 py-3 text-center text-slate-600 dark:text-slate-400">{t.jumlah_karyawan}</td>
                          <td className="px-3 sm:px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(t.tip_per_orang)}</td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <Badge label={t.status} variant={t.status === 'DIDISTRIBUSIKAN' ? 'green' : 'gray'} />
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openHistory(t)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500 transition-colors" title="Riwayat Distribusi">
                                <History size={14} />
                              </button>
                              {t.status === 'DRAFT' && (
                                <button onClick={() => openDistribute(t)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500 transition-colors" title="Distribusikan">
                                  <HandCoins size={14} />
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

          <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Buat Tip Pooling" size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModal(null)}>Batal</Button>
                <Button loading={loading} onClick={handleCreate}>Simpan</Button>
              </>
            }>
            <div className="space-y-3">
              <Input label="Tanggal *" type="date" value={form.tgl} onChange={e => setForm(p => ({ ...p, tgl: e.target.value }))} />
              <div>
                <Input
                  label="Total Tip (Rp) *"
                  type="text"
                  inputMode="numeric"
                  value={form.total_tip}
                  onChange={e => setForm(p => ({ ...p, total_tip: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="0"
                />
                {Boolean(form.total_tip && Number(form.total_tip) > 0) && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 ml-0.5">
                    Nominal: {formatRupiah(Number(form.total_tip))}
                  </p>
                )}
              </div>
            </div>
          </Modal>

          <Modal open={modal === 'distribute' && !!distributeTarget} onClose={() => { setModal(null); setDistributeTarget(null) }} title="Distribusi Tip" size="md"
            footer={
              <>
                <Button variant="secondary" onClick={() => { setModal(null); setDistributeTarget(null) }}>Batal</Button>
                <Button variant="success" loading={loading} onClick={handleDistribute}>Konfirmasi Distribusi</Button>
              </>
            }>
            {distributeTarget && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500">Tanggal</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(distributeTarget.tgl)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500">Total Tip</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(distributeTarget.total_tip)}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Tip per Orang</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatRupiah(distributeTarget.tip_per_orang)}</p>
                  <p className="text-xs text-emerald-500 mt-1">Dibagi ke {distributeTarget.jumlah_karyawan} karyawan aktif</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Tip akan didistribusikan secara merata ke seluruh karyawan aktif.
                </p>
              </div>
            )}
          </Modal>

          <Modal open={modal === 'history' && !!historyTarget} onClose={() => { setModal(null); setHistoryTarget(null); setDistributions([]) }} title="Riwayat Distribusi Tip" size="md"
            footer={<Button variant="secondary" onClick={() => { setModal(null); setHistoryTarget(null); setDistributions([]) }}>Tutup</Button>}>
            {historyTarget && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500">Tanggal</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(historyTarget.tgl)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500">Total Tip</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(historyTarget.total_tip)}</p>
                  </div>
                </div>
                {distributions.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Belum ada distribusi</p>
                ) : (
                  <div className="space-y-2">
                    {distributions.map(d => (
                      <div key={d.id_distribusi} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{d.karyawan_nama || '-'}</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(d.jumlah)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  )
}
