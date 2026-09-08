import { useEffect, useState } from 'react'
import { Calendar, Clock, Users, Phone, Mail, CheckCircle, XCircle, CalendarCheck, List, Plus, Search, RefreshCw, Edit3, Trash2, AlertTriangle, MessageCircle } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Select from '../components/Select'
import Textarea from '../components/Textarea'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatDate, formatDateTime } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

interface Reservasi {
  id: number
  nomor_reservasi: string
  nama_pelanggan: string
  no_telp?: string | null
  email?: string | null
  jumlah_tamu: number
  tgl_reservasi: string
  jam_reservasi: string
  jam_berakhir?: string | null
  table_id?: number | null
  nomor_meja?: string | null
  label_meja?: string | null
  catatan?: string | null
  status: 'MENUNGGU' | 'KONFIRMASI' | 'HADIR' | 'SELESAI' | 'BATAL'
  deposit?: number
  created_at: string
}

interface Meja {
  id: number
  nomor_meja: string
  label?: string | null
  kapasitas: number
  status: string
}

type ReservationTab = 'SEMUA' | 'MENUNGGU' | 'KONFIRMASI' | 'HADIR' | 'SELESAI' | 'BATAL'

const statusVariant: Record<string, 'yellow' | 'blue' | 'green' | 'gray' | 'red'> = {
  MENUNGGU: 'yellow',
  KONFIRMASI: 'blue',
  HADIR: 'green',
  SELESAI: 'gray',
  BATAL: 'red',
}

