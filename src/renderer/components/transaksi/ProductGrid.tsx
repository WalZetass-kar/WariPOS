import React from 'react'
import { ShoppingCart, Plus, Minus, Check } from 'lucide-react'
import { Barang, CartItem } from '../../../shared/types'
import { ProductGridSkeleton } from '../../components/Skeleton'
import ProductImage from '../../components/ProductImage'
import { formatRupiah } from '../../utils/format'

interface ProductGridProps {
  products: Barang[]
  productsLoading: boolean
  filtered: Barang[]
  onAddToCart: (product: Barang) => void
  cart?: CartItem[]
  viewMode?: 'grid' | 'list'
  onUpdateQty?: (kd: string, delta: number) => void
}

export default function ProductGrid({
  products, productsLoading, filtered, onAddToCart, cart = [], viewMode = 'grid', onUpdateQty
}: ProductGridProps) {
  if (productsLoading) {
    return <ProductGridSkeleton />
  }

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <ShoppingCart size={32} />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Produk Tidak Ditemukan</p>
          <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian Anda</p>
        </div>
      </div>
    )
  }

  // Map cart items for rapid O(1) quantity lookups
  const cartQtyMap = React.useMemo(() => {
    const map = new Map<string, number>()
    cart.forEach(c => map.set(c.kd_barang, c.qty))
    return map
  }, [cart])

  if (viewMode === 'list') {
    return (
      <div className="space-y-2 p-1">
        {filtered.map((p, index) => {
          const isOutOfStock = (p.stok ?? 0) <= 0
          const inCartQty = cartQtyMap.get(p.kd_barang) ?? 0

          return (
            <div
              key={p.kd_barang ?? String(index)}
              onClick={() => { if (!isOutOfStock) onAddToCart(p) }}
              className={`w-full rounded-2xl border p-2.5 transition-all flex items-center justify-between gap-3 cursor-pointer select-none touch-manipulation ${
                isOutOfStock
                  ? 'cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-50'
                  : inCartQty > 0
                  ? 'border-red-500/50 bg-red-50/20 dark:bg-red-950/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 active:scale-[0.99]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <ProductImage
                    src={p.foto_barang}
                    alt=""
                    bordered={false}
                    iconSize={24}
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  {inCartQty > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black shadow">
                      x{inCartQty}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate leading-snug">{p.nama_barang}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-red-600 dark:text-red-400 font-extrabold text-xs sm:text-sm">
                      {formatRupiah(p.harga_barang)}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                      isOutOfStock ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {isOutOfStock ? 'Habis' : `Stok: ${p.stok}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                {inCartQty > 0 && onUpdateQty ? (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(p.kd_barang, -1)}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-xs font-black text-slate-900 dark:text-white">{inCartQty}</span>
                    <button
                      type="button"
                      onClick={() => onAddToCart(p)}
                      disabled={inCartQty >= (p.stok ?? 0)}
                      className="w-7 h-7 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 flex items-center justify-center transition-colors shadow-sm"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { if (!isOutOfStock) onAddToCart(p) }}
                    disabled={isOutOfStock}
                    className="h-8 px-3 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-40 flex items-center gap-1 shadow-sm active:scale-95 transition-transform"
                  >
                    <Plus size={14} />
                    <span>Tambah</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid gap-2.5 sm:gap-3 p-0.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {filtered.map((p, index) => {
        const isOutOfStock = (p.stok ?? 0) <= 0
        const inCartQty = cartQtyMap.get(p.kd_barang) ?? 0

        return (
          <button
            key={p.kd_barang ?? String(index)}
            onClick={() => onAddToCart(p)}
            disabled={isOutOfStock}
            className={`w-full rounded-2xl border p-2.5 sm:p-3 text-left transition-all relative overflow-hidden flex flex-col justify-between select-none touch-manipulation ${
              isOutOfStock
                ? 'cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-50'
                : inCartQty > 0
                ? 'border-red-500 dark:border-red-500/80 bg-red-50/15 dark:bg-red-950/20 shadow-sm ring-1 ring-red-500/30'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 active:border-red-600/40 active:scale-[0.98]'
            }`}
          >
            <div>
              <div className="mb-2 relative">
                <ProductImage
                  src={p.foto_barang}
                  alt=""
                  bordered={false}
                  iconSize={28}
                  className="aspect-square w-full rounded-xl object-cover"
                />
                
                {/* Stock badge */}
                <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold ${
                  isOutOfStock ? 'bg-red-500 text-white' : (p.stok ?? 0) <= 5 ? 'bg-amber-500 text-white' : 'bg-slate-900/75 text-white backdrop-blur-sm'
                }`}>
                  {isOutOfStock ? 'Habis' : `${p.stok}`}
                </span>

                {/* In Cart Indicator */}
                {inCartQty > 0 && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black flex items-center gap-0.5 shadow-md shadow-red-600/30">
                    <Check size={10} strokeWidth={3} />
                    <span>x{inCartQty}</span>
                  </span>
                )}
              </div>
              <p title={p.nama_barang ?? ''} className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight min-h-[2rem]">{p.nama_barang}</p>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2">
              <p className="text-red-600 dark:text-red-400 font-extrabold text-xs sm:text-sm">{formatRupiah(p.harga_barang)}</p>
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-colors ${
                inCartQty > 0 ? 'bg-red-600 text-white font-bold' : 'bg-red-600/10 dark:bg-red-950/50 text-red-600 dark:text-red-400'
              }`}>
                <Plus size={14} />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
