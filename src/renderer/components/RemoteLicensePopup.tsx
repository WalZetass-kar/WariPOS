import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  HelpCircle,
  Laptop,
  Loader2,
  Lock,
  MessageCircle,
  Package,
  Radio,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { api } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useDemo } from '../contexts/DemoContext'
import { sanitizeHtml } from '../utils/sanitizeHtml'
import { SUBSCRIPTION_UPGRADE_WA_NUMBER, normalizePhoneNumber } from '../utils/whatsapp'

export interface PublicPlan {
  id: string | number
  code: string
  name: string
  description?: string | null
  features?: string[] | null
  feature_flags?: Record<string, boolean> | null
  price: number
  currency?: string | null
  duration_days: number
  is_recommended?: boolean | number
  sort_order?: number | null
  is_active?: boolean | number
  max_devices?: number
  max_transactions_per_day?: number
  max_products?: number
  max_users?: number
}

interface Invoice {
  external_ref?: string
  invoice_number?: string
  payment_url?: string | null
  status?: string
  whatsapp_number?: string | null
  whatsapp_message?: string | null
}

interface RemotePopup {
  code?: string
  title: string
  description?: string | null
  cta_text?: string | null
  cta_url?: string | null
  whatsapp_number?: string | null
  image_url?: string | null
  pricing_html?: string | null
  severity?: 'info' | 'warning' | 'danger'
  dismissible?: boolean
}

interface PopupState {
  popup: RemotePopup
  force: boolean
}

function formatPlanPrice(plan: PublicPlan): string {
  const currency = !plan.currency || plan.currency.toUpperCase() === 'IDR' ? 'Rp' : plan.currency
  return `${currency} ${Number(plan.price || 0).toLocaleString('id-ID')}`
}

