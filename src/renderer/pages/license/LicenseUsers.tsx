import { useState, useEffect, useCallback } from 'react'
import { Bell, CheckCircle, Copy, KeyRound, Plus, RotateCcw, Trash2, UserX } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import ConfirmDialog from '../../components/ConfirmDialog'
import { SkeletonPage } from '../../components/Skeleton'

interface UserRow {
  id: string
  name: string
  email: string
  phone?: string | null
  status: string
  plan_code: string | null
  sub_status: string | null
  expired_at: string | null
  active_devices: number
  force_popup_code?: string | null
  force_popup_until?: string | null
}
interface PlanRow {
  id: string
  code: string
  name: string
  price: number
  duration_days: number
  description?: string | null
  max_devices?: number | null
  max_transactions_per_day?: number | null
  max_products?: number | null
  max_users?: number | null
}
interface PlanFeatureRow {
  id: string
  code: string
  name: string
  category: string | null
  is_enabled: number | boolean
  limit_value: number | null
}
interface PopupRow { id: string; code: string; title: string; is_active: number | boolean }
type UserConfirmAction = 'inactive' | 'blocked' | 'delete'

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function LicenseUsersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editPlan, setEditPlan] = useState<UserRow | null>(null)
  const [editPopup, setEditPopup] = useState<UserRow | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: UserConfirmAction; user: UserRow } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null)
  const [resetPasswordResult, setResetPasswordResult] = useState<{ user: UserRow; password: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<UserRow[]>('license:getUsers', search)
    if (r.success) setUsers(r.data ?? [])
    else toast(r.message || 'Gagal memuat', 'error')
    setLoading(false)
  }, [search, toast])

  useEffect(() => { void load() }, [load])

  const resetPassword = async (u: UserRow) => {
    setResetLoadingId(u.id)
    const r = await api<{ password?: string; new_password?: string }>('license:resetUserPassword', u.id)
    setResetLoadingId(null)
    if (r.success && r.data) {
      const generatedPassword = r.data.new_password || r.data.password || ''
      setResetPasswordResult({ user: u, password: generatedPassword })
    } else {
      toast(r.message || 'Gagal reset password', 'error')
    }
  }

  const runConfirmAction = async () => {
    if (!confirmAction) return
    setConfirmLoading(true)
    const { type, user: u } = confirmAction
    let status = u.status
    if (type === 'inactive') status = 'inactive'
    else if (type === 'blocked') status = 'blocked'

    if (type === 'delete') {
      const r = await api('license:deleteUser', u.id)
      if (r.success) {
        toast('Pengguna berhasil dihapus', 'success')
        load()
      } else {
        toast(r.message || 'Gagal menghapus pengguna', 'error')
      }
    } else {
      const r = await api('license:updateUser', u.id, { status })
      if (r.success) {
        toast('Status pengguna diperbarui', 'success')
        load()
      } else {
        toast(r.message || 'Gagal memperbarui status', 'error')
      }
    }
    setConfirmLoading(false)
    setConfirmAction(null)
  }

  const confirmTitle = confirmAction?.type === 'delete'
    ? 'Hapus Pengguna'
    : confirmAction?.type === 'blocked'
    ? 'Blokir Pengguna'
    : 'Nonaktifkan Pengguna'

  const confirmMessage = confirmAction?.type === 'delete'
    ? `Apakah Anda yakin ingin menghapus akun ${confirmAction?.user?.name || ''}? Action ini tidak dapat dibatalkan.`
    : `Apakah Anda yakin ingin mengubah status akun ${confirmAction?.user?.name || ''}?`

  if (loading) return <SkeletonPage rows={8} />

  const visibleUsers = users.filter(u => !statusFilter || u.status === statusFilter || u.sub_status === statusFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / email…"
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 w-64 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
            <option value="">Semua status</option>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="suspended">suspended</option>
            <option value="blocked">blocked</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2 text-sm font-medium">
          <Plus className="w-4 h-4" />Buat Akun Pembeli
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3">Nama</th><th>Email</th><th>Paket</th>
              <th>Status</th><th>Berakhir</th><th>Device</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Memuat…</td></tr>
            ) : visibleUsers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Belum ada user</td></tr>
            ) : visibleUsers.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{u.name}</td>
                <td className="text-slate-500">{u.email}</td>
                <td><span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-medium">{u.plan_code || '—'}</span></td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span className={`w-fit px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[u.status ?? ''] || 'bg-slate-100 text-slate-600'}`}>{u.status || '—'}</span>
                    <span className={`w-fit px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[u.sub_status ?? ''] || 'bg-slate-100 text-slate-600'}`}>{u.sub_status || '—'}</span>
                  </div>
                </td>
                <td className="text-xs text-slate-500">{u.expired_at ? new Date(u.expired_at).toLocaleDateString('id-ID') : '—'}</td>
                <td className="text-xs font-mono text-slate-500 text-center">{u.active_devices}</td>
                <td className="pr-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setEditPlan(u)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">Ubah Paket</button>
                    <button onClick={() => void resetPassword(u)} disabled={resetLoadingId === u.id}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" title="Reset Password"><RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${resetLoadingId === u.id ? 'animate-spin' : ''}`} /></button>
                    <button onClick={() => setEditPopup(u)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" title="Remote popup">
                      <Bell className="w-3.5 h-3.5 text-primary-500" />
                    </button>
                    {u.status !== 'active' && (
                      <button onClick={async () => { await api('license:updateUser', u.id, { status: 'active' }); load() }}
                        className="px-2 py-1 rounded-lg border border-green-200 text-xs text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20">Aktifkan</button>
                    )}
                    {u.status === 'active' && (
                      <button onClick={() => setConfirmAction({ type: 'inactive', user: u })}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" title="Nonaktifkan lisensi"><UserX className="w-3.5 h-3.5 text-orange-500" /></button>
                    )}
                    <button onClick={() => setConfirmAction({ type: 'blocked', user: u })}
                      className="px-2 py-1 rounded-lg border border-red-200 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20">Block</button>
                    <button onClick={() => setConfirmAction({ type: 'delete', user: u })}
                      className="p-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20" title="Hapus"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSaved={load} />}
      {editPlan && <ChangePlanModal user={editPlan} onClose={() => setEditPlan(null)} onSaved={load} />}
      {editPopup && <RemotePopupModal user={editPopup} onClose={() => setEditPopup(null)} onSaved={load} />}
      {resetPasswordResult && (
        <ResetPasswordModal
          user={resetPasswordResult.user}
          password={resetPasswordResult.password}
          onClose={() => setResetPasswordResult(null)}
        />
      )}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmAction?.type === 'delete' ? 'Hapus' : 'Konfirmasi'}
        variant={confirmAction?.type === 'delete' ? 'danger' : 'warning'}
        loading={confirmLoading}
      >
        {confirmAction && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Nama</span><span className="font-semibold text-slate-800 dark:text-slate-100">{confirmAction.user.name}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Paket</span><span className="font-semibold text-slate-800 dark:text-slate-100">{confirmAction.user.plan_code || '-'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Device</span><span className="font-semibold text-slate-800 dark:text-slate-100">{confirmAction.user.active_devices}</span></div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

function ResetPasswordModal({ user, password, onClose }: { user: UserRow; password: string; onClose: () => void }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast('Password baru disalin', 'success')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast('Gagal menyalin password', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-white">Password Pembeli Di-reset</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.name} - {user.email}</p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            Berikan password ini ke pembeli. Password hanya tampil di sini setelah reset berhasil.
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Password Baru</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={password}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={copyPassword}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="hidden sm:inline">{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'developer', plan_code: '', duration_days: 30 })
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    api<PlanRow[]>('license:getPlans').then(r => {
      if (!r.success) return
      const rows = r.data ?? []
      setPlans(rows)
      setForm(current => {
        if (current.plan_code && rows.some(plan => plan.code === current.plan_code)) return current
        const preferred = rows.find(plan => plan.code.includes('BASIC')) ?? rows.find(plan => Number(plan.price) > 0) ?? rows[0]
        return {
          ...current,
          plan_code: preferred?.code ?? current.plan_code,
          duration_days: preferred?.duration_days ?? current.duration_days,
        }
      })
    })
  }, [])

  const selectedPlan = plans.find(plan => plan.code === form.plan_code)

  function selectPlan(code: string) {
    const plan = plans.find(item => item.code === code)
    setForm({
      ...form,
      plan_code: code,
      duration_days: plan?.duration_days ?? form.duration_days,
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    if (form.role !== 'developer' && !form.plan_code) {
      setLoading(false)
      return toast('Paket wajib dipilih untuk akun pengguna/pembeli', 'error')
    }
    const r = await api('license:createUser', {
      ...form,
      hak_akses: form.role,
      duration_days: form.role === 'developer' ? 0 : Number(form.duration_days),
    })
    setLoading(false)
    if (r.success) {
      toast(r.message || `Akun ${form.role} berhasil dibuat!`, 'success')
      onSaved()
      onClose()
    } else {
      toast(r.message || 'Gagal membuat akun', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Tambah Akun Baru</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tipe Akun / Role *</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full border-2 border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="developer">Developer (Akses Penuh Tanpa Batas & Panel Lisensi)</option>
              <option value="pembeli">Pengguna / Pembeli Toko</option>
              <option value="admin">Admin Toko</option>
            </select>
          </div>
          {[['Nama / Toko','text','name',true],['Email / Username','text','email',true],['Password (min 8)','password','password',true],['WhatsApp (opsional)','text','phone',false]].map(([label,type,key,req]) => (
            <div key={key as string}>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">{label as string}</label>
              <input type={type as string} required={req as boolean} minLength={key === 'password' ? 8 : undefined}
                value={(form as any)[key as string]} onChange={e => setForm({ ...form, [key as string]: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
            </div>
          ))}
          {form.role !== 'developer' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Paket</label>
                  <select value={form.plan_code} onChange={e => selectPlan(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
                    {!plans.length && <option value="">Paket belum tersedia</option>}
                    {plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Durasi (hari)</label>
                  <input type="number" min={0} value={form.duration_days} onChange={e => setForm({ ...form, duration_days: Number(e.target.value) })}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
                </div>
              </div>
              <PlanAccessPreview plan={selectedPlan} />
            </>
          ) : (
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-300 font-medium">
              Akun Developer memiliki akses seumur hidup tanpa batas transaksi, tanpa batas perangkat, serta hak akses ke seluruh fitur dan Developer Panel.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">Batal</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm disabled:opacity-50">{loading ? 'Menyimpan…' : 'Simpan Akun'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function planLimitLabel(value?: number | null) {
  if (value === -1) return 'Unlimited'
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString('id-ID')
}

function isEnabled(value: number | boolean) {
  return value === true || value === 1
}

function PlanAccessPreview({ plan, compact = false }: { plan?: PlanRow; compact?: boolean }) {
  const [features, setFeatures] = useState<PlanFeatureRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!plan?.id) {
      setFeatures([])
      return
    }
    let cancelled = false
    setLoading(true)
    api<PlanFeatureRow[]>('license:getPlanFeatures', plan.id).then(result => {
      if (cancelled) return
      setFeatures(result.success ? result.data ?? [] : [])
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [plan?.id])

  if (!plan) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400 dark:border-slate-700">
        Pilih paket untuk melihat fitur yang akan dibuka pembeli.
      </div>
    )
  }

  const activeFeatures = features.filter(feature => isEnabled(feature.is_enabled))
  const visibleFeatures = activeFeatures.slice(0, compact ? 6 : 10)

  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 dark:border-primary-900/50 dark:bg-primary-900/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">Fitur terbuka untuk pembeli</p>
          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{plan.name}</p>
          {!compact && plan.description && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{plan.description}</p>}
        </div>
        <div className="shrink-0 text-left text-xs text-slate-500 dark:text-slate-400 sm:text-right">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Rp {Number(plan.price ?? 0).toLocaleString('id-ID')}</p>
          <p>{plan.duration_days === 0 ? 'Seumur hidup' : `${plan.duration_days} hari`}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div><span className="text-slate-400">Device:</span> <b>{planLimitLabel(plan.max_devices)}</b></div>
        <div><span className="text-slate-400">Transaksi:</span> <b>{planLimitLabel(plan.max_transactions_per_day)}</b></div>
        <div><span className="text-slate-400">Produk:</span> <b>{planLimitLabel(plan.max_products)}</b></div>
        <div><span className="text-slate-400">Pengguna:</span> <b>{planLimitLabel(plan.max_users)}</b></div>
      </div>

      <div className="mt-3">
        {loading ? (
          <p className="text-xs text-slate-400">Memuat fitur paket...</p>
        ) : activeFeatures.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada fitur aktif di paket ini.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {visibleFeatures.map(feature => (
              <span key={feature.code} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                {feature.name}
              </span>
            ))}
            {activeFeatures.length > visibleFeatures.length && (
              <span className="rounded-full bg-primary-100 px-2 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                +{activeFeatures.length - visibleFeatures.length} fitur
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChangePlanModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [planCode, setPlanCode] = useState(user.plan_code || 'BASIC_MONTHLY')
  const [days, setDays] = useState(30)
  const [expiresAt, setExpiresAt] = useState(toDateInput(user.expired_at))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    api<PlanRow[]>('license:getPlans').then(r => {
      if (!r.success) return
      const rows = r.data ?? []
      setPlans(rows)
      setDays(current => rows.find(plan => plan.code === planCode)?.duration_days ?? current)
    })
  }, [])
  const selectedPlan = plans.find(plan => plan.code === planCode)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    const r = await api('license:changeUserPlan', user.id, {
      plan_code: planCode,
      duration_days: Number(days),
      expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : undefined,
      notes,
    })
    setLoading(false)
    if (r.success) { onSaved(); onClose() } else toast(r.message || 'Gagal', 'error')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Ubah Paket — {user.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3 text-xs text-slate-500">
            Paket sekarang: <b className="text-slate-800 dark:text-white">{user.plan_code || '—'}</b>
            {user.expired_at && <> · berakhir {new Date(user.expired_at).toLocaleDateString('id-ID')}</>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Paket baru</label>
            <select value={planCode} onChange={e => {
              const nextPlan = plans.find(plan => plan.code === e.target.value)
              setPlanCode(e.target.value)
              if (nextPlan) setDays(nextPlan.duration_days)
            }}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
              {plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <PlanAccessPreview plan={selectedPlan} compact />
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Durasi (hari)</label>
            <input type="number" min={0} value={days} onChange={e => setDays(Number(e.target.value))}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Expired At</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Catatan</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">Batal</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm disabled:opacity-50">{loading ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RemotePopupModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [popups, setPopups] = useState<PopupRow[]>([])
  const [code, setCode] = useState(user.force_popup_code || 'REMOTE_ANNOUNCEMENT')
  const [until, setUntil] = useState(toDateTimeLocal(user.force_popup_until) || defaultPopupUntil())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api<PopupRow[]>('license:getPopups').then(r => {
      if (r.success) setPopups((r.data ?? []).filter(p => p.is_active))
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const r = await api('license:updateUser', user.id, {
      force_popup_code: code,
      force_popup_until: until ? new Date(until).toISOString() : null,
    })
    setLoading(false)
    if (r.success) { onSaved(); onClose() } else toast(r.message || 'Gagal mengirim popup', 'error')
  }

  async function clearPopup() {
    setLoading(true)
    const r = await api('license:updateUser', user.id, { force_popup_code: null, force_popup_until: null })
    setLoading(false)
    if (r.success) { onSaved(); onClose() } else toast(r.message || 'Gagal menghapus popup', 'error')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Remote Popup - {user.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">x</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Popup</label>
            <select value={code} onChange={e => setCode(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
              {popups.map(p => <option key={p.code} value={p.code}>{p.code} - {p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tampilkan sampai</label>
            <input type="datetime-local" value={until} onChange={e => setUntil(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <button type="button" onClick={clearPopup} disabled={loading}
              className="px-4 py-2 rounded-xl border border-red-200 text-sm text-red-600 dark:border-red-800 dark:text-red-300">Hapus</button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">Batal</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm disabled:opacity-50">{loading ? 'Mengirim...' : 'Kirim'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultPopupUntil() {
  return toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
}
