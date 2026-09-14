import { useState, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Eye, Trash2, ShoppingBag, TrendingDown, AlertCircle, CheckCircle, DollarSign } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { SkeletonCard } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDate } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import type { Pembelian, PembelianDetail, Supplier } from '../../shared/types'

interface FormState {
  kd_suplier: string
  yang_dibayar: string
  catatan: string
  items: { kd_barang: string; nama_barang: string; qty: number; harga_beli: number }[]
}

export default function PembelianPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [data, setData] = useState<Pembelian[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LUNAS' | 'HUTANG'>('ALL')
  const [selected, setSelected] = useState<Pembelian | null>(null)
  const [detailItems, setDetailItems] = useState<PembelianDetail[]>([])
  const [modal, setModal] = useState<'detail' | 'delete' | 'create' | 'bayar' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [bayarAmount, setBayarAmount] = useState('')
  
  // Form create pembelian
  const [form, setForm] = useState<FormState>({ kd_suplier: '', yang_dibayar: '', catatan: '', items: [] })
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [itemQty, setItemQty] = useState('1')
  const [itemHarga, setItemHarga] = useState('')

  // Summary stats
  const totalHutang = data.reduce((s, p) => s + (p.sisa_hutang ?? 0), 0)
  const totalPembelian = data.reduce((s, p) => s + (p.sub_total ?? 0), 0)
  const countHutang = data.filter(p => (p.sisa_hutang ?? 0) > 0).length

  const load = async () => {
    setLoading(true)
    const [r1, r2, r3] = await Promise.all([
      api<Pembelian[]>('pembelian:getAll'),
      api<Supplier[]>('supplier:getAll'),
      api<any[]>('barang:getAll'),
    ])
    if (r1.success) setData(r1.data ?? [])
    if (r2.success) setSuppliers(r2.data ?? [])
    if (r3.success) setProducts(r3.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openDetail = async (row: Pembelian) => {
    setSelected(row)
    const r = await api<{ header: Pembelian; details: PembelianDetail[] }>('pembelian:getById', row.kd_pembelian)
    if (r.success && r.data) setDetailItems(r.data.details ?? [])
    setModal('detail')
  }
  
  const openCreate = () => {
    setForm({ kd_suplier: '', yang_dibayar: '', catatan: '', items: [] })
    setSelectedProduct('')
    setItemQty('1')
    setItemHarga('')
    setModal('create')
  }
  
  const addItem = () => {
    if (!selectedProduct || !itemQty || !itemHarga) return toast('Lengkapi data item', 'error')
    const product = products.find(p => p.kd_barang === selectedProduct)
    if (!product) return
    
    const existing = form.items.find(i => i.kd_barang === selectedProduct)
    if (existing) return toast('Produk sudah ada di list', 'error')
    
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        kd_barang: product.kd_barang,
        nama_barang: product.nama_barang,
        qty: parseInt(itemQty),
        harga_beli: parseFloat(itemHarga)
      }]
    }))
    setSelectedProduct('')
    setItemQty('1')
    setItemHarga('')
  }
  
  const removeItem = (kd: string) => {
    setForm(prev => ({ ...prev, items: prev.items.filter(i => i.kd_barang !== kd) }))
  }
  
  const handleCreate = async () => {
    if (!form.kd_suplier) return toast('Pilih supplier', 'error')
    if (form.items.length === 0) return toast('Tambahkan minimal 1 item', 'error')
    
    setActionLoading(true)
    const r = await api('pembelian:create', {
      ...form,
      username: user?.nama_pengguna ?? 'ADMIN',
      yang_dibayar: parseFloat(form.yang_dibayar) || 0
    })
    setActionLoading(false)
    if (r.success) {
      toast(r.message as string)
      setModal(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setActionLoading(true)
    const r = await api('pembelian:delete', selected.kd_pembelian)
    setActionLoading(false)
    if (r.success) { toast(r.message as string); setModal(null); load() }
    else toast(r.message as string, 'error')
  }

  const handleBayar = async () => {
    if (!selected || !bayarAmount) return toast('Jumlah bayar wajib diisi', 'error')
    const amount = parseFloat(bayarAmount)
    if (amount <= 0) return toast('Jumlah harus lebih dari 0', 'error')
    if (amount > (selected.sisa_hutang ?? 0)) return toast('Jumlah melebihi sisa hutang', 'error')
    
    setActionLoading(true)
    const r = await api('pembelian:updateStatus', selected.kd_pembelian, amount)
    setActionLoading(false)
    if (r.success) { toast(r.message as string); setModal(null); setBayarAmount(''); load() }
    else toast(r.message as string, 'error')
  }

  const filtered = data.filter(p => filterStatus === 'ALL' || p.status === filterStatus)

  const columns: ColumnDef<Pembelian>[] = [
    { accessorKey: 'kd_pembelian', header: 'Kode PO', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: 'tgl_pembelian', header: 'Tanggal', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'nama_suplier', header: 'Supplier', cell: ({ getValue }) => getValue() as string ?? '-' },
    { accessorKey: 'total_qty', header: 'Qty', size: 60 },
    { accessorKey: 'sub_total', header: 'Sub Total', cell: ({ getValue }) => <span className="font-medium">{formatRupiah(getValue() as number)}</span> },
    { accessorKey: 'yang_dibayar', header: 'Dibayar', cell: ({ getValue }) => <span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(getValue() as number)}</span> },
    {
      accessorKey: 'sisa_hutang', header: 'Sisa Hutang',
      cell: ({ getValue }) => {
        const v = getValue() as number
        return <span className={v > 0 ? 'font-bold text-red-600 dark:text-red-400' : 'text-slate-400'}>{formatRupiah(v)}</span>
      }
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ getValue }) => <Badge label={getValue() as string ?? '-'} variant={getValue() === 'LUNAS' ? 'green' : 'yellow'} />
    },
    {
      id: 'actions', header: 'Aksi',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openDetail(row.original)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-slate-700 text-primary-500 transition-colors" title="Detail">
            <Eye size={14} />
          </button>
          {(row.original.sisa_hutang ?? 0) > 0 && (
            <button onClick={() => { setSelected(row.original); setBayarAmount(''); setModal('bayar') }} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors" title="Bayar Hutang">
              <DollarSign size={14} />
            </button>
          )}
          <button onClick={() => { setSelected(row.original); setModal('delete') }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Hapus">
            <Trash2 size={14} />
          </button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />) : (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center text-white shrink-0 shadow-lg"><ShoppingBag size={20} /></div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Pembelian</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{formatRupiah(totalPembelian)}</p>
                <p className="text-xs text-slate-400">{data.length} transaksi</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shrink-0 shadow-lg"><TrendingDown size={20} /></div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Hutang</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatRupiah(totalHutang)}</p>
                <p className="text-xs text-slate-400">{countHutang} PO belum lunas</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg"><CheckCircle size={20} /></div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">PO Lunas</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.length - countHutang}</p>
                <p className="text-xs text-slate-400">dari {data.length} total PO</p>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Filter + Table */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} pembelian ditemukan</p>
        <Button icon={<Plus size={16} />} onClick={openCreate} className="w-full sm:w-auto">Tambah Pembelian</Button>
      </div>

      <Card
        title="Daftar Purchase Order"
        action={
          <div className="flex items-center gap-2">
            {(['ALL', 'LUNAS', 'HUTANG'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                {s === 'ALL' ? 'Semua' : s}
              </button>
            ))}
          </div>
        }
      >
        <DataTable data={filtered} columns={columns} searchPlaceholder="Cari kode PO atau supplier..." />
      </Card>

      {/* Detail Modal */}
      <Modal open={modal === 'detail'} onClose={() => setModal(null)} title={`Detail PO: ${selected?.kd_pembelian}`} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Tanggal</p><p className="font-medium">{formatDate(selected.tgl_pembelian)}</p></div>
              <div><p className="text-xs text-slate-400">Supplier</p><p className="font-medium">{selected.nama_suplier ?? '-'}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><Badge label={selected.status ?? '-'} variant={selected.status === 'LUNAS' ? 'green' : 'yellow'} /></div>
              <div><p className="text-xs text-slate-400">Kasir</p><p className="font-medium">{selected.username ?? '-'}</p></div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[400px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                  <tr>
                    {['Produk', 'Qty', 'Harga Beli', 'Total'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {detailItems.map((d, i) => (
                    <tr key={d.kd_pembelian_detail} className={i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}>
                      <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{d.nama_barang}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{d.qty}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{formatRupiah(d.harga_beli)}</td>
                      <td className="px-4 py-2.5 font-semibold text-primary-600 dark:text-primary-400">{formatRupiah(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Sub Total</span><span className="font-semibold">{formatRupiah(selected.sub_total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Yang Dibayar</span><span className="font-semibold text-emerald-600">{formatRupiah(selected.yang_dibayar)}</span></div>
              <div className="flex justify-between text-base"><span className="font-bold">Sisa Hutang</span><span className={`font-bold ${(selected.sisa_hutang ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatRupiah(selected.sisa_hutang)}</span></div>
            </div>

            {selected.catatan && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">
                <span className="font-medium">Catatan: </span>{selected.catatan}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Hapus Purchase Order" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button variant="danger" loading={actionLoading} onClick={handleDelete} className="w-full sm:w-auto">Hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Yakin ingin menghapus PO ini?</p>
        {selected && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm font-mono">{selected.kd_pembelian}</div>
        )}
      </Modal>

      {/* Bayar Hutang Modal */}
      <Modal open={modal === 'bayar'} onClose={() => setModal(null)} title="Bayar Hutang Pembelian" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button loading={actionLoading} onClick={handleBayar} className="w-full sm:w-auto">Bayar</Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
              <p className="text-xs text-slate-500 mb-1">Supplier</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">{selected.nama_suplier}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-900/20">
                <p className="text-xs text-slate-500">Total Pembelian</p>
                <p className="text-lg font-bold text-pink-600 dark:text-pink-400">{formatRupiah(selected.sub_total)}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-xs text-slate-500">Sudah Dibayar</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(selected.yang_dibayar)}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-slate-500">Sisa Hutang</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatRupiah(selected.sisa_hutang)}</p>
            </div>
            <Input
              label="Jumlah Bayar *"
              type="number"
              value={bayarAmount}
              onChange={e => setBayarAmount(e.target.value)}
              placeholder="0"
            />
            {bayarAmount && parseFloat(bayarAmount) > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm">
                <span className="text-slate-500">Sisa hutang setelah bayar: </span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {formatRupiah(Math.max(0, (selected.sisa_hutang ?? 0) - parseFloat(bayarAmount)))}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Pembelian Modal */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Tambah Pembelian" size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button loading={actionLoading} onClick={handleCreate} className="w-full sm:w-auto">Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Supplier */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Supplier *</label>
            <select value={form.kd_suplier} onChange={e => setForm(prev => ({ ...prev, kd_suplier: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-700/80 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="">-- Pilih Supplier --</option>
              {suppliers.filter(s => !s.status || s.status.toLowerCase() === 'aktif' || s.status.toLowerCase() === 'active').map(s => (
                <option key={s.kd_suplier} value={s.kd_suplier}>{s.nama_suplier}</option>
              ))}
            </select>
          </div>

          {/* Add Item Section */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tambah Item</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="">-- Pilih Produk --</option>
                {products.map(p => (
                  <option key={p.kd_barang} value={p.kd_barang}>{p.nama_barang} ({p.kd_barang})</option>
                ))}
              </select>
              <input type="number" placeholder="Qty" value={itemQty} onChange={e => setItemQty(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <input type="number" placeholder="Harga Beli" value={itemHarga} onChange={e => setItemHarga(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <Button size="sm" onClick={addItem} icon={<Plus size={14} />} className="w-full sm:w-auto">Tambah ke List</Button>
          </div>

          {/* Items List */}
          {form.items.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Produk</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Harga</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Total</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {form.items.map(item => (
                    <tr key={item.kd_barang}>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.nama_barang}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.qty}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatRupiah(item.harga_beli)}</td>
                      <td className="px-3 py-2 font-semibold text-primary-600 dark:text-primary-400">{formatRupiah(item.qty * item.harga_beli)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeItem(item.kd_barang)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          {form.items.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Total Item</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{form.items.reduce((s, i) => s + i.qty, 0)} pcs</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-bold text-slate-900 dark:text-slate-100">Sub Total</span>
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {formatRupiah(form.items.reduce((s, i) => s + (i.qty * i.harga_beli), 0))}
                </span>
              </div>
            </div>
          )}

          {/* Payment & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Dibayar (opsional)" type="number" value={form.yang_dibayar} 
              onChange={e => setForm(prev => ({ ...prev, yang_dibayar: e.target.value }))} 
              placeholder="0 = Hutang semua" />
            <Input label="Catatan (opsional)" value={form.catatan} 
              onChange={e => setForm(prev => ({ ...prev, catatan: e.target.value }))} 
              placeholder="Catatan pembelian..." />
          </div>
        </div>
      </Modal>
    </div>
  )
}
