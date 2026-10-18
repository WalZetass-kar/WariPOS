import React from 'react'
import PosStage from './PosStage'
import RetailWatermark from './RetailWatermark'
import logo from '../../assets/app-logo.png'

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt="WariPOS Logo"
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} shrink-0 rounded-2xl object-contain drop-shadow-sm`}
        draggable={false}
      />
      <div className="min-w-0">
        <span className="block text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white">
          WariPOS
        </span>
        <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
          Sistem Kasir &amp; Manajemen Toko
        </span>
      </div>
    </div>
  )
}

export default function LoginShowcase() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between py-1 xl:py-2">
      {/* Retail / POS watermark layer */}
      <RetailWatermark />

      {/* Brand & Headline */}
      <div className="relative z-10 space-y-3.5">
        <BrandLockup />
        <div className="max-w-xl">
          <h1 className="text-3xl sm:text-4xl xl:text-[2.65rem] font-black leading-[1.12] tracking-tight text-slate-900 dark:text-white">
            Semua Transaksi,<br />Satu Kendali.
          </h1>
          <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 max-w-lg">
            Penjualan, inventori, dan laporan keuangan berjalan di satu sistem terpadu yang ringan, cepat, dan siap digunakan kapan pun toko beroperasi.
          </p>
        </div>
      </div>

      {/* 3D Showcase occupying 60-70% of visual area */}
      <div className="relative z-10 my-auto py-3 w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto flex items-center justify-center">
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