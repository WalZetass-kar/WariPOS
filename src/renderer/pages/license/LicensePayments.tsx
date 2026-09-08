import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle, Trash2 } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import ConfirmDialog from '../../components/ConfirmDialog'
import { SkeletonPage } from '../../components/Skeleton'

interface PaymentRow {
  id: string
  user_name: string
  user_email: string
  plan_code: string | null
  amount: number
  method: string | null
  provider?: string | null
  invoice_number?: string | null
  payment_url?: string | null
  status: string
  created_at: string
}
interface UserRow { id: string; name: string; email: string }
interface PlanRow { id: string; code: string; name: string; price: number }

const statusColor: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  failed:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export default function LicensePaymentsPage() {
  const toast = useToast()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [deletePayment, setDeletePayment] = useState<PaymentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<PaymentRow[]>('license:getPayments')
    if (r.success) setPayments(r.data ?? [])
    else toast(r.message || 'Gagal memuat', 'error')
    setLoading(false)
  }, [toast])

  useEffect(() => { void load() }, [load])

  async function handleDeletePayment() {
    if (!deletePayment) return
    setDeletingId(deletePayment.id)
    const r = await api('license:deletePayment', deletePayment.id)
    setDeletingId(null)
    if (!r.success) return toast(r.message || 'Gagal menghapus persetujuan lisensi', 'error')
    toast('Persetujuan lisensi berhasil dihapus', 'success')
    setDeletePayment(null)
    void load()
  }

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white">Persetujuan Lisensi</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Request dari popup lisensi muncul sebagai pending. Setujui setelah pembayaran pembeli valid agar lisensi aktif.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2 text-sm font-medium">
          <Plus className="w-4 h-4" />Catat Persetujuan Manual
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 text-left">
            <tr><th className="px-4 py-3">Pembeli</th><th>Paket</th><th>Jumlah</th><th>Request</th><th>Status</th><th>Tanggal</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Memuat…</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Belum ada request persetujuan lisensi</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800 dark:text-white">{p.user_name}</p>
                  <p className="text-xs text-slate-400">{p.user_email}</p>
                </td>
                <td><span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-medium">{p.plan_code || '—'}</span></td>
                <td className="font-medium">Rp {Number(p.amount).toLocaleString('id-ID')}</td>
                <td className="text-slate-500 text-xs">
                  <p>{p.provider || p.method}</p>
                  {p.invoice_number && <p className="font-mono text-[11px]">{p.invoice_number}</p>}
                </td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status] || 'bg-slate-100 text-slate-600'}`}>{p.status}</span></td>
                <td className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString('id-ID')}</td>
                <td className="pr-3">
                  <div className="flex justify-end gap-1">
                    {p.status === 'pending' && (
                      <button onClick={async () => { await api('license:approvePayment', p.id); load() }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs">
                        <CheckCircle className="w-3 h-3" />Setujui
                      </button>
                    )}
                    <button
                      onClick={() => setDeletePayment(p)}
                      disabled={deletingId === p.id}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-400 dark:hover:bg-red-950/30"
                      title="Hapus persetujuan lisensi"
                    >
                      <Trash2 className="w-3 h-3" />Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && <AddPaymentModal onClose={() => setShowAdd(false)} onSaved={load} />}
      <ConfirmDialog
        open={!!deletePayment}
        onClose={() => setDeletePayment(null)}
        onConfirm={handleDeletePayment}
        title="Hapus Persetujuan Lisensi"
        message={`Request ${deletePayment?.invoice_number || deletePayment?.id || ''} akan dihapus dari Developer Panel.`}
        confirmText="Hapus"
        variant="danger"
        loading={!!deletePayment && deletingId === deletePayment.id}
      >
        {deletePayment && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Pembeli</span><span className="font-semibold text-slate-800 dark:text-slate-100">{deletePayment.user_email}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Jumlah</span><span className="font-semibold text-slate-800 dark:text-slate-100">Rp {Number(deletePayment.amount).toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><span className="font-semibold text-slate-800 dark:text-slate-100">{deletePayment.status}</span></div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

function AddPaymentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [form, setForm] = useState({ user_id: '', plan_code: 'BASIC_MONTHLY', amount: 99000, method: 'manual_transfer', status: 'pending' as 'paid' | 'pending' | 'failed' | 'expired', notes: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api<UserRow[]>('license:getUsers').then(r => { if (r.success) setUsers(r.data ?? []) })
    api<PlanRow[]>('license:getPlans').then(r => { if (r.success) setPlans(r.data ?? []) })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.user_id) return toast('Pembeli wajib dipilih', 'error')
    setLoading(true)
    const r = await api('license:createPayment', { ...form, user_id: form.user_id, amount: Number(form.amount) })
    setLoading(false)
    if (r.success) { onSaved(); onClose() } else toast(r.message || 'Gagal', 'error')
  }

  const inp = "w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Catat Persetujuan Lisensi Manual</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Pembeli</label>
            <select required value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} className={inp}>
              <option value="">— pilih user —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Paket</label>
              <select value={form.plan_code} onChange={e => {
                const plan = plans.find(p => p.code === e.target.value)
                setForm({ ...form, plan_code: e.target.value, amount: plan ? Number(plan.price) : form.amount })
              }} className={inp}>
                {plans.map(p => <option key={p.code} value={p.code}>{p.name} — Rp {Number(p.price).toLocaleString('id-ID')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Jumlah (Rp)</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Metode</label>
              <input value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'paid' | 'pending' | 'failed' | 'expired' })} className={inp}>
                <option value="pending">pending (menunggu persetujuan)</option>
                <option value="paid">paid (langsung aktif/perpanjang)</option>
                <option value="failed">failed</option>
                <option value="expired">expired</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Catatan</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inp} />
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
