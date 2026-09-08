import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Power, Crown, Zap, Star, Check,
  Package, TrendingUp, Clock, DollarSign, Award, Trash2,
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { formatRupiah } from '../utils/format'
import type { SubscriptionPlan } from '../../shared/types'
import { SkeletonStatGrid } from '../components/Skeleton'

// ─── Form State ───────────────────────────────────────────────────────

interface PlanForm {
  name: string
  price: string
  duration_days: string
  features: string
  is_active: boolean
  is_recommended: boolean
  max_devices: string
  max_transactions_per_day: string
  max_products: string
  max_users: string
  feature_flags: Record<string, boolean>
}

const EMPTY_FORM: PlanForm = {
  name: '',
  price: '',
  duration_days: '',
  features: '',
  is_active: true,
  is_recommended: false,
  max_devices: '1',
  max_transactions_per_day: '-1',
  max_products: '-1',
  max_users: '1',
  feature_flags: {},
}

const FEATURE_OPTIONS = [
  { code: 'reports', label: 'Laporan' },
  { code: 'export_excel', label: 'Export Excel' },
  { code: 'export_pdf', label: 'Export PDF' },
  { code: 'multi_user', label: 'Multi User' },
  { code: 'backup', label: 'Backup' },
  { code: 'restore', label: 'Restore' },
  { code: 'stock_opname', label: 'Stock Opname' },
  { code: 'debt_management', label: 'Hutang/Piutang' },
  { code: 'shift_management', label: 'Shift' },
  { code: 'api_access', label: 'API Access' },
]

// ─── Plan Icon Picker ─────────────────────────────────────────────────

function getPlanIcon(name: string, size = 20) {
  const n = name.toLowerCase()
  if (n.includes('hari') || n.includes('daily')) return <Zap size={size} />
  if (n.includes('tahun') || n.includes('year')) return <Star size={size} />
  return <Crown size={size} />
}

function getPlanColor(plan: SubscriptionPlan): string {
  if (!plan.is_active) return 'from-slate-400 to-slate-500'
  if (plan.is_recommended) return 'from-violet-600 to-purple-500'
  const n = plan.name.toLowerCase()
  if (n.includes('hari') || n.includes('daily')) return 'from-amber-500 to-orange-500'
  if (n.includes('tahun') || n.includes('year')) return 'from-emerald-500 to-teal-500'
  return 'from-blue-500 to-indigo-500'
}

// ─── Component ────────────────────────────────────────────────────────

