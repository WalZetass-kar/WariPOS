import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'
import { LayoutGrid, Table2, Plus, Edit3, Trash2, Circle, Square, QrCode, Printer, Download, Share2, X } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Select from '../components/Select'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { generateTableStickerPdf, saveFileToDevice } from '../utils/receiptExporter'

interface FloorLayout {
  id: number
  nama: string
  kapasitas?: number
  created_at: string
}

interface Meja {
  id: number
  floor_layout_id?: number | null
  nomor_meja: string
  label?: string | null
  kapasitas: number
  posisi_x: number
  posisi_y: number
  bentuk: 'BULAT' | 'PERSEGI'
  status: 'KOSONG' | 'TERISI' | 'RESERVASI' | 'MAINTENANCE'
  qr_code?: string | null
}

interface TableSummary {
  total: number
  terisi: number
  kosong: number
  reservasi: number
  maintenance?: number
}

const statusColors: Record<string, { badge: 'green' | 'red' | 'yellow' | 'gray'; bg: string; border: string }> = {
  KOSONG: { badge: 'green', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-300 dark:border-emerald-700' },
  TERISI: { badge: 'red', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-300 dark:border-red-700' },
  RESERVASI: { badge: 'yellow', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-300 dark:border-amber-700' },
  MAINTENANCE: { badge: 'gray', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-600' },
}

export default function TableManagement() {
  const toast = useToast()
  const [tables, setTables] = useState<Meja[]>([])
  const [layouts, setLayouts] = useState<FloorLayout[]>([])
  const [summary, setSummary] = useState<TableSummary>({ total: 0, terisi: 0, kosong: 0, reservasi: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState<Meja | null>(null)
  const [modal, setModal] = useState<'table' | 'layout' | null>(null)
  const [editTable, setEditTable] = useState<Meja | null>(null)
  const [editLayout, setEditLayout] = useState<FloorLayout | null>(null)
  const [deleteTable, setDeleteTable] = useState<Meja | null>(null)
  const [deleteLayout, setDeleteLayout] = useState<FloorLayout | null>(null)
  const [qrModalTable, setQrModalTable] = useState<Meja | null>(null)
  const [qrImageSrc, setQrImageSrc] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [activeLayout, setActiveLayout] = useState<string>('')

  useEffect(() => {
    if (!qrModalTable) {
      setQrImageSrc('')
      return
    }
    const orderUrl = `https://zetasspos.app/menu?table=${encodeURIComponent(qrModalTable.nomor_meja)}&id=${qrModalTable.id}`
    toDataURL(orderUrl, { width: 320, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => setQrImageSrc(url))
      .catch(() => setQrImageSrc(''))
  }, [qrModalTable])

  const [formTable, setFormTable] = useState({
    nomor_meja: '',
    label: '',
    kapasitas: '4',
    posisi_x: '50',
    posisi_y: '50',
    bentuk: 'PERSEGI' as 'BULAT' | 'PERSEGI',
    status: 'KOSONG' as Meja['status'],
    floor_layout_id: '',
  })
  const [formLayout, setFormLayout] = useState({ nama: '', kapasitas: '' })

  const load = async () => {
    const [r1, r2, r3] = await Promise.all([
      api<Meja[]>('table:getAll'),
      api<FloorLayout[]>('floor:getAll'),
      api<any>('table:getSummary'),
    ])
    if (r1.success) setTables(r1.data ?? [])
    if (r2.success) setLayouts(r2.data ?? [])
    if (r3.success && r3.data) {
      setSummary({
        total: r3.data.total ?? 0,
        kosong: r3.data.KOSONG ?? 0,
        terisi: r3.data.TERISI ?? 0,
        reservasi: r3.data.RESERVASI ?? 0,
        maintenance: r3.data.MAINTENANCE ?? 0,
      })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resetFormTable = (meja?: Meja | null) => {
    setFormTable(meja ? {
      nomor_meja: meja.nomor_meja,
      label: meja.label ?? '',
      kapasitas: String(meja.kapasitas),
      posisi_x: String(meja.posisi_x),
      posisi_y: String(meja.posisi_y),
      bentuk: meja.bentuk,
      status: meja.status,
      floor_layout_id: meja.floor_layout_id ? String(meja.floor_layout_id) : '',
    } : {
      nomor_meja: '',
      label: '',
      kapasitas: '4',
      posisi_x: '50',
      posisi_y: '50',
      bentuk: 'PERSEGI',
      status: 'KOSONG',
      floor_layout_id: activeLayout || '',
    })
  }

  const handleSaveTable = async () => {
    if (!formTable.nomor_meja.trim()) {
      return toast('Nomor meja wajib diisi', 'error')
    }
    setSubmitting(true)
    const payload = {
      nomor_meja: formTable.nomor_meja.trim(),
      label: formTable.label.trim() || null,
      kapasitas: parseInt(formTable.kapasitas) || 4,
      posisi_x: parseInt(formTable.posisi_x) || 50,
      posisi_y: parseInt(formTable.posisi_y) || 50,
      bentuk: formTable.bentuk,
      status: formTable.status,
      floor_layout_id: formTable.floor_layout_id ? parseInt(formTable.floor_layout_id) : null,
    }
    const r = editTable
      ? await api('table:update', editTable.id, payload)
      : await api('table:create', payload)
    setSubmitting(false)
    if (r.success) {
      toast(editTable ? 'Meja diperbarui' : 'Meja ditambahkan', 'success')
      setModal(null)
      setEditTable(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleSaveLayout = async () => {
    if (!formLayout.nama.trim()) return toast('Nama layout wajib diisi', 'error')
    setSubmitting(true)
    const payload = {
      nama: formLayout.nama.trim(),
      kapasitas: parseInt(formLayout.kapasitas) || 0,
    }
    const r = editLayout
      ? await api('floor:update', editLayout.id, payload)
      : await api('floor:create', payload)
    setSubmitting(false)
    if (r.success) {
      toast(editLayout ? 'Layout diperbarui' : 'Layout ditambahkan', 'success')
      setModal(null)
      setEditLayout(null)
      setFormLayout({ nama: '', kapasitas: '' })
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleUpdateStatus = async (meja: Meja, status: Meja['status']) => {
    const r = await api('table:updateStatus', meja.id, status)
    if (r.success) {
      toast(`Status ${meja.nomor_meja} diubah menjadi ${status}`, 'success')
      setSelectedTable(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDeleteTable = async () => {
    if (!deleteTable) return
    setSubmitting(true)
    const r = await api('table:delete', deleteTable.id)
    setSubmitting(false)
    if (r.success) {
      toast('Meja dihapus', 'success')
      setDeleteTable(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDeleteLayout = async () => {
    if (!deleteLayout) return
    setSubmitting(true)
    const r = await api('floor:delete', deleteLayout.id)
    setSubmitting(false)
    if (r.success) {
      toast('Layout dihapus', 'success')
      setDeleteLayout(null)
      if (activeLayout === String(deleteLayout.id)) setActiveLayout('')
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const layoutTables = tables.filter(t => !activeLayout || String(t.floor_layout_id) === activeLayout)
  const layoutOptions = layouts.map(l => ({ value: String(l.id), label: l.nama }))

  const statItems = [
    { label: 'Total Meja', value: summary.total, icon: <Table2 size={20} className="text-primary-500" /> },
    { label: 'Terisi', value: summary.terisi, icon: <Table2 size={20} className="text-red-500" /> },
    { label: 'Kosong', value: summary.kosong, icon: <Table2 size={20} className="text-emerald-500" /> },
    { label: 'Reservasi', value: summary.reservasi, icon: <Table2 size={20} className="text-amber-500" /> },
  ]

  return (
    <div className="space-y-4">
      {loading ? (
        <>
          <SkeletonStatGrid count={4} />
          <SkeletonSpinner label="Memuat denah meja..." />
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

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Select
                value={activeLayout}
                onChange={e => setActiveLayout(e.target.value)}
                options={layoutOptions}
                placeholder="Semua Lantai / Layout"
                className="w-56"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={<LayoutGrid size={16} />} onClick={() => { setEditLayout(null); setFormLayout({ nama: '', kapasitas: '' }); setModal('layout') }}>
                Kelola Layout
              </Button>
              <Button size="sm" icon={<Plus size={16} />} onClick={() => { setEditTable(null); resetFormTable(); setModal('table') }} className="bg-red-600 hover:bg-red-700 text-white border-0">
                Tambah Meja
              </Button>
            </div>
          </div>

          {/* Floor Plan */}
          <Card title="Denah Meja Restoran" action={activeLayout && <Badge label={layouts.find(l => String(l.id) === activeLayout)?.nama ?? ''} variant="blue" />}>
            <div className="relative min-h-[160px] sm:min-h-[220px] bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 overflow-x-auto">
              {layoutTables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-slate-400 dark:text-slate-500 text-xs sm:text-sm font-semibold">Belum ada meja di layout ini. Klik &quot;Tambah Meja&quot; untuk memulai.</p>
                </div>
              ) : (
                layoutTables.map(meja => {
                  const sc = statusColors[meja.status] ?? statusColors.KOSONG
                  const isCircle = meja.bentuk === 'BULAT'
                  return (
                    <div
                      key={meja.id}
                      className={`cursor-pointer border-2 ${sc.border} ${sc.bg} rounded-2xl p-2 flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-lg inline-block m-2`}
                      style={{ width: 110, height: isCircle ? 110 : 90, borderRadius: isCircle ? '50%' : '1rem' }}
                      onClick={() => setSelectedTable(meja)}
                    >
                      {isCircle ? <Circle size={15} className="text-slate-400 mb-1" /> : <Square size={15} className="text-slate-400 mb-1" />}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-full">{meja.nomor_meja}</span>
                      <span className="text-[10px] text-slate-500">{meja.kapasitas} org · {meja.status}</span>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Table List */}
          <Card title="Daftar Meja">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[640px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nomor Meja</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Label / Ruangan</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Kapasitas</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Bentuk</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {layoutTables.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 sm:px-4 py-10 text-center text-slate-400">Belum ada data meja</td>
                      </tr>
                    ) : (
                      layoutTables.map(meja => {
                        const sc = statusColors[meja.status] ?? statusColors.KOSONG
                        return (
                          <tr key={meja.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-3 sm:px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{meja.nomor_meja}</td>
                            <td className="px-3 sm:px-4 py-3 text-slate-600 dark:text-slate-300">{meja.label || '-'}</td>
                            <td className="px-3 sm:px-4 py-3 text-center text-slate-600 dark:text-slate-300">{meja.kapasitas} orang</td>
                            <td className="px-3 sm:px-4 py-3 text-center text-slate-600 dark:text-slate-300">{meja.bentuk}</td>
                            <td className="px-3 sm:px-4 py-3 text-center">
                              <Badge label={meja.status} variant={sc.badge} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setQrModalTable(meja)}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                                  title="QR Code Meja"
                                >
                                  <QrCode size={15} />
                                </button>
                                <button
                                  onClick={() => { setEditTable(meja); resetFormTable(meja); setModal('table') }}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors"
                                  title="Edit Meja"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteTable(meja)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors"
                                  title="Hapus Meja"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Table Detail Modal */}
          <Modal open={!!selectedTable} onClose={() => setSelectedTable(null)} title={`Meja ${selectedTable?.nomor_meja ?? ''}`} size="sm">
            {selectedTable && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Status Meja</span>
                  <Badge label={selectedTable.status} variant={statusColors[selectedTable.status]?.badge ?? 'gray'} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Label / Deskripsi</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{selectedTable.label || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Kapasitas Tamu</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{selectedTable.kapasitas} orang</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Bentuk Meja</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{selectedTable.bentuk}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Ubah Status Cepat</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['KOSONG', 'TERISI', 'RESERVASI', 'MAINTENANCE'] as Meja['status'][]).map(s => (
                      <Button
                        key={s}
                        size="sm"
                        variant={selectedTable.status === s ? 'primary' : 'secondary'}
                        onClick={() => handleUpdateStatus(selectedTable, s)}
                        className="w-full text-xs font-bold"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Modal>

          {/* Table Form Modal */}
          <Modal
            open={modal === 'table'}
            onClose={() => { setModal(null); setEditTable(null) }}
            title={editTable ? 'Edit Data Meja' : 'Tambah Meja Baru'}
            size="md"
            footer={
              <>
                <Button variant="secondary" onClick={() => { setModal(null); setEditTable(null) }} className="w-full sm:w-auto">Batal</Button>
                <Button loading={submitting} onClick={handleSaveTable} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-0">{editTable ? 'Simpan Perubahan' : 'Tambah Meja'}</Button>
              </>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nomor Meja *" value={formTable.nomor_meja} onChange={e => setFormTable(prev => ({ ...prev, nomor_meja: e.target.value }))} placeholder="Meja 01" />
              <Input label="Label / Ruang" value={formTable.label} onChange={e => setFormTable(prev => ({ ...prev, label: e.target.value }))} placeholder="Depan Bar / VIP 1" />
              <Input label="Kapasitas (Orang) *" type="number" value={formTable.kapasitas} onChange={e => setFormTable(prev => ({ ...prev, kapasitas: e.target.value }))} placeholder="4" />
              <Select label="Bentuk Meja" value={formTable.bentuk} onChange={e => setFormTable(prev => ({ ...prev, bentuk: e.target.value as 'BULAT' | 'PERSEGI' }))} options={[{ value: 'BULAT', label: 'Bulat (Bundar)' }, { value: 'PERSEGI', label: 'Persegi (Kotak)' }]} />
              <Select label="Pilih Layout / Lantai" value={formTable.floor_layout_id} onChange={e => setFormTable(prev => ({ ...prev, floor_layout_id: e.target.value }))} options={layoutOptions} placeholder="Pilih Layout Lantai" />
              <Select label="Status Awal" value={formTable.status} onChange={e => setFormTable(prev => ({ ...prev, status: e.target.value as Meja['status'] }))} options={[
                { value: 'KOSONG', label: 'Kosong (Tersedia)' }, { value: 'TERISI', label: 'Terisi (Ada Tamu)' }, { value: 'RESERVASI', label: 'Reservasi' }, { value: 'MAINTENANCE', label: 'Maintenance (Rusak/Renov)' },
              ]} />
            </div>
          </Modal>

          {/* Layout Form Modal */}
          <Modal
            open={modal === 'layout'}
            onClose={() => { setModal(null); setEditLayout(null) }}
            title={editLayout ? 'Edit Layout Lantai' : 'Kelola Layout & Lantai'}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => { setModal(null); setEditLayout(null) }} className="w-full sm:w-auto">Tutup</Button>
                <Button loading={submitting} onClick={handleSaveLayout} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-0">{editLayout ? 'Simpan' : 'Tambah Layout'}</Button>
              </>
            }
          >
            <div className="space-y-3">
              <Input label="Nama Layout / Lantai *" value={formLayout.nama} onChange={e => setFormLayout(prev => ({ ...prev, nama: e.target.value }))} placeholder="Lantai 1 - Indoor AC" />
              <Input label="Estimasi Kapasitas Total" type="number" value={formLayout.kapasitas} onChange={e => setFormLayout(prev => ({ ...prev, kapasitas: e.target.value }))} placeholder="50" />

              {layouts.length > 0 && (
                <div className="mt-4 space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 uppercase">Daftar Layout Aktif</p>
                  {layouts.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{l.nama}</p>
                        <p className="text-[10px] text-slate-400">{l.kapasitas ?? 0} kapasitas tamu</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditLayout(l); setFormLayout({ nama: l.nama, kapasitas: String(l.kapasitas ?? '') }) }}
                          className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteLayout(l)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modal>

          {/* Table QR Code Modal */}
          <Modal
            open={!!qrModalTable}
            onClose={() => setQrModalTable(null)}
            title={`QR Code Order ${qrModalTable?.nomor_meja ?? ''}`}
            size="sm"
            footer={
              <div className="flex gap-2 w-full">
                {qrImageSrc && (
                  <a
                    href={qrImageSrc}
                    download={`QR-Meja-${qrModalTable?.nomor_meja ?? 'Meja'}.png`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
                  >
                    <Download size={14} />
                    <span>Download PNG</span>
                  </a>
                )}
                <Button
                  variant="secondary"
                  icon={<Printer size={14} />}
                  onClick={async () => {
                    if (qrModalTable && qrImageSrc) {
                      try {
                        const pdfBlob = await generateTableStickerPdf(qrModalTable.nomor_meja, qrImageSrc, 'WARIPOS')
                        await saveFileToDevice(`Stiker-Meja-${qrModalTable.nomor_meja}.pdf`, pdfBlob, 'application/pdf')
                        toast(`Stiker Meja ${qrModalTable.nomor_meja} disimpan sebagai PDF`, 'success')
                      } catch (err) {
                        console.warn('PDF export fallback:', err)
                      }
                      const printWindow = window.open('', '_blank', 'width=450,height=600')
                      if (!printWindow) {
                        window.print()
                        return
                      }
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>Stiker Meja ${qrModalTable.nomor_meja}</title>
                            <style>
                              @page { size: auto; margin: 0; }
                              body {
                                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                                margin: 0;
                                padding: 24px;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                text-align: center;
                                background: #fff;
                                color: #0f172a;
                              }
                              .card {
                                border: 3px solid #0f172a;
                                border-radius: 20px;
                                padding: 24px 28px;
                                max-width: 320px;
                                box-sizing: border-box;
                              }
                              .store-title {
                                font-size: 13px;
                                font-weight: 800;
                                letter-spacing: 1.5px;
                                text-transform: uppercase;
                                color: #64748b;
                                margin-bottom: 4px;
                              }
                              .table-number {
                                font-size: 32px;
                                font-weight: 900;
                                margin: 0 0 10px 0;
                                letter-spacing: -0.5px;
                              }
                              .qr-wrapper {
                                margin: 10px 0;
                                display: inline-block;
                              }
                              .qr-image {
                                width: 200px;
                                height: 200px;
                                border-radius: 12px;
                              }
                              .instruction {
                                font-size: 13px;
                                font-weight: 800;
                                color: #dc2626;
                                margin-top: 10px;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                              }
                              .subtext {
                                font-size: 11px;
                                color: #64748b;
                                margin-top: 4px;
                              }
                            </style>
                          </head>
                          <body>
                            <div class="card">
                              <div class="store-title">WariPOS & Resto</div>
                              <div class="table-number">${qrModalTable.nomor_meja}</div>
                              <div class="qr-wrapper">
                                <img src="${qrImageSrc}" class="qr-image" alt="QR Code Meja" />
                              </div>
                              <div class="instruction">Scan untuk Lihat Menu & Order</div>
                              <div class="subtext">${qrModalTable.label || 'Meja Restoran'} · Kapasitas ${qrModalTable.kapasitas} Orang</div>
                            </div>
                            <script>
                              window.onload = function() {
                                window.focus();
                                window.print();
                              };
                            </script>
                          </body>
                        </html>
                      `)
                      printWindow.document.close()
                    } else {
                      window.print()
                    }
                  }}
                  className="flex-1 font-bold text-xs"
                >
                  Cetak Stiker
                </Button>
              </div>
            }
          >
            {qrModalTable && (
              <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-md inline-block">
                  {qrImageSrc ? (
                    <img src={qrImageSrc} alt={`QR Meja ${qrModalTable.nomor_meja}`} className="w-48 h-48 rounded-xl object-contain mx-auto" />
                  ) : (
                    <QrCode size={180} className="text-slate-900" />
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{qrModalTable.nomor_meja}</h4>
                  <p className="text-xs text-slate-500 font-medium">{qrModalTable.label || 'Meja Restoran'} · Kapasitas {qrModalTable.kapasitas} orang</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400 font-bold">
                    <span>Scan untuk pesan menu & self-order</span>
                  </div>
                </div>
              </div>
            )}
          </Modal>

          <ConfirmDialog
            open={!!deleteTable}
            onClose={() => setDeleteTable(null)}
            onConfirm={handleDeleteTable}
            title="Hapus Meja"
            message={`Apakah Anda yakin ingin menghapus Meja ${deleteTable?.nomor_meja ?? ''}?`}
            confirmText="Hapus Meja"
            variant="danger"
            loading={submitting}
          />

          <ConfirmDialog
            open={!!deleteLayout}
            onClose={() => setDeleteLayout(null)}
            onConfirm={handleDeleteLayout}
            title="Hapus Layout"
            message={`Apakah Anda yakin ingin menghapus layout ${deleteLayout?.nama ?? ''}? Meja terkait akan di-set tanpa layout.`}
            confirmText="Hapus Layout"
            variant="danger"
            loading={submitting}
          />
        </>
      )}
    </div>
  )
}

