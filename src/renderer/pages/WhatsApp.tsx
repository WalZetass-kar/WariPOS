import { useState, useEffect, useRef } from 'react'
import {
  AlertCircle,
  Bell,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  MessageCircle,
  Send,
  ShieldCheck,
  XCircle,
  Zap,
  RefreshCw,
  Clock,
  Radio,
  FileText,
  History,
  Settings2,
  Users,
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Textarea from '../components/Textarea'
import { useToast } from '../contexts/ToastContext'
import { api } from '../utils/api'
import type { Customer } from '../../shared/types'
import { SkeletonPage } from '../components/Skeleton'

interface WhatsAppSettings {
  provider: 'fonnte'
  apiKey: string
  enabled: boolean
  notifyOnSale: boolean
  notifyOnReturn: boolean
  notifyOnLowStock: boolean
  notifyOnPayment: boolean
  messageTemplate: string
  rateLimitPerMinute: number
}

interface WhatsAppTemplate {
  id: number
  name: string
  content: string
  created_at: string
  updated_at?: string | null
}

interface BroadcastHistory {
  id: number
  title: string
  target_type: string
  total_targets: number
  delivered: number
  failed: number
  scheduled_at?: string | null
  sent_at?: string | null
  status: string
  detail?: string | null
  created_at: string
}

type WaTab = 'gateway' | 'template' | 'broadcast' | 'history'

const DEFAULT_TEMPLATE = 'Terima kasih {customer}! Pesanan Anda sebesar {total} telah diterima. No. Transaksi: {invoice}'
const DEFAULT_BROADCAST_TEMPLATE = 'Halo {{nama_customer}}, total belanja Anda {{total_belanja}} dan poin loyalty {{poin_loyalty}}.'

const notificationItems = [
  { key: 'notifyOnSale', label: 'Transaksi Kasir Baru', desc: 'Struk ringkas otomatis dikirim ke WhatsApp customer saat pembayaran selesai' },
  { key: 'notifyOnReturn', label: 'Nota Retur Barang', desc: 'Customer mendapat konfirmasi WhatsApp saat ada barang yang diretur' },
  { key: 'notifyOnLowStock', label: 'Peringatan Stok Menipis', desc: 'Owner/Admin menerima pesan saat stok produk menyentuh batas minimum' },
  { key: 'notifyOnPayment', label: 'Bukti Pembayaran / Piutang', desc: 'Notifikasi saat pembayaran piutang atau pelunasan berhasil dicatat' },
] as const

function boolFromDb(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return Boolean(value)
}

function normalizePreview(phone: string): string {
  let cleaned = phone.trim().replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2)
  if (cleaned.startsWith('0')) cleaned = `62${cleaned.slice(1)}`
  if (cleaned.startsWith('8')) cleaned = `62${cleaned}`
  return cleaned
}

