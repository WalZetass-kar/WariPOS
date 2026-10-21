import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle2, QrCode, X } from 'lucide-react'
import { toDataURL } from 'qrcode'
import { formatRupiah } from '../../utils/format'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { QrisPayment } from './types'

interface QrisModalProps {
  open: boolean
  totalBayar: number
  qrisPayment: QrisPayment | null
  qrisStatus: string
  qrisChecking: boolean
  qrisCompleting: boolean
  isStaticQrisPayment: boolean
  onCancel: () => void
  onCompleteQrisSale: () => void
  onCheckStatus: () => void
}

type StatusVariant = 'waiting' | 'success' | 'error' | 'idle'

function resolveVariant(status: string, completing: boolean): StatusVariant {
  if (completing) return 'success'
  const s = status.toLowerCase()
  if (s.includes('gagal') || s.includes('dibatalkan') || s.includes('kedaluwarsa') || s.includes('expired'))
    return 'error'
  if (s.includes('diterima') || s.includes('menyimpan') || s.includes('selesai'))
    return 'success'
  if (s.includes('menunggu') || s.includes('menyiapkan') || s.includes('scan'))
    return 'waiting'
  return 'idle'
}

const statusBand: Record<StatusVariant, string> = {
  waiting: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300',
  error:   'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700/40 dark:text-red-300',
  idle:    'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
}

export default function QrisModal({
  open,
  totalBayar,
  qrisPayment,
  qrisStatus,
  qrisChecking,
  qrisCompleting,
  isStaticQrisPayment,
  onCancel,
  onCompleteQrisSale,
  onCheckStatus,
}: QrisModalProps) {
  const [generatedQr, setGeneratedQr] = useState<string | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Generate QR from string when backend provides qrString instead of qrImageUrl
  useEffect(() => {
    let active = true
    if (qrisPayment?.qrString && !qrisPayment?.qrImageUrl) {
      toDataURL(qrisPayment.qrString, {
        margin: 2,
        scale: 8,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(url => { if (active) setGeneratedQr(url) })
        .catch(() => { if (active) setGeneratedQr(null) })
    } else {
      setGeneratedQr(null)
    }
    return () => { active = false }
  }, [qrisPayment?.qrString, qrisPayment?.qrImageUrl])

  // Escape key closes modal (unless completing)
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !qrisCompleting) onCancel()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, qrisCompleting, onCancel])

  const qrSrc = qrisPayment?.qrImageUrl || generatedQr
  const orderId = qrisPayment?.orderId || ''
  const variant = resolveVariant(qrisStatus, qrisCompleting)
  const isWaiting = variant === 'waiting'
  const hasQr = Boolean(qrSrc)

  const spring = { type: 'spring' as const, damping: 30, stiffness: 320, duration: prefersReducedMotion ? 0.01 : 0.24 }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qris-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
            onClick={() => { if (!qrisCompleting) onCancel() }}
          />

          {/* Dialog card */}
          <motion.div
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden flex flex-col max-h-[calc(100svh-1.5rem)]"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            transition={spring}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shrink-0">
                <QrCode size={17} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="qris-modal-title"
                  className="text-sm font-bold text-slate-800 dark:text-white leading-none"
                >
                  Pembayaran QRIS
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                  Scan untuk menyelesaikan transaksi
                </p>
              </div>
              <button
                type="button"
                onClick={() => { if (!qrisCompleting) onCancel() }}
                disabled={qrisCompleting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Tutup modal QRIS"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4 min-h-0">

              {/* Total tagihan — primary color panel, nominal is the visual anchor */}
              <div className="rounded-lg bg-primary-600 px-4 pt-3 pb-3.5">
                <p className="text-[11px] font-medium text-primary-200 mb-1">Total Tagihan</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={totalBayar}
                    className="text-2xl font-bold text-white tracking-tight leading-none"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
                  >
                    {formatRupiah(totalBayar)}
                  </motion.p>
                </AnimatePresence>
                {orderId && (
                  <p className="text-[10px] text-primary-300 mt-2 font-mono truncate" title={orderId}>
                    {orderId}
                  </p>
                )}
              </div>

              {/* QR code panel — white background, generous padding, no decoration near quiet zone */}
              <div className="flex justify-center">
                {hasQr ? (
                  <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm inline-block">
                    <img
                      src={qrSrc!}
                      alt="Kode QR pembayaran QRIS"
                      className="w-52 h-52 object-contain block"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-52 h-52 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500">
                    <QrCode size={36} className="mb-2 opacity-40" aria-hidden="true" />
                    <p className="text-xs">Menyiapkan QR...</p>
                  </div>
                )}
              </div>

              {/* Status bar — transitions between states */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={variant}
                  role="status"
                  aria-live="polite"
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium ${statusBand[variant]}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
                >
                  {isWaiting && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 qris-waiting-pulse shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  {variant === 'success' && (
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  )}
                  {variant === 'error' && (
                    <AlertCircle size={13} className="shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                  )}
                  <span className="leading-snug">{qrisStatus}</span>
                </motion.div>
              </AnimatePresence>

              {/* Scan instruction — shown only when QR is ready and payment is pending */}
              {hasQr && isWaiting && (
                <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Pindai QR menggunakan aplikasi pembayaran Anda
                </p>
              )}
            </div>

            {/* Footer — cancel always on the left, action on the right */}
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex gap-2.5 shrink-0 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={onCancel}
                disabled={qrisCompleting}
                className="flex-1 py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-red-300 hover:text-red-600 dark:hover:border-red-700 dark:hover:text-red-400 font-semibold text-xs sm:text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary-600"
              >
                Batalkan
              </button>

              {isStaticQrisPayment ? (
                <button
                  type="button"
                  onClick={onCompleteQrisSale}
                  disabled={!qrisPayment || qrisCompleting}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-emerald-700"
                >
                  {qrisCompleting ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Konfirmasi Dibayar</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCheckStatus}
                  disabled={!qrisPayment || qrisCompleting || qrisChecking}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary-700"
                >
                  {qrisChecking ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Memeriksa...</span>
                    </>
                  ) : (
                    <span>Cek Status</span>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
