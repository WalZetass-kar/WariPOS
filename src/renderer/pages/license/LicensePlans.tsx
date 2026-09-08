import { useState, useEffect, useCallback } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AlertTriangle, Check, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import { SkeletonPage } from '../../components/Skeleton'

interface PlanRow {
  id: string
  code: string
  name: string
  price: number
  currency?: string | null
  duration_days: number
  description: string | null
  is_active: number | boolean
  is_recommended?: number | boolean
  max_devices?: number | null
  max_transactions_per_day?: number | null
  max_products?: number | null
  max_users?: number | null
  sort_order?: number | null
}

interface FeatureRow {
  id: string
  code: string
  name: string
  category: string | null
  sort_order: number
  is_enabled: number
  limit_value: number | null
}

interface PlanFormState {
  code: string
  name: string
  description: string
  price: string
  currency: string
  duration_days: string
  max_devices: string
  max_transactions_per_day: string
  max_products: string
  max_users: string
  sort_order: string
  is_active: boolean
  is_recommended: boolean
}

const EMPTY_PLAN: PlanFormState = {
  code: '',
  name: '',
  description: '',
  price: '0',
  currency: 'IDR',
  duration_days: '30',
  max_devices: '1',
  max_transactions_per_day: '-1',
  max_products: '-1',
  max_users: '1',
  sort_order: '0',
  is_active: true,
  is_recommended: false,
}

const PLAN_COLORS: Record<string, string> = {
  DEMO: 'from-slate-500 to-slate-400',
  TRIAL_3_DAYS: 'from-slate-500 to-slate-400',
  BASIC: 'from-blue-500 to-blue-400',
  BASIC_MONTHLY: 'from-blue-500 to-blue-400',
  PRO: 'from-primary-600 to-primary-400',
  PRO_MONTHLY: 'from-primary-600 to-primary-400',
  PRO_ANNUAL: 'from-emerald-600 to-teal-400',
  TAHUNAN: 'from-emerald-600 to-teal-400',
  LIFETIME: 'from-amber-500 to-yellow-500',
  SEUMUR_HIDUP: 'from-amber-500 to-yellow-500',
  ENTERPRISE: 'from-violet-600 to-purple-400',
}

const ALL_FEATURE_CODES = [
  'reports',
  'export_excel',
  'export_pdf',
  'multi_user',
  'backup',
  'restore',
  'stock_opname',
  'debt_management',
  'shift_management',
  'api_access',
  'multi_branch',
  'return_refund',
]

const WEEKLY_PLAN_PAYLOAD = {
  code: 'WEEKLY',
  name: 'Mingguan',
  description: 'Paket 7 hari untuk operasional toko: max 1 perangkat, max 2 kasir/pengguna lokal, batas 100 transaksi/hari.',
  price: 19000,
  currency: 'IDR',
  duration_days: 7,
  max_devices: 1,
  max_transactions_per_day: 100,
  max_products: 100,
  max_users: 2,
  sort_order: 10,
  is_active: true,
  is_recommended: false,
  feature_flags: {
    reports: true,
    export_excel: false,
    export_pdf: true,
    multi_user: true,
    backup: true,
    restore: false,
    stock_opname: false,
    debt_management: false,
    shift_management: true,
    api_access: false,
  },
}

const ANNUAL_PLAN_PAYLOAD = {
  code: 'PRO_ANNUAL',
  name: 'Tahunan',
  description: 'Paket 1 tahun untuk operasional lengkap: max 10 perangkat, max 15 kasir/pengguna, laporan, export Excel/PDF, multi-user, backup/restore, stock opname, hutang/piutang, shift, API, multi cabang, dan retur/refund.',
  price: 990000,
  currency: 'IDR',
  duration_days: 365,
  max_devices: 10,
  max_transactions_per_day: -1,
  max_products: -1,
  max_users: 15,
  sort_order: 30,
  is_active: true,
  is_recommended: false,
  feature_flags: Object.fromEntries(ALL_FEATURE_CODES.map(code => [code, true])),
}

