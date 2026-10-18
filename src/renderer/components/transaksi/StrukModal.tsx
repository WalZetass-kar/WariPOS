import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Check, FileImage, MessageCircle, Printer, X } from 'lucide-react'
import Button from '../../components/Button'
import Struk from '../../components/Struk'
import { formatRupiah } from '../../utils/format'
import { exportReceiptSoftFile } from '../../utils/receiptExporter'
import { useToast } from '../../contexts/ToastContext'
import { CartItem, Customer } from '../../../shared/types'
import productClickSoundUrl from '../../assets/sounds/product-click.mp3'

interface StrukModalProps {
  open: boolean
  cart: CartItem[]
  subTotal: number
  pajakAmount: number
  pajakPersen: number
  totalBayar: number
  promoDiskon: number
  paidAmount: number
  kembalian: number
  lastKd: string | null
  jenisBayar: 'TUNAI' | 'TRANSFER' | 'QRIS'
  selectedCustomer: Customer | null
  poinEarned: number
  user: any
  strukRef: React.RefObject<HTMLDivElement>
  manualWaPhone: string
  btPrinting: boolean
  bluetoothPrinterConnected: boolean
  onClose: () => void
  onSendWhatsApp: () => void
  onHandlePrint: () => void
  onHandleBluetoothPrint: () => void
  onChangeManualWaPhone: (phone: string) => void
}

/* ────────────────────────────────────────────────────────────────
   Motion
   ──────────────────────────────────────────────────────────────── */
const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

const EASE_SETTLE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const EASE_FEED: [number, number, number, number] = [0.42, 0.05, 0.32, 1]

/* ────────────────────────────────────────────────────────────────
   Thermal printer 3D
   One red shell, lit from above, so the emerging paper has a source.
   Depth comes from tinted (brand red) shadows, never hard black.
   ──────────────────────────────────────────────────────────────── */
const PRINTER_LIP = 30

interface ThermalPrinter3DProps {
  printing: boolean
  reducedMotion: boolean
}

const ThermalPrinter3D: React.FC<ThermalPrinter3DProps> = ({ printing, reducedMotion }) => (
  <div className="relative z-20 mx-auto w-[min(84vw,306px)] select-none">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-4 left-1/2 h-7 w-[82%] -translate-x-1/2 rounded-[50%] blur-[3px]"
      style={{ background: 'radial-gradient(ellipse at center, rgba(15,23,42,.26), rgba(15,23,42,0) 70%)' }}
    />

    <div
      className="relative overflow-hidden rounded-[26px]"
      style={{
        background: 'linear-gradient(180deg,#fb7185 0%,#f43f5e 14%,#e11d48 44%,#be123c 76%,#881337 100%)',
        boxShadow:
          'inset 0 1.5px 0 rgba(255,255,255,.6), inset 0 -2px 0 rgba(0,0,0,.3),' +
          'inset 1.5px 0 0 rgba(255,255,255,.2), inset -1.5px 0 0 rgba(0,0,0,.24),' +
          '0 26px 44px -24px rgba(190,18,60,.8), 0 6px 16px -10px rgba(15,23,42,.55)',
      }}
    >
      {/* glossy crown highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-11 left-1/2 h-24 w-[135%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, rgba(255,255,255,.42), rgba(255,255,255,.1) 46%, rgba(255,255,255,0) 72%)',
        }}
      />

      <div className="relative px-5 pb-0 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <motion.span
              className="block h-2 w-2 rounded-full"
              style={{
                background: printing ? '#34d399' : '#a7f3d0',
                boxShadow: printing ? '0 0 7px 1px rgba(52,211,153,.55)' : '0 0 3px 0 rgba(52,211,153,.35)',
              }}
              animate={
                reducedMotion || !printing
                  ? undefined
                  : { opacity: [1, 0.45, 1], scale: [1, 1.22, 1] }
              }
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span
              className="text-[11px] font-bold tracking-[0.16em]"
              style={{ color: 'rgba(255,255,255,.66)', textShadow: '0 1px 0 rgba(88,16,42,.7)' }}
            >
              WARIPOS
            </span>
          </div>

          {/* vent: a real printer detail, three slots, not a background pattern */}
          <div aria-hidden="true" className="flex items-end gap-[3px]">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="block h-[9px] w-[3px] rounded-full"
                style={{
                  background: 'linear-gradient(180deg,rgba(88,16,42,.42),rgba(136,19,55,.7))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28)',
                }}
              />
            ))}
          </div>
        </div>

        {/* tear-off cutter bar */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-[7px] w-[58%] rounded-full"
          style={{
            background: 'linear-gradient(180deg,#f1f5f9 0%,#cbd5e1 52%,#94a3b8 100%)',
            boxShadow: '0 1px 0 rgba(88,16,42,.55), inset 0 1px 0 rgba(255,255,255,.95)',
          }}
        />

        {/* slot mouth */}
        <div
          aria-hidden="true"
          className="mx-auto mt-1.5 h-[14px] rounded-[7px]"
          style={{
            background: 'linear-gradient(180deg,#1a0409 0%,#3f0a1d 100%)',
            boxShadow:
              'inset 0 4px 7px rgba(0,0,0,.85), inset 0 -1px 0 rgba(255,255,255,.14), 0 1px 0 rgba(255,255,255,.2)',
          }}
        />
      </div>

      {/* bottom lip: the paper emerges from behind this */}
      <div
        aria-hidden="true"
        className="relative"
        style={{
          height: PRINTER_LIP,
          background: 'linear-gradient(180deg,#9f1239 0%,#881337 60%,#4c0519 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 -3px 6px rgba(0,0,0,.3)',
        }}
      >
        <div
          className="absolute inset-x-5 top-1 h-[3px] rounded-full"
          style={{ background: 'rgba(255,255,255,.1)' }}
        />
      </div>
    </div>
  </div>
)