export default function SubscriptionPlans() {
  const toast = useToast()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<PlanForm>({ ...EMPTY_FORM })
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    const r = await api<SubscriptionPlan[]>('plan:getAll')
    if (r.success) setPlans(r.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ─── Handlers ─────────────────────────────────────────────────────

  const openAdd = () => {
    setForm({ ...EMPTY_FORM })
    setSelected(null)
    setModal('add')
  }

  const openEdit = (plan: SubscriptionPlan) => {
    setSelected(plan)
    setForm({
      name: plan.name,
      price: String(plan.price),
      duration_days: String(plan.duration_days),
      features: plan.features.join('\n'),
      is_active: plan.is_active,
      is_recommended: plan.is_recommended,
      max_devices: String(plan.max_devices ?? 1),
      max_transactions_per_day: String(plan.max_transactions_per_day ?? -1),
      max_products: String(plan.max_products ?? -1),
      max_users: String(plan.max_users ?? 1),
      feature_flags: plan.feature_flags ?? {},
    })
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setSelected(null)
  }

  const handleSave = async () => {
    const name = form.name.trim()
    const price = parseInt(form.price)
    const duration_days = parseInt(form.duration_days)
    const features = form.features.split('\n').map(f => f.trim()).filter(Boolean)
    const max_devices = parseInt(form.max_devices)
    const max_transactions_per_day = parseInt(form.max_transactions_per_day)
    const max_products = parseInt(form.max_products)
    const max_users = parseInt(form.max_users)

    if (!name) return toast('Nama paket wajib diisi', 'error')
    if (!price || price <= 0) return toast('Harga harus lebih dari 0', 'error')
    if (!duration_days || duration_days <= 0) return toast('Durasi harus lebih dari 0', 'error')

    setSaving(true)

    const payload = {
      name,
      price,
      duration_days,
      features,
      is_active: form.is_active,
      is_recommended: form.is_recommended,
      max_devices: Number.isFinite(max_devices) ? max_devices : 1,
      max_transactions_per_day: Number.isFinite(max_transactions_per_day) ? max_transactions_per_day : -1,
      max_products: Number.isFinite(max_products) ? max_products : -1,
      max_users: Number.isFinite(max_users) ? max_users : 1,
      feature_flags: form.feature_flags,
    }

    const r = modal === 'add'
      ? await api('plan:create', payload)
      : await api('plan:update', selected!.id, payload)

    setSaving(false)

    if (r.success) {
      toast(r.message as string)
      closeModal()
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDeactivate = async (plan: SubscriptionPlan) => {
    const r = plan.is_active
      ? await api('plan:deactivate', plan.id)
      : await api('plan:update', plan.id, { is_active: true })

    if (r.success) {
      toast(r.message as string)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDelete = async (plan: SubscriptionPlan) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus paket "${plan.name}"? Paket yang sudah dihapus tidak bisa dikembalikan.`
    )
    if (!confirmed) return

    setDeletingId(plan.id)
    const r = await api('plan:delete', plan.id)
    setDeletingId(null)

    if (r.success) {
      toast(r.message as string)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const setField = (key: keyof PlanForm, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleFeature = (code: string) => {
    setForm(prev => ({
      ...prev,
      feature_flags: {
        ...prev.feature_flags,
        [code]: prev.feature_flags[code] === false,
      },
    }))
  }

  // ─── Stats ────────────────────────────────────────────────────────

  const activePlans = plans.filter(p => p.is_active)
  const recommendedPlan = plans.find(p => p.is_recommended && p.is_active)

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) return <SkeletonStatGrid count={3} />

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg">
            <Package size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Paket</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{plans.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-lg">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Paket Aktif</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{activePlans.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-lg">
            <Award size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Rekomendasi</p>
            <p className="text-sm font-bold text-slate-800 dark:text-white">
              {recommendedPlan?.name ?? 'Belum dipilih'}
            </p>
          </div>
        </Card>
      </div>

      {/* Plans Grid */}
      <Card
        title="Paket Langganan"
        action={
          <Button icon={<Plus size={14} />} onClick={openAdd} className="text-xs px-3 py-1.5">
            Tambah Paket
          </Button>
        }
      >
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Clock size={24} className="animate-spin mx-auto mb-2" />
            Memuat...
          </div>
        ) : plans.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-500 font-medium">Belum ada paket</p>
            <p className="text-sm text-slate-400 mt-1">Klik "Tambah Paket" untuk membuat paket pertama</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-5 transition-all duration-300
                  ${plan.is_active
                    ? plan.is_recommended
                      ? 'border-purple-400 dark:border-purple-600 bg-gradient-to-b from-purple-50/50 to-violet-50/30 dark:from-purple-900/15 dark:to-violet-900/10 shadow-lg shadow-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md'
                    : 'border-slate-200/60 dark:border-slate-800 opacity-60'
                  }`}
              >
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3">
                  {plan.is_recommended && plan.is_active && (
                    <Badge label="Rekomendasi" variant="purple" />
                  )}
                  <Badge
                    label={plan.is_active ? 'Aktif' : 'Nonaktif'}
                    variant={plan.is_active ? 'green' : 'red'}
                  />
                </div>

                {/* Icon + Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${getPlanColor(plan)} text-white shadow-md`}>
                    {getPlanIcon(plan.name)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400">{plan.duration_days === 0 ? 'Seumur hidup' : `${plan.duration_days} hari`}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-2xl font-extrabold text-slate-800 dark:text-white">
                    {formatRupiah(plan.price)}
                  </span>
                  <span className="text-sm text-slate-400 ml-1">
                    /{plan.duration_days === 0 ? 'seumur hidup' : plan.duration_days === 1 ? 'hari' : plan.duration_days === 30 ? 'bulan' : plan.duration_days === 365 ? 'tahun' : `${plan.duration_days} hari`}
                  </span>
                  {plan.duration_days > 1 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      ≈ {formatRupiah(Math.round(plan.price / plan.duration_days))}/hari
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1.5">
                    <span className="text-slate-400">Device</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{plan.max_devices === -1 ? 'Unlimited' : plan.max_devices}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1.5">
                    <span className="text-slate-400">Transaksi/hari</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{plan.max_transactions_per_day === -1 ? 'Unlimited' : plan.max_transactions_per_day}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1.5">
                    <span className="text-slate-400">Produk</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{plan.max_products === -1 ? 'Unlimited' : plan.max_products}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1.5">
                    <span className="text-slate-400">User</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{plan.max_users === -1 ? 'Unlimited' : plan.max_users}</p>
                  </div>
                </div>

                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check size={13} className="shrink-0 mt-0.5 text-emerald-500" />
                      <span className="text-slate-600 dark:text-slate-300">{f}</span>
                    </li>
                  ))}
                  {plan.features.length === 0 && (
                    <li className="text-xs text-slate-400 italic">Belum ada fitur</li>
                  )}
                </ul>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  <button
                    onClick={() => openEdit(plan)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                      text-xs font-medium text-primary-600 dark:text-primary-400
                      bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30
                      transition-colors"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeactivate(plan)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                      text-xs font-medium transition-colors
                      ${plan.is_active
                        ? 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                        : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                      }`}
                  >
                    <Power size={13} />
                    {plan.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    disabled={deletingId === plan.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                      text-xs font-medium text-red-600 dark:text-red-400
                      bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30
                      disabled:opacity-60 transition-colors"
                  >
                    <Trash2 size={13} />
                    {deletingId === plan.id ? 'Hapus...' : 'Hapus'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={closeModal}
        title={modal === 'add' ? 'Tambah Paket' : 'Edit Paket'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button loading={saving} onClick={handleSave} className="w-full sm:w-auto">
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nama Paket *"
            placeholder="contoh: Bulanan"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Harga (Rp) *"
              type="number"
              placeholder="299000"
              value={form.price}
              onChange={e => setField('price', e.target.value)}
            />
            <Input
              label="Durasi (hari) *"
              type="number"
              placeholder="30"
              value={form.duration_days}
              onChange={e => setField('duration_days', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Fitur (satu per baris)
            </label>
            <textarea
              value={form.features}
              onChange={e => setField('features', e.target.value)}
              rows={5}
              placeholder="Transaksi tak terbatas&#10;Export Excel & PDF&#10;Multi-user (3 akun)"
              className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-600
                bg-white/80 dark:bg-slate-700/80 px-3 py-2 text-sm
                text-slate-800 dark:text-slate-100
                focus:outline-none focus:ring-2 focus:ring-primary-400
                placeholder:text-slate-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Limit Paket (-1 = unlimited)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Limit Device" type="number" value={form.max_devices} onChange={e => setField('max_devices', e.target.value)} />
              <Input label="Transaksi / Hari" type="number" value={form.max_transactions_per_day} onChange={e => setField('max_transactions_per_day', e.target.value)} />
              <Input label="Limit Produk" type="number" value={form.max_products} onChange={e => setField('max_products', e.target.value)} />
              <Input label="Limit User" type="number" value={form.max_users} onChange={e => setField('max_users', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Kontrol Fitur Premium
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURE_OPTIONS.map(feature => (
                <label key={feature.code} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 cursor-pointer">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{feature.label}</span>
                  <input
                    type="checkbox"
                    checked={form.feature_flags[feature.code] !== false}
                    onChange={() => toggleFeature(feature.code)}
                    className="w-4 h-4 rounded accent-primary-500"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setField('is_active', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">Aktif</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_recommended}
                onChange={e => setField('is_recommended', e.target.checked)}
                className="w-4 h-4 rounded accent-purple-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Rekomendasi
              </span>
            </label>
          </div>

          {form.is_recommended && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
              Menandai paket ini sebagai rekomendasi akan menghapus status rekomendasi dari paket lain.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
