import { useEffect, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Gift, ToggleLeft, ToggleRight, Minus, History, Users, UserCheck, Award, Phone, Mail, MapPin } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Input from '../components/Input'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { SkeletonPage } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDate } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import type { Customer, Penjualan } from '../../shared/types'

interface FormState {
  nama_customer: string
  no_telp: string
  email: string
  alamat: string
  tgl_lahir: string
}

const EMPTY: FormState = { nama_customer: '', no_telp: '', email: '', alamat: '', tgl_lahir: '' }

export default function CustomerPage() {
  const toast = useToast()
  const [data, setData] = useState<Customer[]>([])
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | 'poin' | 'riwayat' | null>(null)
  const [form, setForm] = useState<FormState>({ ...EMPTY })
  const [selected, setSelected] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [poinInput, setPoinInput] = useState('')
  const [poinMode, setPoinMode] = useState<'add' | 'sub'>('add')
  const [riwayat, setRiwayat] = useState<Penjualan[]>([])

  const load = async () => {
    try {
      const r = await api<Customer[]>('customer:getAll')
      if (r.success) setData(r.data ?? [])
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setForm({ ...EMPTY }); setModal('add') }
  const openEdit = (row: Customer) => {
    setSelected(row)
    setForm({
      nama_customer: row.nama_customer ?? '',
      no_telp: row.no_telp ?? '',
      email: row.email ?? '',
      alamat: row.alamat ?? '',
      tgl_lahir: row.tgl_lahir ?? '',
    })
    setModal('edit')
  }
  const openDelete = (row: Customer) => { setSelected(row); setModal('delete') }
  const openPoin = (row: Customer) => { setSelected(row); setPoinInput(''); setPoinMode('add'); setModal('poin') }
  const openRiwayat = async (row: Customer) => {
    setSelected(row)
    setLoading(true)
    const r = await api<Penjualan[]>('customer:getRiwayatPembelian', row.kd_customer)
    setLoading(false)
    if (r.success) {
      setRiwayat(r.data ?? [])
      setModal('riwayat')
    } else {
      toast(r.message as string, 'error')
    }
  }
  const closeModal = () => { setModal(null); setSelected(null); setRiwayat([]) }

  const handleSave = async () => {
    if (!form.nama_customer) return toast('Nama customer wajib diisi', 'error')
    setLoading(true)
    try {
      const r = modal === 'add'
        ? await api('customer:create', form)
        : await api('customer:update', selected?.kd_customer, form)
      if (r.success) { toast(r.message as string); closeModal(); load() }
      else toast(r.message as string, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const r = await api('customer:delete', selected?.kd_customer)
      if (r.success) { toast(r.message as string); closeModal(); load() }
      else toast(r.message as string, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (row: Customer) => {
    const r = await api('customer:toggleStatus', row.kd_customer)
    if (r.success) { toast(r.message as string); load() }
    else toast(r.message as string, 'error')
  }

  const handlePoin = async () => {
    const val = parseInt(poinInput)
    if (!val || val <= 0) return toast('Masukkan jumlah poin yang valid', 'error')
    setLoading(true)
    const finalPoin = poinMode === 'add' ? val : -val
    const r = await api('customer:addPoin', selected!.kd_customer, finalPoin)
    setLoading(false)
    if (r.success) { toast(r.message as string); closeModal(); load() }
    else toast(r.message as string, 'error')
  }

  const f = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'nama_customer',
      header: 'Nama Customer',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-red-600/10 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
            {(row.original.nama_customer || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-white truncate">{row.original.nama_customer}</p>
            {row.original.alamat && <p className="text-[11px] text-slate-400 truncate">{row.original.alamat}</p>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'no_telp', header: 'No. Telepon', size: 130,
      cell: ({ getValue }) => (
        <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
          {getValue() as string || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'email', header: 'Email',
      cell: ({ getValue }) => <span className="text-slate-600 dark:text-slate-400">{getValue() as string || '-'}</span>,
    },
    {
      accessorKey: 'poin', header: 'Poin Loyalty',
      cell: ({ getValue }) => (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
          <Gift size={13} className="text-amber-500" />
          <span className="font-black text-amber-600 dark:text-amber-400 text-xs">{(getValue() as number ?? 0).toLocaleString('id-ID')} Poin</span>
        </div>
      ),
    },
    {
      accessorKey: 'total_belanja', header: 'Total Belanja',
      cell: ({ getValue }) => <span className="font-extrabold text-red-600 dark:text-red-400">{formatRupiah(getValue() as number ?? 0)}</span>,
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => (
        <button onClick={() => handleToggleStatus(row.original)} className="flex items-center gap-1.5 transition-colors" title="Ubah status customer">
          {row.original.status === 'Aktif'
            ? <><ToggleRight size={22} className="text-emerald-500" /><span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Aktif</span></>
            : <><ToggleLeft size={22} className="text-slate-400" /><span className="text-xs font-bold text-slate-400">Nonaktif</span></>
          }
        </button>
      ),
    },
    {
      id: 'actions', header: 'Aksi',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors" title="Edit Customer">
            <Pencil size={15} />
          </button>
          <button onClick={() => openPoin(row.original)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 transition-colors" title="Kelola Poin">
            <Gift size={15} />
          </button>
          <button onClick={() => openRiwayat(row.original)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors" title="Riwayat Pembelian">
            <History size={15} />
          </button>
          <button onClick={() => openDelete(row.original)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors" title="Hapus Customer">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const activeCount = data.filter(c => c.status === 'Aktif').length
  const totalPoin = data.reduce((acc, c) => acc + (c.poin ?? 0), 0)

  return (
    <div className="space-y-4 select-none">
      {loadingData ? (
        <SkeletonPage rows={6} />
      ) : (
        <>
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Pelanggan & Loyalty Poin</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-primary-600/10 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400 text-[11px] font-bold border border-primary-600/20">
                  {data.length} Member Terdaftar
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Kelola data pelanggan, program poin loyalty, dan riwayat transaksi member toko.
              </p>
            </div>

            <Button
              icon={<Plus size={16} />}
              onClick={openAdd}
              className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold border-0 shadow-md shadow-primary-600/20"
            >
              Tambah Customer Baru
            </Button>
          </div>

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Pelanggan</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{data.length} Member</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-600/10 text-primary-600 flex items-center justify-center">
                  <Users size={20} />
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Member Aktif</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount} Customer</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                  <UserCheck size={20} />
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Poin Beredar</p>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{totalPoin.toLocaleString('id-ID')} Poin</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center">
                  <Award size={20} />
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <DataTable data={data} columns={columns} searchPlaceholder="Cari berdasarkan nama, nomor telepon, atau email..." />
          </Card>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={closeModal}
        title={modal === 'add' ? 'Tambah Member Customer' : 'Edit Data Customer'} size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto font-bold">Batal</Button>
            <Button loading={loading} onClick={handleSave} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold border-0">Simpan Data Customer</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input label="Nama Customer *" value={form.nama_customer} onChange={e => f('nama_customer', e.target.value)} />
          <Input label="No. Telepon / WhatsApp" value={form.no_telp} onChange={e => f('no_telp', e.target.value)} />
          <Input label="Email Customer" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          <Input label="Tanggal Lahir" type="date" value={form.tgl_lahir} onChange={e => f('tgl_lahir', e.target.value)} />
          <div className="col-span-1 sm:col-span-2">
            <Input label="Alamat Lengkap" value={form.alamat} onChange={e => f('alamat', e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Poin Modal */}
      <Modal open={modal === 'poin'} onClose={closeModal} title="Kelola Poin Loyalty Customer" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto font-bold">Batal</Button>
            <Button loading={loading} onClick={handlePoin} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold border-0">Simpan Perubahan Poin</Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-200">Poin Loyalty Saat Ini</span>
            <div className="flex items-center gap-1.5">
              <Gift size={18} className="text-amber-500" />
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {(selected?.poin ?? 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-1 bg-slate-100 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setPoinMode('add')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${poinMode === 'add' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
            >
              <Plus size={14} /> Tambah Poin
            </button>
            <button
              type="button"
              onClick={() => setPoinMode('sub')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${poinMode === 'sub' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500'}`}
            >
              <Minus size={14} /> Kurangi Poin
            </button>
          </div>

          <Input
            label={`Jumlah Poin yang ${poinMode === 'add' ? 'Ditambahkan' : 'Dikurangi'} *`}
            type="number"
            value={poinInput}
            onChange={e => setPoinInput(e.target.value)}
            placeholder="Contoh: 100"
          />

          {poinInput && parseInt(poinInput) > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 font-medium">Estimasi poin akhir: </span>
              <span className="font-black text-amber-600 dark:text-amber-400">
                {Math.max(0, (selected?.poin ?? 0) + (poinMode === 'add' ? parseInt(poinInput) : -parseInt(poinInput))).toLocaleString('id-ID')} Poin
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmDialog
        open={modal === 'delete'}
        onClose={closeModal}
        onConfirm={handleDelete}
        title="Hapus Data Customer"
        message={`Apakah Anda yakin ingin menghapus data customer "${selected?.nama_customer}"?`}
        confirmText="Hapus Customer"
        variant="danger"
        loading={loading}
      />

      {/* Purchase History Modal */}
      <Modal open={modal === 'riwayat'} onClose={closeModal} title={`Riwayat Pembelian — ${selected?.nama_customer}`} size="lg"
        footer={<Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto font-bold">Tutup</Button>}
      >
        {loading ? (
          <div className="text-center py-8 text-xs font-bold text-slate-400">Memuat data riwayat transaksi...</div>
        ) : riwayat.length === 0 ? (
          <div className="text-center py-8 text-xs font-bold text-slate-400">Belum ada riwayat pembelian untuk member ini</div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {riwayat.map(item => (
              <div key={item.kd_tansaksi_jual} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="text-xs font-mono font-bold text-slate-900 dark:text-white">{item.kd_tansaksi_jual}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{formatDate(item.tgl_wkt_transaksi)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-red-600 dark:text-red-400">{formatRupiah(item.yang_dibayar ?? 0)}</p>
                  <Badge label={item.jenis_pembayaran ?? 'Tunai'} variant={item.jenis_pembayaran === 'Transfer' ? 'blue' : 'green'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