const LIFETIME_PLAN_PAYLOAD = {
  code: 'LIFETIME',
  name: 'Sekali Beli Seumur Hidup',
  description: 'Paket sekali bayar untuk akses permanen: max 20 perangkat, max 50 pengguna, semua fitur operasional, multi-user, backup/restore, stock opname, hutang/piutang, shift, API, multi cabang, dan retur/refund.',
  price: 2500000,
  currency: 'IDR',
  duration_days: 0,
  max_devices: 20,
  max_transactions_per_day: -1,
  max_products: -1,
  max_users: 50,
  sort_order: 40,
  is_active: true,
  is_recommended: true,
  feature_flags: Object.fromEntries(ALL_FEATURE_CODES.map(code => [code, true])),
}

const PLAN_FEATURE_SUMMARIES: Record<'trial' | 'basic' | 'pro' | 'enterprise', string[]> = {
  trial: [
    'Akses coba terbatas',
    '1 device',
    'Limit transaksi dan produk',
    'Fitur premium terkunci',
  ],
  basic: [
    'Laporan dasar',
    'Backup data',
    'Return/refund',
    'Cocok untuk satu toko kecil',
  ],
  pro: [
    'Export Excel dan PDF',
    'Multi-user',
    'Restore/import backup',
    'Stock opname, hutang/piutang, shift, dan API',
  ],
  enterprise: [
    'Semua fitur Pro',
    'Multi cabang',
    'Produk dan transaksi unlimited',
    'Akses penuh untuk operasional lengkap',
  ],
}

function isOn(value: unknown) {
  return value === true || value === 1
}

function limitLabel(value?: number | null) {
  if (value === -1) return 'Unlimited'
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString('id-ID')
}

function durationLabel(days?: number | null) {
  if (days === 0) return 'Seumur hidup'
  if (days === null || days === undefined) return '-'
  return `${days} hari`
}

function toNumber(value: string, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
}

function formFromPlan(plan: PlanRow): PlanFormState {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? '',
    price: String(plan.price ?? 0),
    currency: plan.currency ?? 'IDR',
    duration_days: String(plan.duration_days ?? 30),
    max_devices: String(plan.max_devices ?? 1),
    max_transactions_per_day: String(plan.max_transactions_per_day ?? -1),
    max_products: String(plan.max_products ?? -1),
    max_users: String(plan.max_users ?? 1),
    sort_order: String(plan.sort_order ?? 0),
    is_active: isOn(plan.is_active),
    is_recommended: isOn(plan.is_recommended),
  }
}

function payloadFromForm(form: PlanFormState, includeCode: boolean) {
  return {
    ...(includeCode ? { code: cleanCode(form.code) } : {}),
    name: form.name.trim(),
    description: form.description.trim() || null,
    price: Math.max(0, toNumber(form.price, 0)),
    currency: form.currency.trim() || 'IDR',
    duration_days: Math.max(0, toNumber(form.duration_days, 30)),
    max_devices: toNumber(form.max_devices, 1),
    max_transactions_per_day: toNumber(form.max_transactions_per_day, -1),
    max_products: toNumber(form.max_products, -1),
    max_users: toNumber(form.max_users, 1),
    sort_order: toNumber(form.sort_order, 0),
    is_active: form.is_active,
    is_recommended: form.is_recommended,
  }
}

const BASIC_FEATURE_CODES = ['reports', 'backup', 'return_refund']
const PRO_FEATURE_CODES = [
  'reports',
  'export_excel',
  'export_pdf',
  'multi_user',
  'backup',
  'restore',
  'stock_opname',
  'debt_management',
  'shift_management',
  'api_access',
  'return_refund',
]

