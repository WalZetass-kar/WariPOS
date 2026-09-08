import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Search, Printer, FileText } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Badge from '../components/Badge'
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
  const toast = useToast()
  const [products, setProducts] = useState<ProductItem[]>([])
  const [kategori, setKategori] = useState<Kategori[]>([])
  const [loading, setLoading] = useState(true)
  const [kdKategori, setKdKategori] = useState<number>(0)
  const [search, setSearch] = useState('')

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white">
          <ClipboardList size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Price List</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Daftar harga produk untuk dicetak dan dipajang di toko</p>
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
            className="w-48"
          />
          <div className="flex-1">
            <Input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={14} />} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Printer size={14} />} onClick={handlePrint}>Cetak</Button>
            <Button variant="secondary" icon={<FileText size={14} />} onClick={handleExportPDF}>Export PDF</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">{products.length} produk</p>
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
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-8">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kategori</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Stok</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {products.map((p, i) => (
                  <tr key={p.kd_barang} className={`hover:bg-primary-50/50 dark:hover:bg-slate-700/30 ${i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.kd_barang}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{p.nama_barang}</td>
                    <td className="px-4 py-2.5"><Badge label={p.kategori_barang ?? '-'} variant="blue" /></td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-semibold ${(p.stok ?? 0) <= 5 ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>{p.stok}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary-600 dark:text-primary-400">{formatRupiah(p.harga_barang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
