import { useEffect, useMemo, useState } from 'react'
import { Plus, Check, X, Eye, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import { TableSkeleton } from '../components/Skeleton'
import { api } from '../utils/api'
import EmptyState from '../components/EmptyState'
import { formatRupiah, formatDate } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface ReturnRow {
  id: number
  return_number: string
  nomor_transaksi?: string | null
  penjualan_id?: string | null
  customer_id?: string | null
  customer_name?: string | null
  total_amount: number
  refund_method: string
  reason?: string | null
  status: ReturnStatus
  created_at: string
  item_count?: number
}

interface SaleDetail {
  kd_barang: string
  nama_barang: string | null
  harga_jual: number | null
  qty: number | null
  total_harga_jual: number | null
}

interface SaleHeader {
  kd_tansaksi_jual: string
  kd_customer?: string | null
  tgl_wkt_transaksi?: string | null
  sub_total?: number | null
}

interface ReturnDetail {
  id: number
  barang_id: string
  nama_barang?: string | null
  quantity: number
  price: number
  subtotal: number
  reason?: string | null
}

export default function Returns() {
  const toast = useToast()
  const { user } = useAuth()
  const [returns, setReturns] = useState<ReturnRow[]>([])
  const [sales, setSales] = useState<SaleHeader[]>([])
  const [saleHeader, setSaleHeader] = useState<SaleHeader | null>(null)
  const [saleDetails, setSaleDetails] = useState<SaleDetail[]>([])
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [selectedItems, setSelectedItems] = useState<Record<string, { checked: boolean; qty: number; reason: string }>>({})
  const [modal, setModal] = useState<'create' | 'detail' | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<ReturnRow | null>(null)
  const [returnDetails, setReturnDetails] = useState<ReturnDetail[]>([])
  const [deleteReturn, setDeleteReturn] = useState<ReturnRow | null>(null)
  const [approveReturn, setApproveReturn] = useState<ReturnRow | null>(null)
  const [rejectReturn, setRejectReturn] = useState<ReturnRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [refundMethod, setRefundMethod] = useState<'TUNAI' | 'TRANSFER' | 'STORE_CREDIT'>('TUNAI')
  const [reason, setReason] = useState('')

  const selectedReturnItems = useMemo(() => {
    return saleDetails
      .map(item => {
        const state = selectedItems[item.kd_barang]
        const qty = Math.min(Number(item.qty ?? 0), Math.max(0, Number(state?.qty ?? 0)))
        const price = Number(item.harga_jual ?? 0)
        return {
          ...item,
          selected: !!state?.checked && qty > 0,
          returnQty: qty,
          returnReason: state?.reason ?? '',
          subtotal: price * qty,
        }
      })
      .filter(item => item.selected)
  }, [saleDetails, selectedItems])

  const totalReturn = selectedReturnItems.reduce((sum, item) => sum + item.subtotal, 0)

  const loadReturns = async () => {
    try {
      const r = await api<ReturnRow[]>('return:getAll')
      if (r.success) setReturns((r.data ?? []).filter(item => item && item.id))
    } finally {
      setLoadingData(false)
    }
  }

  const loadSales = async () => {
    try {
      const r = await api<SaleHeader[]>('penjualan:getAll')
      if (r.success) setSales((r.data ?? []).slice(0, 100))
    } finally {
    }
  }

  useEffect(() => {
    loadReturns()
    loadSales()
  }, [])

  useEffect(() => {
    if (!selectedSaleId) {
      setSaleHeader(null)
      setSaleDetails([])
      setSelectedItems({})
      return
    }

    api<{ header: SaleHeader; details: SaleDetail[] }>('penjualan:getDetail', selectedSaleId).then(r => {
      if (!r.success || !r.data?.header) {
        toast(r.message ?? 'Detail transaksi tidak ditemukan', 'error')
        return
      }

      setSaleHeader(r.data.header)
      setSaleDetails(r.data.details ?? [])
      const next: Record<string, { checked: boolean; qty: number; reason: string }> = {}
      for (const item of r.data.details ?? []) {
        if (item.kd_barang) next[item.kd_barang] = { checked: false, qty: 1, reason: '' }
      }
      setSelectedItems(next)
    })
  }, [selectedSaleId, toast])

  const resetCreateForm = () => {
    setSelectedSaleId('')
    setSaleHeader(null)
    setSaleDetails([])
    setSelectedItems({})
    setReason('')
    setRefundMethod('TUNAI')
  }

  const openCreate = () => {
    resetCreateForm()
    setModal('create')
  }

  const openDetail = async (row: ReturnRow) => {
    setSelectedReturn(row)
    setReturnDetails([])
    setModal('detail')
    const r = await api<ReturnDetail[]>('return:getDetails', row.id)
    if (r.success) setReturnDetails(r.data ?? [])
  }

  const setItemState = (kd: string, patch: Partial<{ checked: boolean; qty: number; reason: string }>) => {
    setSelectedItems(prev => {
      const current = prev[kd]
      return {
        ...prev,
        [kd]: {
          checked: patch.checked ?? current?.checked ?? false,
          qty: patch.qty ?? current?.qty ?? 1,
          reason: patch.reason ?? current?.reason ?? '',
        },
      }
    })
  }

  const handleCreateReturn = async () => {
    if (!selectedSaleId || !saleHeader) return toast('Pilih transaksi asli', 'error')
    if (!selectedReturnItems.length) return toast('Pilih item yang diretur', 'error')
    if (!reason.trim()) return toast('Alasan return wajib diisi', 'error')

    setLoading(true)
    const r = await api('return:create', {
      penjualan_id: selectedSaleId,
      customer_id: saleHeader.kd_customer ?? null,
      total_amount: totalReturn,
      refund_method: refundMethod,
      reason,
      created_by: user?.nama_pengguna,
      items: selectedReturnItems.map(item => ({
        kd_barang: item.kd_barang,
        quantity: item.returnQty,
        price: item.harga_jual ?? 0,
        subtotal: item.subtotal,
        reason: item.returnReason || reason,
      })),
    })
    setLoading(false)

    if (r.success) {
      toast(r.message ?? 'Return dibuat')
      setModal(null)
      resetCreateForm()
      loadReturns()
    } else {
      toast(r.message || 'Gagal membuat return', 'error')
    }
  }

  const handleApprove = async (id: number) => {
    const ret = returns.find(r => r.id === id)
    if (ret) setApproveReturn(ret)
  }

  const confirmApprove = async () => {
    if (!approveReturn) return
    setLoading(true)
    try {
      const r = await api('return:approve', approveReturn.id, user?.nama_pengguna)
      if (r.success) {
        toast(r.message ?? 'Return berhasil diapprove')
        setApproveReturn(null)
        loadReturns()
      } else {
        toast(r.message || 'Gagal approve return', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (id: number) => {
    const ret = returns.find(r => r.id === id)
    if (ret) setRejectReturn(ret)
  }

  const confirmReject = async () => {
    if (!rejectReturn) return
    setLoading(true)
    try {
      const r = await api('return:reject', rejectReturn.id, user?.nama_pengguna)
      if (r.success) {
        toast(r.message ?? 'Return berhasil direject')
        setRejectReturn(null)
        loadReturns()
      } else {
        toast(r.message || 'Gagal reject return', 'error')
      }
    } finally {
      setLoading(false)
    }
  }
  
  const handleDelete = async () => {
    if (!deleteReturn) return
    setLoading(true)
    const r = await api('return:delete', deleteReturn.id)
    setLoading(false)
    if (r.success) {
      toast(r.message ?? 'Return berhasil dihapus')
      setDeleteReturn(null)
      loadReturns()
    } else {
      toast(r.message || 'Gagal menghapus return', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Return & Refund</h1>
          <p className="text-slate-600 dark:text-slate-400">Return wajib berasal dari transaksi dan item asli.</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />} className="w-full sm:w-auto">Buat Return</Button>
      </div>

      <Card title="Daftar Return">
        {loadingData ? (
          <TableSkeleton rows={5} columns={7} />
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[900px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No Return</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Transaksi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {returns.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Belum ada data return</td></tr>
                  ) : returns.map(ret => (
                    <tr key={ret.id} className="hover:bg-primary-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{ret.return_number}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{ret.nomor_transaksi ?? ret.penjualan_id ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(ret.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{ret.customer_name || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatRupiah(ret.total_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge label={ret.status} variant={ret.status === 'APPROVED' ? 'green' : ret.status === 'REJECTED' ? 'red' : 'yellow'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => openDetail(ret)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-slate-600 text-primary-500" title="Detail">
                            <Eye size={14} />
                          </button>
                          {ret.status === 'PENDING' && (
                            <>
                              <button onClick={() => handleApprove(ret.id)} className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600" title="Approve">
                                <Check size={14} />
                              </button>
                              <button onClick={() => handleReject(ret.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Reject">
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button onClick={() => setDeleteReturn(ret)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Buat Return Dari Transaksi" size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleCreateReturn} className="w-full sm:w-auto">Simpan Return</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">Transaksi Asli *</label>
            <select
              value={selectedSaleId}
              onChange={e => setSelectedSaleId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Pilih transaksi...</option>
              {sales.map(sale => (
                <option key={sale.kd_tansaksi_jual} value={sale.kd_tansaksi_jual}>
                  {sale.kd_tansaksi_jual} - {formatDate(sale.tgl_wkt_transaksi ?? '')} - {formatRupiah(sale.sub_total ?? 0)}
                </option>
              ))}
            </select>
          </div>

          {saleDetails.length > 0 ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700">
                Item Transaksi
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {saleDetails.map(item => {
                  const state = selectedItems[item.kd_barang] ?? { checked: false, qty: 1, reason: '' }
                  return (
                    <div key={item.kd_barang} className="grid gap-3 p-3 sm:grid-cols-[1fr_96px_1fr] sm:items-center">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={state.checked}
                          onChange={e => setItemState(item.kd_barang, { checked: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.nama_barang ?? item.kd_barang}</span>
                          <span className="text-xs text-slate-500">Terjual {item.qty ?? 0} x {formatRupiah(item.harga_jual ?? 0)}</span>
                        </span>
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={item.qty ?? 1}
                        value={state.qty}
                        onChange={e => setItemState(item.kd_barang, { qty: Number(e.target.value) })}
                        disabled={!state.checked}
                      />
                      <Input
                        placeholder="Alasan item"
                        value={state.reason}
                        onChange={e => setItemState(item.kd_barang, { reason: e.target.value })}
                        disabled={!state.checked}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Eye size={36} strokeWidth={1.5} />}
              title="Pilih transaksi"
              description="Pilih transaksi di atas untuk melihat item yang dapat diretur"
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Metode Refund *</label>
              <div className="flex gap-2">
                {(['TUNAI', 'TRANSFER', 'STORE_CREDIT'] as const).map(m => (
                  <button key={m} onClick={() => setRefundMethod(m)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${refundMethod === m ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                    {m === 'STORE_CREDIT' ? 'Store' : m}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Alasan Return *" value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan utama return..." />
          </div>

          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Total Refund</span>
              <span className="font-bold text-primary-600 dark:text-primary-400">{formatRupiah(totalReturn)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Stok belum dikembalikan sampai return di-approve.</p>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'detail'} onClose={() => setModal(null)} title={`Detail Return: ${selectedReturn?.return_number ?? ''}`} size="md">
        {selectedReturn && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Transaksi</p><p className="font-mono text-xs text-slate-700 dark:text-slate-200">{selectedReturn.nomor_transaksi ?? selectedReturn.penjualan_id ?? '-'}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><Badge label={selectedReturn.status} variant={selectedReturn.status === 'APPROVED' ? 'green' : selectedReturn.status === 'REJECTED' ? 'red' : 'yellow'} /></div>
              <div><p className="text-xs text-slate-400">Customer</p><p className="font-medium text-slate-700 dark:text-slate-200">{selectedReturn.customer_name || '-'}</p></div>
              <div><p className="text-xs text-slate-400">Refund</p><p className="font-medium text-slate-700 dark:text-slate-200">{selectedReturn.refund_method}</p></div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              {returnDetails.length === 0 ? (
                <p className="p-3 text-sm text-slate-400">Tidak ada detail item</p>
              ) : returnDetails.map(item => (
                <div key={item.id} className="flex justify-between gap-3 border-b border-slate-100 p-3 text-sm last:border-0 dark:border-slate-700">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{item.nama_barang ?? item.barang_id}</p>
                    <p className="text-xs text-slate-500">{item.quantity} x {formatRupiah(item.price)}</p>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(item.subtotal)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-lg dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-200">Total Refund</span>
              <span className="font-bold text-primary-600 dark:text-primary-400">{formatRupiah(selectedReturn.total_amount)}</span>
            </div>
            {selectedReturn.reason && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <span className="font-medium">Alasan: </span>{selectedReturn.reason}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!deleteReturn} onClose={() => setDeleteReturn(null)} title="Hapus Return" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteReturn(null)} className="w-full sm:w-auto">Batal</Button>
            <Button variant="danger" loading={loading} onClick={handleDelete} className="w-full sm:w-auto">Hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Return yang sudah approved tidak bisa dihapus karena stok sudah dikembalikan.
        </p>
      </Modal>

      <ConfirmDialog
        open={!!approveReturn}
        onClose={() => setApproveReturn(null)}
        onConfirm={confirmApprove}
        title="Approve Return"
        message="Approve return ini? Stok item akan dikembalikan."
        confirmText="Approve"
        loading={loading}
      />

      <ConfirmDialog
        open={!!rejectReturn}
        onClose={() => setRejectReturn(null)}
        onConfirm={confirmReject}
        title="Reject Return"
        message="Reject return ini?"
        confirmText="Reject"
        variant="danger"
        loading={loading}
      />
    </div>
  )
}