function featurePresetForPlan(plan: PlanRow): 'trial' | 'basic' | 'pro' | 'enterprise' | null {
  const code = cleanCode(plan.code)
  const name = plan.name.toLowerCase()
  if (code.includes('TRIAL') || code.includes('DEMO') || name.includes('trial') || name === 'harian') return 'trial'
  if (code.includes('LIFETIME') || code.includes('SEUMUR') || name.includes('seumur') || name.includes('lifetime')) return 'enterprise'
  if (code.includes('ENTERPRISE') || code.includes('TAHUNAN') || code.includes('ANNUAL') || name.includes('enterprise') || name.includes('tahunan')) return 'enterprise'
  if (code.includes('PRO') || name.includes('pro')) return 'pro'
  if (code.includes('BASIC') || name.includes('basic') || name === 'bulanan') return 'basic'
  return null
}

function applyFeaturePreset(plan: PlanRow, features: FeatureRow[]) {
  const preset = featurePresetForPlan(plan)
  if (!preset) return features
  if (preset === 'enterprise') return features.map(feature => ({ ...feature, is_enabled: 1 }))

  const enabled = new Set(preset === 'basic' ? BASIC_FEATURE_CODES : preset === 'pro' ? PRO_FEATURE_CODES : [])
  return features.map(feature => ({ ...feature, is_enabled: enabled.has(feature.code) ? 1 : 0 }))
}

function planFeatureSummary(plan: PlanRow) {
  const preset = featurePresetForPlan(plan)
  return preset ? PLAN_FEATURE_SUMMARIES[preset] : []
}

