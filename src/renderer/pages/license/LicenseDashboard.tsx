import { useEffect, useState } from 'react'
import { Activity, CreditCard, DollarSign, MonitorSmartphone, RefreshCw, ShieldAlert, TrendingUp, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Badge from '../../components/Badge'
import { Skeleton } from '../../components/Skeleton'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'

interface LicenseStats {
  users: number
  total_devices: number
  user_online: number
  active_subscriptions: number
  expired_subscriptions: number
  revenue_month: number
  revenue_year: number
  total_transactions: number
  device_online: number
  active_devices: number
  blocked_devices: number
  active_versions: Record<string, number>
  revenue_by_month: Array<{ month: string; total: number }>
  recent_activity: Array<{ id: string; event_type: string; action: string; created_at: string }>
  recent_errors: Array<{ id: string; error_type: string; error_message: string; created_at: string }>
  generated_at: string
}

function money(value: number) {
  return `Rp ${Number(value ?? 0).toLocaleString('id-ID')}`
}

export default function LicenseDashboardPage() {
  const toast = useToast()
  const [stats, setStats] = useState<LicenseStats | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    api<LicenseStats>('license:getStats').then(r => {
      if (r.success) setStats(r.data ?? null)
      else toast(r.message || 'Gagal memuat statistik lisensi', 'error')
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const versions = Object.entries(stats?.active_versions ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([version, count]) => `${version} (${count})`)
    .join(', ') || '-'
  const revenueRows = stats?.revenue_by_month ?? []

  const cards = [
    { label: 'Total User', value: stats?.users ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-500' },
    { label: 'Total Device', value: stats?.total_devices ?? 0, icon: MonitorSmartphone, color: 'text-cyan-600', bg: 'bg-cyan-500' },
    { label: 'User Online', value: stats?.user_online ?? 0, icon: Activity, color: 'text-green-600', bg: 'bg-green-500' },
    { label: 'Lisensi Aktif', value: stats?.active_subscriptions ?? 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-500' },
    { label: 'Lisensi Expired', value: stats?.expired_subscriptions ?? 0, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-500' },
    { label: 'Revenue Bulan Ini', value: money(stats?.revenue_month ?? 0), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-500' },
    { label: 'Revenue Tahun Ini', value: money(stats?.revenue_year ?? 0), icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-500' },
    { label: 'Total Transaksi', value: stats?.total_transactions ?? 0, icon: Activity, color: 'text-primary-600', bg: 'bg-primary-500' },
  ]

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 animate-pulse">
              <div className="mb-3 h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 transition-colors hover:border-primary-300 dark:hover:border-primary-700">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} text-white shadow-sm`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                  {card.value}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        {/* Revenue Chart */}
        <Card
          title="Revenue per Bulan"
          subtitle="Pembayaran paid tahun berjalan"
          action={
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800">{versions}</span>
              <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>
                Refresh
              </Button>
            </div>
          }
        >
          <div className="h-72 min-w-0">
            {loading ? (
              <div className="flex h-full items-end gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex-1 animate-pulse rounded-t-lg bg-slate-200 dark:bg-slate-700" style={{ height: `${30 + Math.random() * 60}%` }} />
                ))}
              </div>
            ) : revenueRows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v) / 1000}k`} />
                  <Tooltip
                    formatter={(value) => typeof value === 'number' ? money(value) : String(value || '')}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)', fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="var(--color-primary-500, #0f766e)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <DollarSign size={32} className="mb-2 opacity-20" />
                <p className="text-sm">Belum ada data revenue</p>
              </div>
            )}
          </div>
        </Card>

        {/* Device Monitoring + Recent Errors */}
        <div className="space-y-4">
          <Card title="Monitoring Device">
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                  <p className="text-lg font-extrabold text-green-700 dark:text-green-300">{stats?.device_online ?? 0}</p>
                  <p className="text-[11px] text-green-700 dark:text-green-300">Online</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{stats?.active_devices ?? 0}</p>
                  <p className="text-[11px] text-slate-500">Aktif</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                  <p className="text-lg font-extrabold text-red-700 dark:text-red-300">{stats?.blocked_devices ?? 0}</p>
                  <p className="text-[11px] text-red-700 dark:text-red-300">Blocked</p>
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Error Terbaru</p>
              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
                      <Skeleton className="h-3 w-24 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  ))
                ) : (stats?.recent_errors ?? []).length > 0 ? (
                  (stats?.recent_errors ?? []).slice(0, 5).map(error => (
                    <div key={error.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge label={error.error_type} variant="red" />
                      </div>
                      <p className="truncate text-slate-500">{error.error_message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Belum ada error tercatat.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card title="Aktivitas Terbaru">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4 py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : (stats?.recent_activity ?? []).length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Event</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Action</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(stats?.recent_activity ?? []).slice(0, 8).map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5"><Badge label={row.event_type} variant="blue" /></td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.action}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(row.created_at).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <Activity size={28} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Belum ada aktivitas</p>
          </div>
        )}
        {stats?.generated_at && !loading && (
          <p className="mt-3 text-xs text-slate-400">Terakhir diperbarui: {new Date(stats.generated_at).toLocaleString('id-ID')}</p>
        )}
      </Card>
    </div>
  )
}
