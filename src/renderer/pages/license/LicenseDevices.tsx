import { useCallback, useEffect, useState } from 'react'
import { Ban, CheckCircle2, Clock3, Eye, Search, ShieldCheck } from 'lucide-react'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'
import { SkeletonPage } from '../../components/Skeleton'

interface DeviceRow {
  id: string
  user_name: string
  user_email: string
  user_role?: string
  customer_status: string | null
  device_id: string
  device_name: string | null
  platform: string | null
  os_name: string | null
  operating_system?: string | null
  app_version: string | null
  ip_address: string | null
  status: string
  license_status: string | null
  plan_code: string | null
  plan_name?: string | null
  activated_at?: string | null
  expired_at: string | null
  first_seen_at: string
  last_seen_at: string
  revoked_at: string | null
  login_history?: Array<{ id: string; action: string; created_at: string; metadata?: Record<string, unknown> }>
}

const statusClass: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const platforms = ['', 'windows', 'linux', 'macos', 'android', 'ios']

function isOnline(lastSeen: string) {
  const ts = new Date(lastSeen).getTime()
  return Number.isFinite(ts) && Date.now() - ts <= 5 * 60 * 1000
}

export default function LicenseDevicesPage() {
  const toast = useToast()
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [selected, setSelected] = useState<DeviceRow | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api<DeviceRow[]>('license:getDevices', { search, status, platform })
    if (r.success) setDevices(r.data ?? [])
    else toast(r.message || 'Gagal memuat device', 'error')
    setLoading(false)
  }, [search, status, platform, toast])

  useEffect(() => { void load() }, [load])

  async function openDetail(id: string) {
    const r = await api<DeviceRow>('license:getDeviceDetail', id)
    if (r.success && r.data) setSelected(r.data)
    else toast(r.message || 'Gagal memuat detail device', 'error')
  }

  async function action(channel: string, id: string, payload?: unknown) {
    const r = await api(channel, id, payload)
    if (r.success) {
      toast(r.message || 'Berhasil', 'success')
      await load()
      if (selected?.id === id) await openDetail(id)
    } else {
      toast(r.message || 'Gagal menjalankan aksi', 'error')
    }
  }

  if (loading) return <SkeletonPage rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari device, user, email..."
            className="w-72 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
          <option value="">Semua status</option>
          <option value="active">active</option>
          <option value="blocked">blocked</option>
          <option value="inactive">inactive</option>
        </select>
        <select value={platform} onChange={e => setPlatform(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
          {platforms.map(item => <option key={item || 'all'} value={item}>{item || 'Semua platform'}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th>User</th>
              <th>Status</th>
              <th>Lisensi</th>
              <th>Online</th>
              <th>Terakhir</th>
              <th className="pr-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">Memuat...</td></tr>
            ) : devices.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">Belum ada device</td></tr>
            ) : devices.map(device => (
              <tr key={device.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800 dark:text-white">{device.device_name || device.device_id.slice(0, 16)}</p>
                  <p className="font-mono text-[11px] text-slate-400">{device.device_id}</p>
                  <p className="text-[11px] text-slate-400">{[device.platform, device.os_name, device.app_version].filter(Boolean).join(' / ') || '-'}</p>
                </td>
                <td>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{device.user_name}</p>
                  <p className="text-xs text-slate-400">{device.user_email}</p>
                </td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[device.status] || statusClass.inactive}`}>{device.status}</span></td>
                <td>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[device.license_status ?? ''] || statusClass.inactive}`}>{device.license_status || '-'}</span>
                  <p className="mt-1 text-[11px] text-slate-400">{device.plan_code || '-'}{device.expired_at ? ` / ${new Date(device.expired_at).toLocaleDateString('id-ID')}` : ''}</p>
                </td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isOnline(device.last_seen_at) ? statusClass.active : statusClass.inactive}`}>{isOnline(device.last_seen_at) ? 'online' : 'offline'}</span></td>
                <td className="text-xs text-slate-500">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('id-ID') : '-'}</td>
                <td className="pr-4">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openDetail(device.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                      <Eye className="h-3.5 w-3.5" />Detail
                    </button>
                    {device.status === 'active' ? (
                      <button onClick={() => action('license:blockDevice', device.id)} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"><Ban className="h-3.5 w-3.5" />Block</button>
                    ) : (
                      <button onClick={() => action('license:unblockDevice', device.id)} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"><CheckCircle2 className="h-3.5 w-3.5" />Aktifkan</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Device Detail</p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{selected.device_name || selected.device_id}</h3>
                <p className="text-sm text-slate-500">{selected.user_name} - {selected.user_email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Tutup</button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ['Nama User', selected.user_name],
                ['Email', selected.user_email],
                ['Device ID', selected.device_id],
                ['Device Name', selected.device_name || '-'],
                ['Platform', selected.platform || '-'],
                ['Sistem Operasi', selected.operating_system || selected.os_name || '-'],
                ['Versi Aplikasi', selected.app_version || '-'],
                ['Status Lisensi', selected.license_status || '-'],
                ['Paket Langganan', selected.plan_name || selected.plan_code || '-'],
                ['Tanggal Aktivasi', selected.activated_at ? new Date(selected.activated_at).toLocaleString('id-ID') : '-'],
                ['Tanggal Expired', selected.expired_at ? new Date(selected.expired_at).toLocaleString('id-ID') : '-'],
                ['Aktivitas Terakhir', selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleString('id-ID') : '-'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {selected.status === 'active' ? (
                <button onClick={() => action('license:blockDevice', selected.id)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"><Ban className="h-4 w-4" />Block Device</button>
              ) : (
                <button onClick={() => action('license:unblockDevice', selected.id)} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"><CheckCircle2 className="h-4 w-4" />Unblock Device</button>
              )}
              <button onClick={() => action('license:suspendDeviceLicense', selected.id)} className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"><Ban className="h-4 w-4" />Suspend Lisensi</button>
              <button onClick={() => action('license:activateDeviceLicense', selected.id)} className="inline-flex items-center gap-2 rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20"><ShieldCheck className="h-4 w-4" />Aktifkan Lisensi</button>
              <button onClick={() => action('license:extendDeviceLicense', selected.id, { days: 30 })} className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:border-primary-800 dark:hover:bg-primary-900/20"><Clock3 className="h-4 w-4" />Perpanjang 30 Hari</button>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Riwayat Login</p>
              <div className="space-y-2">
                {(selected.login_history ?? []).map(row => (
                  <div key={row.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{row.action}</p>
                    <p className="text-slate-400">{new Date(row.created_at).toLocaleString('id-ID')}</p>
                  </div>
                ))}
                {!selected.login_history?.length && <p className="text-sm text-slate-400">Belum ada riwayat login.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
