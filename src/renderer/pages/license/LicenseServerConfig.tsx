import { useState, useEffect } from 'react'
import { ServerCog, Wifi, WifiOff, LogIn, RefreshCw, CheckCircle, Globe, Laptop } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import { SkeletonPage } from '../../components/Skeleton'

type LicenseConfig = {
  url: string
  connected: boolean
  hasRefreshToken?: boolean
}

const DEFAULT_LICENSE_URL = import.meta.env.VITE_LICENSE_SERVER_URL || 'https://azhkvmkmimepmflzqqty.supabase.co/functions/v1/mediasoft-license'
const DEFAULT_ADMIN_EMAIL = import.meta.env.VITE_LICENSE_ADMIN_EMAIL || 'admin@waripos.local'

export default function LicenseServerConfig() {
  const toast = useToast()
  const [config, setConfig] = useState<LicenseConfig | null>(null)
  const [form, setForm] = useState({
    url: DEFAULT_LICENSE_URL,
    email: DEFAULT_ADMIN_EMAIL,
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [pinging, setPinging] = useState(false)
  const [pingOk, setPingOk] = useState<boolean | null>(null)
  const [connectionMessage, setConnectionMessage] = useState('')
  const [connectionTone, setConnectionTone] = useState<'info' | 'success' | 'error'>('info')
  const [syncing, setSyncing] = useState(false)
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    api<LicenseConfig>('license:getConfig').then(r => {
      if (r.success && r.data) {
        setConfig(r.data)
        if (r.data.url) setForm(f => ({ ...f, url: r.data!.url }))
        if (r.data.connected && !r.data.hasRefreshToken) {
          setConnectionTone('info')
          setConnectionMessage('Server sudah tersimpan, tapi sesi admin lama belum punya refresh token. Login ulang dengan akun admin license server.')
        }
      }
    })
  }, [])

  async function ping() {
    setPinging(true); setPingOk(null); setConnectionMessage('')
    try {
      const r = await api('license:testConnection', form.url)
      setPingOk(!!r.success)
      setConnectionTone(r.success ? 'success' : 'error')
      setConnectionMessage(r.message || (r.success ? 'Server dapat dijangkau' : 'Server tidak merespons'))
      if (!r.success) toast(r.message || 'Server tidak merespons', 'error')
    } finally {
      setPinging(false)
    }
  }

  async function validateLicense() {
    setValidating(true)
    const r = await api('license:validateApplication')
    setValidating(false)
    toast(r.message || (r.success ? 'Validasi berhasil' : 'Validasi gagal'), r.success ? 'success' : 'error')
  }

  async function syncLicense() {
    setSyncing(true)
    const r = await api('license:syncFromServer')
    setSyncing(false)
    toast(r.message || (r.success ? 'Sync selesai' : 'Sync gagal'), r.success ? 'success' : 'error')
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setConnectionMessage('')
    const r = await api('license:testAndSave', form.url, form.email, form.password)
    setLoading(false)
    if (r.success) {
      toast('Berhasil terhubung ke license server', 'success')
      setConfig({ url: form.url, connected: true, hasRefreshToken: true })
      setConnectionTone('success')
      setConnectionMessage(r.message || 'Berhasil terhubung ke license server')
    } else {
      setConfig(prev => prev ? { ...prev, hasRefreshToken: false } : { url: form.url, connected: false, hasRefreshToken: false })
      setConnectionTone('error')
      setConnectionMessage(r.message || 'Gagal terhubung')
      toast(r.message || 'Gagal terhubung', 'error')
    }
  }

  const adminReady = Boolean(config?.connected && config.hasRefreshToken)
  const needsLogin = Boolean(config?.connected && !config.hasRefreshToken)

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="max-w-none space-y-4">
      {adminReady && (
        <div className="flex items-start sm:items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 overflow-hidden">
          <Wifi className="w-4 h-4 text-green-600 shrink-0 mt-0.5 sm:mt-0" />
          <span className="text-sm text-green-700 dark:text-green-300 min-w-0 break-all">Admin aktif di <code className="font-mono bg-green-100/70 dark:bg-green-950/50 px-1 py-0.5 rounded break-all">{config?.url}</code></span>
        </div>
      )}

      {needsLogin && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">Server tersimpan, tapi login admin perlu diperbarui.</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Konfigurasi License Server</h2>
        
        {/* Preset server quick select */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setForm(f => ({ ...f, url: 'https://azhkvmkmimepmflzqqty.supabase.co/functions/v1/mediasoft-license', email: 'admin@waripos.local' }))
              setPingOk(null)
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 transition-colors flex items-center gap-1.5"
          >
            <Globe size={14} />
            <span>Supabase Cloud (Default)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(f => ({ ...f, url: 'http://localhost:4000/api', email: 'admin@waripos.local' }))
              setPingOk(null)
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <Laptop size={14} />
            <span>Local Server (Port 4000)</span>
          </button>
        </div>

        <form onSubmit={connect} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">URL License Server</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ServerCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  required value={form.url}
                  onChange={e => { setForm({ ...form, url: e.target.value }); setPingOk(null) }}
                  placeholder="https://SUPABASE_PROJECT.supabase.co/functions/v1/mediasoft-license"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                />
              </div>
              <button type="button" onClick={ping} disabled={pinging}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5">
                {pinging ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  : pingOk === true ? <Wifi className="w-4 h-4 text-green-500" />
                  : pingOk === false ? <WifiOff className="w-4 h-4 text-red-500" />
                  : <Wifi className="w-4 h-4 text-slate-400" />}
                <span className="text-xs font-bold">Ping</span>
              </button>
            </div>
            {pingOk === true && <p className="text-xs text-green-600 mt-1"> Server dapat dijangkau</p>}
            {pingOk === false && <p className="text-xs text-red-500 mt-1"> Server tidak merespons</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Email Admin</label>
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Password</label>
            <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Password admin license server"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          {connectionMessage && (
            <div className={`rounded-xl border px-3 py-2 text-xs ${
              connectionTone === 'error'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                : connectionTone === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
            }`}>
              {connectionMessage}
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-colors">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Menghubungkan…' : 'Simpan & Hubungkan'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Validasi & Sync Lisensi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={validateLicense}
            disabled={validating}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {validating ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
            Validasi Lisensi Aplikasi
          </button>
          <button
            type="button"
            onClick={syncLicense}
            disabled={syncing}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {syncing ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="w-4 h-4 text-primary-500" />}
            Sync Lisensi dari Server
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
           Sync menarik paket dan popup dari Supabase ke database lokal aplikasi ini. Akun pembeli, fitur, popup, dan persetujuan lisensi dikelola dari Dashboard Developer (Supabase).
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tips</p>
        <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <li className="break-all leading-relaxed">
            • Server aktif: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded break-all inline-block max-w-full">https://azhkvmkmimepmflzqqty.supabase.co/functions/v1/mediasoft-license</code>
          </li>
          <li>• Login admin: gunakan email Supabase Auth yang sudah diverifikasi dan punya role <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">super_admin</code></li>
          <li>• Pembeli login memakai email dan password akun yang dibuat admin</li>
          <li>• Token admin tersimpan di database lokal aplikasi ini</li>
        </ul>
      </div>
    </div>
  )
}
