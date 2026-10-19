import React from 'react'
import logo from '../../assets/app-logo.png'

export interface BrandLockupProps {
  compact?: boolean
  className?: string
}

export function BrandLockup({ compact = false, className = '' }: BrandLockupProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
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

export default BrandLockup