/* ────────────────────────────────────────────────────────────────
   Reveal block: one line group of the receipt, fed out in order
   ──────────────────────────────────────────────────────────────── */
const RevealBlock: React.FC<{
  index: number
  delay: number
  instant: boolean
  children: React.ReactNode
}> = ({ index, delay, instant, children }) => {
  if (instant) return <div>{children}</div>
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_SETTLE, delay }}
      data-reveal={index}
    >
      {children}
    </motion.div>
  )
}

const PaperRow: React.FC<{ label: string; value: React.ReactNode; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className={strong ? 'shrink-0 font-bold text-slate-900' : 'shrink-0 text-slate-600'}>{label}</span>
    <span
      className={`min-w-0 break-all text-right tabular-nums ${
        strong ? 'font-bold text-slate-900' : 'font-semibold text-slate-900'
      }`}
    >
      {value}
    </span>
  </div>
)

/* ────────────────────────────────────────────────────────────────
   StrukModal
   ──────────────────────────────────────────────────────────────── */
export default function StrukModal({
  open,
  cart,
  subTotal,
  pajakAmount,
  pajakPersen,
  totalBayar,
  promoDiskon,
  paidAmount,
  kembalian,
  lastKd,
  jenisBayar,
  selectedCustomer,
  poinEarned,
  user,
  strukRef,
  onClose,
  onSendWhatsApp,
  onHandlePrint,
}: StrukModalProps) {
  const toast = useToast()
  const [softLoading, setSoftLoading] = useState<'png' | 'pdf' | null>(null)
  const [measured, setMeasured] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)
  const [animationBroken, setAnimationBroken] = useState(false)
  const [feedDone, setFeedDone] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const paperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const focusHandledRef = useRef(false)

  /* Freeze the sale timestamp once, at the moment the receipt appears. */
  const [soldAt] = useState(() => new Date())

  /* ── paper geometry: length follows the real number of items ── */
  useLayoutEffect(() => {
    if (!open) return

    /* Read the live node every time: switching the wrapper from the
       pre-measure div to the animated one detaches the old node, and a
       stale node measures 0 which would wrongly trigger the static fallback. */
    const measure = () => {
      const el = paperRef.current
      if (!el || !el.isConnected) return
      const h = el.offsetHeight
      if (h <= 0) return
      setContentHeight(prev => (prev === h ? prev : h))
      setMeasured(true)
    }
    measure()

    let ro: ResizeObserver | null = null
    try {
      ro = new ResizeObserver(measure)
      if (paperRef.current) ro.observe(paperRef.current)
    } catch {
      ro = null
    }
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [open, cart.length, lastKd, measured])

  const revealCount = 6 + cart.length + 5
  const feedMs = useMemo(() => {
    if (prefersReducedMotion) return 0
    return Math.min(2400, Math.max(850, contentHeight * 5.4))
  }, [contentHeight, prefersReducedMotion])

  const staticReveal = measured && (prefersReducedMotion || animationBroken || contentHeight <= 0)

  const delayFor = useCallback(
    (index: number) => {
      if (staticReveal) return 0
      const start = feedMs * 0.3
      const span = feedMs * 0.5
      return start + (revealCount > 1 ? (index / (revealCount - 1)) * span : 0)
    },
    [staticReveal, feedMs, revealCount]
  )

  /* ── reset every run of the sequence, keyed per transaction ── */
  useEffect(() => {
    if (!open) {
      setMeasured(false)
      setContentHeight(0)
      setAnimationBroken(false)
      setFeedDone(false)
      focusHandledRef.current = false
      return
    }
    setFeedDone(false)
    focusHandledRef.current = false
  }, [open, lastKd])

  /* ── printer sound, synced to the moment the paper starts feeding ── */
  useEffect(() => {
    if (!open || prefersReducedMotion || staticReveal) return
    const timer = setTimeout(() => {
      try {
        const audio = new Audio(productClickSoundUrl)
        audio.volume = 0.25
        audio.play().catch(() => {})
      } catch {}
    }, prefersReducedMotion ? 0 : 460)

    return () => clearTimeout(timer)
  }, [open, prefersReducedMotion, staticReveal])

  /* ── failsafe: if the feed never reports completion, snap to the end ── */
  useEffect(() => {
    if (!open || staticReveal) return
    const timer = setTimeout(() => setAnimationBroken(true), feedMs + 2500)
    return () => clearTimeout(timer)
  }, [open, feedMs, staticReveal])

  /* ── hand focus to the action panel once the receipt is fully out ── */
  const handleFeedComplete = useCallback(() => {
    setFeedDone(true)
    if (focusHandledRef.current) return
    focusHandledRef.current = true
    const active = document.activeElement
    if (!active || active === document.body) panelRef.current?.focus({ preventScroll: true })
  }, [])

  /* ── Escape closes ── */
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleExportSoftFile = async (format: 'png' | 'pdf') => {
    if (!strukRef.current) return toast('Preview struk belum siap', 'error')
    setSoftLoading(format)
    const res = await exportReceiptSoftFile(
      strukRef.current,
      lastKd || `TRX-${Date.now()}`,
      format
    )
    setSoftLoading(null)
    if (res.success) {
      toast(`Struk soft file (${format.toUpperCase()}) berhasil disimpan: ${res.fileName}`)
    } else {
      toast(res.error || 'Gagal menyimpan soft file struk', 'error')
    }
  }

  const skipAnimation = useCallback(() => setAnimationBroken(true), [])

  const printerVariants: Variants = {
    hidden: { opacity: 0, y: -20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: prefersReducedMotion ? 0 : 0.5, ease: EASE_SETTLE },
    },
  }

  const panelVariants: Variants = {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.4, ease: EASE_SETTLE },
    },
  }

  /* ── the receipt itself ── */
  const paperContent = (
    <div
      ref={paperRef}
      className="receipt-edge [--receipt-tooth:5px] px-3.5 pb-1 pt-3 font-mono text-[10px] leading-[1.5] text-slate-900"
      style={{
        background:
          'linear-gradient(90deg,#efece4 0%,#faf8f3 12%,#fdfcf9 50%,#faf8f3 88%,#efece4 100%)',
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(15,23,42,.018) 0px, rgba(15,23,42,.018) 1px, transparent 1px, transparent 3px), linear-gradient(90deg,#efece4 0%,#faf8f3 12%,#fdfcf9 50%,#faf8f3 88%,#efece4 100%)',
      }}
    >
      <RevealBlock index={0} delay={delayFor(0)} instant={staticReveal || !measured}>
        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.1em] text-rose-700">WARIPOS</p>
          <p className="mt-0.5 text-[9px] tracking-[0.08em] text-slate-500">STRUK TRANSAKSI</p>
          <p className="mt-1 text-[9.5px] text-slate-600">
            {soldAt.toLocaleString('id-ID', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </RevealBlock>

      <div className="my-2 border-t border-dashed border-slate-400/70" />

      <div className="space-y-0.5">
        <RevealBlock index={1} delay={delayFor(1)} instant={staticReveal || !measured}>
          <PaperRow label="Invoice" value={lastKd || '-'} strong />
        </RevealBlock>
        <RevealBlock index={2} delay={delayFor(2)} instant={staticReveal || !measured}>
          <PaperRow label="Kasir" value={user?.nama_pengguna || 'Kasir'} />
        </RevealBlock>
        <RevealBlock index={3} delay={delayFor(3)} instant={staticReveal || !measured}>
          <PaperRow label="Pelanggan" value={selectedCustomer?.nama_customer || 'Umum'} />
        </RevealBlock>
      </div>

      <div className="my-2 border-t border-dashed border-slate-400/70" />

      <div className="space-y-1">
        {cart.map((item, i) => {
          const disc = (item.harga_jual * (item.disc ?? 0)) / 100
          const itemTotal = (item.harga_jual - disc) * item.qty
          const idx = 4 + i
          return (
            <RevealBlock
              key={item.kd_barang}
              index={idx}
              delay={delayFor(idx)}
              instant={staticReveal || !measured}
            >
              <div>
                <div className="flex items-end justify-between gap-2">
                  <span className="min-w-0 break-words">
                    <span className="text-slate-500">{item.qty}x</span> {item.nama_barang}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatRupiah(itemTotal)}</span>
                </div>
                {(item.disc ?? 0) > 0 && (
                  <p className="text-[9.5px] text-slate-500">
                    Diskon item {item.disc}% <span className="tabular-nums">-{formatRupiah(disc * item.qty)}</span>
                  </p>
                )}
              </div>
            </RevealBlock>
          )
        })}
      </div>

      <div className="my-2 border-t border-dashed border-slate-400/70" />

      <div className="space-y-0.5">
        <RevealBlock index={4 + cart.length} delay={delayFor(4 + cart.length)} instant={staticReveal || !measured}>
          <PaperRow label="Subtotal" value={formatRupiah(subTotal)} />
        </RevealBlock>
        {pajakAmount > 0 && (
          <RevealBlock index={5 + cart.length} delay={delayFor(5 + cart.length)} instant={staticReveal || !measured}>
            <PaperRow label={`PPN ${pajakPersen}%`} value={formatRupiah(pajakAmount)} />
          </RevealBlock>
        )}
        {promoDiskon > 0 && (
          <RevealBlock index={6 + cart.length} delay={delayFor(6 + cart.length)} instant={staticReveal || !measured}>
            <PaperRow label="Diskon Promo" value={`-${formatRupiah(promoDiskon)}`} />
          </RevealBlock>
        )}
      </div>

      <RevealBlock index={7 + cart.length} delay={delayFor(7 + cart.length)} instant={staticReveal || !measured}>
        <div className="mt-2 rounded-[4px] bg-rose-50 px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-900">
              Total Bayar
            </span>
            <span className="text-[12.5px] font-bold tabular-nums text-rose-700">
              {formatRupiah(totalBayar)}
            </span>
          </div>
        </div>
      </RevealBlock>

      <div className="mt-2 space-y-0.5">
        <RevealBlock index={8 + cart.length} delay={delayFor(8 + cart.length)} instant={staticReveal || !measured}>
          <PaperRow label="Metode Bayar" value={jenisBayar} />
        </RevealBlock>
        <RevealBlock index={9 + cart.length} delay={delayFor(9 + cart.length)} instant={staticReveal || !measured}>
          <PaperRow label="Dibayar" value={formatRupiah(paidAmount)} />
        </RevealBlock>
        <RevealBlock index={10 + cart.length} delay={delayFor(10 + cart.length)} instant={staticReveal || !measured}>
          <PaperRow label="Kembalian" value={formatRupiah(kembalian)} strong />
        </RevealBlock>
        {poinEarned > 0 && (
          <RevealBlock index={11 + cart.length} delay={delayFor(11 + cart.length)} instant={staticReveal || !measured}>
            <PaperRow label="Poin Ditambahkan" value={`${poinEarned} poin`} />
          </RevealBlock>
        )}
      </div>

      <RevealBlock index={12 + cart.length} delay={delayFor(12 + cart.length)} instant={staticReveal || !measured}>
        <p className="mt-3 text-center text-[9.5px] leading-relaxed text-slate-600">
          Terima kasih atas kunjungan Anda.
          <br />
          Simpan struk ini sebagai bukti pembayaran.
        </p>
      </RevealBlock>
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop: dims the dashboard so the printer is the only lit object */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
            className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[3px]"
            role="presentation"
            aria-hidden="true"
          />

          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-5 pb-10 pt-6 sm:pt-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-success-title"
            aria-describedby="transaction-success-desc"
          >
            <div className="w-full max-w-[380px]">
              <h2 id="transaction-success-title" className="sr-only">
                Transaksi Berhasil
              </h2>
              <p id="transaction-success-desc" className="sr-only">
                Transaksi dengan nomor invoice {lastKd} telah berhasil disimpan. Total pembayaran{' '}
                {formatRupiah(totalBayar)}, metode {jenisBayar}, kembalian {formatRupiah(kembalian)}.
              </p>

              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label="Tutup struk transaksi"
                >
                  <X size={17} />
                </button>

                {!feedDone && !prefersReducedMotion && !staticReveal && (
                  <button
                    onClick={skipAnimation}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    Lewati animasi
                  </button>
                )}
              </div>

              {/* printer + paper */}
              <motion.div variants={printerVariants} initial="hidden" animate="visible">
                <ThermalPrinter3D printing={!feedDone} reducedMotion={prefersReducedMotion} />
              </motion.div>

              <div
                className="relative z-10 mx-auto w-[70%] min-w-[136px] max-w-[236px]"
                style={{ marginTop: -PRINTER_LIP }}
              >
                {measured ? (
                  <motion.div
                    className="relative overflow-hidden"
                    style={{ boxShadow: '0 18px 30px -20px rgba(15,23,42,.5)' }}
                    initial={{ height: staticReveal ? 'auto' : 0 }}
                    animate={{ height: staticReveal ? 'auto' : contentHeight + PRINTER_LIP }}
                    transition={{ duration: staticReveal ? 0 : feedMs / 1000, ease: EASE_FEED }}
                    onAnimationComplete={handleFeedComplete}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-black/30 via-black/8 to-transparent" />
                    <div aria-hidden="true" style={{ height: PRINTER_LIP }} />
                    {paperContent}
                  </motion.div>
                ) : (
                  <div className="relative overflow-hidden" style={{ height: 0 }}>
                    {paperContent}
                  </div>
                )}
              </div>

              {/* action panel */}
              <motion.div
                ref={panelRef}
                tabIndex={-1}
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.4,
                  ease: EASE_SETTLE,
                  delay: prefersReducedMotion ? 0 : Math.max(0, feedMs),
                }}
                className="mt-6 rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-[0_18px_38px_-24px_rgba(15,23,42,.55)] focus:outline-none"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100">
                    <Check size={19} strokeWidth={2.6} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">
                      Transaksi Berhasil
                    </h3>
                    <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                      <span className="font-semibold tabular-nums text-slate-700">
                        {formatRupiah(totalBayar)}
                      </span>{' '}
                      dibayar dengan {jenisBayar}. Struk sudah dicetak dari printer di atas.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button
                    onClick={onHandlePrint}
                    variant="secondary"
                    icon={<Printer size={16} />}
                    className="min-h-[46px] flex-col gap-1 rounded-xl bg-slate-50 px-1 py-2 text-[11.5px] shadow-none hover:bg-slate-100"
                  >
                    Cetak
                  </Button>

                  <Button
                    onClick={onSendWhatsApp}
                    variant="secondary"
                    icon={<MessageCircle size={16} />}
                    className="min-h-[46px] flex-col gap-1 rounded-xl bg-slate-50 px-1 py-2 text-[11.5px] shadow-none hover:bg-slate-100"
                  >
                    Bagikan
                  </Button>

                  <Button
                    onClick={() => handleExportSoftFile('png')}
                    loading={softLoading === 'png'}
                    disabled={!!softLoading}
                    variant="secondary"
                    icon={<FileImage size={16} />}
                    className="min-h-[46px] flex-col gap-1 rounded-xl bg-slate-50 px-1 py-2 text-[11.5px] shadow-none hover:bg-slate-100"
                  >
                    PNG
                  </Button>
                </div>

                <Button
                  onClick={onClose}
                  className="mt-2 min-h-[46px] w-full rounded-xl bg-rose-600 py-2.5 font-bold text-white shadow-[0_10px_20px_-12px_rgba(225,29,72,.9)] transition-colors hover:bg-rose-700 active:scale-[0.99]"
                >
                  Transaksi Baru
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Hidden print reference, unchanged: print, PDF and PNG all read from here */}
          <div className="hidden print:block">
            <div ref={strukRef}>
              <Struk
                cart={cart}
                subTotal={subTotal}
                pajak={pajakAmount}
                pajakPersen={pajakPersen}
                totalBayar={totalBayar}
                promoDiskon={promoDiskon}
                bayar={paidAmount}
                kembalian={kembalian}
                kdTransaksi={lastKd ?? ''}
                jenisBayar={jenisBayar}
                customerName={selectedCustomer?.nama_customer}
                poinEarned={poinEarned}
                kasirName={user?.nama_pengguna}
              />
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}