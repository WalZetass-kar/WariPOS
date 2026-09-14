import { useState, useEffect } from 'react'
import { Bell, Database, AlertTriangle, Clock, CreditCard, Package, Shield, MessageCircle, Save, Smartphone, Send } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import { Skeleton, SettingsCardSkeleton } from '../components/Skeleton'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import {
  showSystemNotification,
  scheduleDailyMorningReminder,
  requestNotificationPermission,
} from '../utils/systemNotification'

interface NotifSettings {
  stok_menipis: boolean
  stok_habis: boolean
  hutang_jatuh_tempo: boolean
  lisensi_expire: boolean
  target_penjualan: boolean
  min_stok: number
  notif_wa: boolean
  wa_number: string
  notif_in_app: boolean
  notif_banner_system: boolean
  notif_pagi: boolean
  jam_notif_pagi: string
  quiet_start: string
  quiet_end: string
}

const DEFAULT: NotifSettings = {
  stok_menipis: true,
  stok_habis: true,
  hutang_jatuh_tempo: true,
  lisensi_expire: true,
  target_penjualan: false,
  min_stok: 5,
  notif_wa: false,
  wa_number: '',
  notif_in_app: true,
  notif_banner_system: true,
  notif_pagi: true,
  jam_notif_pagi: '07:00',
  quiet_start: '22:00',
  quiet_end: '06:00',
}

