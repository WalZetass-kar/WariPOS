import { useEffect, useState } from 'react'
import { Truck, Package, Plus, Edit3, Trash2, MapPin, Phone, User, RefreshCw } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Select from '../components/Select'
import Textarea from '../components/Textarea'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDateTime } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

interface DeliveryOrder {
  id: number
  kd_transaksi?: string | null
  nomor_delivery: string
  nama_penerima: string
  no_telp_penerima?: string | null
  alamat: string
  catatan_alamat?: string | null
  status: 'MENUNGGU' | 'DIPROSES' | 'DIANTAR' | 'TERKIRIM' | 'GAGAL'
  biaya_ongkir: number
  kurir?: string | null
  created_at: string
}

interface Vehicle {
  id: number
  nama_kendaraan: string
  plat_nomor: string
  jenis: string
  kapasitas_kg?: number | null
  biaya_per_km?: number | null
  status: 'AKTIF' | 'NONAKTIF'
}

const statusVariant: Record<string, 'yellow' | 'blue' | 'amber' | 'green' | 'red'> = {
  MENUNGGU: 'yellow',
  DIPROSES: 'blue',
  DIANTAR: 'amber',
  TERKIRIM: 'green',
  GAGAL: 'red',
}

export default function Delivery() {
  const toast = useToast()
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'orders' | 'vehicles'>('orders')
  const [modal, setModal] = useState<'order' | 'vehicle' | 'courier' | null>(null)
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null)

  const [formOrder, setFormOrder] = useState({
    kd_transaksi: '',
    nama_penerima: '',
    no_telp_penerima: '',
    alamat: '',
    catatan_alamat: '',
    biaya_ongkir: '',
  })

  const [formVehicle, setFormVehicle] = useState({
    nama_kendaraan: '',
    plat_nomor: '',
    jenis: 'Motor',
    kapasitas_kg: '50',
    biaya_per_km: '3000',
    status: 'AKTIF' as 'AKTIF' | 'NONAKTIF',
  })

  const [formCourier, setFormCourier] = useState({ kurir: '' })

  const load = async (isManual = false) => {
    const [r1, r2] = await Promise.all([
      api<DeliveryOrder[]>('delivery:getOrders'),
      api<Vehicle[]>('delivery:getVehicles'),
    ])
    if (r1.success) setOrders(r1.data ?? [])
    if (r2.success) setVehicles(r2.data ?? [])
    setLoading(false)
    if (isManual) toast('Data pengiriman diperbarui', 'success')
  }

  useEffect(() => { load() }, [])

  const resetFormOrder = () => {
    setFormOrder({
      kd_transaksi: '',
      nama_penerima: '',
      no_telp_penerima: '',
      alamat: '',
      catatan_alamat: '',
      biaya_ongkir: '10000',
    })
  }

  const resetFormVehicle = (v?: Vehicle | null) => {
    setFormVehicle(v ? {
      nama_kendaraan: v.nama_kendaraan,
      plat_nomor: v.plat_nomor,
      jenis: v.jenis,
      kapasitas_kg: String(v.kapasitas_kg ?? '50'),
      biaya_per_km: String(v.biaya_per_km ?? '3000'),
      status: v.status,
    } : {
      nama_kendaraan: '',
      plat_nomor: '',
      jenis: 'Motor',
      kapasitas_kg: '50',
      biaya_per_km: '3000',
      status: 'AKTIF',
    })
  }

  const handleSaveOrder = async () => {
    if (!formOrder.nama_penerima.trim() || !formOrder.alamat.trim()) {
      return toast('Nama penerima dan alamat wajib diisi', 'error')
    }
    setSubmitting(true)
    const payload = {
      nama_penerima: formOrder.nama_penerima.trim(),
      no_telp_penerima: formOrder.no_telp_penerima.trim() || null,
      kd_transaksi: formOrder.kd_transaksi.trim() || null,
      alamat: formOrder.alamat.trim(),
      catatan_alamat: formOrder.catatan_alamat.trim() || null,
      biaya_ongkir: parseFloat(formOrder.biaya_ongkir) || 0,
      status: 'MENUNGGU',
    }
    const r = await api('delivery:createOrder', payload)
    setSubmitting(false)
    if (r.success) {
      toast('Pesanan delivery berhasil dibuat', 'success')
      setModal(null)
      resetFormOrder()
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleSaveVehicle = async () => {
    if (!formVehicle.nama_kendaraan.trim() || !formVehicle.plat_nomor.trim()) {
      return toast('Nama dan plat nomor kendaraan wajib diisi', 'error')
    }
    setSubmitting(true)
    const payload = {
      nama_kendaraan: formVehicle.nama_kendaraan.trim(),
      plat_nomor: formVehicle.plat_nomor.trim(),
      jenis: formVehicle.jenis.trim(),
      kapasitas_kg: parseFloat(formVehicle.kapasitas_kg) || 0,
      biaya_per_km: parseFloat(formVehicle.biaya_per_km) || 0,
      status: formVehicle.status,
    }
    const r = editVehicle
      ? await api('delivery:updateVehicle', editVehicle.id, payload)
      : await api('delivery:createVehicle', payload)
    setSubmitting(false)
    if (r.success) {
      toast(editVehicle ? 'Kendaraan diperbarui' : 'Kendaraan ditambahkan', 'success')
      setModal(null)
      setEditVehicle(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleUpdateStatus = async (order: DeliveryOrder, status: string) => {
    setSubmitting(true)
    const r = await api('delivery:updateOrderStatus', order.id, status)
    setSubmitting(false)
    if (r.success) {
      toast(`Status pengiriman ${order.nomor_delivery} diubah ke ${status}`, 'success')
      setSelectedOrder(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleAssignCourier = async () => {
    if (!selectedOrder || !formCourier.kurir.trim()) return toast('Pilih atau masukkan nama kurir', 'error')
    setSubmitting(true)
    const r = await api('delivery:assignCourier', selectedOrder.id, formCourier.kurir.trim())
    setSubmitting(false)
    if (r.success) {
      toast('Kurir berhasil ditugaskan', 'success')
      setModal(null)
      setSelectedOrder(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDeleteVehicle = async () => {
    if (!deleteVehicle) return
    setSubmitting(true)
    const r = await api('delivery:deleteVehicle', deleteVehicle.id)
    setSubmitting(false)
    if (r.success) {
      toast('Kendaraan berhasil dihapus', 'success')
      setDeleteVehicle(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const filteredOrders = orders.filter(o =>
    o.nomor_delivery.toLowerCase().includes(search.toLowerCase()) ||
    o.nama_penerima.toLowerCase().includes(search.toLowerCase()) ||
    (o.alamat ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const statusFlow: Record<string, string[]> = {
    MENUNGGU: ['DIPROSES'],
    DIPROSES: ['DIANTAR'],
    DIANTAR: ['TERKIRIM', 'GAGAL'],
  }

  const statItems = [
    { label: 'Total Pesanan Antar', value: orders.length, icon: <Package size={20} className="text-primary-500" /> },
    { label: 'Menunggu Driver', value: orders.filter(o => o.status === 'MENUNGGU').length, icon: <Package size={20} className="text-amber-500" /> },
    { label: 'Sedang Diantar', value: orders.filter(o => o.status === 'DIANTAR').length, icon: <Truck size={20} className="text-blue-500" /> },
    { label: 'Sukses Terkirim', value: orders.filter(o => o.status === 'TERKIRIM').length, icon: <Package size={20} className="text-emerald-500" /> },
  ]

  return (
    <div className="space-y-4">
      {loading ? (
        <>
          <SkeletonStatGrid count={4} />
          <SkeletonSpinner label="Memuat modul pengiriman delivery..." />
        </>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statItems.map((s, i) => (
              <Card key={i} title={s.label} action={s.icon}>
                <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setTab('orders')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'orders' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Daftar Pengiriman
            </button>
            <button
              onClick={() => setTab('vehicles')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'vehicles' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Armada & Kendaraan ({vehicles.length})
            </button>
          </div>

          {tab === 'orders' && (
            <>
              {/* Orders Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                  placeholder="Cari penerima / no delivery / alamat..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="max-w-xs text-xs"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => load(true)}>
                    Refresh
                  </Button>
                  <Button icon={<Plus size={16} />} onClick={() => { resetFormOrder(); setModal('order') }} className="bg-primary-600 hover:bg-primary-700 text-white border-0 font-bold">
                    Buat Order Delivery
                  </Button>
                </div>
              </div>

              {/* Orders Table */}
              <Card title="Daftar Pengiriman Kurir">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[800px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">No Delivery</th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Penerima</th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Alamat Antar</th>
                          <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                          <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Kurir</th>
                          <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ongkir</th>
                          <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 sm:px-4 py-10 text-center text-slate-400">Belum ada data pengiriman</td>
                          </tr>
                        ) : (
                          filteredOrders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                              <td className="px-3 sm:px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{order.nomor_delivery}</td>
                              <td className="px-3 sm:px-4 py-3">
                                <p className="font-bold text-slate-800 dark:text-slate-200">{order.nama_penerima}</p>
                                <p className="text-xs text-slate-400">{order.no_telp_penerima || '-'}</p>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[220px] truncate">{order.alamat}</td>
                              <td className="px-3 sm:px-4 py-3 text-center">
                                <Badge label={order.status} variant={statusVariant[order.status] ?? 'gray'} />
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300">{order.kurir || '-'}</td>
                              <td className="px-3 sm:px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-300">{order.biaya_ongkir > 0 ? formatRupiah(order.biaya_ongkir) : 'Gratis'}</td>
                              <td className="px-3 sm:px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  {order.status === 'MENUNGGU' && (
                                    <Button size="sm" icon={<User size={14} />} onClick={() => { setSelectedOrder(order); setFormCourier({ kurir: '' }); setModal('courier') }} className="font-bold">
                                      Tugaskan Kurir
                                    </Button>
                                  )}
                                  {order.status === 'DIPROSES' && (
                                    <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(order, 'DIANTAR')}>
                                      Mulai Antar
                                    </Button>
                                  )}
                                  {order.status === 'DIANTAR' && (
                                    <Button size="sm" variant="success" onClick={() => handleUpdateStatus(order, 'TERKIRIM')}>
                                      Terkirim
                                    </Button>
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

              {/* Order Detail Modal */}
              <Modal open={!!selectedOrder && modal !== 'courier'} onClose={() => setSelectedOrder(null)} title={`Detail Delivery: ${selectedOrder?.nomor_delivery ?? ''}`} size="sm">
                {selectedOrder && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge label={selectedOrder.status} variant={statusVariant[selectedOrder.status] ?? 'gray'} />
                      <span className="text-xs text-slate-400">{formatDateTime(selectedOrder.created_at)}</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <User size={15} className="text-slate-400" />
                        <span className="font-bold">{selectedOrder.nama_penerima}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone size={14} className="text-slate-400" />
                        <span>{selectedOrder.no_telp_penerima || '-'}</span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>{selectedOrder.alamat}</span>
                      </div>
                      {selectedOrder.catatan_alamat && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl">Patokan: {selectedOrder.catatan_alamat}</p>
                      )}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <span className="text-slate-500">Biaya Ongkos Kirim:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{formatRupiah(selectedOrder.biaya_ongkir)}</span>
                      </div>
                      {selectedOrder.kurir && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                          <span className="text-slate-500">Kurir Pengantar:</span>
                          <span className="font-bold text-primary-600 dark:text-primary-400">{selectedOrder.kurir}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {(statusFlow[selectedOrder.status] ?? []).map(nextStatus => (
                        <Button
                          key={nextStatus}
                          className="flex-1 font-bold"
                          variant={nextStatus === 'GAGAL' ? 'danger' : 'primary'}
                          onClick={() => handleUpdateStatus(selectedOrder, nextStatus)}
                        >
                          {nextStatus === 'DIPROSES' ? 'Proses Pesanan' : nextStatus === 'DIANTAR' ? 'Kirim / Antarkan' : nextStatus === 'TERKIRIM' ? 'Tandai Sampai' : 'Gagal Kirim'}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </Modal>

              {/* Assign Courier Modal */}
              <Modal
                open={modal === 'courier'}
                onClose={() => { setModal(null); setSelectedOrder(null) }}
                title="Tugaskan Kurir Pengiriman"
                size="sm"
                footer={
                  <>
                    <Button variant="secondary" onClick={() => { setModal(null); setSelectedOrder(null) }} className="w-full sm:w-auto">Batal</Button>
                    <Button loading={submitting} onClick={handleAssignCourier} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white border-0 font-bold">Tugaskan Sekarang</Button>
                  </>
                }
              >
                <div className="space-y-3">
                  <Input
                    label="Nama Kurir / Driver *"
                    value={formCourier.kurir}
                    onChange={e => setFormCourier({ kurir: e.target.value })}
                    placeholder="Contoh: Budi Santoso (Motor Beat)"
                  />
                  <p className="text-xs text-slate-400">Pesanan akan langsung dialihkan ke status &quot;DIPROSES&quot; dan siap diantar.</p>
                </div>
              </Modal>

              {/* Create Order Modal */}
              <Modal
                open={modal === 'order'}
                onClose={() => { setModal(null); resetFormOrder() }}
                title="Buat Pengiriman Delivery Baru"
                size="md"
                footer={
                  <>
                    <Button variant="secondary" onClick={() => { setModal(null); resetFormOrder() }} className="w-full sm:w-auto">Batal</Button>
                    <Button loading={submitting} onClick={handleSaveOrder} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white border-0 font-bold">Simpan & Proses</Button>
                  </>
                }
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Nama Penerima *" value={formOrder.nama_penerima} onChange={e => setFormOrder(prev => ({ ...prev, nama_penerima: e.target.value }))} placeholder="Nama Pelanggan" />
                    <Input label="No Telepon / WhatsApp *" value={formOrder.no_telp_penerima} onChange={e => setFormOrder(prev => ({ ...prev, no_telp_penerima: e.target.value }))} placeholder="08123456789" />
                  </div>
                  <Input label="Kode Transaksi Kasir (Opsional)" value={formOrder.kd_transaksi} onChange={e => setFormOrder(prev => ({ ...prev, kd_transaksi: e.target.value }))} placeholder="TRX..." />
                  <Textarea label="Alamat Lengkap Tujuan *" value={formOrder.alamat} onChange={e => setFormOrder(prev => ({ ...prev, alamat: e.target.value }))} placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan..." />
                  <Input label="Catatan Patokan Alamat" value={formOrder.catatan_alamat} onChange={e => setFormOrder(prev => ({ ...prev, catatan_alamat: e.target.value }))} placeholder="Depan musholla / pagar hitam" />
                  <Input label="Biaya Ongkir (Rp)" type="number" value={formOrder.biaya_ongkir} onChange={e => setFormOrder(prev => ({ ...prev, biaya_ongkir: e.target.value }))} placeholder="10000" />
                </div>
              </Modal>
            </>
          )}

          {tab === 'vehicles' && (
            <>
              {/* Vehicles Controls */}
              <div className="flex justify-end">
                <Button icon={<Plus size={16} />} onClick={() => { setEditVehicle(null); resetFormVehicle(); setModal('vehicle') }} className="bg-primary-600 hover:bg-primary-700 text-white border-0 font-bold">
                  Tambah Kendaraan Armada
                </Button>
              </div>

              {/* Vehicles List */}
              <Card title="Daftar Armada & Kendaraan Kurir">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama Armada</th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Plat Nomor</th>
                          <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Jenis</th>
                          <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Kapasitas</th>
                          <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Tarif / km</th>
                          <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                          <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {vehicles.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 sm:px-4 py-10 text-center text-slate-400">Belum ada armada kendaraan terdaftar</td>
                          </tr>
                        ) : (
                          vehicles.map(v => (
                            <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="px-3 sm:px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{v.nama_kendaraan}</td>
                              <td className="px-3 sm:px-4 py-3 font-mono font-bold text-slate-600 dark:text-slate-300">{v.plat_nomor}</td>
                              <td className="px-3 sm:px-4 py-3 text-center text-slate-600 dark:text-slate-300">{v.jenis}</td>
                              <td className="px-3 sm:px-4 py-3 text-center text-slate-600 dark:text-slate-300">{v.kapasitas_kg} kg</td>
                              <td className="px-3 sm:px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatRupiah(v.biaya_per_km ?? 0)}</td>
                              <td className="px-3 sm:px-4 py-3 text-center">
                                <Badge label={v.status} variant={v.status === 'AKTIF' ? 'green' : 'red'} />
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => { setEditVehicle(v); resetFormVehicle(v); setModal('vehicle') }}
                                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors"
                                    title="Edit Armada"
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteVehicle(v)}
                                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 transition-colors"
                                    title="Hapus Armada"
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
                </div>
              </Card>

              {/* Vehicle Form Modal */}
              <Modal
                open={modal === 'vehicle'}
                onClose={() => { setModal(null); setEditVehicle(null) }}
                title={editVehicle ? 'Edit Data Kendaraan' : 'Tambah Armada Kendaraan Baru'}
                size="md"
                footer={
                  <>
                    <Button variant="secondary" onClick={() => { setModal(null); setEditVehicle(null) }} className="w-full sm:w-auto">Batal</Button>
                    <Button loading={submitting} onClick={handleSaveVehicle} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white border-0 font-bold">{editVehicle ? 'Simpan Perubahan' : 'Tambah Armada'}</Button>
                  </>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Nama Kendaraan / Motor *" value={formVehicle.nama_kendaraan} onChange={e => setFormVehicle(prev => ({ ...prev, nama_kendaraan: e.target.value }))} placeholder="Honda Beat Operasional" />
                  <Input label="Plat Nomor *" value={formVehicle.plat_nomor} onChange={e => setFormVehicle(prev => ({ ...prev, plat_nomor: e.target.value }))} placeholder="B 1234 XYZ" />
                  <Input label="Jenis Kendaraan *" value={formVehicle.jenis} onChange={e => setFormVehicle(prev => ({ ...prev, jenis: e.target.value }))} placeholder="Motor / Mobil Box" />
                  <Input label="Kapasitas Angkut (Kg)" type="number" value={formVehicle.kapasitas_kg} onChange={e => setFormVehicle(prev => ({ ...prev, kapasitas_kg: e.target.value }))} placeholder="50" />
                  <Input label="Tarif / Biaya per Km (Rp)" type="number" value={formVehicle.biaya_per_km} onChange={e => setFormVehicle(prev => ({ ...prev, biaya_per_km: e.target.value }))} placeholder="3000" />
                  <Select label="Status Operasional" value={formVehicle.status} onChange={e => setFormVehicle(prev => ({ ...prev, status: e.target.value as 'AKTIF' | 'NONAKTIF' }))} options={[{ value: 'AKTIF', label: 'Aktif (Siap Jalan)' }, { value: 'NONAKTIF', label: 'Nonaktif (Servis/Rusak)' }]} />
                </div>
              </Modal>

              <ConfirmDialog
                open={!!deleteVehicle}
                onClose={() => setDeleteVehicle(null)}
                onConfirm={handleDeleteVehicle}
                title="Hapus Kendaraan"
                message={`Apakah Anda yakin ingin menghapus armada "${deleteVehicle?.nama_kendaraan ?? ''}"?`}
                confirmText="Hapus Kendaraan"
                variant="danger"
                loading={submitting}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

