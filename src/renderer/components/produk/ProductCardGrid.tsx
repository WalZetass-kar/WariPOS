import React, { useState } from 'react'
import {
  Pencil,
  Trash2,
  Barcode,
  Copy,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertTriangle,
  Inbox,
  X,
} from 'lucide-react'
import ProductImage from '../ProductImage'
import { formatRupiah } from '../../utils/format'
import type { Barang, Kategori } from '../../../shared/types'

interface ProductCardGridProps {
  data: Barang[]
  loading: boolean
  totalRows: number
  pageCount: number
  pageIndex: number
  pageSize: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
  onSearchChange: (search: string) => void
  onSortChange: (sortBy: string, sortOrder: 'ASC' | 'DESC') => void
  currentSearch?: string
  currentSortBy?: string
  currentSortOrder?: 'ASC' | 'DESC'
  kategoriList?: Kategori[]
  onEdit: (product: Barang) => void
  onBarcode: (product: Barang) => void
  onDuplicate: (product: Barang) => void
  onDelete: (product: Barang) => void
}

function getExpiredStatus(expiredDate: string | null | undefined) {
  if (!expiredDate) return null
  const today = new Date()
  const exp = new Date(expiredDate)
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'soon'
  return null
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function ProductCardGrid({
  data,
  loading,
  totalRows,
  pageCount,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onSortChange,
  currentSearch = '',
  currentSortBy = 'nama_barang',
  currentSortOrder = 'ASC',
  onEdit,
  onBarcode,
  onDuplicate,
  onDelete,
}: ProductCardGridProps) {
  const [searchInput, setSearchInput] = useState(currentSearch)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearchChange(searchInput)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    onSearchChange('')
  }

  const handleSortChangeInternal = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    switch (val) {
      case 'nama_asc':
        onSortChange('nama_barang', 'ASC')
        break
      case 'nama_desc':
        onSortChange('nama_barang', 'DESC')
        break
      case 'stok_desc':
        onSortChange('stok', 'DESC')
        break
      case 'stok_asc':
        onSortChange('stok', 'ASC')
        break
      case 'harga_desc':
        onSortChange('harga_barang', 'DESC')
        break
      case 'harga_asc':
        onSortChange('harga_barang', 'ASC')
        break
      case 'expired_asc':
        onSortChange('expired_date', 'ASC')
        break
      default:
        onSortChange('nama_barang', 'ASC')
    }
  }

  const currentSortVal = `${currentSortBy}_${currentSortOrder.toLowerCase()}`

  const fromRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const toRow = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className="space-y-4">
      {/* Grid Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchInput}
            onChange={e => {
              setSearchInput(e.target.value)
              onSearchChange(e.target.value)
            }}
            placeholder="Cari nama, kode barang, atau barcode..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300">
            <ArrowUpDown size={14} className="text-slate-400" />
            <span className="hidden sm:inline text-slate-400">Urutkan:</span>
            <select
              value={currentSortVal}
              onChange={handleSortChangeInternal}
              className="bg-transparent border-0 focus:outline-none cursor-pointer font-bold text-slate-900 dark:text-white"
            >
              <option value="nama_barang_asc">Nama (A-Z)</option>
              <option value="nama_barang_desc">Nama (Z-A)</option>
              <option value="stok_desc">Stok Terbanyak</option>
              <option value="stok_asc">Stok Tersedikit</option>
              <option value="harga_barang_desc">Harga Tertinggi</option>
              <option value="harga_barang_asc">Harga Terendah</option>
              <option value="expired_date_asc">Kedaluwarsa Terdekat</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Cards Container */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: pageSize > 12 ? 12 : pageSize }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2.5 animate-pulse"
            >
              <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl sm:rounded-2xl" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Inbox size={32} />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Tidak Ada Produk Ditemukan
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            {searchInput
              ? `Tidak ditemukan produk dengan kata kunci "${searchInput}". Silakan coba kata kunci lain.`
              : 'Belum ada produk yang terdaftar di katalog toko Anda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {data.map(p => {
            const isOutOfStock = (p.stok ?? 0) <= 0
            const isLowStock = (p.stok ?? 0) > 0 && (p.stok ?? 0) <= 5
            const expStatus = getExpiredStatus(p.expired_date)

            return (
              <div
                key={p.kd_barang}
                className="group rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between overflow-hidden relative"
              >
                {/* Top Image & Floating Badges */}
                <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                  <ProductImage
                    src={p.foto_barang}
                    alt={p.nama_barang ?? ''}
                    bordered={false}
                    iconSize={32}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Stock Badge Overlay */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight shadow-sm backdrop-blur-md ${
                        isOutOfStock
                          ? 'bg-rose-600/90 text-white'
                          : isLowStock
                          ? 'bg-amber-500/90 text-white'
                          : 'bg-slate-900/80 dark:bg-slate-800/90 text-white'
                      }`}
                    >
                      {isOutOfStock ? 'Habis' : `Stok: ${p.stok}`}
                    </span>
                  </div>

                  {/* Expiry Warning Badge Overlay */}
                  {expStatus && (
                    <div className="absolute top-2 right-2 z-10">
                      <span
                        className={`p-1 rounded-full text-white shadow-sm flex items-center justify-center ${
                          expStatus === 'expired' ? 'bg-red-600' : 'bg-amber-500'
                        }`}
                        title={
                          expStatus === 'expired'
                            ? 'Produk sudah kedaluwarsa'
                            : 'Kedaluwarsa dalam 30 hari'
                        }
                      >
                        <AlertTriangle size={12} />
                      </span>
                    </div>
                  )}

                  {/* Category Pill at Bottom Right of Image */}
                  {p.kategori_barang && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 text-[9px] font-bold shadow-xs backdrop-blur-xs max-w-[80%] truncate">
                      {p.kategori_barang}
                    </span>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-2">
                  <div className="space-y-1">
                    <h3
                      className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                      title={p.nama_barang ?? undefined}
                    >
                      {p.nama_barang}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 truncate">
                      <Package size={11} className="shrink-0" />
                      <span className="truncate">{p.kd_barang}</span>
                      {p.barcode && <span className="truncate">· {p.barcode}</span>}
                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-black text-xs sm:text-sm text-primary-600 dark:text-primary-400 truncate">
                        {formatRupiah(p.harga_barang)}
                      </span>
                      {p.potongan && Number(p.potongan) > 0 ? (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.2 rounded">
                          Disc {p.potongan}%
                        </span>
                      ) : null}
                    </div>
                    {p.harga_modal && Number(p.harga_modal) > 0 ? (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        Modal: {formatRupiah(p.harga_modal)}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3 pt-0">
                  <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90"
                      title="Edit Produk"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onBarcode(p)}
                      className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90"
                      title="Cetak Barcode"
                    >
                      <Barcode size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(p)}
                      className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90"
                      title="Duplikat Produk"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all active:scale-90"
                      title="Hapus Produk"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Grid Pagination Controls */}
      {totalRows > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan <strong>{fromRow}</strong> - <strong>{toRow}</strong> dari <strong>{totalRows}</strong> produk
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline text-slate-400">Tampilkan:</span>
              <select
                value={pageSize}
                onChange={e => {
                  onPageSizeChange(Number(e.target.value))
                  onPageChange(0)
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {PAGE_SIZES.map(s => (
                  <option key={s} value={s}>
                    {s} / hal
                  </option>
                ))}
              </select>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
                disabled={pageIndex <= 0 || loading}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-2.5 font-bold text-slate-900 dark:text-white">
                {pageIndex + 1} / {Math.max(1, pageCount)}
              </span>

              <button
                type="button"
                onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))}
                disabled={pageIndex >= pageCount - 1 || loading}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
