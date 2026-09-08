import React, { useEffect, useState } from 'react'
import { ShieldCheck, Plus, Key, Users, Calendar, AlertCircle, CheckCircle2, XCircle, Building2, User, Mail, Smartphone, Laptop } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../../shared/supabase/config'
import { appConfig } from '../utils/productionConfig'
import { SkeletonPage } from '../components/Skeleton'

interface LicenseDisplay {
  id: string
  customer_id: string
  license_key: string
  customer_name: string
  company_name: string
  email: string
  plan: string
  plan_code: string
  max_devices: number
  active_devices: number | null
  status: string
  expires_at: string | null
  started_at: string | null
  created_at: string
}

export default function LicenseAdmin() {
  const { user } = useAuth()
  const [licenses, setLicenses] = useState<LicenseDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    customerName: '',
    companyName: '',
    email: '',
    plan: 'STANDARD',
    maxDevices: 1,
    durationDays: 365
  })

  const fetchLicenses = async () => {
    setLoading(true)
    console.log('[Supabase] SELECT license_customers', { select: 'id,name,email,metadata,status,created_at', filter: {} })
    const { data: customers, error: customersError } = await (supabase
      .from('license_customers') as any)
      .select('id, name, email, metadata, status, created_at')
      .order('created_at', { ascending: false })

    if (customersError) {
      console.error('[Supabase] ERROR SELECT license_customers', {
        status: customersError.status,
        code: customersError.code,
        message: customersError.message,
        details: customersError.details,
        hint: customersError.hint,
      })
      setLoading(false)
      return
    }
    console.log('[Supabase] OK SELECT license_customers', { rows: (customers || []).length })

    if (!customers || customers.length === 0) {
      setLicenses([])
      setLoading(false)
      return
    }

    const customerIds: string[] = (customers as any[]).map((c: any) => c.id)

    console.log('[Supabase] SELECT customer_subscriptions', { select: 'id,customer_id,plan_id,status,expires_at,started_at', filter: { customer_id: customerIds } })
    const { data: subscriptions, error: subsError } = await (supabase
      .from('customer_subscriptions') as any)
      .select('id, customer_id, plan_id, status, expires_at, started_at')
      .in('customer_id', customerIds)

    if (subsError) {
      console.error('[Supabase] ERROR SELECT customer_subscriptions', {
        status: subsError.status,
        code: subsError.code,
        message: subsError.message,
        details: subsError.details,
        hint: subsError.hint,
      })
      setLoading(false)
      return
    }
    console.log('[Supabase] OK SELECT customer_subscriptions', { rows: (subscriptions || []).length })

    const subMap: Record<string, any> = {}
    const planIds: string[] = []
    for (const s of (subscriptions || []) as any[]) {
      if (!subMap[s.customer_id]) {
        subMap[s.customer_id] = s
        if (s.plan_id) planIds.push(s.plan_id)
      }
    }

    let plansMap: Record<string, any> = {}
    if (planIds.length > 0) {
      console.log('[Supabase] SELECT subscription_plans', { select: 'id,code,name,max_devices', filter: { id: planIds } })
      const { data: plans, error: plansError } = await (supabase
        .from('subscription_plans') as any)
        .select('id, code, name, max_devices')
        .in('id', planIds)

      if (plansError) {
        console.error('[Supabase] ERROR SELECT subscription_plans', {
          status: plansError.status,
          code: plansError.code,
          message: plansError.message,
          details: plansError.details,
          hint: plansError.hint,
        })
      } else {
        console.log('[Supabase] OK SELECT subscription_plans', { rows: (plans || []).length })
        for (const p of (plans || []) as any[]) {
          plansMap[p.id] = p
        }
      }
    }

    const mapped: LicenseDisplay[] = (customers as any[]).map((c: any) => {
      const sub = subMap[c.id] || {}
      const plan = plansMap[sub.plan_id] || {}
      const meta = (c.metadata || {}) as any
      return {
        id: sub.id || c.id,
        customer_id: c.id,
        license_key: meta.license_key || '-',
        customer_name: c.name,
        company_name: meta.company_name || '',
        email: c.email,
        plan: plan.name || '-',
        plan_code: plan.code || '',
        max_devices: plan.max_devices ?? 1,
        active_devices: null,
        status: sub.status || c.status || 'unknown',
        expires_at: sub.expires_at || null,
        started_at: sub.started_at || null,
        created_at: c.created_at,
      }
    })
    setLicenses(mapped)
    setLoading(false)
  }

  const fetchDeviceCounts = async (customerIds: string[]) => {
    if (customerIds.length === 0) return
    const { data: devices } = await (supabase
      .from('customer_devices') as any)
      .select('customer_id, status')
      .in('customer_id', customerIds)

    if (devices) {
      const counts: Record<string, number> = {}
      for (const d of devices as Array<{ customer_id: string; status: string }>) {
        if (d.status === 'active') {
          counts[d.customer_id] = (counts[d.customer_id] || 0) + 1
        }
      }
      setLicenses(prev => prev.map(l => ({
        ...l,
        active_devices: counts[l.customer_id] || 0,
      })))
    }
  }

  useEffect(() => {
    if (user?.hak_akses === 'developer') {
      fetchLicenses()
    }
  }, [user])

  useEffect(() => {
    const customerIds = licenses.map(l => l.customer_id).filter(Boolean)
    if (customerIds.length > 0) {
      fetchDeviceCounts(customerIds)
    }
  }, [licenses.length])

  if (!user || user.hak_akses !== 'developer') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6 select-none">
        <div className="rounded-3xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 p-10 text-center max-w-md shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-600/10 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-600/20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-xl font-black text-red-600 dark:text-red-400 mb-2">Akses Ditolak</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            Halaman Developer Dashboard khusus untuk akun Developer / Super Admin.
          </p>
        </div>
      </div>
    )
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const edgeFunctionUrl = `${appConfig.supabaseProjectId}/functions/v1/license-server/generate`
      const res = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appConfig.supabaseApiKey}`
        },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.success) {
        alert('Lisensi berhasil dibuat: ' + (data.license_key || data.customer_id))
        setShowModal(false)
        fetchLicenses()
      } else {
        alert('Gagal: ' + data.error)
      }
    } catch (err: any) {
      alert('Error menghubungi server: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!confirm(`Yakin ingin mengubah status lisensi ini?`)) return
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const { error } = await (supabase.from('customer_subscriptions') as any).update({ status: newStatus }).eq('id', id)
    if (!error) fetchLicenses()
  }

  if (loading) return <SkeletonPage rows={6} />

  const statusBadge = (status: string) => {
    if (status === 'ACTIVE' || status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
          <CheckCircle2 size={14} /> Aktif
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
        <XCircle size={14} /> Suspended
      </span>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 select-none">
      
      {/* Developer Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-red-600" size={28} />
              Developer Panel
            </h1>
            <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-extrabold shadow-sm shadow-red-600/20">
              Developer By WalZetass-Kar
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manajemen Lisensi Pembeli UMKM, Kuota Perangkat & Aktivasi Sistem Cloud Supabase.
          </p>
        </div>

        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-3 rounded-xl shadow-md shadow-red-600/20 text-xs sm:text-sm transition-all active:scale-[0.98]"
        >
          <Plus size={18} />
          Generate Lisensi Baru
        </button>
      </div>

      {/* Licenses Data Table Container */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-extrabold uppercase text-slate-500 tracking-wider">
                <th className="p-4">License Key</th>
                <th className="p-4">Toko / Pembeli</th>
                <th className="p-4">Paket Plan</th>
                <th className="p-4">Perangkat</th>
                <th className="p-4">Masa Berlaku</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-400 font-medium">Memuat data lisensi pembeli...</td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-400 font-medium">Belum ada lisensi pembeli yang terdaftar.</td>
                </tr>
              ) : (
                licenses.map(lic => (
                  <tr key={lic.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-red-600" />
                        {lic.license_key}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-extrabold text-slate-900 dark:text-white">{lic.company_name || 'Tanpa Nama Toko'}</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">{lic.email} ({lic.customer_name})</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-600/20">
                        {lic.plan}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                        <Laptop size={14} className="text-slate-400" />
                        {lic.active_devices ?? '?'} / {lic.max_devices} Perangkat
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </td>
                    <td className="p-4">
                      {statusBadge(lic.status)}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        type="button"
                        onClick={() => toggleStatus(lic.id, lic.status)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                          lic.status === 'ACTIVE' || lic.status === 'active'
                            ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40' 
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/60 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        {lic.status === 'ACTIVE' || lic.status === 'active' ? 'Suspend' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate License Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-red-600" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Generate Lisensi Pembeli Baru</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Nama Pemilik / Customer *</label>
                <input
                  required
                  value={formData.customerName}
                  onChange={e => setFormData({...formData, customerName: e.target.value})}
                  className="w-full h-12 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                  placeholder="Budi Santoso"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Email Toko Pembeli *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full h-12 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                  placeholder="budi@toko.com"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Nama Toko (Opsional)</label>
                <input
                  value={formData.companyName}
                  onChange={e => setFormData({...formData, companyName: e.target.value})}
                  className="w-full h-12 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                  placeholder="Toko Maju Sejahtera"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Paket Plan *</label>
                  <select
                    value={formData.plan}
                    onChange={e => setFormData({...formData, plan: e.target.value})}
                    className="w-full h-12 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Max Devices *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.maxDevices}
                    onChange={e => setFormData({...formData, maxDevices: parseInt(e.target.value) || 1})}
                    className="w-full h-12 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Durasi Hari Aktif *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.durationDays}
                  onChange={e => setFormData({...formData, durationDays: parseInt(e.target.value) || 365})}
                  className="w-full h-12 px-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={generating}
                  className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 transition-all disabled:opacity-50"
                >
                  {generating ? 'Membuat Lisensi Cloud...' : 'Generate License Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
