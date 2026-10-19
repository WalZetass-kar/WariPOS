import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, DollarSign, Users, CreditCard } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Badge from '../../components/Badge'
import { Skeleton } from '../../components/Skeleton'
import { api } from '../../utils/api'
import { useToast } from '../../contexts/ToastContext'

interface RevenueData {
  total_revenue: number
  revenue_by_month: Array<{ month: string; total: number }>
  plan_revenue: Array<{ code: string; name: string; total: number; count: number }>
  active_customers: number
  expired_customers: number
  new_subscriptions: number
  renewals: number
}

function money(value: number) {
  return `Rp ${Number(value ?? 0).toLocaleString('id-ID')}`
}

export default function LicenseRevenuePage() {
  const toast = useToast()
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    api<RevenueData>('license:getRevenue').then(r => {
      if (r.success) setData(r.data ?? null)
      else toast(r.message || 'Gagal memuat revenue', 'error')
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const revenueRows = data?.revenue_by_month ?? []
  const planRows = data?.plan_revenue ?? []
  const topPlan = planRows[0]

  const statCards = [
    { label: 'Total Pendapatan', value: money(data?.total_revenue ?? 0), icon: DollarSign, bg: 'bg-emerald-500' },
    { label: 'Pelanggan Aktif', value: data?.active_customers ?? 0, icon: Users, bg: 'bg-blue-500' },
    { label: 'Pelanggan Expired', value: data?.expired_customers ?? 0, icon: CreditCard, bg: 'bg-red-500' },
    { label: 'Lisensi Baru', value: data?.new_subscriptions ?? 0, icon: TrendingUp, bg: 'bg-indigo-500' },
    { label: 'Renewal', value: data?.renewals ?? 0, icon: RefreshCw, bg: 'bg-amber-500' },
    { label: 'Paket Terlaris', value: topPlan?.name ?? '-', icon: CreditCard, bg: 'bg-primary-500' },
  ]

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {statCards.map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 transition-colors hover:border-primary-300 dark:hover:border-primary-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
                </div>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">{card.value}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card
          title="Revenue per Bulan"
          action={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>Refresh</Button>}
        >
          <div className="h-80 min-w-0">
            {loading ? (
              <div className="flex h-full items-end gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex-1 animate-pulse rounded-t-lg bg-slate-200 dark:bg-slate-700" style={{ height: `${20 + Math.random() * 70}%` }} />
                ))}
              </div>
            ) : revenueRows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v) / 1000000}jt`} />
                  <Tooltip formatter={(value) => typeof value === 'number' ? money(value) : String(value || '')} contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)', fontSize: 12 }} />
                  <Bar dataKey="total" fill="var(--color-primary-500, #2563eb)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <TrendingUp size={32} className="mb-2 opacity-20" />
                <p className="text-sm">Belum ada data revenue</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Paket Terlaris">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-slate-100 dark:border-slate-800 p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" /></div>
                </div>
              ))}
            </div>
          ) : planRows.length > 0 ? (
            <div className="space-y-3">
              {planRows.map((plan, idx) => (
                <div key={plan.code} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="flex justify-between gap-3 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                        idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}>{idx + 1}</span>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{plan.name}</p>
                    </div>
                    <Badge label={`${plan.count}x`} variant="blue" />
                  </div>
                  <p className="mt-1 text-sm font-bold text-primary-600 dark:text-primary-400">{money(plan.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              <CreditCard size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Belum ada data paket</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
