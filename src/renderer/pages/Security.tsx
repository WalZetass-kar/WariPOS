import { useState, useEffect } from 'react'
import { Shield, CheckCircle, RefreshCw, Monitor, Smartphone, LogOut } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { useToast } from '../contexts/ToastContext'
import { api } from '../utils/api'
import { SkeletonPage } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

interface SecuritySettings {
  loginAttempts: number
  lockDuration: number
  sessionTimeout: number
  requireStrongPassword: boolean
  twoFactorEnabled: boolean
  ipWhitelist: string[]
}

interface ActiveSession {
  id: number
  username: string
  device_id: string | null
  device_name: string | null
  platform: string | null
  os_name: string | null
  ip_address: string | null
  last_seen_at: string | null
  expires_at: string
}

export default function Security() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [settings, setSettings] = useState<SecuritySettings>({
    loginAttempts: 5,
    lockDuration: 15,
    sessionTimeout: 30,
    requireStrongPassword: true,
    twoFactorEnabled: false,
    ipWhitelist: [],
  })
  const [showPassword, setShowPassword] = useState(false)
  const [ipModal, setIpModal] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [sessions, setSessions] = useState<ActiveSession[]>([])

  const loadSessions = async () => {
    const r = await api<ActiveSession[]>('device:getAllSessions')
    if (r.success) setSessions(r.data ?? [])
  }

  useEffect(() => {
    Promise.all([
      api<any>('security:get').then(r => {
        if (r.success && r.data) {
          setSettings({
            loginAttempts: Number(r.data.loginAttempts) || 5,
            lockDuration: Number(r.data.lockDuration) || 15,
            sessionTimeout: Number(r.data.sessionTimeout) || 30,
            requireStrongPassword: Boolean(r.data.requireStrongPassword ?? true),
            twoFactorEnabled: Boolean(r.data.twoFactorEnabled),
            ipWhitelist: Array.isArray(r.data.ipWhitelist) ? r.data.ipWhitelist : [],
          })
        }
      }),
      loadSessions(),
    ]).finally(() => setInitialLoading(false))
  }, [])

  const handleSave = async () => {
    setLoading(true)
    const r = await api('security:save', settings)
    setLoading(false)
    if (r.success) toast('Pengaturan keamanan berhasil disimpan')
    else toast(r.message as string ?? 'Gagal menyimpan', 'error')
  }

  const addIp = () => {
    if (!newIp) return toast('Masukkan IP address', 'error')
    const currentList = Array.isArray(settings.ipWhitelist) ? settings.ipWhitelist : []
    if (currentList.includes(newIp)) return toast('IP sudah ada', 'error')
    setSettings({ ...settings, ipWhitelist: [...currentList, newIp] })
    setNewIp('')
  }

  const removeIp = (ip: string) => {
    const currentList = Array.isArray(settings.ipWhitelist) ? settings.ipWhitelist : []
    setSettings({ ...settings, ipWhitelist: currentList.filter(i => i !== ip) })
  }

  const revokeSession = async (id: number) => {
    const r = await api('device:revokeSession', id, 'security-admin')
    if (r.success) {
      toast('Session berhasil direvoke')
      loadSessions()
    } else {
      toast(r.message as string ?? 'Gagal revoke session', 'error')
    }
  }

  if (initialLoading) return <SkeletonPage rows={4} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="text-primary-500" size={28} />
            Keamanan Sistem
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Pengaturan keamanan dan akses sistem</p>
        </div>
        <Button onClick={handleSave} loading={loading} icon={<CheckCircle size={16} />} className="w-full sm:w-auto">
          Simpan Perubahan
        </Button>
      </div>

      {/* Login Security */}
      <Card title="Keamanan Login">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Maksimum Percobaan Login
              </label>
              <Input
                type="number"
                value={settings.loginAttempts}
                onChange={e => setSettings({ ...settings, loginAttempts: parseInt(e.target.value) || 5 })}
              />
              <p className="text-xs text-slate-400 mt-1">Percobaan sebelum akun dikunci</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Durasi Kunci (menit)
              </label>
              <Input
                type="number"
                value={settings.lockDuration}
                onChange={e => setSettings({ ...settings, lockDuration: parseInt(e.target.value) || 15 })}
              />
              <p className="text-xs text-slate-400 mt-1">Lama akun terkunci setelah percobaan gagal</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">Password Kuat Wajib</p>
              <p className="text-sm text-slate-500">Wajibkan huruf besar, huruf kecil, angka, dan simbol</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, requireStrongPassword: !settings.requireStrongPassword })}
              className={`w-12 h-6 rounded-full transition-colors ${settings.requireStrongPassword ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${settings.requireStrongPassword ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </Card>

      <Card title="Session Control & Remote Logout">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Sesi aktif yang dapat direvoke dari backend.</p>
          <Button variant="secondary" onClick={loadSessions} icon={<RefreshCw size={14} />}>Refresh</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2">User</th>
                <th>Device</th>
                <th>Platform</th>
                <th>IP</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400"><EmptyState icon={<Shield size={32} strokeWidth={1.5} />} title="Tidak ada sesi aktif" description="Semua sesi pengguna sudah tidak aktif" className="py-4" /></td></tr>
              ) : sessions.map(session => (
                <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{session.username}</td>
                  <td className="text-slate-600 dark:text-slate-400">{session.device_name || session.device_id?.slice(0, 12) || '-'}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      {session.platform === 'android' ? <Smartphone size={12} /> : <Monitor size={12} />}
                      {session.platform || '-'} / {session.os_name || '-'}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-slate-500">{session.ip_address || '-'}</td>
                  <td className="text-xs text-slate-500">{session.last_seen_at ? new Date(session.last_seen_at).toLocaleString('id-ID') : '-'}</td>
                  <td className="text-right">
                    <button
                      onClick={() => revokeSession(session.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                    >
                      <LogOut size={12} />
                      Logout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Session Security */}
      <Card title="Keamanan Sesi">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Timeout Sesi (menit)
            </label>
            <Input
              type="number"
              value={settings.sessionTimeout}
              onChange={e => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })}
              className="max-w-xs"
            />
            <p className="text-xs text-slate-400 mt-1">Waktu tidak aktif sebelum sesi berakhir otomatis</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">Two-Factor Authentication (2FA)</p>
                <p className="text-sm text-slate-500">Aktifkan kebijakan 2FA untuk akun admin dan operator</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, twoFactorEnabled: !settings.twoFactorEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.twoFactorEnabled ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                title={settings.twoFactorEnabled ? 'Nonaktifkan 2FA' : 'Aktifkan 2FA'}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${settings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
        </div>
      </Card>

      {/* IP Whitelist */}
      <Card title="IP Whitelist">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Batasi akses sistem dari IP tertentu. Kosongkan untuk mengizinkan semua IP.
          </p>

          <div className="flex gap-2">
            <Input
              value={newIp}
              onChange={e => setNewIp(e.target.value)}
              placeholder="Contoh: 192.168.1.1"
              className="flex-1"
            />
            <Button onClick={addIp} variant="secondary">Tambah IP</Button>
          </div>

          {(settings.ipWhitelist || []).length > 0 ? (
            <div className="space-y-2">
              {(settings.ipWhitelist || []).map(ip => (
                <div key={ip} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="font-mono text-slate-700 dark:text-slate-200">{ip}</span>
                  <button onClick={() => removeIp(ip)} className="text-red-500 hover:text-red-600">
                    <RefreshCw size={16} className="rotate-180" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">Belum ada IP yang diizinkan</p>
          )}
        </div>
      </Card>

      {/* Security Status */}
      <Card title="Status Keamanan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">Rate Limiting</p>
              <p className="text-sm text-green-600 dark:text-green-500">Aktif - 100 req/menit</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">Input Validation</p>
              <p className="text-sm text-green-600 dark:text-green-500">Aktif - Zod validation</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">SQL Injection Protection</p>
              <p className="text-sm text-green-600 dark:text-green-500">Aktif - Parameterized queries</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">XSS Protection</p>
              <p className="text-sm text-green-600 dark:text-green-500">Aktif - Content sanitization</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
