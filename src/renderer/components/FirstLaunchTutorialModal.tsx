import { useState, useEffect } from 'react'
import { ShoppingCart, Package, BarChart2, Printer, ChevronRight, Check, X } from 'lucide-react'
import Button from './Button'

const FIRST_LAUNCH_KEY = 'zetass_mobile_first_launch_tutorial_shown'

interface Step {
  title: string
  subtitle: string
  description: string
  icon: React.ReactNode
  color: string
}

const STEPS: Step[] = [
  {
    title: 'Selamat Datang di WariPOS',
    subtitle: 'Aplikasi Kasir & Pembukuan Pintar',
    description: 'Kelola seluruh operasional toko retail & restoran Anda mulai dari transaksi, stok barang, kasir, hingga laporan keuangan dalam satu genggaman.',
    icon: <ShoppingCart size={28} className="text-white" />,
    color: 'from-red-600 to-rose-500',
  },
  {
    title: 'Transaksi Kasir & Scanner Cepat',
    subtitle: 'Scan Barcode Kamera & Multi Pembayaran',
    description: 'Scan barcode produk seketika menggunakan kamera HP. Mendukung pembayaran Tunai, Transfer Bank, dan QRIS dinamis/statis secara realtime.',
    icon: <Package size={28} className="text-white" />,
    color: 'from-blue-600 to-indigo-500',
  },
  {
    title: 'Laporan Pembukuan & Laba Rugi',
    subtitle: 'Export PDF & Excel Sekali Klik',
    description: 'Pantau omset harian, produk terlaris, dan laba kotor secara otomatis. Simpan dan bagikan laporan pembukuan ke format PDF & Excel kapan saja.',
    icon: <BarChart2 size={28} className="text-white" />,
    color: 'from-emerald-600 to-teal-500',
  },
  {
    title: 'Cetak Struk & Kirim WhatsApp',
    subtitle: 'Printer Bluetooth Thermal 58/80mm',
    description: 'Cetak struk belanja dengan printer Bluetooth portabel tanpa kabel, atau kirim rincian nota belanja langsung ke nomor WhatsApp pembeli.',
    icon: <Printer size={28} className="text-white" />,
    color: 'from-amber-500 to-orange-500',
  },
]

export default function FirstLaunchTutorialModal() {
  const [open, setOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    try {
      const shown = localStorage.getItem(FIRST_LAUNCH_KEY)
      // Only show if not shown before and on mobile device / screen
      const isMobile = typeof window !== 'undefined' && (window.innerWidth < 1024 || (window as any).Capacitor?.isNativePlatform())
      if (!shown && isMobile) {
        setOpen(true)
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const handleFinish = () => {
    try {
      localStorage.setItem(FIRST_LAUNCH_KEY, 'true')
    } catch {}
    setOpen(false)
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleFinish()
    }
  }

  if (!open) return null

  const step = STEPS[currentStep]

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md modal-backdrop-animate"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-white space-y-5 overflow-hidden modal-card-animate">
        {/* Skip button */}
        <button
          onClick={handleFinish}
          className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Lewati panduan"
        >
          <X size={18} />
        </button>

        {/* Step Icon */}
        <div className="flex justify-center pt-2">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
            {step.icon}
          </div>
        </div>

        {/* Step Content */}
        <div className="text-center space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary-600 dark:text-primary-400">
            Panduan Penggunaan ({currentStep + 1}/{STEPS.length})
          </span>
          <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {step.title}
          </h3>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {step.subtitle}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
            {step.description}
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center items-center gap-1.5 pt-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-6 bg-primary-600 dark:bg-primary-500'
                  : 'w-1.5 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {currentStep < STEPS.length - 1 ? (
            <>
              <Button
                variant="ghost"
                onClick={handleFinish}
                className="flex-1 text-xs font-bold text-slate-500"
              >
                Lewati
              </Button>
              <Button
                onClick={handleNext}
                icon={<ChevronRight size={16} />}
                className="flex-1 text-xs font-bold"
              >
                Lanjut
              </Button>
            </>
          ) : (
            <Button
              onClick={handleFinish}
              icon={<Check size={16} />}
              className="w-full text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white"
            >
              Mulai Gunakan Aplikasi
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
