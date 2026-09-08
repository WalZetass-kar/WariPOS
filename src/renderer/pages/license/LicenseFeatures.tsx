import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import { SkeletonPage } from '../../components/Skeleton'

interface FeatureRow { id: string; code: string; name: string; category: string | null; is_active: number | boolean }

const catColor: Record<string, string> = {
  core: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  finance: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  report: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tools: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

export default function LicenseFeaturesPage() {
  const toast = useToast()
  const [features, setFeatures] = useState<FeatureRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<FeatureRow[]>('license:getFeatures')
    if (r.success) setFeatures(r.data ?? [])
    else toast(r.message || 'Gagal memuat', 'error')
    setLoading(false)
  }, [toast])

  useEffect(() => { void load() }, [load])

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2 text-sm font-medium">
          <Plus className="w-4 h-4" />Tambah Fitur
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 text-left">
            <tr><th className="px-4 py-3">Kode</th><th>Nama</th><th>Kategori</th><th>Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-slate-400">Memuat…</td></tr>
            ) : features.map(f => (
              <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3"><code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-400">{f.code}</code></td>
                <td className="font-medium text-slate-800 dark:text-white">{f.name}</td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[f.category || ''] || 'bg-slate-100 text-slate-600'}`}>{f.category || '—'}</span></td>
                <td>
                  <button onClick={async () => { await api('license:updateFeature', f.id, { is_active: !f.is_active }); load() }}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {f.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCreate && <CreateFeatureModal onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  )
}

function CreateFeatureModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({ code: '', name: '', category: 'core' })
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    const r = await api('license:createFeature', form)
    setLoading(false)
    if (r.success) { onSaved(); onClose() } else toast(r.message || 'Gagal', 'error')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Tambah Fitur Baru</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Kode (snake_case)</label>
            <input required pattern="[a-z0-9_]+" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="contoh: multi_warehouse"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Nama</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Kategori</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
              <option value="core">core</option><option value="finance">finance</option>
              <option value="report">report</option><option value="tools">tools</option>
            </select>
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
