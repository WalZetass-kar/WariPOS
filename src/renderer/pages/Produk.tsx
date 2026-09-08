import { useCallback, useEffect, useRef, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Barcode, AlertTriangle, Image as ImageIcon, X, Upload, Camera, ScanLine, Copy, Package } from 'lucide-react'
import Barcode_ from 'react-barcode'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import ProductImage from '../components/ProductImage'
import Select from '../components/Select'
import Textarea from '../components/Textarea'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonPage } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { ensureCameraPermission } from '../utils/nativePermissions'
import { useDebounce } from '../hooks/useDebounce'
import { useUndo } from '../hooks/useUndo'
import type { Barang, IpcResponse, Kategori, Satuan } from '../../shared/types'

interface FormState {
  kd_barang: string
  nama_barang: string
  stok: number | ''
  harga_barang: number | ''
  harga_modal: number | ''
  potongan: number | ''
  kd_kategori_barang: number
  kd_satuan: number
  deskripsi_barang: string
  barcode: string
  expired_date: string
  foto_barang: string
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

type PaginatedResponse<T> = IpcResponse<T> & { pagination?: PaginationMeta }

const EMPTY: FormState = {
  kd_barang: '', nama_barang: '', stok: '', harga_barang: '', harga_modal: '',
  potongan: 0, kd_kategori_barang: 0, kd_satuan: 0, deskripsi_barang: '',
  barcode: '', expired_date: '', foto_barang: '',
}

function getExpiredStatus(expired_date: string | null) {
  if (!expired_date) return null
  const today = new Date()
  const exp = new Date(expired_date)
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'soon'
  return 'ok'
}

export default function Produk() {
  const toast = useToast()
  const { showUndo } = useUndo()
  const [data, setData] = useState<Barang[]>([])
  const [kategori, setKategori] = useState<Kategori[]>([])
  const [satuan, setSatuan] = useState<Satuan[]>([])
  const [modal, setModal] = useState<'add' | 'edit' | 'barcode' | null>(null)
  const [modalTab, setModalTab] = useState<'info' | 'media'>('info')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<FormState>({ ...EMPTY })
  const [selected, setSelected] = useState<Barang | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [showImport, setShowImport] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [productPageIndex, setProductPageIndex] = useState(0)
  const [productPageSize, setProductPageSize] = useState(25)
  const [productSearch, setProductSearch] = useState('')
  const debouncedSearch = useDebounce(productSearch, 300)
  const [productSortBy, setProductSortBy] = useState('nama_barang')
  const [productSortOrder, setProductSortOrder] = useState<'ASC' | 'DESC'>('ASC')
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false)
  const [cameraScannerError, setCameraScannerError] = useState('')
  const [cameraScannerStatus, setCameraScannerStatus] = useState('Menyiapkan kamera...')
  const [productPagination, setProductPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  })

  const loadProducts = useCallback(async () => {
    setTableLoading(true)
    try {
      const r = await api<Barang[]>('barang:getPaginated', {
        page: productPageIndex + 1,
        limit: productPageSize,
        search: debouncedSearch,
        sortBy: productSortBy,
        sortOrder: productSortOrder,
      }) as PaginatedResponse<Barang[]>
      if (r.success) {
        setData(r.data ?? [])
        setProductPagination(r.pagination ?? {
          page: productPageIndex + 1,
          limit: productPageSize,
          total: r.data?.length ?? 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: productPageIndex > 0,
        })
      }
    } finally {
      setTableLoading(false)
      setLoadingData(false)
    }
  }, [productPageIndex, productPageSize, debouncedSearch, productSortBy, productSortOrder])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    const loadLookups = async () => {
      const [r2, r3] = await Promise.all([
        api<Kategori[]>('kategori:getAll'),
        api<Satuan[]>('satuan:getAll'),
      ])
      if (r2.success) setKategori(r2.data ?? [])
      if (r3.success) setSatuan(r3.data ?? [])
    }
    loadLookups()
  }, [])

  const openAdd = () => { setForm({ ...EMPTY }); setModalTab('info'); setModal('add'); setFormErrors({}) }
  const openEdit = (row: Barang) => {
    setSelected(row)
    setForm({
      kd_barang: row.kd_barang,
      nama_barang: row.nama_barang ?? '',
      stok: row.stok ?? 0,
      harga_barang: row.harga_barang ?? 0,
      harga_modal: row.harga_modal ?? 0,
      potongan: row.potongan ?? 0,
      kd_kategori_barang: row.kd_kategori_barang ?? 0,
      kd_satuan: row.kd_satuan ?? 0,
      deskripsi_barang: row.deskripsi_barang ?? '',
      barcode: row.barcode ?? '',
      expired_date: row.expired_date ?? '',
      foto_barang: row.foto_barang ?? '',
    })
    setModalTab('info')
    setModal('edit')
  }
  const openBarcode = (row: Barang) => { setSelected(row); setModal('barcode') }
  const openDelete = (row: Barang) => { setSelected(row); setConfirmDelete(true) }
  const closeModal = () => { setModal(null); setSelected(null) }

  const stopCameraScanner = useCallback(() => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
    cameraStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraScannerOpen(false)
  }, [])

  useEffect(() => stopCameraScanner, [stopCameraScanner])

  const handleCameraBarcode = useCallback((barcode: string) => {
    setForm(prev => ({ ...prev, barcode }))
    toast(`Barcode ${barcode} berhasil dipindai`)
    stopCameraScanner()
  }, [stopCameraScanner, toast])

  const openCameraScanner = async () => {
    const permission = await ensureCameraPermission()
    if (!permission.granted) {
      toast(permission.message ?? 'Izin kamera ditolak', 'error')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Kamera tidak tersedia di perangkat ini', 'error')
      return
    }

    setCameraScannerError('')
    setCameraScannerStatus('Menyiapkan kamera...')
    setCameraScannerOpen(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector
      if (!BarcodeDetectorCtor) {
        setCameraScannerError('Pemindai barcode kamera belum didukung oleh WebView ini. Gunakan scanner Bluetooth/USB atau ketik barcode.')
        return
      }

      const detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      })
      setCameraScannerStatus('Arahkan kamera ke barcode produk')

      scanIntervalRef.current = window.setInterval(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return

        try {
          const codes = await detector.detect(video)
          const rawValue = codes?.[0]?.rawValue
          if (rawValue) handleCameraBarcode(String(rawValue).trim())
        } catch (error) {
          setCameraScannerError(error instanceof Error ? error.message : 'Gagal membaca barcode')
        }
      }, 500)
    } catch (error) {
      setCameraScannerError(error instanceof Error ? error.message : 'Gagal membuka kamera')
    }
  }

  const handleSave = async () => {
    const harga_barang = form.harga_barang === '' ? 0 : Number(form.harga_barang)
    const harga_modal = form.harga_modal === '' ? 0 : Number(form.harga_modal)
    const stok = form.stok === '' ? 0 : Number(form.stok)
    const potongan = form.potongan === '' ? 0 : Number(form.potongan)

    const errors: Record<string, string> = {}
    if (!form.kd_barang) errors.kd_barang = 'Kode barang wajib diisi'
    if (!form.nama_barang) errors.nama_barang = 'Nama barang wajib diisi'
    if (harga_barang < 0) errors.harga_barang = 'Harga tidak boleh negatif'
    if (harga_modal < 0) errors.harga_modal = 'Harga modal tidak boleh negatif'
    if (stok < 0) errors.stok = 'Stok tidak boleh negatif'
    if (potongan < 0 || potongan > 100) errors.potongan = 'Diskon 0-100%'
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }

    const sanitizedPayload = {
      ...form,
      harga_barang,
      harga_modal,
      stok,
      potongan,
    }

    setLoading(true)
    try {
      const r = modal === 'add'
        ? await api('barang:create', sanitizedPayload)
        : await api('barang:update', selected?.kd_barang, sanitizedPayload)
      if (r.success) {
        toast(r.message as string)
        closeModal()
        if (modal === 'add') setProductPageIndex(0)
        loadProducts()
      }
      else toast(r.message as string, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    const deletedProduct = { ...selected }
    setLoading(true)
    try {
      const r = await api('barang:delete', selected.kd_barang)
      if (r.success) {
        setConfirmDelete(false)
        setSelected(null)
        loadProducts()
        showUndo(`"${deletedProduct.nama_barang}" dihapus`, async () => {
          await api('barang:create', {
            kd_barang: deletedProduct.kd_barang,
            nama_barang: deletedProduct.nama_barang ?? '',
            stok: deletedProduct.stok ?? 0,
            harga_barang: deletedProduct.harga_barang ?? 0,
            harga_modal: deletedProduct.harga_modal ?? 0,
            potongan: deletedProduct.potongan ?? 0,
            kd_kategori_barang: deletedProduct.kd_kategori_barang ?? 0,
            kd_satuan: deletedProduct.kd_satuan ?? 0,
            deskripsi_barang: deletedProduct.deskripsi_barang ?? '',
            barcode: deletedProduct.barcode ?? '',
            expired_date: deletedProduct.expired_date ?? '',
            foto_barang: deletedProduct.foto_barang ?? '',
          })
          loadProducts()
        })
      }
      else toast(r.message as string, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async (row: Barang) => {
    const newCode = `${row.kd_barang}_COPY`
    setLoading(true)
    try {
      const r = await api('barang:create', {
        kd_barang: newCode,
        nama_barang: `${row.nama_barang ?? ''} (Copy)`,
        stok: 0,
        harga_barang: row.harga_barang ?? 0,
        harga_modal: row.harga_modal ?? 0,
        potongan: row.potongan ?? 0,
        kd_kategori_barang: row.kd_kategori_barang ?? 0,
        kd_satuan: row.kd_satuan ?? 0,
        deskripsi_barang: row.deskripsi_barang ?? '',
        barcode: '',
        expired_date: row.expired_date ?? '',
        foto_barang: row.foto_barang ?? '',
      })
      if (r.success) {
        toast(`Produk "${row.nama_barang}" berhasil diduplikasi sebagai ${newCode}`, 'success')
        setProductPageIndex(0)
        loadProducts()
      } else {
        toast(r.message as string ?? 'Gagal menduplikasi produk', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return toast('Format CSV tidak valid', 'error')

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            current += '"'
            i++
          } else if (ch === '"') {
            inQuotes = false
          } else {
            current += ch
          }
        } else {
          if (ch === '"') {
            inQuotes = true
          } else if (ch === ',') {
            result.push(current.trim())
            current = ''
          } else {
            current += ch
          }
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase())
    const products: Record<string, unknown>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i])
      const row: Record<string, unknown> = {}
      headers.forEach((h, idx) => {
        const val = values[idx] || ''
        row[h] = h === 'stok' || h === 'harga_barang' || h === 'harga_modal' || h === 'potongan' || h === 'kd_kategori_barang' || h === 'kd_satuan'
          ? parseFloat(val) || 0
          : val
      })
      products.push(row)
    }

    setLoading(true)
    const r = await api('barang:bulkImport', products)
    setLoading(false)
    if (r.success) {
      toast(r.message as string)
      setShowImport(false)
      setProductPageIndex(0)
      loadProducts()
    }
    else toast(r.message as string, 'error')
  }

  const columns: ColumnDef<Barang>[] = [
    { accessorKey: 'kd_barang', header: 'Kode', size: 120 },
    {
      accessorKey: 'foto_barang', header: 'Foto', size: 80,
      cell: ({ getValue }) => (
        <ProductImage src={getValue() as string | null} className="w-10 h-10 rounded-lg" iconSize={16} />
      ),
    },
    { accessorKey: 'nama_barang', header: 'Nama Produk' },
    {
      accessorKey: 'kategori_barang', header: 'Kategori',
      cell: ({ getValue }) => <Badge label={String(getValue() ?? '-')} variant="blue" />,
    },
    {
      accessorKey: 'harga_barang', header: 'Harga Jual',
      cell: ({ getValue }) => <span className="font-extrabold text-red-600 dark:text-red-400">{formatRupiah(getValue() as number)}</span>,
    },
    {
      accessorKey: 'stok', header: 'Stok',
      cell: ({ getValue }) => {
        const v = getValue() as number
        return <Badge label={`${v} Unit`} variant={v <= 5 ? 'red' : v <= 20 ? 'yellow' : 'green'} />
      },
    },
    {
      accessorKey: 'expired_date', header: 'Expired Date',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        if (!v) return <span className="text-slate-400 text-xs">-</span>
        const status = getExpiredStatus(v)
        const label = new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
        if (status === 'expired') return <Badge label={`Expired: ${label}`} variant="red" />
        if (status === 'soon') return <Badge label={`Segera: ${label}`} variant="yellow" />
        return <span className="text-xs text-slate-500 font-medium">{label}</span>
      },
    },
    {
      id: 'actions', header: 'Aksi',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openBarcode(row.original)} aria-label={`Lihat barcode ${row.original.nama_barang}`} title="Lihat Barcode" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <Barcode size={15} />
          </button>
          <button onClick={() => handleDuplicate(row.original)} aria-label={`Duplikasi ${row.original.nama_barang}`} title="Duplikasi Produk" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors">
            <Copy size={15} />
          </button>
          <button onClick={() => openEdit(row.original)} aria-label={`Edit ${row.original.nama_barang}`} title="Edit Produk" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={() => openDelete(row.original)} aria-label={`Hapus ${row.original.nama_barang}`} title="Hapus Produk" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const f = (k: keyof FormState, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast('File harus berupa gambar', 'error')
      return
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast('Ukuran gambar maksimal 2MB', 'error')
      return
    }
    
    const reader = new FileReader()
    reader.onload = () => {
      f('foto_barang', reader.result as string)
    }
    reader.readAsDataURL(file)
    e.currentTarget.value = ''
  }

  const expiredCount = data.filter(d => getExpiredStatus(d.expired_date) === 'expired').length
  const soonCount = data.filter(d => getExpiredStatus(d.expired_date) === 'soon').length

  return (
    <div className="space-y-4 select-none">
      {loadingData ? (
        <SkeletonPage rows={7} />
      ) : (
        <>
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Katalog & Inventaris Produk</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-red-600/10 text-red-600 dark:bg-red-950/60 dark:text-red-400 text-[11px] font-bold border border-red-600/20">
                  {productPagination.total} Total Barang
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Kelola data barang, harga jual, stok minimum, barcode, dan tanggal kedaluwarsa produk.
              </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                icon={<Upload size={16} />}
                onClick={() => setShowImport(true)}
                className="w-full sm:w-auto font-bold border-slate-200 dark:border-slate-800"
              >
                Import CSV
              </Button>
              <Button
                icon={<Plus size={16} />}
                onClick={openAdd}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold border-0 shadow-md shadow-red-600/20"
              >
                Tambah Produk Baru
              </Button>
            </div>
          </div>

          {/* Expired Warning Banner */}
          {(expiredCount > 0 || soonCount > 0) && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-medium">
              <AlertTriangle size={18} className="shrink-0 text-amber-600" />
              <span>
                {expiredCount > 0 && <strong>{expiredCount} produk di halaman ini sudah kedaluwarsa. </strong>}
                {soonCount > 0 && <strong>{soonCount} produk akan kedaluwarsa dalam 30 hari ke depan.</strong>}
              </span>
            </div>
          )}

          {/* DataTable Card */}
          <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <DataTable
              data={data}
              columns={columns}
              searchPlaceholder="Cari produk berdasarkan nama, kode atau barcode..."
              defaultPageSize={25}
              manualPagination
              totalRows={productPagination.total}
              pageCount={productPagination.totalPages}
              pageIndex={productPageIndex}
              pageSize={productPageSize}
              loading={tableLoading}
              onPageChange={setProductPageIndex}
              onPageSizeChange={setProductPageSize}
              onSearchChange={search => {
                setProductSearch(search)
                setProductPageIndex(0)
              }}
              onSortChange={(sortBy, sortOrder) => {
                setProductSortBy(sortBy || 'nama_barang')
                setProductSortOrder(sortOrder)
                setProductPageIndex(0)
              }}
            />
          </Card>
        </>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={closeModal}
        title={modal === 'add' ? 'Tambah Produk Baru' : 'Edit Data Produk'}
        size="lg"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {modalTab === 'media' ? (
                <Button variant="secondary" onClick={() => setModalTab('info')} className="w-full sm:w-auto font-bold text-xs">
                  ← Kembali ke Data Utama
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setModalTab('media')} className="w-full sm:w-auto font-bold text-xs">
                  Lanjut ke Barcode & Foto →
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto font-bold text-xs">Batal</Button>
              <Button loading={loading} onClick={handleSave} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold text-xs border-0">Simpan Data Produk</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Modal Tab Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setModalTab('info')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                modalTab === 'info'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package size={14} />
              <span>1. Data Utama & Harga</span>
            </button>
            <button
              type="button"
              onClick={() => setModalTab('media')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                modalTab === 'media'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Barcode size={14} />
              <span>2. Barcode & Media</span>
            </button>
          </div>

          {/* TAB 1: INFORMASI UTAMA & HARGA */}
          {modalTab === 'info' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <Input label="Kode Barang *" value={form.kd_barang} onChange={e => f('kd_barang', e.target.value)} disabled={modal === 'edit'} error={formErrors.kd_barang} />
              <Input label="Nama Barang *" value={form.nama_barang} onChange={e => f('nama_barang', e.target.value)} error={formErrors.nama_barang} />
              <Select
                label="Kategori Produk"
                value={form.kd_kategori_barang}
                onChange={e => f('kd_kategori_barang', +e.target.value)}
                placeholder="-- Pilih Kategori --"
                options={kategori.map(k => ({ value: k.kd_kategori_barang, label: k.kategori_barang ?? '' }))}
              />
              <Select
                label="Satuan Unit"
                value={form.kd_satuan}
                onChange={e => f('kd_satuan', +e.target.value)}
                placeholder="-- Pilih Satuan --"
                options={satuan.map(s => ({ value: s.kd_satuan, label: s.nama_satuan ?? '' }))}
              />
              <Input label="Harga Jual (Rp) *" type="number" placeholder="0" value={form.harga_barang} onChange={e => f('harga_barang', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} error={formErrors.harga_barang} />
              <Input label="Harga Modal / Beli (Rp)" type="number" placeholder="0" value={form.harga_modal} onChange={e => f('harga_modal', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} error={formErrors.harga_modal} />
              <Input label="Jumlah Stok Unit *" type="number" placeholder="0" value={form.stok} onChange={e => f('stok', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} error={formErrors.stok} />
              <Input label="Diskon Potongan (%)" type="number" placeholder="0" value={form.potongan} onChange={e => f('potongan', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} error={formErrors.potongan} />
            </div>
          )}

          {/* TAB 2: BARCODE, MEDIA & EXPIRED */}
          {modalTab === 'media' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Kode Barcode</label>
                  <div className="flex gap-2">
                    <input
                      value={form.barcode}
                      onChange={e => f('barcode', e.target.value)}
                      placeholder="Scan atau ketik barcode..."
                      className="min-w-0 flex-1 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-600/10"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<ScanLine size={16} />}
                      onClick={openCameraScanner}
                      className="shrink-0 px-3 font-bold"
                    >
                      <span className="hidden sm:inline">Scan Kamera</span>
                    </Button>
                  </div>
                </div>
                <Input label="Tanggal Kedaluwarsa (Expired)" type="date" value={form.expired_date} onChange={e => f('expired_date', e.target.value)} />
              </div>
              
              {/* Image Upload */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Foto Produk</label>
                <div className="flex gap-3 items-start p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {form.foto_barang ? (
                    <div className="relative group shrink-0">
                      <img src={form.foto_barang} alt="Preview" className="w-20 h-20 object-cover rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm" />
                      <button
                        type="button"
                        onClick={() => f('foto_barang', '')}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-red-600 text-white shadow-sm"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex items-center justify-center bg-white dark:bg-slate-900 shrink-0">
                      <ImageIcon size={28} className="text-slate-400 opacity-60" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-capture"
                    />
                    <div className="flex flex-wrap gap-2">
                      <label
                        htmlFor="image-capture"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 cursor-pointer"
                      >
                        <Camera size={14} />
                        Ambil Foto
                      </label>
                      <label
                        htmlFor="image-upload"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"
                      >
                        <ImageIcon size={14} />
                        {form.foto_barang ? 'Ganti File' : 'Upload File'}
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Mendukung JPG, PNG, GIF. Maksimal 2MB.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Textarea label="Deskripsi Produk (Opsional)" rows={2} value={form.deskripsi_barang} onChange={e => f('deskripsi_barang', e.target.value)} placeholder="Tuliskan deskripsi ringkas produk..." />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Barcode Preview Modal */}
      <Modal open={modal === 'barcode'} onClose={closeModal} title="Kode Barcode Produk" size="sm">
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="font-bold text-slate-900 dark:text-white text-sm">{selected?.nama_barang}</p>
          {selected?.barcode ? (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <Barcode_ value={selected.barcode} width={1.5} height={60} fontSize={12} />
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 space-y-2">
              <Barcode size={40} className="mx-auto opacity-30" />
              <p className="text-xs font-bold">Belum Ada Barcode untuk Produk Ini</p>
              <p className="text-[11px]">Edit produk untuk menambahkan kode barcode.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Camera Scanner Modal */}
      <Modal open={cameraScannerOpen} onClose={stopCameraScanner} title="Scan Barcode Kamera" size="md"
        footer={<Button variant="secondary" onClick={stopCameraScanner} className="w-full sm:w-auto font-bold">Tutup Kamera</Button>}
      >
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-slate-800">
            <video ref={videoRef} muted playsInline className="h-72 w-full object-cover" />
          </div>
          <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold ${
            cameraScannerError
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            <Camera size={16} className="mt-0.5 shrink-0" />
            <span>{cameraScannerError || cameraScannerStatus}</span>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => { setConfirmDelete(false); setSelected(null) }}
        onConfirm={handleDelete}
        loading={loading}
        title="Hapus Data Produk"
        message={`Apakah Anda yakin ingin menghapus produk "${selected?.nama_barang}"? Tindakan ini dapat dibatalkan melalui fitur Undo.`}
      />

      {/* Import CSV Modal */}
      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Produk dari File CSV"
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setShowImport(false)} className="w-full sm:w-auto font-bold">Batal</Button>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-bold mb-1 text-slate-900 dark:text-white">Format Kolom CSV yang Diterima:</p>
            <p className="font-mono text-[11px] text-red-600 dark:text-red-400">kd_barang, nama_barang, harga_barang, harga_modal, stok, potongan, kd_kategori_barang, kd_satuan, barcode</p>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCsv}
            className="hidden"
            id="csv-import"
          />
          <label
            htmlFor="csv-import"
            className="flex flex-col items-center justify-center gap-2 w-full p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-red-600/40 cursor-pointer transition-colors"
          >
            <Upload size={24} className="text-red-600" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Pilih File CSV Produk</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