export default function Reservation() {
  const toast = useToast()
  const [reservations, setReservations] = useState<Reservasi[]>([])
  const [tables, setTables] = useState<Meja[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<ReservationTab>('SEMUA')
  const [modal, setModal] = useState<'add' | 'edit' | 'detail' | null>(null)
  const [selectedReservation, setSelectedReservation] = useState<Reservasi | null>(null)
  const [editReservation, setEditReservation] = useState<Reservasi | null>(null)
  const [deleteModal, setDeleteModal] = useState<Reservasi | null>(null)
  const [cancelModal, setCancelModal] = useState<Reservasi | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    nama_pelanggan: '',
    no_telp: '',
    email: '',
    jumlah_tamu: '2',
    tgl_reservasi: new Date().toISOString().split('T')[0],
    jam_reservasi: '18:00',
    table_id: '',
    catatan: '',
    status: 'MENUNGGU' as Reservasi['status'],
  })

  const load = async (isManual = false) => {
    const [r1, r2] = await Promise.all([
      api<Reservasi[]>('reservation:getAll'),
      api<Meja[]>('table:getAll'),
    ])
    if (r1.success) setReservations(r1.data ?? [])
    if (r2.success) setTables(r2.data ?? [])
    setLoading(false)
    if (isManual) toast('Data reservasi diperbarui', 'success')
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({
      nama_pelanggan: '',
      no_telp: '',
      email: '',
      jumlah_tamu: '2',
      tgl_reservasi: new Date().toISOString().split('T')[0],
      jam_reservasi: '18:00',
      table_id: '',
      catatan: '',
      status: 'MENUNGGU',
    })
    setEditReservation(null)
  }

  const openEdit = (res: Reservasi) => {
    setEditReservation(res)
    setForm({
      nama_pelanggan: res.nama_pelanggan || '',
      no_telp: res.no_telp || '',
      email: res.email || '',
      jumlah_tamu: String(res.jumlah_tamu || 2),
      tgl_reservasi: res.tgl_reservasi || new Date().toISOString().split('T')[0],
      jam_reservasi: res.jam_reservasi || '18:00',
      table_id: res.table_id ? String(res.table_id) : '',
      catatan: res.catatan || '',
      status: res.status || 'MENUNGGU',
    })
    setModal('edit')
  }

  const handleCreate = async () => {
    if (!form.nama_pelanggan.trim() || !form.no_telp.trim() || !form.tgl_reservasi || !form.jam_reservasi) {
      return toast('Nama, no telepon, tanggal dan jam wajib diisi', 'error')
    }
    setSubmitting(true)
    const payload = {
      nama_pelanggan: form.nama_pelanggan.trim(),
      no_telp: form.no_telp.trim(),
      email: form.email.trim() || null,
      jumlah_tamu: parseInt(form.jumlah_tamu) || 2,
      tgl_reservasi: form.tgl_reservasi,
      jam_reservasi: form.jam_reservasi,
      table_id: form.table_id ? parseInt(form.table_id) : null,
      catatan: form.catatan.trim() || null,
    }
    const r = await api('reservation:create', payload)
    setSubmitting(false)
    if (r.success) {
      toast('Reservasi berhasil dibuat', 'success')
      setModal(null)
      resetForm()
      load()
    } else {
      toast((r.message as string) || 'Gagal membuat reservasi', 'error')
    }
  }

  const handleSaveEdit = async () => {
    if (!editReservation) return
    if (!form.nama_pelanggan.trim() || !form.no_telp.trim() || !form.tgl_reservasi || !form.jam_reservasi) {
      return toast('Nama, no telepon, tanggal dan jam wajib diisi', 'error')
    }
    setSubmitting(true)
    const payload = {
      nama_pelanggan: form.nama_pelanggan.trim(),
      no_telp: form.no_telp.trim(),
      email: form.email.trim() || null,
      jumlah_tamu: parseInt(form.jumlah_tamu) || 2,
      tgl_reservasi: form.tgl_reservasi,
      jam_reservasi: form.jam_reservasi,
      table_id: form.table_id ? parseInt(form.table_id) : null,
      catatan: form.catatan.trim() || null,
      status: form.status,
    }
    const r = await api('reservation:update', editReservation.id, payload)
    setSubmitting(false)
    if (r.success) {
      toast('Perubahan reservasi berhasil disimpan', 'success')
      setModal(null)
      resetForm()
      load()
    } else {
      toast((r.message as string) || 'Gagal menyimpan reservasi', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setSubmitting(true)
    const r = await api('reservation:delete', deleteModal.id)
    setSubmitting(false)
    if (r.success) {
      toast(`Reservasi atas nama ${deleteModal.nama_pelanggan} berhasil dihapus`, 'success')
      setDeleteModal(null)
      load()
    } else {
      toast((r.message as string) || 'Gagal menghapus reservasi', 'error')
    }
  }

  const handleUpdateStatus = async (res: Reservasi, status: string) => {
    setSubmitting(true)
    const r = await api('reservation:updateStatus', res.id, status)
    setSubmitting(false)
    if (r.success) {
      toast(`Status reservasi ${res.nama_pelanggan} diubah ke ${status}`, 'success')
      setSelectedReservation(null)
      load()
    } else {
      toast((r.message as string) || 'Gagal mengubah status', 'error')
    }
  }

  const handleCancel = async () => {
    if (!cancelModal) return
    setSubmitting(true)
    const r = await api('reservation:cancel', cancelModal.id)
    setSubmitting(false)
    if (r.success) {
      toast('Reservasi berhasil dibatalkan', 'success')
      setCancelModal(null)
      load()
    } else {
      toast((r.message as string) || 'Gagal membatalkan reservasi', 'error')
    }
  }

  const filtered = reservations.filter(r => {
    const matchSearch =
      r.nama_pelanggan.toLowerCase().includes(search.toLowerCase()) ||
      r.nomor_reservasi.toLowerCase().includes(search.toLowerCase()) ||
      (r.no_telp && r.no_telp.includes(search))
    const matchTab = tab === 'SEMUA' || r.status === tab
    return matchSearch && matchTab
  })

  const tableOptions = tables.map(t => ({
    value: String(t.id),
    label: `${t.nomor_meja} (${t.label || '-'}) · ${t.kapasitas} org [${t.status}]`,
  }))

  const statItems = [
    { label: 'Total Reservasi', value: reservations.length, icon: <Calendar size={20} className="text-primary-500" /> },
    { label: 'Menunggu', value: reservations.filter(r => r.status === 'MENUNGGU').length, icon: <Clock size={20} className="text-amber-500" /> },
    { label: 'Tamu Hadir', value: reservations.filter(r => r.status === 'HADIR').length, icon: <CheckCircle size={20} className="text-emerald-500" /> },
    { label: 'Batal', value: reservations.filter(r => r.status === 'BATAL').length, icon: <XCircle size={20} className="text-red-500" /> },
  ]

  return (
    <div className="space-y-4">
      {loading ? (
        <>
          <SkeletonStatGrid count={4} />
          <SkeletonSpinner label="Memuat reservasi..." />
        </>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {statItems.map((s, i) => (
              <Card key={i} title={s.label} action={s.icon}>
                <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-1.5">{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto">
              {(['SEMUA', 'MENUNGGU', 'KONFIRMASI', 'HADIR', 'SELESAI', 'BATAL'] as ReservationTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                    tab === t
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Cari nama / no reservasi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 sm:w-56"
              />
              <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => load(true)}>
                Refresh
              </Button>
              <Button icon={<Plus size={15} />} onClick={() => { resetForm(); setModal('add') }} className="bg-red-600 hover:bg-red-700 text-white border-0 font-bold text-xs sm:text-sm whitespace-nowrap">
                Buat Reservasi
              </Button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <Card title="Daftar Reservasi Meja">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">No Reservasi</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Pelanggan</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">Tamu</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">Jadwal</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">Meja</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs sm:text-sm">
                          {tab === 'SEMUA' ? 'Belum ada data reservasi' : `Tidak ada reservasi berstatus ${tab}`}
                        </td>
                      </tr>
                    ) : (
                      filtered.map(res => (
                        <tr key={res.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => { setSelectedReservation(res); setModal('detail') }}>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{res.nomor_reservasi}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{res.nama_pelanggan}</p>
                            <p className="text-xs text-slate-400">{res.no_telp || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{res.jumlah_tamu} orang</td>
                          <td className="px-4 py-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300">{formatDate(res.tgl_reservasi)} · {res.jam_reservasi}</td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300">{res.nomor_meja ? `${res.nomor_meja}` : '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge label={res.status} variant={statusVariant[res.status] ?? 'gray'} />
                          </td>
                          <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {res.status === 'MENUNGGU' && (
                                <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(res, 'KONFIRMASI')} className="text-xs font-bold">
                                  Konfirmasi
                                </Button>
                              )}
                              {(res.status === 'MENUNGGU' || res.status === 'KONFIRMASI') && (
                                <Button size="sm" variant="success" icon={<CheckCircle size={13} />} onClick={() => handleUpdateStatus(res, 'HADIR')} className="text-xs font-bold">
                                  Hadir
                                </Button>
                              )}
                              {res.status === 'HADIR' && (
                                <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(res, 'SELESAI')} className="text-xs font-bold">
                                  Selesai
                                </Button>
                              )}

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => openEdit(res)}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Edit data reservasi"
                              >
                                <Edit3 size={14} />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => setDeleteModal(res)}
                                className="p-1.5 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                title="Hapus reservasi"
                              >
                                <Trash2 size={14} />
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

          {/* Mobile Card List View (Eliminates empty horizontal scroll) */}
          <div className="block sm:hidden space-y-2.5">
            {filtered.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-bold">
                {tab === 'SEMUA' ? 'Belum ada data reservasi' : `Tidak ada reservasi berstatus ${tab}`}
              </div>
            ) : (
              filtered.map(res => (
                <div
                  key={res.id}
                  onClick={() => { setSelectedReservation(res); setModal('detail') }}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">{res.nomor_reservasi}</span>
                    <Badge label={res.status} variant={statusVariant[res.status] ?? 'gray'} />
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{res.nama_pelanggan}</h4>
                      <p className="text-xs text-slate-500">{res.no_telp || '-'}</p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{res.jumlah_tamu} Tamu</span>
                      <span className="text-slate-400 text-[11px]">{res.nomor_meja ? `Meja ${res.nomor_meja}` : 'Tanpa Meja'}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl flex items-center justify-between">
                    <span>{formatDate(res.tgl_reservasi)}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Pukul {res.jam_reservasi}</span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                    {res.status === 'MENUNGGU' && (
                      <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(res, 'KONFIRMASI')} className="flex-1 text-xs font-bold">
                        Konfirmasi
                      </Button>
                    )}
                    {(res.status === 'MENUNGGU' || res.status === 'KONFIRMASI') && (
                      <Button size="sm" variant="success" icon={<CheckCircle size={13} />} onClick={() => handleUpdateStatus(res, 'HADIR')} className="flex-1 text-xs font-bold">
                        Hadir
                      </Button>
                    )}
                    {res.status === 'HADIR' && (
                      <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(res, 'SELESAI')} className="flex-1 text-xs font-bold">
                        Selesai
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(res)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteModal(res)}
                      className="p-2 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add / Edit Reservation Modal */}
          <Modal
            open={modal === 'add' || modal === 'edit'}
            onClose={() => { setModal(null); resetForm() }}
            title={modal === 'edit' ? `Edit Data Reservasi (${editReservation?.nomor_reservasi})` : 'Buat Reservasi Meja Baru'}
            size="md"
            footer={
              <>
                <Button variant="secondary" onClick={() => { setModal(null); resetForm() }} className="w-full sm:w-auto">Batal</Button>
                <Button
                  loading={submitting}
                  onClick={modal === 'edit' ? handleSaveEdit : handleCreate}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-0 font-bold"
                >
                  {modal === 'edit' ? 'Simpan Perubahan' : 'Simpan Reservasi'}
                </Button>
              </>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nama Pelanggan *" value={form.nama_pelanggan} onChange={e => setForm(prev => ({ ...prev, nama_pelanggan: e.target.value }))} placeholder="Nama Pelanggan" />
              <Input label="No Telepon / WhatsApp *" value={form.no_telp} onChange={e => setForm(prev => ({ ...prev, no_telp: e.target.value }))} placeholder="08123456789" />
              <Input label="Email (Opsional)" type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" />
              <Input label="Jumlah Tamu *" type="number" value={form.jumlah_tamu} onChange={e => setForm(prev => ({ ...prev, jumlah_tamu: e.target.value }))} placeholder="2" />
              <Input label="Tanggal Reservasi *" type="date" value={form.tgl_reservasi} onChange={e => setForm(prev => ({ ...prev, tgl_reservasi: e.target.value }))} />
              <Input label="Jam Reservasi *" type="time" value={form.jam_reservasi} onChange={e => setForm(prev => ({ ...prev, jam_reservasi: e.target.value }))} />
              
              <div className="sm:col-span-2">
                <Select label="Pilih Meja Restoran" value={form.table_id} onChange={e => setForm(prev => ({ ...prev, table_id: e.target.value }))} options={tableOptions} placeholder="Pilih Meja (Opsional)" />
              </div>

              {modal === 'edit' && (
                <div className="sm:col-span-2">
                  <Select
                    label="Status Reservasi"
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                    options={[
                      { value: 'MENUNGGU', label: 'MENUNGGU' },
                      { value: 'KONFIRMASI', label: 'KONFIRMASI' },
                      { value: 'HADIR', label: 'HADIR' },
                      { value: 'SELESAI', label: 'SELESAI' },
                      { value: 'BATAL', label: 'BATAL' },
                    ]}
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <Textarea label="Catatan Khusus (Request Tamu)" value={form.catatan} onChange={e => setForm(prev => ({ ...prev, catatan: e.target.value }))} placeholder="Dekat jendela, kursi bayi, dll..." />
              </div>
            </div>
          </Modal>

          {/* Detail Modal */}
          <Modal open={modal === 'detail' && !!selectedReservation} onClose={() => { setModal(null); setSelectedReservation(null) }} title="Detail Data Reservasi" size="sm">
            {selectedReservation && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">{selectedReservation.nomor_reservasi}</span>
                  <Badge label={selectedReservation.status} variant={statusVariant[selectedReservation.status] ?? 'gray'} />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Users size={15} className="text-slate-400" />
                    <span className="font-bold">{selectedReservation.nama_pelanggan}</span>
                    <span className="text-slate-400 font-normal">({selectedReservation.jumlah_tamu} orang)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Phone size={14} className="text-slate-400" />
                    <span>{selectedReservation.no_telp || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Calendar size={14} className="text-slate-400" />
                    <span>{formatDate(selectedReservation.tgl_reservasi)} pukul {selectedReservation.jam_reservasi}</span>
                  </div>
                  {selectedReservation.nomor_meja && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                      Meja Terkait: {selectedReservation.nomor_meja} {selectedReservation.label_meja ? `(${selectedReservation.label_meja})` : ''}
                    </div>
                  )}
                </div>
                {selectedReservation.catatan && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-bold text-slate-700 dark:text-slate-200">Catatan:</p>
                    <p>{selectedReservation.catatan}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="secondary"
                    icon={<Edit3 size={15} />}
                    onClick={() => {
                      const res = selectedReservation
                      setSelectedReservation(null)
                      openEdit(res)
                    }}
                    className="flex-1 font-bold"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={15} />}
                    onClick={() => {
                      const res = selectedReservation
                      setSelectedReservation(null)
                      setDeleteModal(res)
                    }}
                    className="flex-1 font-bold"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            )}
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            open={!!deleteModal}
            onClose={() => setDeleteModal(null)}
            title="Hapus Reservasi"
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleteModal(null)} className="w-full sm:w-auto">Batal</Button>
                <Button variant="danger" loading={submitting} onClick={handleDelete} className="w-full sm:w-auto font-bold">Ya, Hapus Reservasi</Button>
              </>
            }
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus reservasi <strong>{deleteModal?.nomor_reservasi} ({deleteModal?.nama_pelanggan})</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </Modal>

          {/* Cancel Modal */}
          <Modal
            open={!!cancelModal}
            onClose={() => setCancelModal(null)}
            title="Batalkan Reservasi"
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setCancelModal(null)} className="w-full sm:w-auto">Tutup</Button>
                <Button variant="danger" loading={submitting} onClick={handleCancel} className="w-full sm:w-auto font-bold">Ya, Batalkan</Button>
              </>
            }
          >
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Apakah Anda yakin ingin membatalkan reservasi atas nama <strong>{cancelModal?.nama_pelanggan}</strong>?
            </p>
          </Modal>
        </>
      )}
    </div>
  )
}

