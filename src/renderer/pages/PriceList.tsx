import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Search, Printer, FileText, Edit3, Tag, ExternalLink, Check } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { FilterBarSkeleton, PriceListSkeleton } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import type { Kategori } from '../../shared/types'

interface ProductItem {
  kd_barang: string
  nama_barang: string | null
  harga_barang: number
  stok: number
  kategori_barang: string | null
  barcode: string | null
}

export default function PriceList() {
  const navigate = useNavigate()
  const toast = useToast()
  const [products, setProducts] = useState<ProductItem[]>([])
  const [kategori, setKategori] = useState<Kategori[]>([])
  const [loading, setLoading] = useState(true)
  const [kdKategori, setKdKategori] = useState<number>(0)
  const [search, setSearch] = useState('')

  // Quick edit price modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null)
  const [newPrice, setNewPrice] = useState<number | string>('')
  const [savingPrice, setSavingPrice] = useState(false)

  // Shelf label modal
  const [labelModalOpen, setLabelModalOpen] = useState(false)
  const [labelProduct, setLabelProduct] = useState<ProductItem | null>(null)
  const labelRef = useRef<HTMLDivElement | null>(null)

  const loadKategori = useCallback(async () => {
    const r = await api<Kategori[]>('kategori:getAll')
    if (r.success) setKategori(r.data ?? [])
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const r = await api<ProductItem[]>('priceList:get', kdKategori, search)
    if (r.success) setProducts(r.data ?? [])
    setLoading(false)
  }, [kdKategori, search])

  useEffect(() => { loadKategori() }, [loadKategori])
  useEffect(() => { loadProducts() }, [loadProducts])

  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = async () => {
    const r = await api('export:priceListPDF', products, kdKategori ? kategori.find(k => k.kd_kategori_barang === kdKategori)?.kategori_barang : 'Semua')
    if (r.success) {
      toast(r.message || 'Price list berhasil di-export', 'success')
    } else {
      toast(r.message as string ?? 'Export gagal', 'error')
    }
  }

  const openQuickEdit = (p: ProductItem) => {
    setSelectedProduct(p)
    setNewPrice(p.harga_barang)
    setEditModalOpen(true)
  }

  const handleSavePrice = async () => {
    if (!selectedProduct) return
    const priceNumber = Number(newPrice)
    if (isNaN(priceNumber) || priceNumber < 0) {
      toast('Harga produk tidak valid', 'error')
      return
    }

    setSavingPrice(true)
    try {
      const r = await api('barang:update', selectedProduct.kd_barang, { harga_barang: priceNumber })
      if (r.success) {
        toast(`Harga ${selectedProduct.nama_barang || selectedProduct.kd_barang} berhasil diubah ke ${formatRupiah(priceNumber)}`, 'success')
        setEditModalOpen(false)
        await loadProducts()
      } else {
        toast((r.message as string) || 'Gagal mengubah harga produk', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem saat update harga', 'error')
    } finally {
      setSavingPrice(false)
    }
  }

  const openShelfLabel = (p: ProductItem) => {
    setLabelProduct(p)
    setLabelModalOpen(true)
  }

  const handlePrintLabel = () => {
    if (!labelRef.current) return
    window.print()
  }

  const goToProductMaster = (p: ProductItem) => {
    navigate(`/produk?search=${encodeURIComponent(p.nama_barang || p.kd_barang)}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white shadow-sm">
          <ClipboardList size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Daftar Harga (Price List)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pantau dan kelola harga jual produk, cetak label rak, dan update harga cepat</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <Select
            label="Kategori"
            value={kdKategori}
            onChange={e => setKdKategori(+e.target.value)}
            placeholder="Semua Kategori"
            options={[{ value: 0, label: 'Semua Kategori' }, ...kategori.map(k => ({ value: k.kd_kategori_barang, label: k.kategori_barang ?? '' }))]}
            className="w-full sm:w-48"
          />
          <div className="flex-1 w-full">
            <Input placeholder="Cari kode atau nama produk..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={14} />} />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="secondary" icon={<Printer size={14} />} onClick={handlePrint} className="flex-1 sm:flex-none">Cetak</Button>
            <Button variant="secondary" icon={<FileText size={14} />} onClick={handleExportPDF} className="flex-1 sm:flex-none">Export PDF</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{products.length} produk terdaftar</p>
          <p className="text-xs text-slate-400">
            {kdKategori ? kategori.find(k => k.kd_kategori_barang === kdKategori)?.kategori_barang : 'Semua Kategori'}
            {' · '}{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {loading ? (
          <PriceListSkeleton rows={8} />
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ClipboardList size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Tidak ada produk ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm min-w-[650px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-10">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kategori</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Stok</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Harga Jual</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {products.map((p, i) => (
                  <tr key={p.kd_barang} className={`hover:bg-primary-50/40 dark:hover:bg-slate-700/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{p.kd_barang}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{p.nama_barang}</td>
                    <td className="px-4 py-2.5"><Badge label={p.kategori_barang ?? '-'} variant="blue" /></td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                        (p.stok ?? 0) <= 0
                          ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                          : (p.stok ?? 0) <= 5
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {p.stok}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-extrabold text-primary-600 dark:text-primary-400">
                      {formatRupiah(p.harga_barang)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openQuickEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-950/50 text-primary-600 dark:text-primary-400 transition-colors"
                          title="Quick Edit Harga"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openShelfLabel(p)}
                          className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-600 dark:text-amber-400 transition-colors"
                          title="Cetak Label Rak"
                        >
                          <Tag size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => goToProductMaster(p)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                          title="Buka Detail di Master Produk"
                        >
                          <ExternalLink size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Edit Price Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Quick Edit Harga Jual"
        size="sm"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button loading={savingPrice} onClick={handleSavePrice} className="w-full sm:w-auto font-bold">
              Simpan Harga Baru
            </Button>
          </div>
        }
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Produk Terpilih</p>
              <p className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{selectedProduct.nama_barang}</p>
              <p className="font-mono text-xs text-slate-400 mt-0.5">Kode: {selectedProduct.kd_barang}</p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                Harga Sekarang: <span className="text-primary-600 dark:text-primary-400 font-bold">{formatRupiah(selectedProduct.harga_barang)}</span>
              </p>
            </div>

            <div>
              <Input
                label="Harga Jual Baru (Rp) *"
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                placeholder="0"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Pratinjau: <strong className="text-slate-700 dark:text-slate-200">{formatRupiah(Number(newPrice) || 0)}</strong>
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Shelf Label Print Modal */}
      <Modal
        open={labelModalOpen}
        onClose={() => setLabelModalOpen(false)}
        title="Label Rak Produk (Shelf Tag)"
        size="sm"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => setLabelModalOpen(false)} className="w-full sm:w-auto">
              Tutup
            </Button>
            <Button icon={<Printer size={15} />} onClick={handlePrintLabel} className="w-full sm:w-auto font-bold">
              Cetak Label
            </Button>
          </div>
        }
      >
        {labelProduct && (
          <div className="space-y-3">
            <div
              ref={labelRef}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 bg-white text-slate-900 text-center space-y-2 shadow-sm"
            >
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Label Rak Toko</p>
              <p className="text-base font-extrabold text-slate-900 leading-snug">{labelProduct.nama_barang}</p>
              <div className="py-2">
                <p className="text-2xl font-black text-primary-600">{formatRupiah(labelProduct.harga_barang)}</p>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>Kode: {labelProduct.kd_barang}</span>
                <span>{labelProduct.barcode ? `Barcode: ${labelProduct.barcode}` : `Stok: ${labelProduct.stok}`}</span>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400">
              Label rak siap dicetak pada printer standard atau printer label.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
