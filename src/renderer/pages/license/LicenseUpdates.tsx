import { useEffect, useState } from 'react'
import { Save, Wrench, ShieldCheck, Smartphone, Laptop, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import { SkeletonPage } from '../../components/Skeleton'

interface UpdateRule {
  id?: string
  platform: string
  latest_version: string
  minimum_version: string
  release_notes: string | null
  download_url: string | null
  mode: 'optional' | 'force'
  is_active: boolean
}

const emptyRule: UpdateRule = {
  platform: 'all',
  latest_version: '2.1.0',
  minimum_version: '2.0.0',
  release_notes: 'Pembaruan stabilitas sistem, sinkronisasi lisensi realtime, dan UI modern.',
  download_url: '',
  mode: 'optional',
  is_active: true,
}

export default function LicenseUpdatesPage() {
  const toast = useToast()
  const [rules, setRules] = useState<UpdateRule[]>([])
  const [form, setForm] = useState<UpdateRule>(emptyRule)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const r = await api<any>('license:getAppUpdates')
      if (r && r.success && r.data) {
        const rawData = Array.isArray(r.data) ? r.data : [r.data]
        const rows: UpdateRule[] = rawData.map((item: any) => ({
          id: String(item.id || item.platform || 'all'),
          platform: String(item.platform || 'all'),
          latest_version: String(item.latest_version || item.current_version || '2.1.0'),
          minimum_version: String(item.minimum_version || '2.0.0'),
          release_notes: item.release_notes || '',
          download_url: item.download_url || '',
          mode: item.mode === 'force' || item.is_mandatory ? 'force' : 'optional',
          is_active: item.is_active !== false && item.is_active !== 0,
        }))
        setRules(rows)
        setForm(rows.find(row => row.platform === 'all') ?? rows[0] ?? emptyRule)
      } else {
        setRules([emptyRule])
        setForm(emptyRule)
      }
    } catch {
      setRules([emptyRule])
      setForm(emptyRule)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api<any>('license:saveAppUpdate', form)
      if (r && r.success) {
        toast('Aturan update rilis berhasil disimpan!', 'success')
        await load()
      } else {
        toast(r?.message || 'Gagal menyimpan update rule', 'error')
      }
    } catch (e: any) {
      toast(e?.message || 'Gagal menyimpan update rule', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white transition'

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      {/* Update Rule Form */}
      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-red-600/10 text-red-600">
            <Wrench size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kelola Aturan Update</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Atur pembaruan opsional atau wajib (Force Update).</p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Target Platform
            </label>
            <select
              value={form.platform}
              onChange={e => {
                const p = e.target.value
                const existing = rules.find(r => r.platform === p)
                if (existing) {
                  setForm(existing)
                } else {
                  setForm({ ...emptyRule, platform: p })
                }
              }}
              className={inputClass}
            >
              <option value="all">Semua Platform (All)</option>
              <option value="android">Android (APK)</option>
              <option value="windows">Windows (.exe / installer)</option>
              <option value="linux">Linux (.AppImage / .deb)</option>
              <option value="macos">macOS (.dmg)</option>
              <option value="ios">iOS</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Versi Rilis Terbaru
              </label>
              <input
                type="text"
                value={form.latest_version}
                onChange={e => setForm({ ...form, latest_version: e.target.value })}
                className={inputClass}
                placeholder="2.1.0"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Versi Minimum Wajib
              </label>
              <input
                type="text"
                value={form.minimum_version}
                onChange={e => setForm({ ...form, minimum_version: e.target.value })}
                className={inputClass}
                placeholder="2.0.0"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Tipe Pembaruan
            </label>
            <select
              value={form.mode}
              onChange={e => setForm({ ...form, mode: e.target.value as 'optional' | 'force' })}
              className={inputClass}
            >
              <option value="optional">Update Opsional (Bisa diabaikan user)</option>
              <option value="force">Force Update (Wajib update sebelum masuk POS)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Download URL (APK / File Installer)
            </label>
            <input
              type="url"
              value={form.download_url ?? ''}
              onChange={e => setForm({ ...form, download_url: e.target.value })}
              className={inputClass}
              placeholder="https://domain.com/update/latest.apk"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Catatan Rilis (Release Notes)
            </label>
            <textarea
              value={form.release_notes ?? ''}
              onChange={e => setForm({ ...form, release_notes: e.target.value })}
              className={`${inputClass} min-h-[90px] resize-none`}
              placeholder="Tuliskan daftar perbaikan fitur atau rincian versi baru..."
            />
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded text-red-600 focus:ring-red-600"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-900 dark:text-white block">Status Aturan Aktif</span>
              <span className="text-slate-500 dark:text-slate-400">Aktifkan pengecekan update otomatis untuk platform ini</span>
            </div>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan Aturan...' : 'Simpan Aturan Update'}
          </button>
        </div>
      </form>

      {/* Rules Overview List */}
      <div className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between">
        <div>
          <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daftar Aturan Platform Aktif</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pilih platform di bawah untuk mengedit pengaturannya.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {rules.map(rule => {
              const isSelected = form.platform === rule.platform
              return (
                <button
                  key={rule.id ?? rule.platform}
                  type="button"
                  onClick={() => setForm(rule)}
                  className={`w-full p-4 text-left transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-l-4 border-l-red-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs uppercase tracking-wide text-slate-900 dark:text-white">
                        {rule.platform}
                      </span>
                      {rule.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={11} /> Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Nonaktif</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Rilis Terbaru: <strong className="text-slate-800 dark:text-slate-200">{rule.latest_version}</strong> • Min Wajib: <strong className="text-slate-800 dark:text-slate-200">{rule.minimum_version}</strong>
                    </p>
                    {rule.release_notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                        "{rule.release_notes}"
                      </p>
                    )}
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    rule.mode === 'force'
                      ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                  }`}>
                    {rule.mode}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <p className="font-bold text-slate-700 dark:text-slate-300">Pemberitahuan Otomatis</p>
          <p className="mt-0.5">Ketika user membuka aplikasi pada versi lebih rendah dari versi minimum, dialog update wajib akan muncul otomatis.</p>
        </div>
      </div>
    </div>
  )
}
