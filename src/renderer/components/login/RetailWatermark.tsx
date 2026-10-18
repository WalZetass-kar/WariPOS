import React from 'react'

/**
 * RetailWatermark:
 * Dekorasi latar ber-opacity rendah yang menghadirkan identitas visual retail/POS:
 * - Garis perforasi nota kasir (thermal receipt perforation)
 * - Barcode vertikal geometris halus
 * - Titik-titik matrix printer kasir
 * 
 * Sepenuhnya non-intrusif (pointer-events-none, aria-hidden) untuk memperkuat DNA toko fisik
 * tanpa mengganggu keterbacaan teks dan kontras tombol.
 */
export default function RetailWatermark() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
    >
      {/* 1. Barcode Pattern di sudut kanan atas */}
      <svg
        className="absolute -top-6 right-8 w-64 h-32 opacity-[0.035] dark:opacity-[0.025] text-slate-900 dark:text-white"
        fill="currentColor"
        viewBox="0 0 240 100"
      >
        <rect x="0" y="0" width="3" height="100" />
        <rect x="6" y="0" width="6" height="100" />
        <rect x="16" y="0" width="2" height="100" />
        <rect x="22" y="0" width="8" height="100" />
        <rect x="34" y="0" width="3" height="100" />
        <rect x="42" y="0" width="10" height="100" />
        <rect x="56" y="0" width="2" height="100" />
        <rect x="62" y="0" width="7" height="100" />
        <rect x="74" y="0" width="4" height="100" />
        <rect x="84" y="0" width="9" height="100" />
        <rect x="98" y="0" width="3" height="100" />
        <rect x="105" y="0" width="5" height="100" />
        <rect x="115" y="0" width="12" height="100" />
        <rect x="132" y="0" width="2" height="100" />
        <rect x="138" y="0" width="6" height="100" />
        <rect x="148" y="0" width="4" height="100" />
        <rect x="156" y="0" width="8" height="100" />
        <rect x="168" y="0" width="3" height="100" />
        <rect x="175" y="0" width="11" height="100" />
        <rect x="190" y="0" width="4" height="100" />
        <rect x="198" y="0" width="6" height="100" />
        <rect x="208" y="0" width="2" height="100" />
        <rect x="214" y="0" width="8" height="100" />
        <rect x="226" y="0" width="4" height="100" />
        <rect x="234" y="0" width="6" height="100" />
      </svg>

      {/* 2. Garis Perforasi Struk Kasir & Grid Matrix */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.02]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Pola grid teknis POS */}
          <pattern id="pos-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              className="text-slate-900 dark:text-white"
            />
            {/* Titik dot matrix register */}
            <circle cx="24" cy="24" r="1" fill="currentColor" className="text-red-600" />
          </pattern>
          {/* Pola perforasi nota potong */}
          <pattern id="receipt-cut" width="32" height="16" patternUnits="userSpaceOnUse">
            <line
              x1="0"
              y1="8"
              x2="20"
              y2="8"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeDasharray="4 4"
              className="text-slate-800 dark:text-slate-200"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pos-grid)" />
      </svg>

      {/* 3. Barcode Accent di sudut kiri bawah */}
      <svg
        className="absolute bottom-6 left-8 w-48 h-20 opacity-[0.035] dark:opacity-[0.025] text-slate-900 dark:text-white"
        fill="currentColor"
        viewBox="0 0 160 60"
      >
        <rect x="0" y="0" width="3" height="60" />
        <rect x="6" y="0" width="5" height="60" />
        <rect x="14" y="0" width="2" height="60" />
        <rect x="20" y="0" width="7" height="60" />
        <rect x="30" y="0" width="4" height="60" />
        <rect x="38" y="0" width="8" height="60" />
        <rect x="50" y="0" width="2" height="60" />
        <rect x="56" y="0" width="6" height="60" />
        <rect x="66" y="0" width="3" height="60" />
        <rect x="74" y="0" width="9" height="60" />
        <rect x="88" y="0" width="4" height="60" />
        <rect x="96" y="0" width="2" height="60" />
        <rect x="102" y="0" width="7" height="60" />
        <rect x="114" y="0" width="5" height="60" />
        <rect x="124" y="0" width="3" height="60" />
        <rect x="132" y="0" width="8" height="60" />
        <rect x="144" y="0" width="4" height="60" />
        <rect x="152" y="0" width="6" height="60" />
      </svg>
    </div>
  )
}
