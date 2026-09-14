import { useEffect, useState } from 'react'
import { Megaphone, Plus, Trash2, Send, Bell } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import { SkeletonPage } from '../../components/Skeleton'
import { showSystemNotification } from '../../utils/systemNotification'

interface Announcement {
  id: string
  type: string
  title: string
  message: string
  severity: string
  target_scope: string
  target_plan_code: string | null
  target_platform: string | null
  is_active: boolean
  starts_at: string
  ends_at: string | null
  created_at: string
}

const empty = {
  type: 'announcement',
  title: '',
  message: '',
  severity: 'info',
  target_scope: 'all',
  target_plan_code: '',
  target_platform: '',
}

export default function LicenseAnnouncementsPage() {
  const toast = useToast()
  const [rows, setRows] = useState<Announcement[]>([])
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const r = await api<Announcement[]>('license:getAnnouncements')
    if (r.success) setRows(r.data ?? [])
    else toast(r.message || 'Gagal memuat pengumuman', 'error')
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const r = await api('license:createAnnouncement', form)
    setSaving(false)
    if (r.success) {
      toast('Push notifikasi banner berhasil dikirim ke seluruh user!', 'success')
      // Realtime cross-window broadcast
      try {
        const bc = new BroadcastChannel('waripos_developer_broadcast')
        bc.postMessage({ title: form.title, message: form.message, severity: form.severity })
      } catch {}

      // Trigger preview notification locally
      void showSystemNotification({
        id: 9555,
        title: form.title,
        body: form.message,
        actionRoute: '/lisensi',
      })

      setForm(empty)
      await load()
    } else toast(r.message || 'Gagal mengirim pengumuman', 'error')
  }

  async function remove(id: string) {
    const r = await api('license:deleteAnnouncement', id)
    if (r.success) await load()
    else toast(r.message || 'Gagal menghapus pengumuman', 'error')
  }

  const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800'

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Push Notifikasi Banner Developer</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Kirim notifikasi banner kustom langsung ke seluruh perangkat pengguna</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={input} placeholder="Judul Notifikasi Banner" />
          <textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className={`${input} min-h-28`} placeholder="Isi Pesan Notifikasi Banner..." />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={input}>
              {['announcement', 'maintenance', 'promo', 'warning', 'update'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className={input}>
              {['info', 'success', 'warning', 'danger'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={form.target_scope} onChange={e => setForm({ ...form, target_scope: e.target.value })} className={input}>
              <option value="all">Semua User</option>
              <option value="plan">Paket Tertentu</option>
              <option value="platform">Platform Tertentu</option>
            </select>
            {form.target_scope === 'plan' ? (
              <input value={form.target_plan_code} onChange={e => setForm({ ...form, target_plan_code: e.target.value.toUpperCase() })} className={input} placeholder="Kode paket" />
            ) : (
              <select value={form.target_platform} onChange={e => setForm({ ...form, target_platform: e.target.value })} className={input}>
                <option value="">Semua platform</option>
                {['windows', 'linux', 'macos', 'android', 'ios'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
          <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
            <Send className="h-4 w-4" />{saving ? 'Mengirim Push Banner...' : 'Kirim Push Notifikasi Banner Sekarang'}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat Broadcast</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(row => (
            <div key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800 dark:text-white">{row.title}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{row.type}</span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{row.target_scope}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{row.message}</p>
                <p className="mt-2 text-xs text-slate-400">{new Date(row.created_at).toLocaleString('id-ID')}</p>
              </div>
              <button onClick={() => remove(row.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-sm text-slate-400">Belum ada broadcast.</p>}
        </div>
      </div>
    </div>
  )
}