export default function NotificationSettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    api<NotifSettings>('notifSettings:get').then(r => {
      if (r.success && r.data) setSettings({ ...DEFAULT, ...r.data })
      setLoading(false)
    })
  }, [])

  const [testingBanner, setTestingBanner] = useState(false)

  const update = <K extends keyof NotifSettings>(key: K, value: NotifSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const r = await api('notifSettings:save', settings)
    setSaving(false)
    if (r.success) {
      toast('Pengaturan notifikasi disimpan', 'success')
      void scheduleDailyMorningReminder(
        settings.jam_notif_pagi || '07:00',
        settings.notif_banner_system && settings.notif_pagi
      )
    } else {
      toast(r.message as string ?? 'Gagal menyimpan', 'error')
    }
  }

  const handleTestBanner = async () => {
    setTestingBanner(true)
    try {
      const granted = await requestNotificationPermission()
      if (!granted) {
        toast('Izin notifikasi belum diberikan pada perangkat ini', 'info')
        setTestingBanner(false)
        return
      }

      await showSystemNotification({
        title: 'WariPOS - Notifikasi Berhasil',
        body: 'Notifikasi banner sistem telah aktif dan berfungsi normal di perangkat Anda.',
        actionRoute: '/dashboard',
      })
      toast('Notifikasi banner uji coba berhasil dikirim', 'success')
    } catch (err) {
      toast('Gagal mengirim banner: ' + (err as Error).message, 'error')
    } finally {
      setTestingBanner(false)
    }
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600" />
    </label>
  )

  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-48" /></div>
        </div>
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <SettingsCardSkeleton toggles={3} />
      <SettingsCardSkeleton toggles={2} />
      <SettingsCardSkeleton toggles={1} />
      <SettingsCardSkeleton toggles={2} />
      <SettingsCardSkeleton toggles={1} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Notifikasi</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pengaturan notifikasi untuk stok, hutang, lisensi, dan lainnya</p>
          </div>
        </div>
        <Button icon={<Save size={14} />} onClick={handleSave} loading={saving}>Simpan</Button>
      </div>

      <Card title="Stok Produk" action={<Package size={16} className="text-slate-400" />}>
        <div className="space-y-4 mt-1">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Stok Menipis</p>
              <p className="text-xs text-slate-400">Notifikasi saat stok produk mendekati minimum</p>
            </div>
            <Toggle checked={settings.stok_menipis} onChange={v => update('stok_menipis', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Stok Habis</p>
              <p className="text-xs text-slate-400">Notifikasi urgent saat stok produk = 0</p>
            </div>
            <Toggle checked={settings.stok_habis} onChange={v => update('stok_habis', v)} />
          </div>
          <Input label="Batas Stok Minimum" type="number" value={settings.min_stok} onChange={e => update('min_stok', +e.target.value)}
            helperText="Notifikasi stok menipis muncul jika stok ≤ nilai ini" />
        </div>
      </Card>

      <Card title="Keuangan" action={<CreditCard size={16} className="text-slate-400" />}>
        <div className="space-y-4 mt-1">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Hutang Jatuh Tempo</p>
              <p className="text-xs text-slate-400">Ingatkan 3 hari sebelum jatuh tempo</p>
            </div>
            <Toggle checked={settings.hutang_jatuh_tempo} onChange={v => update('hutang_jatuh_tempo', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Target Penjualan</p>
              <p className="text-xs text-slate-400">Notifikasi saat target harian tercapai</p>
            </div>
            <Toggle checked={settings.target_penjualan} onChange={v => update('target_penjualan', v)} />
          </div>
        </div>
      </Card>

      <Card title="Sistem" action={<Shield size={16} className="text-slate-400" />}>
        <div className="space-y-4 mt-1">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Lisensi Akan Berakhir</p>
              <p className="text-xs text-slate-400">Ingatkan 7 hari sebelum lisensi habis</p>
            </div>
            <Toggle checked={settings.lisensi_expire} onChange={v => update('lisensi_expire', v)} />
          </div>
        </div>
      </Card>

      <Card title="Pengingat Pagi & Banner Sistem" action={<Smartphone size={16} className="text-slate-400" />}>
        <div className="space-y-4 mt-1">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Notifikasi Banner Sistem (OS)</p>
              <p className="text-xs text-slate-400">Tampilkan pop-up banner di status bar HP atau desktop ketika ada peringatan stok atau jadwal</p>
            </div>
            <Toggle checked={settings.notif_banner_system} onChange={v => update('notif_banner_system', v)} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Pengingat Buka Kasir Setiap Pagi</p>
              <p className="text-xs text-slate-400">Alarm otomatis setiap pagi untuk mulai transaksi kasir (tetap berbunyi meski aplikasi ditutup)</p>
            </div>
            <Toggle checked={settings.notif_pagi} onChange={v => update('notif_pagi', v)} />
          </div>

          {settings.notif_pagi && (
            <Input
              label="Jam Pengingat Pagi"
              type="time"
              value={settings.jam_notif_pagi}
              onChange={e => update('jam_notif_pagi', e.target.value)}
              helperText="Alarm notifikasi harian akan dijadwalkan pada jam ini"
            />
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/30">
            <div>
              <p className="text-xs font-semibold text-primary-900 dark:text-primary-200">Uji Coba Banner Sistem</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Klik untuk memunculkan notifikasi banner langsung di perangkat Anda saat ini</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Send size={14} />}
              onClick={handleTestBanner}
              loading={testingBanner}
            >
              Tes Banner
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Channel Pengiriman" action={<MessageCircle size={16} className="text-slate-400" />}>
        <div className="space-y-4 mt-1">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Notifikasi In-App</p>
              <p className="text-xs text-slate-400">Tampilkan di icon lonceng atas kanan</p>
            </div>
            <Toggle checked={settings.notif_in_app} onChange={v => update('notif_in_app', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Notifikasi WhatsApp</p>
              <p className="text-xs text-slate-400">Kirim ke WhatsApp owner</p>
            </div>
            <Toggle checked={settings.notif_wa} onChange={v => update('notif_wa', v)} />
          </div>
          {settings.notif_wa && (
            <Input label="Nomor WhatsApp" value={settings.wa_number} onChange={e => update('wa_number', e.target.value)}
              placeholder="62812xxxx" helperText="Format: 62xxx tanpa tanda +" />
          )}
        </div>
      </Card>

      <Card title="Jam Tenang" action={<Clock size={16} className="text-slate-400" />}>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <Input label="Mulai (tidak kirim)" type="time" value={settings.quiet_start} onChange={e => update('quiet_start', e.target.value)} />
          <Input label="Selesai" type="time" value={settings.quiet_end} onChange={e => update('quiet_end', e.target.value)} />
        </div>
        <p className="text-xs text-slate-400 mt-2">Notifikasi tidak dikirim antara jam ini. Tetap disimpan dan ditampilkan saat app dibuka.</p>
      </Card>
    </div>
  )
}
