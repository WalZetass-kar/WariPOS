import React from 'react'
import PosStage from './PosStage'
import { BrandLockup } from './BrandLockup'

export { BrandLockup }

export default function LoginShowcase() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between py-1 xl:py-2">
      {/* Brand & Headline: warm white clean background, no watermark */}
      <div className="relative z-10 flex-1 lg:flex lg:flex-col pt-6 lg:pt-10 xl:pt-12 space-y-3.5">
        <BrandLockup compact />

        <h1 className="text-3xl sm:text-4xl xl:text-[2.65rem] font-black leading-[1.12] tracking-tight text-slate-900 dark:text-white">
          Semua Transaksi,<br />Satu Kendali.
        </h1>

        <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 max-w-lg">
          Penjualan, inventori, dan laporan keuangan berjalan di satu sistem terpadu yang ringan, cepat, dan siap digunakan kapan pun toko beroperasi.
        </p>
      </div>

      {/* 3D Showcase occupying ~60-70% of left visual area */}
      <div className="relative z-10 my-auto py-3 w-full lg:max-w-none xl:max-w-none">
        <PosStage />
      </div>

      {/* Left panel bottom note */}
      <div className="relative z-10 pt-2.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800/80">
        <span className="font-medium">Solusi Kasir &amp; POS Terpercaya untuk UMKM</span>
        <span className="font-medium">© 2026 WariPOS</span>
      </div>
    </div>
  )
}