function Toggle({ checked, onChange, title }: { checked: boolean; onChange: () => void; title: string }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      title={title}
      onClick={onChange}
      className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors ${
        checked ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function WhatsApp() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<WaTab>('gateway')
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [settings, setSettings] = useState<WhatsAppSettings>({
    provider: 'fonnte',
    apiKey: '',
    enabled: false,
    notifyOnSale: true,
    notifyOnReturn: true,
    notifyOnLowStock: false,
    notifyOnPayment: true,
    messageTemplate: DEFAULT_TEMPLATE,
    rateLimitPerMinute: 20,
  })
  const [testNumber, setTestNumber] = useState('')
  const [testModal, setTestModal] = useState(false)
  const [lastTestMessage, setLastTestMessage] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [history, setHistory] = useState<BroadcastHistory[]>([])
  const [targetMode, setTargetMode] = useState<'all' | 'active' | 'manual'>('active')
  const [manualTargets, setManualTargets] = useState('')
  const [broadcastTitle, setBroadcastTitle] = useState('Broadcast Promo Member')
  const [broadcastTemplate, setBroadcastTemplate] = useState(DEFAULT_BROADCAST_TEMPLATE)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [broadcastProgress, setBroadcastProgress] = useState({ running: false, total: 0, sent: 0, failed: 0 })
  const cancelBroadcastRef = useRef(false)

  const syncSettings = (data: any) => {
    setSettings({
      provider: data?.provider ?? 'fonnte',
      apiKey: data?.api_key ?? '',
      enabled: boolFromDb(data?.enabled),
      notifyOnSale: boolFromDb(data?.notify_on_sale, true),
      notifyOnReturn: boolFromDb(data?.notify_on_return, true),
      notifyOnLowStock: boolFromDb(data?.notify_on_low_stock),
      notifyOnPayment: boolFromDb(data?.notify_on_payment, true),
      messageTemplate: data?.message_template || DEFAULT_TEMPLATE,
      rateLimitPerMinute: Number(data?.rate_limit_per_minute ?? 20),
    })
  }

  useEffect(() => {
    api<any>('whatsapp:get').then(r => {
      if (r.success && r.data) syncSettings(r.data)
    })
    api<Customer[]>('customer:getAll').then(r => {
      if (r.success) setCustomers(r.data ?? [])
    })
    api<WhatsAppTemplate[]>('whatsapp:getTemplates').then(r => {
      if (r.success) {
        setTemplates(r.data ?? [])
        if (r.data?.[0]?.content) setBroadcastTemplate(r.data[0].content)
      }
    })
    api<BroadcastHistory[]>('whatsapp:getBroadcastHistory').then(r => {
      if (r.success) setHistory(r.data ?? [])
    })
  }, [])

  const handleSave = async () => {
    if (settings.enabled && !settings.apiKey.trim()) {
      toast('API key Fonnte wajib diisi sebelum WhatsApp diaktifkan', 'error')
      return
    }

    setLoading(true)
    const r = await api<any>('whatsapp:save', settings)
    setLoading(false)

    if (r.success) {
      if (r.data) syncSettings(r.data)
      toast('Pengaturan WhatsApp berhasil disimpan', 'success')
    } else {
      toast((r.message as string) ?? 'Gagal menyimpan', 'error')
    }
  }

  const handleTest = async () => {
    const phone = testNumber.trim()
    if (!phone) return toast('Masukkan nomor HP', 'error')
    if (!settings.apiKey.trim()) return toast('API key Fonnte belum diisi', 'error')

    setTesting(true)
    setLastTestMessage('')
    const r = await api('whatsapp:test', {
      phone,
      apiKey: settings.apiKey,
      message: 'Test notifikasi dari WariPOS berhasil terhubung!',
    })
    setTesting(false)

    if (r.success) {
      setTestModal(false)
      setLastTestMessage((r.message as string) ?? 'Pesan test berhasil dikirim via Fonnte')
      toast('Pesan test WhatsApp berhasil dikirim', 'success')
    } else {
      setLastTestMessage((r.message as string) ?? 'Gagal mengirim pesan')
      toast((r.message as string) ?? 'Gagal mengirim pesan', 'error')
    }
  }

  const renderBroadcastTemplate = (template: string, customer: Partial<Customer>) => (
    template
      .split('{{nama_customer}}').join(customer.nama_customer || 'Customer')
      .split('{{total_belanja}}').join(Number(customer.total_belanja ?? 0).toLocaleString('id-ID'))
      .split('{{poin_loyalty}}').join(Number(customer.poin ?? 0).toLocaleString('id-ID'))
  )

  const broadcastTargets = () => {
    if (targetMode === 'manual') {
      return manualTargets
        .split(/\r?\n|,/)
        .map((phone, index) => ({ kd_customer: `manual-${index}`, nama_customer: `Pelanggan ${index + 1}`, no_telp: phone.trim(), total_belanja: 0, poin: 0 }))
        .filter(item => item.no_telp)
    }

    return customers.filter(customer => {
      if (!customer.no_telp) return false
      if (targetMode === 'active') return customer.status === 'Aktif'
      return true
    })
  }

  const saveCurrentTemplate = async () => {
    const r = await api<WhatsAppTemplate[]>('whatsapp:saveTemplate', {
      name: broadcastTitle || 'Template Broadcast',
      content: broadcastTemplate,
    })
    if (r.success) {
      setTemplates(r.data ?? [])
      toast('Template broadcast berhasil disimpan', 'success')
    } else {
      toast((r.message as string) || 'Gagal menyimpan template', 'error')
    }
  }

  const refreshHistory = async () => {
    const r = await api<BroadcastHistory[]>('whatsapp:getBroadcastHistory')
    if (r.success) setHistory(r.data ?? [])
  }

  const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

  const sendBroadcast = async () => {
    if (!settings.apiKey.trim()) return toast('API key Fonnte belum diisi', 'error')
    const targets = broadcastTargets()
    if (targets.length === 0) return toast('Target pelanggan broadcast kosong', 'error')
    if (!broadcastTemplate.trim()) return toast('Template pesan wajib diisi', 'error')

    if (scheduleMode === 'scheduled') {
      if (!scheduledAt) return toast('Pilih waktu jadwal pengiriman', 'error')
      const scheduledTime = new Date(scheduledAt).getTime()
      if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now()) return toast('Waktu jadwal harus di masa mendatang', 'error')
      await api('whatsapp:saveBroadcastHistory', {
        title: broadcastTitle,
        targetType: targetMode,
        totalTargets: targets.length,
        delivered: 0,
        failed: 0,
        scheduledAt: new Date(scheduledAt).toISOString(),
        status: 'scheduled',
      })
      await refreshHistory()
      toast('Broadcast berhasil dijadwalkan', 'success')
      return
    }

    cancelBroadcastRef.current = false
    setBroadcastProgress({ running: true, total: targets.length, sent: 0, failed: 0 })
    const delayMs = Math.ceil(60000 / Math.max(1, settings.rateLimitPerMinute))
    const detail: Array<{ phone: string; success: boolean; message?: string }> = []
    let sent = 0
    let failed = 0

    for (const target of targets) {
      if (cancelBroadcastRef.current) break
      const message = renderBroadcastTemplate(broadcastTemplate, target)
      const r = await api('whatsapp:test', {
        phone: target.no_telp,
        apiKey: settings.apiKey,
        message,
      })
      if (r.success) sent += 1
      else failed += 1
      detail.push({ phone: target.no_telp ?? '', success: r.success, message: r.message as string | undefined })
      setBroadcastProgress({ running: true, total: targets.length, sent, failed })
      if (sent + failed < targets.length) await wait(delayMs)
    }

    setBroadcastProgress({ running: false, total: targets.length, sent, failed })
    await api('whatsapp:saveBroadcastHistory', {
      title: broadcastTitle,
      targetType: targetMode,
      totalTargets: targets.length,
      delivered: sent,
      failed,
      sentAt: new Date().toISOString(),
      status: cancelBroadcastRef.current ? 'cancelled' : failed > 0 ? 'partial' : 'completed',
      detail,
    })
    await refreshHistory()
    toast(cancelBroadcastRef.current ? 'Broadcast dibatalkan' : `Broadcast selesai: ${sent} terkirim, ${failed} gagal`, failed > 0 ? 'error' : 'success')
  }

  const normalizedTestNumber = normalizePreview(testNumber)
  const activeCount = notificationItems.filter(item => settings[item.key as keyof WhatsAppSettings]).length
  const targets = broadcastTargets()
  const previewTarget = targets[0] ?? { nama_customer: 'Pelanggan Setia', total_belanja: 150000, poin: 15 }
  const progressPercent = broadcastProgress.total ? Math.round(((broadcastProgress.sent + broadcastProgress.failed) / broadcastProgress.total) * 100) : 0

  if (loading) return <SkeletonPage rows={6} />

  const tabs: Array<{ id: WaTab; label: string; icon: any }> = [
    { id: 'gateway', label: 'Gateway & Notifikasi', icon: Settings2 },
    { id: 'template', label: 'Template Struk Kasir', icon: FileText },
    { id: 'broadcast', label: 'Broadcast Massal', icon: Send },
    { id: 'history', label: 'Riwayat Broadcast', icon: History },
  ]

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <MessageCircle className="text-emerald-500" size={24} />
              WhatsApp Notifikasi
            </h1>
            <Badge label={settings.enabled ? 'Aktif' : 'Nonaktif'} variant={settings.enabled ? 'green' : 'gray'} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Integrasi API Fonnte untuk struk otomatis ke customer dan pengiriman pesan broadcast.
          </p>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setTestModal(true)}
            icon={<Send size={14} />}
            className="flex-1 sm:flex-initial text-xs font-bold"
          >
            Kirim Test
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
            icon={<CheckCircle size={14} />}
            className="flex-1 sm:flex-initial bg-red-600 hover:bg-red-700 text-white font-bold text-xs border-0"
          >
            Simpan Pengaturan
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        {tabs.map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: GATEWAY & NOTIFIKASI */}
      {activeTab === 'gateway' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Status Switcher Card */}
            <div className={`p-4 rounded-2xl border ${settings.enabled ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${settings.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-800'}`}>
                    {settings.enabled ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Layanan WhatsApp Gateway {settings.enabled ? 'Aktif' : 'Nonaktif'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {settings.enabled ? `${activeCount} dari ${notificationItems.length} jenis notifikasi otomatis aktif` : 'Aktifkan toggle di sebelah kanan untuk menyalakan notifikasi'}
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={settings.enabled}
                  title="Aktifkan WhatsApp"
                  onChange={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                />
              </div>

              {lastTestMessage && (
                <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lastTestMessage}
                </div>
              )}
            </div>

            {/* API Config Card */}
            <Card title="Konfigurasi API Fonnte">
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Provider Gateway</label>
                    <select
                      value={settings.provider}
                      onChange={e => setSettings(prev => ({ ...prev, provider: e.target.value as 'fonnte' }))}
                      className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                    >
                      <option value="fonnte">Fonnte (fonnte.com)</option>
                    </select>
                  </div>
                  <Input
                    label="Rate Limit (Pesan / Menit)"
                    type="number"
                    min={1}
                    max={60}
                    value={settings.rateLimitPerMinute}
                    onChange={e => setSettings(prev => ({ ...prev, rateLimitPerMinute: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">API Key / Token Fonnte *</label>
                  <div className="relative">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={settings.apiKey}
                      onChange={e => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Contoh: a1b2c3d4e5f6g7h8..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open('https://fonnte.com', '_blank')}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline"
                  >
                    Buka situs Fonnte.com untuk ambil API Key
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </Card>

            {/* Notification Triggers Card */}
            <Card title="Pemicu Notifikasi Otomatis">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notificationItems.map(item => (
                  <div key={item.key} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.label}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                    <Toggle
                      checked={settings[item.key as keyof WhatsAppSettings] as boolean}
                      title={`Toggle ${item.label}`}
                      onChange={() => setSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof WhatsAppSettings] }))}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quick Info Column */}
          <div className="space-y-4">
            <Card title="Status Koneksi">
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={18} className={settings.apiKey.trim() ? 'text-emerald-500' : 'text-slate-400'} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">API Token Fonnte</p>
                    <p className="text-slate-400 text-[11px]">{settings.apiKey.trim() ? 'Sudah Dikonfigurasi' : 'Belum Diisi'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Bell size={18} className={settings.enabled ? 'text-emerald-500' : 'text-slate-400'} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Status Pengiriman</p>
                    <p className="text-slate-400 text-[11px]">{settings.enabled ? 'Aktif Mengirim Pesan' : 'Nonaktif'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Zap size={18} className={activeCount > 0 ? 'text-emerald-500' : 'text-slate-400'} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Event Aktif</p>
                    <p className="text-slate-400 text-[11px]">{activeCount} dari {notificationItems.length} Event Otomatis</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-600" />
                Format Nomor WhatsApp
              </p>
              <p className="text-[11px] leading-relaxed">
                Nomor dapat diinput dalam format <strong>08xx</strong>, <strong>+628xx</strong>, atau <strong>628xx</strong>. Sistem akan menormalkannya secara otomatis ke format internasional.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEMPLATE STRUK KASIR */}
      {activeTab === 'template' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Editor Template Struk WhatsApp">
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pesan ini akan dikirim secara otomatis ke customer setelah kasir menyelesaikan transaksi belanja.
              </p>
              <Textarea
                value={settings.messageTemplate}
                onChange={e => setSettings(prev => ({ ...prev, messageTemplate: e.target.value }))}
                rows={6}
                placeholder={DEFAULT_TEMPLATE}
                helperText="Variabel: {customer}, {total}, {invoice}"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSettings(prev => ({ ...prev, messageTemplate: DEFAULT_TEMPLATE }))}
                  className="text-xs font-bold"
                >
                  Reset Template Standar
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Pratinjau Struk di WhatsApp Customer">
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Pesan Masuk WhatsApp</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                  {(settings.messageTemplate || DEFAULT_TEMPLATE)
                    .replace('{customer}', 'Bpk. Budi Santoso')
                    .replace('{total}', 'Rp 125.000')
                    .replace('{invoice}', 'INV-20260831-001')}
                </p>
                <div className="mt-3 text-right">
                  <span className="text-[10px] text-slate-400 font-mono">12:30 · Terkirim</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: BROADCAST MASSAL */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card title="Kirim Pesan Promosi Massal">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Judul Kampanye"
                    value={broadcastTitle}
                    onChange={e => setBroadcastTitle(e.target.value)}
                  />
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Target Penerima</label>
                    <select
                      value={targetMode}
                      onChange={e => setTargetMode(e.target.value as typeof targetMode)}
                      className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                    >
                      <option value="active">Member Aktif ({customers.filter(c => c.status === 'Aktif' && c.no_telp).length} orang)</option>
                      <option value="all">Semua Member ({customers.filter(c => c.no_telp).length} orang)</option>
                      <option value="manual">Manual Input Nomor HP</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Waktu Kirim</label>
                    <select
                      value={scheduleMode}
                      onChange={e => setScheduleMode(e.target.value as typeof scheduleMode)}
                      className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-600"
                    >
                      <option value="now">Kirim Sekarang</option>
                      <option value="scheduled">Jadwalkan</option>
                    </select>
                  </div>
                </div>

                {targetMode === 'manual' && (
                  <Textarea
                    label="Daftar Nomor HP (Pisahkan koma atau baris baru)"
                    value={manualTargets}
                    onChange={e => setManualTargets(e.target.value)}
                    rows={3}
                    placeholder="08123456789, 085712345678"
                  />
                )}

                {scheduleMode === 'scheduled' && (
                  <Input
                    label="Pilih Tanggal & Jam Pengiriman"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                  />
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Isi Pesan Broadcast</label>
                    {templates.length > 0 && (
                      <select
                        className="text-[11px] font-bold bg-transparent text-red-600 focus:outline-none cursor-pointer"
                        onChange={e => {
                          const selected = templates.find(item => String(item.id) === e.target.value)
                          if (selected) {
                            setBroadcastTitle(selected.name)
                            setBroadcastTemplate(selected.content)
                          }
                        }}
                      >
                        <option value="">-- Gunakan Template Tersimpan --</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </div>
                  <Textarea
                    value={broadcastTemplate}
                    onChange={e => setBroadcastTemplate(e.target.value)}
                    rows={5}
                    placeholder={DEFAULT_BROADCAST_TEMPLATE}
                    helperText="Variabel: {{nama_customer}}, {{total_belanja}}, {{poin_loyalty}}"
                  />
                </div>

                {broadcastProgress.running && (
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Proses Pengiriman...</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="text-xs font-semibold text-slate-500">
                      {broadcastProgress.sent + broadcastProgress.failed}/{broadcastProgress.total} diproses · {broadcastProgress.sent} terkirim · {broadcastProgress.failed} gagal
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={sendBroadcast}
                    loading={broadcastProgress.running}
                    icon={<Send size={15} />}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm border-0"
                  >
                    {scheduleMode === 'scheduled' ? 'Jadwalkan Broadcast' : `Kirim ke ${targets.length} Pelanggan`}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={saveCurrentTemplate}
                    className="text-xs font-bold"
                  >
                    Simpan Template
                  </Button>
                  {broadcastProgress.running && (
                    <Button
                      variant="danger"
                      onClick={() => { cancelBroadcastRef.current = true }}
                      className="text-xs font-bold"
                    >
                      Hentikan
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Pratinjau Pesan Broadcast">
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">Target: {previewTarget.nama_customer}</p>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                  {renderBroadcastTemplate(broadcastTemplate || DEFAULT_BROADCAST_TEMPLATE, previewTarget)}
                </p>
              </div>
            </Card>

            <Card title="Template Tersimpan">
              <div className="space-y-2 text-xs">
                {templates.length === 0 ? (
                  <p className="text-slate-400 font-bold text-center py-4">Belum ada template tersimpan</p>
                ) : (
                  templates.map(t => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setBroadcastTitle(t.name)
                        setBroadcastTemplate(t.content)
                      }}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-red-500 cursor-pointer transition-colors"
                    >
                      <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.content}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: RIWAYAT BLAST */}
      {activeTab === 'history' && (
        <Card title="Riwayat Pengiriman Broadcast">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[700px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kampanye</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Target</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Terkirim</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Gagal</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Belum ada riwayat broadcast</td>
                    </tr>
                  ) : (
                    history.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{item.title}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{item.total_targets} kontak</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600">{item.delivered}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{item.failed}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            label={item.status}
                            variant={item.status === 'completed' ? 'green' : item.status === 'scheduled' ? 'blue' : item.failed > 0 ? 'red' : 'gray'}
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Test Message Modal */}
      <Modal
        open={testModal}
        onClose={() => setTestModal(false)}
        title="Kirim Pesan Test WhatsApp"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTestModal(false)} className="w-full sm:w-auto font-bold">Batal</Button>
            <Button onClick={handleTest} loading={testing} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold border-0">Kirim Test</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Nomor HP Target *"
            value={testNumber}
            onChange={e => setTestNumber(e.target.value)}
            placeholder="08123456789"
            helperText={normalizedTestNumber ? `Akan dikirim ke +${normalizedTestNumber}` : 'Contoh: 08123456789'}
          />
        </div>
      </Modal>
    </div>
  )
}