export default function LicensePlansPage() {
  const toast = useToast()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [featurePlan, setFeaturePlan] = useState<PlanRow | null>(null)
  const [formPlan, setFormPlan] = useState<PlanRow | null>(null)
  const [deletePlanTarget, setDeletePlanTarget] = useState<PlanRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addingAnnual, setAddingAnnual] = useState(false)
  const [addingLifetime, setAddingLifetime] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<PlanRow[]>('license:getPlans')
    if (r.success) setPlans(r.data ?? [])
    else toast(r.message || 'Gagal memuat paket', 'error')
    setLoading(false)
  }, [toast])

  useEffect(() => { void load() }, [load])

  async function toggleActive(plan: PlanRow) {
    const r = await api('license:updatePlan', plan.id, { is_active: !isOn(plan.is_active) })
    if (!r.success) toast(r.message || 'Gagal mengubah status paket', 'error')
    void load()
  }

  async function deletePlan(plan: PlanRow) {
    setDeletingId(plan.id)
    const r = await api('license:deletePlan', plan.id)
    setDeletingId(null)
    if (!r.success) return toast(r.message || 'Gagal menghapus paket', 'error')
    toast('Paket berhasil dihapus', 'success')
    setDeletePlanTarget(null)
    void load()
  }

  const hasAnnualPlan = plans.some(plan => {
    const code = cleanCode(plan.code)
    const name = plan.name.toLowerCase()
    return code.includes('ANNUAL') || code.includes('TAHUNAN') || name.includes('tahunan')
  })

  const hasLifetimePlan = plans.some(plan => {
    const code = cleanCode(plan.code)
    const name = plan.name.toLowerCase()
    return code.includes('LIFETIME') || code.includes('SEUMUR') || name.includes('seumur') || name.includes('lifetime') || plan.duration_days === 0
  })

  async function addAnnualPlan() {
    setAddingAnnual(true)
    const result = await api<PlanRow>('license:createPlan', ANNUAL_PLAN_PAYLOAD)
    if (!result.success || !result.data?.id) {
      setAddingAnnual(false)
      return toast(result.message || 'Gagal menambahkan paket tahunan', 'error')
    }

    const features = await api<FeatureRow[]>('license:getPlanFeatures', result.data.id)
    if (features.success && features.data?.length) {
      await api('license:setPlanFeatures', result.data.id, {
        features: features.data.map(feature => ({ code: feature.code, enabled: true, limit: feature.limit_value })),
      })
    }
    setAddingAnnual(false)
    toast('Paket Tahunan berhasil ditambahkan', 'success')
    void load()
  }

  async function addLifetimePlan() {
    setAddingLifetime(true)
    const result = await api<PlanRow>('license:createPlan', LIFETIME_PLAN_PAYLOAD)
    if (!result.success || !result.data?.id) {
      setAddingLifetime(false)
      return toast(result.message || 'Gagal menambahkan paket lifetime', 'error')
    }

    const features = await api<FeatureRow[]>('license:getPlanFeatures', result.data.id)
    if (features.success && features.data?.length) {
      await api('license:setPlanFeatures', result.data.id, {
        features: features.data.map(feature => ({ code: feature.code, enabled: true, limit: feature.limit_value })),
      })
    }
    setAddingLifetime(false)
    toast('Paket Lifetime berhasil ditambahkan', 'success')
    void load()
  }

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Paket di sini adalah sumber utama untuk harga Android, pembeli, popup upgrade, limit, dan fitur lisensi.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!hasAnnualPlan && (
            <button
              onClick={addAnnualPlan}
              disabled={addingAnnual}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              <Plus className="h-4 w-4" />
              {addingAnnual ? 'Menambahkan...' : 'Tambah Paket Tahunan Opsional'}
            </button>
          )}
          {!hasLifetimePlan && (
            <button
              onClick={addLifetimePlan}
              disabled={addingLifetime}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-950/30"
            >
              <Plus className="h-4 w-4" />
              {addingLifetime ? 'Menambahkan...' : 'Tambah Sekali Beli'}
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Paket
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Memuat...</p>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Belum ada paket. Buat paket pertama dari tombol Tambah Paket.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {plans.map(plan => {
            const gradient = PLAN_COLORS[plan.code] || 'from-slate-600 to-slate-400'
            const active = isOn(plan.is_active)
            const summary = planFeatureSummary(plan)
            return (
              <div key={plan.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className={`bg-gradient-to-br ${gradient} p-5`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold uppercase tracking-wider text-white/70">{plan.code}</p>
                      <h3 className="mt-1 truncate text-xl font-bold text-white">{plan.name}</h3>
                    </div>
                    <button
                      onClick={() => toggleActive(plan)}
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${active ? 'bg-white/20 text-white' : 'bg-black/20 text-white/60'}`}
                    >
                      {active ? 'Aktif' : 'Off'}
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {plan.price === 0 ? 'Gratis' : `Rp ${Number(plan.price).toLocaleString('id-ID')}`}
                  </p>
                  <p className="mt-0.5 text-xs text-white/70">{durationLabel(plan.duration_days)}</p>
                  {isOn(plan.is_recommended) && (
                    <span className="mt-3 inline-flex rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold uppercase text-white">
                      Rekomendasi
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <p className="min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">{plan.description || '-'}</p>
                  {summary.length > 0 && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fitur didapat</p>
                      <ul className="space-y-1">
                        {summary.map(item => (
                          <li key={item} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <span className="mt-1.5 h-1 w-1 rounded-full bg-primary-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Limit label="Device" value={limitLabel(plan.max_devices)} />
                    <Limit label="Transaksi/hari" value={limitLabel(plan.max_transactions_per_day)} />
                    <Limit label="Produk" value={limitLabel(plan.max_products)} />
                    <Limit label="Pengguna Lokal" value={limitLabel(plan.max_users)} />
                  </div>
                  <div className="mt-auto grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setFormPlan(plan)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setFeaturePlan(plan)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Fitur
                    </button>
                    <button
                      onClick={() => setDeletePlanTarget(plan)}
                      disabled={deletingId === plan.id}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === plan.id ? '...' : 'Hapus'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <PlanFormModal
          mode="create"
          initial={EMPTY_PLAN}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); void load() }}
        />
      )}
      {formPlan && (
        <PlanFormModal
          mode="edit"
          initial={formFromPlan(formPlan)}
          onClose={() => setFormPlan(null)}
          onSaved={() => { setFormPlan(null); void load() }}
          planId={formPlan.id}
        />
      )}
      {deletePlanTarget && (
        <DeletePlanModal
          plan={deletePlanTarget}
          deleting={deletingId === deletePlanTarget.id}
          onClose={() => setDeletePlanTarget(null)}
          onConfirm={() => deletePlan(deletePlanTarget)}
        />
      )}
      {featurePlan && <PlanFeaturesModal plan={featurePlan} onClose={() => setFeaturePlan(null)} />}
    </div>
  )
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}

function PlanFormModal({
  mode,
  initial,
  planId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  initial: PlanFormState
  planId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<PlanFormState>(initial)
  const [saving, setSaving] = useState(false)
  const isEdit = mode === 'edit'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast('Nama paket wajib diisi', 'error')
    if (!isEdit && !cleanCode(form.code)) return toast('Kode paket wajib diisi', 'error')

    setSaving(true)
    const payload = payloadFromForm(form, !isEdit)
    const result = isEdit
      ? await api('license:updatePlan', planId, payload)
      : await api('license:createPlan', payload)
    setSaving(false)

    if (!result.success) return toast(result.message || 'Gagal menyimpan paket', 'error')
    toast(isEdit ? 'Paket berhasil diperbarui' : 'Paket berhasil dibuat', 'success')
    onSaved()
  }

  const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">{isEdit ? 'Edit Paket' : 'Tambah Paket'}</h3>
          <button onClick={onClose} className="text-xl text-slate-400 hover:text-slate-600">x</button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Kode Paket">
              <input
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: cleanCode(e.target.value) }))}
                disabled={isEdit}
                placeholder="BASIC_MONTHLY"
                className={`${input} disabled:cursor-not-allowed disabled:opacity-60`}
              />
            </Field>
            <Field label="Nama Paket">
              <input required value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Basic Bulanan" className={input} />
            </Field>
            <Field label="Harga">
              <input type="number" min={0} value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} className={input} />
            </Field>
            <Field label="Durasi Hari">
              <input type="number" min={0} value={form.duration_days} onChange={e => setForm(prev => ({ ...prev, duration_days: e.target.value }))} className={input} />
            </Field>
            <Field label="Currency">
              <input value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))} className={input} />
            </Field>
            <Field label="Urutan">
              <input type="number" value={form.sort_order} onChange={e => setForm(prev => ({ ...prev, sort_order: e.target.value }))} className={input} />
            </Field>
          </div>

          <Field label="Deskripsi">
            <textarea rows={3} value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} className={input} />
          </Field>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Limit Paket</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Field label="Max Device">
                <input type="number" value={form.max_devices} onChange={e => setForm(prev => ({ ...prev, max_devices: e.target.value }))} className={input} />
              </Field>
              <Field label="Transaksi/Hari">
                <input type="number" value={form.max_transactions_per_day} onChange={e => setForm(prev => ({ ...prev, max_transactions_per_day: e.target.value }))} className={input} />
              </Field>
              <Field label="Max Produk">
                <input type="number" value={form.max_products} onChange={e => setForm(prev => ({ ...prev, max_products: e.target.value }))} className={input} />
              </Field>
              <Field label="Max Pengguna Lokal">
                <input type="number" value={form.max_users} onChange={e => setForm(prev => ({ ...prev, max_users: e.target.value }))} className={input} />
              </Field>
            </div>
            <p className="mt-2 text-xs text-slate-400">Isi -1 untuk limit unlimited. Durasi 0 berarti seumur hidup.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle
              label="Paket aktif"
              checked={form.is_active}
              onChange={checked => setForm(prev => ({ ...prev, is_active: checked }))}
            />
            <Toggle
              label="Jadikan rekomendasi"
              checked={form.is_recommended}
              onChange={checked => setForm(prev => ({ ...prev, is_recommended: checked }))}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">Batal</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-primary-600" />
    </label>
  )
}

function DeletePlanModal({
  plan,
  deleting,
  onClose,
  onConfirm,
}: {
  plan: PlanRow
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => { if (!deleting) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-800 dark:text-white">Hapus Paket</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {plan.name} akan dihapus dari pusat lisensi.
            </p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Kode Paket</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{plan.code}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            Paket yang sudah dipakai pembeli, subscription, atau pembayaran tidak bisa dihapus. Nonaktifkan paket kalau hanya ingin disembunyikan dari pembelian baru.
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanFeaturesModal({ plan, onClose }: { plan: PlanRow; onClose: () => void }) {
  const toast = useToast()
  const [features, setFeatures] = useState<FeatureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<FeatureRow[]>('license:getPlanFeatures', plan.id).then(r => {
      if (r.success) setFeatures(r.data ?? [])
      setLoading(false)
    })
  }, [plan.id])

  function toggle(code: string) {
    setFeatures(arr => arr.map(f => f.code === code ? { ...f, is_enabled: f.is_enabled ? 0 : 1 } : f))
  }

  function setLimit(code: string, val: string) {
    setFeatures(arr => arr.map(f => f.code === code ? { ...f, limit_value: val === '' ? null : Number(val) } : f))
  }

  async function save() {
    setSaving(true)
    const r = await api('license:setPlanFeatures', plan.id, {
      features: features.map(f => ({ code: f.code, enabled: !!f.is_enabled, limit: f.limit_value })),
    })
    setSaving(false)
    if (r.success) { toast('Fitur berhasil disimpan', 'success'); onClose() }
    else toast(r.message || 'Gagal', 'error')
  }

  function applyPreset() {
    setFeatures(current => applyFeaturePreset(plan, current))
    toast('Preset fitur paket diterapkan. Klik Simpan untuk menyimpan ke Supabase.', 'info')
  }

  const grouped = features.reduce<Record<string, FeatureRow[]>>((acc, feature) => {
    const key = feature.category || 'lainnya'
    ;(acc[key] = acc[key] || []).push(feature)
    return acc
  }, {})
  const hasPreset = featurePresetForPlan(plan) !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Fitur - {plan.name}</h3>
          <button onClick={onClose} className="text-xl text-slate-400 hover:text-slate-600">x</button>
        </div>
        <div className="p-5">
          {loading ? <p className="text-sm text-slate-400">Memuat...</p> : (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">Centang fitur aktif. Isi Limit untuk batasi per hari. Kosongkan untuk unlimited.</p>
                {hasPreset && (
                  <button
                    type="button"
                    onClick={applyPreset}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Terapkan Preset
                  </button>
                )}
              </div>
              {features.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Belum ada master fitur.
                </div>
              ) : (
                <div className="max-h-[50vh] space-y-4 overflow-auto pr-1">
                  {Object.entries(grouped).map(([category, list]) => (
                    <div key={category}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{category}</p>
                      <div className="space-y-1">
                        {list.map(feature => (
                          <div key={feature.code} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${feature.is_enabled ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                            <button
                              type="button"
                              onClick={() => toggle(feature.code)}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${feature.is_enabled ? 'border-primary-600 bg-primary-600' : 'border-slate-300 dark:border-slate-600'}`}
                            >
                              {feature.is_enabled ? <Check className="h-3 w-3 text-white" /> : null}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{feature.name}</p>
                              <p className="font-mono text-[11px] text-slate-400">{feature.code}</p>
                            </div>
                            <input
                              type="number"
                              placeholder="inf"
                              value={feature.limit_value ?? ''}
                              onChange={e => setLimit(feature.code, e.target.value)}
                              className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-slate-700 dark:bg-slate-800"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">Batal</button>
                <button onClick={save} disabled={saving} className="rounded-xl bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
