import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Warehouse,
  Store,
  ArrowLeftRight,
  Boxes,
  QrCode,
  Search,
  Filter,
  RefreshCw,
  Package,
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { SkeletonPage } from '../components/Skeleton'
import AdvancedInventory from './AdvancedInventory'

interface Branch {
  id: number
  code: string
  name: string
  address: string
  phone: string
  is_warehouse: number
  is_active: number
}

interface BranchStock {
  id: number
  branch_name: string
  nama_barang: string
  kd_barang: string
  jumlah: number
}

interface BranchTransfer {
  id: number
  nama_barang: string
  kd_barang: string
  from_branch: string
  to_branch: string
  qty: number
  created_at: string
}

type TabType = 'cabang' | 'transfer' | 'stok' | 'batch-serial'

export default function Branch() {
  const toast = useToast()
  const [tab, setTab] = useState<TabType>('cabang')
  const [branches, setBranches] = useState<Branch[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState<'add' | 'edit' | 'transfer' | null>(null)
  const [selected, setSelected] = useState<Branch | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Branch | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [stockRows, setStockRows] = useState<BranchStock[]>([])
  const [transferRows, setTransferRows] = useState<BranchTransfer[]>([])

  // Tab 1 filters
  const [branchSearch, setBranchSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<'ALL' | 'OUTLET' | 'WAREHOUSE' | 'ACTIVE'>('ALL')

  // Tab 2 filters
  const [transferSearch, setTransferSearch] = useState('')

  // Tab 3 filters
  const [stockSearch, setStockSearch] = useState('')
  const [selectedStockBranch, setSelectedStockBranch] = useState<string>('ALL')

  const [form, setForm] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    is_warehouse: 0,
    is_active: 1,
  })

  const [transferForm, setTransferForm] = useState({
    from_branch_id: '',
    to_branch_id: '',
    kd_barang: '',
    qty: '',
    notes: '',
  })

  const load = async (isInitial = false) => {
    if (isInitial) setInitialLoading(true)
    else setRefreshing(true)
    try {
      const [r, stockRes, transferRes] = await Promise.all([
        api<Branch[]>('branch:getAll'),
        api<BranchStock[]>('branch:getStockSummary'),
        api<BranchTransfer[]>('branch:getTransferHistory', 50),
      ])
      if (r.success) setBranches(r.data ?? [])
      if (stockRes.success) setStockRows(stockRes.data ?? [])
      if (transferRes.success) setTransferRows(transferRes.data ?? [])
    } finally {
      if (isInitial) setInitialLoading(false)
      else setRefreshing(false)
    }
  }

  useEffect(() => {
    load(true)
  }, [])

  const resetForm = () => {
    setForm({ code: '', name: '', address: '', phone: '', is_warehouse: 0, is_active: 1 })
  }

  const openAdd = () => {
    resetForm()
    setModal('add')
  }

  const openEdit = (branch: Branch) => {
    setSelected(branch)
    setForm({
      code: branch.code,
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      is_warehouse: branch.is_warehouse,
      is_active: branch.is_active,
    })
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      return toast('Kode dan nama cabang wajib diisi', 'error')
    }

    setSaving(true)
    if (modal === 'add') {
      const r = await api('branch:create', form)
      setSaving(false)
      if (r.success) {
        toast('Cabang berhasil ditambahkan')
        setModal(null)
        load(false)
      } else {
        toast(r.message as string, 'error')
      }
    } else if (selected) {
      const r = await api('branch:update', selected.id, form)
      setSaving(false)
      if (r.success) {
        toast('Cabang berhasil diperbarui')
        setModal(null)
        load(false)
      } else {
        toast(r.message as string, 'error')
      }
    }
  }

  const handleToggle = async (branch: Branch) => {
    const newStatus = branch.is_active === 1 ? 0 : 1
    const r = await api('branch:update', branch.id, { is_active: newStatus })
    if (r.success) {
      toast(`Cabang ${newStatus === 1 ? 'diaktifkan' : 'dinonaktifkan'}`)
      load(false)
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    const r = await api('branch:delete', deleteConfirm.id)
    setDeleting(false)
    if (r.success) {
      toast('Cabang berhasil dihapus')
      setDeleteConfirm(null)
      load(false)
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleTransfer = async () => {
    if (!transferForm.from_branch_id || !transferForm.to_branch_id || !transferForm.kd_barang.trim() || !transferForm.qty) {
      return toast('Mohon lengkapi seluruh data transfer', 'error')
    }
    if (transferForm.from_branch_id === transferForm.to_branch_id) {
      return toast('Cabang asal dan cabang tujuan tidak boleh sama', 'error')
    }
    if (Number(transferForm.qty) <= 0) {
      return toast('Jumlah transfer stok harus lebih dari 0', 'error')
    }

    setSaving(true)
    const r = await api(
      'branch:transferStock',
      parseInt(transferForm.from_branch_id),
      parseInt(transferForm.to_branch_id),
      transferForm.kd_barang.trim(),
      parseInt(transferForm.qty),
      transferForm.notes,
      ''
    )
    setSaving(false)
    if (r.success) {
      toast('Transfer stok berhasil diproses')
      setModal(null)
      setTransferForm({ from_branch_id: '', to_branch_id: '', kd_barang: '', qty: '', notes: '' })
      load(false)
    } else {
      toast(r.message as string, 'error')
    }
  }

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return branches.filter(b => {
      const matchSearch =
        !branchSearch.trim() ||
        b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.code.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.address.toLowerCase().includes(branchSearch.toLowerCase())

      const matchType =
        branchFilter === 'ALL' ? true :
        branchFilter === 'OUTLET' ? !b.is_warehouse :
        branchFilter === 'WAREHOUSE' ? b.is_warehouse :
        branchFilter === 'ACTIVE' ? b.is_active === 1 : true

      return matchSearch && matchType
    })
  }, [branches, branchSearch, branchFilter])

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    if (!transferSearch.trim()) return transferRows
    const q = transferSearch.toLowerCase()
    return transferRows.filter(t =>
      (t.nama_barang || '').toLowerCase().includes(q) ||
      (t.kd_barang || '').toLowerCase().includes(q) ||
      (t.from_branch || '').toLowerCase().includes(q) ||
      (t.to_branch || '').toLowerCase().includes(q)
    )
  }, [transferRows, transferSearch])

  // Filtered stocks
  const filteredStocks = useMemo(() => {
    return stockRows.filter(s => {
      const matchBranch = selectedStockBranch === 'ALL' || s.branch_name === selectedStockBranch
      const q = stockSearch.toLowerCase()
      const matchSearch =
        !q ||
        (s.nama_barang || '').toLowerCase().includes(q) ||
        (s.kd_barang || '').toLowerCase().includes(q) ||
        (s.branch_name || '').toLowerCase().includes(q)
      return matchBranch && matchSearch
    })
  }, [stockRows, selectedStockBranch, stockSearch])

  if (initialLoading) return <SkeletonPage rows={5} />

  const outlets = branches.filter(b => !b.is_warehouse)
  const warehouses = branches.filter(b => b.is_warehouse)

  const TABS: Array<{ id: TabType; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'cabang', label: 'Daftar Cabang & Gudang', icon: <Building2 size={16} />, count: branches.length },
    { id: 'transfer', label: 'Transfer Stok', icon: <ArrowLeftRight size={16} />, count: transferRows.length },
    { id: 'stok', label: 'Saldo Stok per Lokasi', icon: <Boxes size={16} />, count: stockRows.length },
    { id: 'batch-serial', label: 'Batch & Nomor Seri', icon: <QrCode size={16} /> },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="text-primary-500" size={28} />
            Kelola Cabang & Gudang
            {refreshing && (
              <span className="ml-2 h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin inline-block" />
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pusat manajemen multi-outlet, gudang penyimpanan, mutasi stok, serta penomoran seri & batch produk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setModal('transfer')}
            variant="secondary"
            icon={<ArrowLeftRight size={16} />}
          >
            Transfer Stok
          </Button>
          <Button onClick={openAdd} icon={<Plus size={16} />}>
            Tambah Cabang
          </Button>
        </div>
      </div>

      {/* Structured 4 Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              tab === t.id
                ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                  tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ======================= TAB 1: DAFTAR CABANG & GUDANG ======================= */}
      {tab === 'cabang' && (
        <div className="space-y-4">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center text-primary-600">
                  <Building2 size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Lokasi</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{branches.length}</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                  <Store size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cabang Toko</p>
                  <p className="text-2xl font-black text-blue-600">{outlets.length}</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
                  <Warehouse size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gudang Penyimpanan</p>
                  <p className="text-2xl font-black text-amber-600">{warehouses.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                {(['ALL', 'OUTLET', 'WAREHOUSE', 'ACTIVE'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setBranchFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      branchFilter === f
                        ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f === 'ALL' ? 'Semua' : f === 'OUTLET' ? 'Cabang Toko' : f === 'WAREHOUSE' ? 'Gudang' : 'Hanya Aktif'}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64">
                <Input
                  placeholder="Cari kode / nama cabang..."
                  value={branchSearch}
                  onChange={e => setBranchSearch(e.target.value)}
                  icon={<Search size={14} />}
                />
              </div>
            </div>
          </Card>

          {/* Branch Table */}
          <Card title={`Daftar Cabang & Gudang (${filteredBranches.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-extrabold text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Kode</th>
                    <th className="px-4 py-3 text-left">Nama Lokasi</th>
                    <th className="px-4 py-3 text-left">Alamat</th>
                    <th className="px-4 py-3 text-left">Kontak / Telp</th>
                    <th className="px-4 py-3 text-center">Tipe</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center pr-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBranches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                        {branchSearch ? 'Tidak ada cabang yang cocok dengan pencarian.' : 'Belum ada cabang. Silakan tambahkan cabang pertama!'}
                      </td>
                    </tr>
                  ) : (
                    filteredBranches.map(branch => (
                      <tr key={branch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{branch.code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{branch.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{branch.address || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono">{branch.phone || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {branch.is_warehouse === 1 ? (
                            <Badge label="Gudang" variant="amber" />
                          ) : (
                            <Badge label="Cabang Toko" variant="blue" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            label={branch.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                            variant={branch.is_active === 1 ? 'green' : 'gray'}
                          />
                        </td>
                        <td className="px-4 py-3 text-center pr-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleToggle(branch)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                              title={branch.is_active === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {branch.is_active === 1 ? <Store size={15} /> : <Building2 size={15} />}
                            </button>
                            <button
                              onClick={() => openEdit(branch)}
                              className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/40 text-primary-600 transition-colors"
                              title="Edit Cabang"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(branch)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors"
                              title="Hapus Cabang"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= TAB 2: TRANSFER STOK ======================= */}
      {tab === 'transfer' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Histori Mutasi & Transfer Stok</h3>
                <p className="text-xs text-slate-500">Daftar perpindahan stok produk antar cabang dan gudang</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-48 sm:w-64">
                  <Input
                    placeholder="Cari produk / cabang..."
                    value={transferSearch}
                    onChange={e => setTransferSearch(e.target.value)}
                    icon={<Search size={14} />}
                  />
                </div>
                <Button onClick={() => setModal('transfer')} icon={<ArrowLeftRight size={16} />} className="shrink-0">
                  Transfer Stok Baru
                </Button>
              </div>
            </div>
          </Card>

          <Card title={`Riwayat Transfer Stok (${filteredTransfers.length} Transaksi)`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-extrabold text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Waktu & Tanggal</th>
                    <th className="px-4 py-3 text-left">Kode & Nama Produk</th>
                    <th className="px-4 py-3 text-left">Dari Lokasi</th>
                    <th className="px-4 py-3 text-left">Ke Lokasi Tujuan</th>
                    <th className="px-4 py-3 text-right">Jumlah Qty</th>
                    <th className="px-4 py-3 text-center pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        {transferSearch ? 'Tidak ada riwayat transfer yang sesuai pencarian.' : 'Belum ada transaksi transfer stok antar cabang.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-300 mr-2">{row.kd_barang}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{row.nama_barang || '-'}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {row.from_branch || '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {row.to_branch || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                          {row.qty.toLocaleString('id-ID')} unit
                        </td>
                        <td className="px-4 py-3 text-center pr-4">
                          <Badge label="Selesai" variant="green" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= TAB 3: SALDO STOK PER LOKASI ======================= */}
      {tab === 'stok' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap flex items-center gap-1.5">
                  <Filter size={14} className="text-primary-600" />
                  <span>Pilih Lokasi:</span>
                </label>
                <select
                  value={selectedStockBranch}
                  onChange={e => setSelectedStockBranch(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                >
                  <option value="ALL">Semua Cabang & Gudang</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.is_warehouse ? 'Gudang' : 'Cabang'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-64">
                <Input
                  placeholder="Cari kode / nama barang..."
                  value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                  icon={<Search size={14} />}
                />
              </div>
            </div>
          </Card>

          <Card title={`Saldo Stok per Lokasi (${filteredStocks.length} Record Produk)`} subtitle="Pantau ketersediaan stok fisik di masing-masing cabang atau gudang">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-extrabold text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Nama Cabang / Gudang</th>
                    <th className="px-4 py-3 text-left">Kode Produk</th>
                    <th className="px-4 py-3 text-left">Nama Produk</th>
                    <th className="px-4 py-3 text-right pr-4">Saldo Stok Fisik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                        {stockSearch ? 'Tidak ada stok barang yang sesuai pencarian.' : 'Belum ada data saldo stok cabang.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {row.branch_name || '-'}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-600 dark:text-slate-300">
                          {row.kd_barang}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {row.nama_barang || row.kd_barang}
                        </td>
                        <td className="px-4 py-3 text-right pr-4 font-black text-sm text-primary-600 dark:text-primary-400">
                          {row.jumlah.toLocaleString('id-ID')} unit
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= TAB 4: BATCH & NOMOR SERI ======================= */}
      {tab === 'batch-serial' && (
        <div className="space-y-4">
          <AdvancedInventory embedded />
        </div>
      )}

      {/* ======================= MODALS ======================= */}

      {/* Add/Edit Branch Modal */}
      <Modal
        open={!!modal && modal !== 'transfer'}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Tambah Cabang / Gudang' : 'Edit Cabang / Gudang'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Kode Lokasi *"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="Contoh: CBG-01 / GDG-01"
            />
            <Input
              label="Nama Lokasi *"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: Cabang Utama / Gudang Barat"
            />
          </div>

          <Input
            label="Alamat Lengkap"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Jl. Merdeka No. 123"
          />

          <Input
            label="Nomor Telepon"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="0812-3456-7890"
          />

          <div className="flex gap-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="is_warehouse"
                checked={form.is_warehouse === 0}
                onChange={() => setForm({ ...form, is_warehouse: 0 })}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Cabang Toko (Outlet)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="is_warehouse"
                checked={form.is_warehouse === 1}
                onChange={() => setForm({ ...form, is_warehouse: 1 })}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Gudang Penyimpanan</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Transfer Stock Modal */}
      <Modal
        open={modal === 'transfer'}
        onClose={() => setModal(null)}
        title="Transfer Stok Antar Cabang / Gudang"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button onClick={handleTransfer} loading={saving}>
              Proses Transfer
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Dari Lokasi Asal *
              </label>
              <select
                value={transferForm.from_branch_id}
                onChange={e => setTransferForm({ ...transferForm, from_branch_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none"
              >
                <option value="">-- Pilih Asal --</option>
                {branches
                  .filter(b => b.is_active)
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.is_warehouse ? 'Gudang' : 'Cabang'})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ke Lokasi Tujuan *
              </label>
              <select
                value={transferForm.to_branch_id}
                onChange={e => setTransferForm({ ...transferForm, to_branch_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none"
              >
                <option value="">-- Pilih Tujuan --</option>
                {branches
                  .filter(b => b.is_active && b.id !== parseInt(transferForm.from_branch_id || '0'))
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.is_warehouse ? 'Gudang' : 'Cabang'})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kode Produk *"
              value={transferForm.kd_barang}
              onChange={e => setTransferForm({ ...transferForm, kd_barang: e.target.value })}
              placeholder="Contoh: BRG001"
            />
            <Input
              label="Jumlah Qty *"
              type="number"
              value={transferForm.qty}
              onChange={e => setTransferForm({ ...transferForm, qty: e.target.value })}
              placeholder="Contoh: 10"
            />
          </div>

          <Input
            label="Catatan Mutasi"
            value={transferForm.notes}
            onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}
            placeholder="Keterangan pengiriman stok..."
          />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Konfirmasi Hapus Cabang / Gudang"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Hapus Lokasi
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Apakah Anda yakin ingin menghapus <strong>"{deleteConfirm?.name}"</strong>?
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Pastikan tidak ada stok aktif yang tertinggal di lokasi ini sebelum menghapus.
        </p>
      </Modal>
    </div>
  )
}
