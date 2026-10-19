import React from 'react'
import PosStage from './PosStage'
import { BrandLockup } from './BrandLockup'

export { BrandLockup }


export default function LoginShowcase() {
  return (
    <div className="flex h-full w-full flex-col justify-between py-1 xl:py-2">
      {/* Brand & Headline */}
      <div className="space-y-3.5">
        <BrandLockup />
        <div className="max-w-xl">
          <h1 className="text-3xl sm:text-4xl xl:text-[2.65rem] font-black leading-[1.12] tracking-tight text-slate-900 dark:text-white">
            Semua Transaksi,<br />Satu Kendali.
          </h1>
          <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-400 max-w-lg">
            Penjualan, inventori, dan laporan keuangan berjalan di satu sistem terpadu yang ringan, cepat, dan siap digunakan kapan pun toko beroperasi.
          </p>
        </div>
      </div>

      {/* 3D Showcase occupying 60-70% of visual area */}
      <div className="my-auto py-3 w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto flex items-center justify-center">
        <PosStage />
      </div>

      {/* Left panel bottom note */}
      <div className="pt-2.5 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-800/60">
        <span className="font-medium">Solusi Kasir &amp; POS Terpercaya untuk UMKM</span>
        <span className="font-medium">© 2026 WariPOS</span>
      </div>
    </div>
  )
}