function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const target = normalizePhoneNumber(phone || SUBSCRIPTION_UPGRADE_WA_NUMBER)
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`
}

function getPlanPeriodLabel(plan: PublicPlan): string {
  if (plan.duration_days === 0) return 'Sekali Bayar'
  if (plan.duration_days <= 1) return '1 Hari'
  if (plan.duration_days >= 360) return '1 Tahun'
  if (plan.duration_days >= 28 && plan.duration_days <= 31) return '1 Bulan'
  return `${plan.duration_days} Hari`
}

function getPlanHighlights(plan: PublicPlan): string[] {
  if (Array.isArray(plan.features) && plan.features.length > 0) {
    return plan.features.filter(Boolean).slice(0, 4)
  }
  const isLifetime = plan.duration_days === 0
  const isYearly = plan.duration_days >= 360

  if (isLifetime) {
    return [
      'Akses Seumur Hidup Tanpa Iuran',
      'Transaksi Kasir & Stok Tanpa Batas',
      'Laporan Laba Rugi & Neraca Lengkap',
      'Gratis Update Fitur & Support Prioritas',
    ]
  }

  if (isYearly) {
    return [
      'Masa Aktif 1 Tahun Penuh (Hemat)',
      'Semua Fitur Pro & Laporan Keuangan',
      'Multi-User Kasir & Shift Kasir',
      'Export Data Excel & Cetak Struk',
    ]
  }

  return [
    'Transaksi Kasir & Cetak Struk',
    'Manajemen Stok & Harga Barang',
    'Rekap Penjualan & Laba Harian',
    'Dukungan Teknis via WhatsApp',
  ]
}

export default function RemoteLicensePopup() {
  const { user } = useAuth()
  const { state: demoState, remainingUsage } = useDemo()

  const [state, setState] = useState<PopupState | null>(null)
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('')
  const [creatingPlan, setCreatingPlan] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'whatsapp' | 'midtrans'>('whatsapp')

  // Listen to remote popup events
  useEffect(() => {
    const onPopup = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {}
      if (detail.popup?.title) {
        setState({
          popup: detail.popup,
          force: !!detail.force || detail.popup.dismissible === false,
        })
      }
    }
    window.addEventListener('license:remote-popup', onPopup)
    return () => window.removeEventListener('license:remote-popup', onPopup)
  }, [])

  // Close popup automatically ONLY if license gets updated to active paid in realtime
  useEffect(() => {
    const onLicenseUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {}
      const nextUser = detail.user
      if (!nextUser) return

      const isNowPaid =
        nextUser.hak_akses !== 'demo' &&
        (Boolean(nextUser.subscription_plan_name) ||
          Boolean(nextUser.subscription_plan_id) ||
          nextUser.hak_akses === 'developer' ||
          nextUser.hak_akses === 'super_admin')

      if (isNowPaid && state && !state.force) {
        setState(null)
      }
    }
    window.addEventListener('license:updated', onLicenseUpdated)
    return () => window.removeEventListener('license:updated', onLicenseUpdated)
  }, [state])

  // Load public plans from backend / server
  useEffect(() => {
    if (!state) return
    let cancelled = false
    setPlansLoading(true)
    api<PublicPlan[]>('license:getPublicPlans').then(result => {
      if (cancelled) return
      if (result.success && Array.isArray(result.data)) {
        const sorted = [...result.data]
          .filter(p => p.is_active !== false && (p as any).is_active !== 0)
          .sort((a, b) => (Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)) || (Number(a.price || 0) - Number(b.price || 0)))

        setPlans(sorted)
        setSelectedPlanCode(current => current || sorted.find(p => p.is_recommended || p.duration_days === 0)?.code || sorted[0]?.code || '')
      }
    }).finally(() => {
      if (!cancelled) setPlansLoading(false)
    })
    return () => { cancelled = true }
  }, [state?.popup.code, state?.popup.title])

  if (!state) return null

  const { popup, force } = state
  const isDanger = popup.severity === 'danger' || popup.code === 'BLOCKED'
  const isBlocking = force || popup.dismissible === false

  const close = () => {
    if (!isBlocking) setState(null)
  }

  const showPlans = !isDanger || ['EXPIRED', 'FEATURE_LOCKED', 'DEMO_LIMIT', 'ACCESS_EXPIRING', 'TRANSACTION_LIMIT', 'DEVICE_LIMIT', 'PRODUCT_LIMIT'].includes(String(popup.code ?? '').toUpperCase())
  const selectedPlan = plans.find(p => p.code === selectedPlanCode) || plans[0] || null

  const handleCheckout = async (plan: PublicPlan) => {
    if (paymentMethod === 'midtrans') {
      setPaymentMessage('Metode otomatis Midtrans saat ini sedang dalam pemeliharaan berkala. Silakan gunakan Pembayaran Manual via WhatsApp untuk aktivasi langsung.')
      return
    }

    const durationText = plan.duration_days === 0
      ? 'Seumur Hidup (Akses Permanen Sekali Bayar)'
      : `${plan.duration_days} Hari Penuh`

    const message = [
      'Halo Admin WariPOS, saya ingin membeli lisensi resmi:',
      '',
      `Paket: ${plan.name} (${plan.code || plan.id})`,
      `Harga: ${formatPlanPrice(plan)} / ${getPlanPeriodLabel(plan)}`,
      `Durasi: ${durationText}`,
      `Akun: ${user?.nama_lengkap ?? user?.nama_pengguna ?? '-'}`,
      `Email: ${user?.email ?? '-'}`,
      '',
      'Mohon info rekening pembayaran dan aktivasi lisensi resminya. Terima kasih!',
    ].join('\n')

    const directWaUrl = buildWhatsAppUrl(popup.whatsapp_number, message)

    setCreatingPlan(plan.code)
    setPaymentMessage(null)
    try {
      const result = await api<Invoice>('license:createManualPaymentRequest', {
        email: user?.email ?? undefined,
        customer_id: user?.remote_customer_id ?? undefined,
        plan_code: plan.code,
        amount: plan.price,
        name: user?.nama_lengkap ?? user?.nama_pengguna ?? user?.email?.split('@')[0],
      })
      if (result.success && result.data) {
        setInvoice(result.data)
        setPaymentMessage('Membuka WhatsApp Admin Developer...')
        const targetUrl = result.data.payment_url || buildWhatsAppUrl(result.data.whatsapp_number || popup.whatsapp_number, result.data.whatsapp_message || message)
        void api('app:openExternal', targetUrl)
      } else {
        void api('app:openExternal', directWaUrl)
      }
    } catch {
      void api('app:openExternal', directWaUrl)
    } finally {
      setCreatingPlan(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md modal-backdrop-animate"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close()
        }
      }}
    >
      <div
        className="relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 text-white shadow-2xl ring-1 ring-white/10 p-5 sm:p-6 modal-card-animate"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Close Button */}
        {!isBlocking && (
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/15 hover:text-white transition"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative space-y-4">
          {/* ─── Header Minimalis ───────────────────────────────────── */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-bold tracking-wide mb-1">
              <ShieldCheck size={13} className="text-amber-400" />
              <span>UPGRADE LISENSI RESMI</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {popup.title || 'Pilih Paket Lisensi Toko Anda'}
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {popup.description || 'Nikmati kebebasan transaksi tanpa batas, kelola stok akurat, dan ekspor laporan pembukuan toko.'}
            </p>
          </div>

          {/* ─── Demo Warning (Jika Akun Demo) ────────────────────────── */}
          {demoState.is_demo && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Batas Demo: <strong>{remainingUsage} transaksi tersisa</strong></span>
              </div>
              <span className="text-[11px] text-amber-200/70 hidden sm:inline">Akses penuh setelah aktivasi</span>
            </div>
          )}

          {/* ─── Kartu Paket Minimalis ────────────────────────────────── */}
          {showPlans && (
            <div>
              {plansLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  Memuat daftar paket lisensi...
                </div>
              ) : plans.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-center text-xs text-slate-400">
                  Belum ada paket aktif. Hubungi WhatsApp admin untuk informasi lisensi.
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {plans.map(plan => {
                    const active = selectedPlanCode === plan.code
                    const isRecommended = Boolean(plan.is_recommended)
                    const highlights = getPlanHighlights(plan)

                    return (
                      <div
                        key={plan.code || plan.id}
                        onClick={() => setSelectedPlanCode(plan.code)}
                        className={`group relative flex flex-col justify-between rounded-2xl p-4 cursor-pointer transition-all duration-150 border text-left ${
                          active
                            ? 'border-amber-400/90 bg-amber-500/[0.08] shadow-md shadow-amber-500/5 ring-1 ring-amber-400/40'
                            : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700'
                        }`}
                      >
                        {isRecommended && (
                          <div className="absolute -top-2.5 right-3 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shadow-sm">
                            Rekomendasi
                          </div>
                        )}

                        <div>
                          {/* Nama & Durasi */}
                          <div className="flex items-start justify-between gap-1 mb-2">
                            <h4 className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                              {plan.name}
                            </h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                              {getPlanPeriodLabel(plan)}
                            </span>
                          </div>

                          {/* Harga */}
                          <div className="my-2">
                            <div className="text-lg font-black text-white leading-none">
                              {formatPlanPrice(plan)}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {plan.duration_days === 0 ? 'Sekali bayar selamanya' : `Masa aktif ${getPlanPeriodLabel(plan)}`}
                            </span>
                          </div>

                          {/* Bullet Fitur Minimalis */}
                          <ul className="mt-3 space-y-1.5 border-t border-slate-800/60 pt-2.5">
                            {highlights.map((item, idx) => (
                              <li key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300 leading-tight">
                                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Indikator Pilih */}
                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-bold">
                          <span className={active ? 'text-amber-300' : 'text-slate-500'}>
                            {active ? '● Dipilih' : '○ Pilih Paket'}
                          </span>
                          {active && <span className="text-emerald-400 text-[10px]">Siap Beli</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Pilihan Metode Pembayaran & Tombol Beli ──────────────── */}
          {selectedPlan && (
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              {/* Switcher Metode Pembayaran */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] px-1 font-semibold text-slate-400">
                  <span>Pilihan Metode Pembayaran:</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck size={13} />
                    Aktivasi Resmi Terjamin
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Option 1: WhatsApp / Transfer Manual (ACTIVE) */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('whatsapp')}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      paymentMethod === 'whatsapp'
                        ? 'border-emerald-500/80 bg-emerald-950/30 text-white ring-1 ring-emerald-500/40 shadow-sm'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <MessageCircle size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Manual via WhatsApp</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold">
                            AKTIF
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">BCA / Mandiri / BRI / QRIS Manual</p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'whatsapp' ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-700'}`}>
                      {paymentMethod === 'whatsapp' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </button>

                  {/* Option 2: Midtrans Otomatis (UNDER MAINTENANCE) */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('midtrans')
                      setPaymentMessage('Gateway otomatis Midtrans sedang dalam pemeliharaan sistem. Silakan gunakan opsi WhatsApp / Transfer untuk aktivasi langsung.')
                    }}
                    className={`relative flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      paymentMethod === 'midtrans'
                        ? 'border-amber-500/60 bg-amber-950/20 text-white ring-1 ring-amber-500/30'
                        : 'border-slate-800/60 bg-slate-950/20 text-slate-500 hover:border-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                        <CreditCard size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <span>Midtrans Otomatis</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold flex items-center gap-0.5">
                            <Wrench size={9} />
                            MAINTENANCE
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">Dalam pemeliharaan berkala</p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${paymentMethod === 'midtrans' ? 'border-amber-400 bg-amber-500 text-slate-950' : 'border-slate-800'}`}>
                      {paymentMethod === 'midtrans' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Maintenance / Info Alert */}
              {paymentMethod === 'midtrans' && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-2.5">
                  <Wrench size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="text-amber-300 font-bold block">Gateway Midtrans Sedang Pemeliharaan Sistem:</strong>
                    Untuk mengaktifkan lisensi seketika, silakan klik tombol WhatsApp di bawah. Admin kami siap membantu verifikasi dan aktivasi lisensi langsung.
                  </div>
                </div>
              )}

              {paymentMessage && paymentMethod !== 'midtrans' && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{paymentMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="w-full sm:w-auto text-xs text-slate-400 hover:text-slate-200 px-3 py-2 transition"
                >
                  Nanti Saja
                </button>

                <button
                  type="button"
                  onClick={() => handleCheckout(selectedPlan)}
                  disabled={creatingPlan === selectedPlan.code}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                >
                  {creatingPlan === selectedPlan.code ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                  <span>
                    Beli Paket {selectedPlan.name} • {formatPlanPrice(selectedPlan)}
                  </span>
                </button>
              </div>

              {/* Trust Footer Notes */}
              <div className="pt-2 text-center text-[10px] text-slate-500 flex items-center justify-center gap-3 border-t border-slate-800/40">
                <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> Lisensi Toko Resmi</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Zap size={12} className="text-amber-500" /> Aktivasi Cepat</span>
                <span>•</span>
                <span className="flex items-center gap-1"><MessageCircle size={12} className="text-primary-500" /> Bantuan WhatsApp 24/7</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
