import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Lock, Unlock, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDateTime } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import EmptyState from '../components/EmptyState'

interface KasDrawer {
  kd_kas: string
  username: string
  modal_awal: number
  total_penjualan: number
  total_pengeluaran: number
  total_pemasukan: number
  saldo_akhir: number
  selisih: number
  status: 'OPEN' | 'CLOSED'
  tgl_buka: string
  tgl_tutup: string | null
  catatan?: string | null
}

interface KasTransaksi {
  kd_kas_transaksi: number
  kd_kas: string
  jenis: 'MASUK' | 'KELUAR'
  jumlah: number
  keterangan: string
  tgl_transaksi: string
  username: string
}

export default function Kas() {
  const toast = useToast()
  const { user } = useAuth()
  const [activeDrawer, setActiveDrawer] = useState<KasDrawer | null>(null)
  const [history, setHistory] = useState<KasDrawer[]>([])
  const [transactions, setTransactions] = useState<KasTransaksi[]>([])
  const [modal, setModal] = useState<'open' | 'close' | 'expense' | 'income' | null>(null)
  const [modalAwal, setModalAwal] = useState('')
  const [modalAkhir, setModalAkhir] = useState('')
  const [expense, setExpense] = useState({ jumlah: '', keterangan: '' })
  const [income, setIncome] = useState({ jumlah: '', keterangan: '' })
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [deleteKas, setDeleteKas] = useState<KasDrawer | null>(null)
  const [deleteTransaksi, setDeleteTransaksi] = useState<KasTransaksi | null>(null)

  const load = async () => {
    try {
      const [r1, r2] = await Promise.all([
        api<KasDrawer>('kas:getActiveKas', user?.nama_pengguna),
        api<KasDrawer[]>('kas:getAllKas'),
      ])
      if (r1.success && r1.data) {
        setActiveDrawer(r1.data)
        loadTransactions(r1.data.kd_kas)
      } else {
        setActiveDrawer(null)
      }
      if (r2.success) setHistory(r2.data ?? [])
    } finally {
      setLoadingData(false)
    }
  }

  const loadTransactions = async (kd_kas: string) => {
    const r = await api<KasTransaksi[]>('kas:getTransaksi', kd_kas)
    if (r.success) setTransactions(r.data ?? [])
  }

  useEffect(() => { load() }, [])

  const handleOpenKas = async () => {
    if (!modalAwal || parseFloat(modalAwal) <= 0) {
      return toast('Modal awal harus lebih dari 0', 'error')
    }
    setLoading(true)
    try {
      const r = await api('kas:bukaKas', user?.nama_pengguna, parseFloat(modalAwal))
      if (r.success) {
        toast(r.message as string)
        setModal(null)
        setModalAwal('')
        load()
        window.dispatchEvent(new CustomEvent('app:refresh'))
      } else {
        toast(r.message as string, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCloseKas = async () => {
    if (!modalAkhir) {
      return toast('Modal akhir wajib diisi', 'error')
    }
    setLoading(true)
    try {
      const r = await api('kas:tutupKas', activeDrawer?.kd_kas, parseFloat(modalAkhir))
      if (r.success) {
        toast(r.message as string)
        setModal(null)
        setModalAkhir('')
        load()
        window.dispatchEvent(new CustomEvent('app:refresh'))
      } else {
        toast(r.message as string, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async () => {
    if (!expense.jumlah || !expense.keterangan) {
      return toast('Jumlah dan keterangan wajib diisi', 'error')
    }
    const amount = parseFloat(expense.jumlah)
    if (isNaN(amount) || amount <= 0) {
      return toast('Jumlah harus berupa angka positif', 'error')
    }
    setLoading(true)
    try {
      const r = await api('kas:addPengeluaran', activeDrawer?.kd_kas, parseFloat(expense.jumlah), expense.keterangan, user?.nama_pengguna)
      if (r.success) {
        toast(r.message as string)
        setModal(null)
        setExpense({ jumlah: '', keterangan: '' })
        load()
        window.dispatchEvent(new CustomEvent('app:refresh'))
      } else {
        toast(r.message as string, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddIncome = async () => {
    if (!income.jumlah || !income.keterangan) {
      return toast('Jumlah dan keterangan wajib diisi', 'error')
    }
    const amount = parseFloat(income.jumlah)
    if (isNaN(amount) || amount <= 0) {
      return toast('Jumlah harus berupa angka positif', 'error')
    }
    setLoading(true)
    try {
      const r = await api('kas:addPemasukan', activeDrawer?.kd_kas, parseFloat(income.jumlah), income.keterangan, user?.nama_pengguna)
      if (r.success) {
        toast(r.message as string)
        setModal(null)
        setIncome({ jumlah: '', keterangan: '' })
        load()
        window.dispatchEvent(new CustomEvent('app:refresh'))
      } else {
        toast(r.message as string, 'error')
      }
    } finally {
      setLoading(false)
    }
  }
  
  const handleDeleteKas = async () => {
    if (!deleteKas) return
    setLoading(true)
    const r = await api('kas:deleteKas', deleteKas.kd_kas)
    setLoading(false)
    if (r.success) {
      toast(r.message as string)
      setDeleteKas(null)
      load()
      window.dispatchEvent(new CustomEvent('app:refresh'))
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDeleteTransaksi = async () => {
    if (!deleteTransaksi) return
    setLoading(true)
    const r = await api('kas:deleteTransaksi', deleteTransaksi.kd_kas_transaksi)
    setLoading(false)
    if (r.success) {
      toast('Transaksi dihapus')
      setDeleteTransaksi(null)
      load()
      window.dispatchEvent(new CustomEvent('app:refresh'))
    } else {
      toast(r.message as string, 'error')
    }
  }

  const expectedCash = activeDrawer
    ? activeDrawer.modal_awal + activeDrawer.total_penjualan + (activeDrawer.total_pemasukan || 0) - activeDrawer.total_pengeluaran
    : 0

  return (
    <div className="space-y-4">
      {loadingData ? (
        <>
          <SkeletonStatGrid count={5} />
          <SkeletonSpinner label="Memuat data kas..." />
        </>
      ) : (
        <>
          {/* Active Drawer Status */}
      {activeDrawer ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card title="Modal Awal" action={<DollarSign size={16} className="text-pink-500" />}>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{formatRupiah(activeDrawer.modal_awal)}</p>
            <p className="text-xs text-slate-400 mt-1">{formatDateTime(activeDrawer.tgl_buka)}</p>
          </Card>
          <Card title="Total Penjualan" action={<TrendingUp size={16} className="text-emerald-500" />}>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{formatRupiah(activeDrawer.total_penjualan)}</p>
            <p className="text-xs text-slate-400 mt-1">Dari transaksi hari ini</p>
          </Card>
          <Card title="Pemasukan Lain" action={<TrendingUp size={16} className="text-teal-500" />}>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-2">{formatRupiah(activeDrawer.total_pemasukan || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">Pemasukan manual</p>
          </Card>
          <Card title="Total Pengeluaran" action={<TrendingDown size={16} className="text-red-500" />}>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">{formatRupiah(activeDrawer.total_pengeluaran)}</p>
            <p className="text-xs text-slate-400 mt-1">Pengeluaran operasional</p>
          </Card>
          <Card title="Kas Seharusnya" action={<DollarSign size={16} className="text-primary-500" />}>
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-2">{formatRupiah(expectedCash)}</p>
            <p className="text-xs text-slate-400 mt-1">Modal + Masuk - Keluar</p>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="text-center py-10">
            <Lock size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-300 font-medium mb-2">Kas Belum Dibuka</p>
            <p className="text-sm text-slate-400 mb-4">Buka kas untuk memulai transaksi hari ini</p>
            <Button icon={<Unlock size={16} />} onClick={() => setModal('open')}>Buka Kas</Button>
          </div>
        </Card>
      )}

      {/* Actions */}
      {activeDrawer && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" icon={<TrendingUp size={16} />} onClick={() => setModal('income')} className="w-full sm:w-auto bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800">
            Tambah Pemasukan
          </Button>
          <Button variant="secondary" icon={<TrendingDown size={16} />} onClick={() => setModal('expense')} className="w-full sm:w-auto">
            Tambah Pengeluaran
          </Button>
          <Button variant="danger" icon={<Lock size={16} />} onClick={() => setModal('close')} className="w-full sm:w-auto">
            Tutup Kas
          </Button>
        </div>
      )}

      {/* Transactions Today */}
      {activeDrawer && (
        <Card title="Transaksi Hari Ini">
          {transactions.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={36} strokeWidth={1.5} />}
              title="Belum ada transaksi"
              description="Transaksi kas hari ini akan muncul di sini"
            />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {transactions.map(t => (
                <div key={t.kd_kas_transaksi} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-700/50 group">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.keterangan}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(t.tgl_transaksi)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${t.jenis === 'MASUK' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.jenis === 'MASUK' ? '+' : '-'} {formatRupiah(t.jumlah)}
                      </p>
                      <Badge label={t.jenis} variant={t.jenis === 'MASUK' ? 'green' : 'red'} />
                    </div>
                    <button
                      onClick={() => setDeleteTransaksi(t)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* History */}
      <Card title="Riwayat Kas">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[640px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Kasir</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Waktu Buka</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Waktu Tutup</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Modal Awal</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Modal Akhir</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Selisih</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-4 py-10 text-center text-slate-400 text-sm">
                      Belum ada riwayat kas
                    </td>
                  </tr>
                ) : (
                  history.map(h => (
                    <tr key={h.kd_kas} className="hover:bg-primary-50/50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 sm:px-4 py-3 text-slate-700 dark:text-slate-300">{h.username}</td>
                      <td className="px-3 sm:px-4 py-3 text-slate-700 dark:text-slate-300">{formatDateTime(h.tgl_buka)}</td>
                      <td className="px-3 sm:px-4 py-3 text-slate-700 dark:text-slate-300">{h.tgl_tutup ? formatDateTime(h.tgl_tutup) : '-'}</td>
                      <td className="px-3 sm:px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatRupiah(h.modal_awal)}</td>
                      <td className="px-3 sm:px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatRupiah(h.saldo_akhir)}</td>
                      <td className={`px-3 sm:px-4 py-3 text-right font-semibold ${h.selisih >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatRupiah(h.selisih)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <Badge label={h.status} variant={h.status === 'OPEN' ? 'green' : 'blue'} />
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        {h.status === 'CLOSED' && (
                          <button 
                            onClick={() => setDeleteKas(h)} 
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Open Kas Modal */}
      <Modal
        open={modal === 'open'}
        onClose={() => setModal(null)}
        title="Buka Kas"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleOpenKas} className="w-full sm:w-auto">Buka Kas</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Masukkan modal awal untuk membuka kas hari ini
        </p>
        <Input
          label="Modal Awal *"
          type="number"
          value={modalAwal}
          onChange={e => setModalAwal(e.target.value)}
          placeholder="0"
        />
      </Modal>

      {/* Close Kas Modal */}
      <Modal
        open={modal === 'close'}
        onClose={() => setModal(null)}
        title="Tutup Kas"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button variant="danger" loading={loading} onClick={handleCloseKas} className="w-full sm:w-auto">Tutup Kas</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Kas Seharusnya</p>
            <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{formatRupiah(expectedCash)}</p>
          </div>
          <Input
            label="Modal Akhir (Uang di Kas) *"
            type="number"
            value={modalAkhir}
            onChange={e => setModalAkhir(e.target.value)}
            placeholder="0"
          />
          {modalAkhir && (
            <div className={`p-3 rounded-xl ${parseFloat(modalAkhir) === expectedCash ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <p className="text-xs text-slate-500 dark:text-slate-400">Selisih</p>
              <p className={`text-lg font-bold ${parseFloat(modalAkhir) === expectedCash ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatRupiah(parseFloat(modalAkhir) - expectedCash)}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Add Expense Modal */}
      <Modal
        open={modal === 'expense'}
        onClose={() => setModal(null)}
        title="Tambah Pengeluaran"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleAddExpense} className="w-full sm:w-auto">Simpan</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Jumlah *"
            type="number"
            value={expense.jumlah}
            onChange={e => setExpense(prev => ({ ...prev, jumlah: e.target.value }))}
            placeholder="0"
          />
          <Input
            label="Keterangan *"
            value={expense.keterangan}
            onChange={e => setExpense(prev => ({ ...prev, keterangan: e.target.value }))}
            placeholder="Contoh: Beli pulsa, bayar listrik..."
          />
        </div>
      </Modal>

      {/* Add Income Modal */}
      <Modal
        open={modal === 'income'}
        onClose={() => setModal(null)}
        title="Tambah Pemasukan"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleAddIncome} className="w-full sm:w-auto">Simpan</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Jumlah *"
            type="number"
            value={income.jumlah}
            onChange={e => setIncome(prev => ({ ...prev, jumlah: e.target.value }))}
            placeholder="0"
          />
          <Input
            label="Keterangan *"
            value={income.keterangan}
            onChange={e => setIncome(prev => ({ ...prev, keterangan: e.target.value }))}
            placeholder="Contoh: Modal tambahan, pinjaman..."
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTransaksi}
        onClose={() => setDeleteTransaksi(null)}
        onConfirm={handleDeleteTransaksi}
        title="Hapus Transaksi Kas"
        message={`Transaksi "${deleteTransaksi?.keterangan ?? ''}" akan dihapus dari kas hari ini.`}
        confirmText="Hapus"
        variant="danger"
        loading={loading}
      >
        {deleteTransaksi && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Jenis</span><span className="font-semibold text-slate-800 dark:text-slate-100">{deleteTransaksi.jenis}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Jumlah</span><span className="font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(deleteTransaksi.jumlah)}</span></div>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteKas}
        onClose={() => setDeleteKas(null)}
        onConfirm={handleDeleteKas}
        title="Hapus Riwayat Kas"
        message="Riwayat kas ini akan dihapus dari laporan."
        confirmText="Hapus"
        variant="danger"
        loading={loading}
      >
        {deleteKas && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex justify-between">
              <span className="text-slate-500">Kasir:</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{deleteKas.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Waktu Buka:</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{formatDateTime(deleteKas.tgl_buka)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Modal Awal:</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{formatRupiah(deleteKas.modal_awal)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
        </>
      )}
    </div>
  )
}
