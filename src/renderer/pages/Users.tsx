import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Key, ShieldCheck, Lock, Power, CalendarPlus, Monitor, Smartphone, RefreshCw, Users as UsersIcon, Zap } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import { SkeletonPage } from '../components/Skeleton'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useDemoGuard } from '../hooks/useDemoGuard'
import { MENU_GROUPS } from '../layouts/Sidebar'
import type { Pengguna } from '../../shared/types'
import { formatDate } from '../utils/format'

interface FormState {
  nama_pengguna: string
  nama_lengkap: string
  password: string
  confirmPassword: string
  pin: string
  confirmPin: string
  pin_enabled: boolean
  hak_akses: 'developer' | 'admin' | 'operator' | 'kasir'
  email: string
  no_telp: string
  access_expires_at: string
}

interface LocalSubscriptionStatus {
  plan_name?: string | null
  max_users?: number | null
  feature_flags?: Record<string, boolean>
  is_expired?: boolean
}

const EMPTY: FormState = {
  nama_pengguna: '',
  nama_lengkap: '',
  password: '',
  confirmPassword: '',
  pin: '',
  confirmPin: '',
  pin_enabled: false,
  hak_akses: 'kasir',
  email: '',
  no_telp: '',
  access_expires_at: '',
}

function isDeveloperAccount(user?: Pick<Pengguna, 'hak_akses'> | null) {
  return user?.hak_akses === 'developer'
}

function isPrivilegedRole(role?: string | null) {
  return role === 'developer'
}

function normalizeLocalRole(role?: string | null): FormState['hak_akses'] {
  if (role === 'superadmin') return 'developer'
  return ['developer', 'admin', 'operator', 'kasir'].includes(role ?? '')
    ? role as FormState['hak_akses']
    : 'kasir'
}

// Password validation
const validatePassword = (password: string): string | null => {
  if (password.length < 8) return 'Password minimal 8 karakter'
  if (!/[A-Z]/.test(password)) return 'Password harus mengandung huruf besar'
  if (!/[a-z]/.test(password)) return 'Password harus mengandung huruf kecil'
  if (!/[0-9]/.test(password)) return 'Password harus mengandung angka'
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'Password harus mengandung simbol'
  return null
}

const validatePin = (pin: string): string | null => {
  if (!/^\d{4,8}$/.test(pin)) return 'PIN kasir harus 4-8 digit angka'
  return null
}

// Collect unique menu items from MENU_GROUPS for permission modal
const PERMISSION_MENUS = MENU_GROUPS.flatMap(g =>
  g.items.map(item => ({ group: g.label, label: item.label, code: item.code }))
).filter((item, idx, arr) => arr.findIndex(x => x.code === item.code && x.label === item.label) === idx)

const ALL_PERMISSION_CODES = [...new Set(PERMISSION_MENUS.map(item => item.code))]

function getDefaultPermissions() {
  return Object.fromEntries(ALL_PERMISSION_CODES.map(code => [code, true]))
}

function normalizePermissions(saved: Record<string, boolean>) {
  return { ...getDefaultPermissions(), ...saved }
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function isExpired(value: string | null | undefined) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now()
}

function getDaysRemaining(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000))
}

export default function Users() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { guardPremiumFeature } = useDemoGuard()
  const [activeTab, setActiveTab] = useState<'users' | 'devices'>('users')
  const [data, setData] = useState<Pengguna[]>([])
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | 'password' | 'permissions' | 'extend' | null>(null)
  const [form, setForm] = useState<FormState>({ ...EMPTY })
  const [selected, setSelected] = useState<Pengguna | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [extendDays, setExtendDays] = useState('30')
  const [subscriptionStatus, setSubscriptionStatus] = useState<LocalSubscriptionStatus | null>(null)

  const load = async () => {
    try {
      const r = await api<Pengguna[]>('user:getAll')
      if (r.success) {
        // Exclude system developer accounts from store staff list
        const storeStaff = (r.data ?? []).filter(u => {
          if (u.hak_akses === 'developer') return false
          // Non-developer should only see active store staff and their own account
          if (currentUser?.hak_akses !== 'developer') {
            if (u.is_buyer && u.nama_pengguna !== currentUser?.nama_pengguna) return false
          }
          return true
        })
        setData(storeStaff)
      }
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!currentUser?.nama_pengguna) {
      setSubscriptionStatus(null)
      return
    }
    api<LocalSubscriptionStatus>('subscription:getStatus', currentUser.nama_pengguna).then(r => {
      setSubscriptionStatus(r.success ? (r.data ?? null) : null)
    })
  }, [currentUser?.nama_pengguna])

  const openAdd = () => {
    if (guardPremiumFeature('multi_user', 'Tambah User')) return
    if (multiUserLocked) {
      return toast('Paket langganan saat ini belum mendukung multi-user. Silakan upgrade paket langganan Anda.', 'error')
    }
    if (userLimitReached) {
      return toast(`Kuota pengguna lokal paket sudah penuh (${localManagedCount}/${limitText} akun termasuk owner). Silakan upgrade paket untuk menambah kasir lagi.`, 'error')
    }
    setPermissions(getDefaultPermissions())
    setForm({ ...EMPTY }); setModal('add')
  }
  const openEdit = async (row: Pengguna) => {
    setSelected(row)
    setForm({
      nama_pengguna: row.nama_pengguna,
      nama_lengkap: row.nama_lengkap ?? '',
      password: '',
      confirmPassword: '',
      pin: '',
      confirmPin: '',
      pin_enabled: !!row.pin_enabled,
      hak_akses: normalizeLocalRole(row.hak_akses),
      email: row.email ?? '',
      no_telp: row.no_telp ?? '',
      access_expires_at: toDateInputValue(row.access_expires_at),
    })
    const r = await api<Record<string, boolean>>('user:getPermissions', row.nama_pengguna)
    setPermissions(normalizePermissions(r.success ? (r.data ?? {}) : {}))
    setModal('edit')
  }
  const openDelete = (row: Pengguna) => { setSelected(row); setModal('delete') }
  const openPassword = (row: Pengguna) => { setSelected(row); setNewPassword(''); setConfirmNewPassword(''); setModal('password') }
  const openExtend = (row: Pengguna) => { setSelected(row); setExtendDays('30'); setModal('extend') }
  const openPermissions = async (row: Pengguna) => {
    setSelected(row)
    const r = await api<Record<string, boolean>>('user:getPermissions', row.nama_pengguna)
    setPermissions(normalizePermissions(r.success ? (r.data ?? {}) : {}))
    setModal('permissions')
  }
  const closeModal = () => { setModal(null); setSelected(null); setNewPassword(''); setConfirmNewPassword(''); setExtendDays('30') }

  const handleSave = async () => {
    if (!form.nama_pengguna || !form.nama_lengkap) {
      return toast('Username dan nama lengkap wajib diisi', 'error')
    }
    if (modal === 'add' && !form.password) {
      return toast('Password wajib diisi', 'error')
    }
    if (form.password) {
      const passwordError = validatePassword(form.password)
      if (passwordError) return toast(passwordError, 'error')
      if (form.password !== form.confirmPassword) {
        return toast('Password dan konfirmasi password tidak cocok', 'error')
      }
    }
    if (form.pin_enabled && form.hak_akses !== 'kasir') {
      return toast('PIN login hanya boleh diaktifkan untuk role kasir', 'error')
    }
    if (form.pin || form.confirmPin || (modal === 'add' && form.pin_enabled)) {
      const pinError = validatePin(form.pin)
      if (pinError) return toast(pinError, 'error')
      if (form.pin !== form.confirmPin) {
        return toast('PIN dan konfirmasi PIN tidak cocok', 'error')
      }
    }
    if (modal === 'edit' && form.pin_enabled && !form.pin && !selected?.pin_enabled) {
      return toast('Isi PIN kasir sebelum mengaktifkan login PIN', 'error')
    }
    setLoading(true)
    const payload = {
      ...form,
      nama_pengguna: form.nama_pengguna.trim(),
      kata_sandi: form.password,
      password: form.password,
      access_expires_at: form.access_expires_at || null,
      pin: form.pin || undefined,
      permissions,
      _caller: currentUser?.nama_pengguna,
    }
    const r = modal === 'add'
      ? await api('user:create', payload)
      : await api('user:update', selected?.nama_pengguna, payload)
    setLoading(false)
    if (r.success) { toast(r.message as string); closeModal(); load() }
    else toast(r.message as string, 'error')
  }

  const handleDelete = async () => {
    setLoading(true)
    const r = await api('user:delete', selected?.nama_pengguna, currentUser?.nama_pengguna)
    setLoading(false)
    if (r.success) { toast(r.message as string); closeModal(); load() }
    else toast(r.message as string, 'error')
  }

  const handleChangePassword = async () => {
    if (!newPassword) return toast('Password baru wajib diisi', 'error')
    const passwordError = validatePassword(newPassword)
    if (passwordError) return toast(passwordError, 'error')
    if (newPassword !== confirmNewPassword) {
      return toast('Password dan konfirmasi password tidak cocok', 'error')
    }
    setLoading(true)
    const r = await api('user:resetPassword', selected!.nama_pengguna, newPassword, currentUser?.nama_pengguna)
    setLoading(false)
    if (r.success) { toast(r.message as string); closeModal() }
    else toast(r.message as string, 'error')
  }

  const handleSavePermissions = async () => {
    setLoading(true)
    const r = await api('user:savePermissions', selected!.nama_pengguna, permissions)
    setLoading(false)
    if (r.success) { toast(r.message as string); closeModal() }
    else toast(r.message as string, 'error')
  }

  const handleExtendAccess = async () => {
    const days = parseInt(extendDays)
    if (!days || days <= 0) return toast('Jumlah hari perpanjangan harus lebih dari 0', 'error')
    setLoading(true)
    const r = await api('user:extendAccess', selected!.nama_pengguna, days, currentUser?.nama_pengguna)
    setLoading(false)
    if (r.success) { toast(r.message as string); closeModal(); load() }
    else toast(r.message as string, 'error')
  }

  const handleToggleStatus = async (user: Pengguna) => {
    const shouldBlock = user.status_user === 'Aktif'
    const r = await api('user:block', user.nama_pengguna, shouldBlock, currentUser?.nama_pengguna)
    if (r.success) { toast(r.message as string); load() }
    else toast(r.message as string, 'error')
  }

  const togglePerm = (code: string) =>
    setPermissions(prev => ({ ...prev, [code]: prev[code] !== true }))

  const toggleGroup = (codes: string[], checked: boolean) =>
    setPermissions(prev => {
      const next = { ...prev }
      codes.forEach(c => { next[c] = checked })
      return next
    })

  const columns: ColumnDef<Pengguna>[] = [
    { accessorKey: 'nama_pengguna', header: 'Username', size: 120 },
    { accessorKey: 'nama_lengkap', header: 'Nama Lengkap' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'no_telp', header: 'No. Telp', size: 120 },
    {
      accessorKey: 'status_user', header: 'Status', size: 100,
      cell: ({ getValue, row }) => {
        const status = getValue() as string
        const expired = isExpired(row.original.access_expires_at)
        if (expired) return <Badge label="KADALUARSA" variant="amber" />
        return <Badge label={status ?? 'Aktif'} variant={status === 'Aktif' ? 'green' : 'red'} />
      },
    },
    {
      accessorKey: 'access_expires_at', header: 'Masa Akses', size: 130,
      cell: ({ getValue, row }) => {
        if (row.original.hak_akses === 'developer') {
          return <span className="text-xs text-slate-400">Tanpa batas</span>
        }
        const value = getValue() as string | null
        const days = getDaysRemaining(value)
        if (!value) return <span className="text-xs text-slate-400">Tanpa batas</span>
        return (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{formatDate(value)}</p>
            <p className={`text-[10px] ${days === 0 ? 'text-red-500' : days !== null && days <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
              {days === 0 ? 'Berakhir' : `${days} hari lagi`}
            </p>
          </div>
        )
      },
    },
    {
      accessorKey: 'hak_akses', header: 'Hak Akses',
      cell: ({ getValue }) => {
        const hak = getValue() as string
        const variant = 
          hak === 'developer' ? 'purple' :
          hak === 'admin' ? 'blue' :
          hak === 'operator' ? 'amber' : 'green'
        return <Badge label={hak?.toUpperCase() ?? 'KASIR'} variant={variant} />
      },
    },
    {
      accessorKey: 'current_devices',
      header: 'Device',
      size: 90,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {row.original.current_devices ?? 0} aktif
        </span>
      ),
    },
    {
      accessorKey: 'pin_enabled',
      header: 'PIN',
      size: 80,
      cell: ({ getValue }) => <Badge label={getValue() ? 'AKTIF' : 'OFF'} variant={getValue() ? 'green' : 'gray'} />,
    },
    {
      accessorKey: 'terakhir_login',
      header: 'Last Login',
      size: 140,
      cell: ({ getValue }) => {
        const value = getValue() as string | null
        return <span className="text-xs text-slate-500">{value ? formatDate(value) : '-'}</span>
      },
    },
    {
      id: 'actions', header: 'Aksi',
      cell: ({ row }) => {
        const isProtected = isDeveloperAccount(row.original)
        const canManagePermissions = isPrivilegedRole(currentUser?.hak_akses)
        const hasUnlimitedAccess = isPrivilegedRole(row.original.hak_akses)
        const isCurrentUser = row.original.nama_pengguna === currentUser?.nama_pengguna
        
        // Every developer-role account is locked from user management actions.
        if (isProtected) {
          return (
            <div className="flex gap-1">
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400" title="Akun developer terkunci">
                <Lock size={14} />
              </div>
            </div>
          )
        }
        
        return (
          <div className="flex gap-1">
            <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-slate-700 text-primary-500 transition-colors" title="Edit">
              <Pencil size={14} />
            </button>
            <button onClick={() => openPassword(row.original)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500 transition-colors" title="Ubah Password">
              <Key size={14} />
            </button>
            {!hasUnlimitedAccess && (
              <button onClick={() => openExtend(row.original)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors" title="Perpanjang Akses">
                <CalendarPlus size={14} />
              </button>
            )}
            <button 
              onClick={() => handleToggleStatus(row.original)} 
              className={`p-1.5 rounded-lg transition-colors ${
                row.original.status_user === 'Aktif' 
                  ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500' 
                  : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500'
              }`}
              title={row.original.status_user === 'Aktif' ? 'Blokir' : 'Aktifkan'}
            >
              <Power size={14} />
            </button>
            {canManagePermissions && (
              <button onClick={() => openPermissions(row.original)} className="p-1.5 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/20 text-pink-500 transition-colors" title="Izin Akses">
                <ShieldCheck size={14} />
              </button>
            )}
            {!isCurrentUser && (
              <button onClick={() => openDelete(row.original)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Hapus">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  const f = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))
  const formHasUnlimitedAccess = isPrivilegedRole(form.hak_akses)
  const currentUserBypassesPlan = currentUser?.hak_akses === 'developer' || currentUser?.hak_akses === 'super_admin'
  const isCurrentPlanManaged = !currentUserBypassesPlan && Boolean(currentUser?.subscription_plan_id || subscriptionStatus?.plan_name)
  const activeStaffCount = data.filter(row => row.hak_akses !== 'developer' && !row.is_buyer && row.nama_pengguna !== currentUser?.nama_pengguna && row.status_user === 'Aktif').length
  const localManagedCount = activeStaffCount + 1
  const maxLocalUsers = subscriptionStatus?.max_users ?? null
  const limitText = maxLocalUsers === -1 ? 'Unlimited' : maxLocalUsers === null || maxLocalUsers === undefined ? '-' : String(maxLocalUsers)
  const userLimitReached = isCurrentPlanManaged && maxLocalUsers !== null && maxLocalUsers !== -1 && localManagedCount >= maxLocalUsers
  const multiUserLocked = isCurrentPlanManaged && subscriptionStatus?.feature_flags?.multi_user === false

  const EXCLUDED_PERMISSION_CODES = new Set(['nav_license_admin'])

  // Group permission menus by group label, excluding developer-only and sensitive items
  const permGroups = MENU_GROUPS
    .map(g => ({
      label: g.label,
      items: g.items
        .filter(item => !EXCLUDED_PERMISSION_CODES.has(item.code))
        .filter(item => !item.roles || !item.roles.every(r => r === 'developer' || r === 'super_admin'))
        .filter((item, idx, arr) => arr.findIndex(x => x.code === item.code) === idx),
    }))
    .filter(g => g.items.length > 0)

  const permissionGroupsView = (
    <div className="space-y-3">
      {permGroups.map(group => {
        const uniqueCodes = [...new Set(group.items.map(i => i.code))]
        const allChecked = uniqueCodes.every(c => permissions[c] !== false)
        const someChecked = uniqueCodes.some(c => permissions[c] !== false)
        return (
          <div key={group.label} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = !allChecked && someChecked }}
                onChange={e => toggleGroup(uniqueCodes, e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {group.label}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 dark:divide-slate-700/50">
              {group.items.map(item => (
                <label key={`${item.code}-${item.label}`} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-primary-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={permissions[item.code] !== false}
                    onChange={() => togglePerm(item.code)}
                    className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
        {(['users', 'devices'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {t === 'users' ? <><UsersIcon size={16} /> Pengguna</> : <><Smartphone size={16} /> Devices</>}
          </button>
        ))}
      </div>

      {activeTab === 'devices' && <DevicesTab currentUser={currentUser?.nama_pengguna ?? ''} />}

      {activeTab === 'users' && (
      <>
      {loadingData ? (
        <SkeletonPage rows={5} />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{data.filter(u => !u.is_buyer).length} kasir & staf terdaftar</p>
                {isCurrentPlanManaged && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    userLimitReached
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 border border-primary-200/60 dark:border-primary-800/40'
                  }`}>
                    Kuota: {localManagedCount} / {limitText} Akun
                  </span>
                )}
              </div>
              {isCurrentPlanManaged && (
                <p className={`text-xs mt-0.5 ${userLimitReached || multiUserLocked ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                  {subscriptionStatus?.plan_name ? `Paket ${subscriptionStatus.plan_name}` : 'Paket Langganan'}
                  {multiUserLocked ? ' - multi-user belum aktif' : userLimitReached ? ' - kuota penuh' : ` - sisa ${maxLocalUsers === -1 ? 'tak terbatas' : Math.max(0, (maxLocalUsers ?? 1) - localManagedCount)} kasir lagi`}
                </p>
              )}
              {currentUser?.hak_akses === 'admin' && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                  <Lock size={12} /> Pengguna kasir bersifat lokal untuk toko ini
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(userLimitReached || multiUserLocked) && (
                <Button
                  variant="secondary"
                  icon={<Zap size={15} />}
                  onClick={() => navigate('/subscription')}
                  className="w-full sm:w-auto text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-bold"
                >
                  Upgrade Kuota
                </Button>
              )}
              <Button icon={<Plus size={16} />} onClick={openAdd} className="w-full sm:w-auto">Tambah Pengguna</Button>
            </div>
          </div>
          <Card>
            <DataTable data={data.filter(u => !u.is_buyer)} columns={columns} searchPlaceholder="Cari user..." />
          </Card>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={closeModal}
        title={modal === 'add' ? 'Tambah User' : 'Edit User'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleSave} className="w-full sm:w-auto">Simpan</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Username *" value={form.nama_pengguna} onChange={e => f('nama_pengguna', e.target.value)} disabled={modal === 'edit'} />
          <Input label="Nama Lengkap *" value={form.nama_lengkap} onChange={e => f('nama_lengkap', e.target.value)} />
          {modal === 'add' && (
            <>
              <Input label="Password *" type="password" value={form.password} onChange={e => f('password', e.target.value)} />
              <Input label="Konfirmasi Password *" type="password" value={form.confirmPassword} onChange={e => f('confirmPassword', e.target.value)} />
            </>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Hak Akses *</label>
            <select
              value={form.hak_akses}
              onChange={e => setForm(prev => ({
                ...prev,
                hak_akses: e.target.value as FormState['hak_akses'],
                pin_enabled: e.target.value === 'kasir' ? prev.pin_enabled : false,
              }))}
              disabled={
                modal === 'edit' && (
                  isDeveloperAccount(selected) ||
                  !isPrivilegedRole(currentUser?.hak_akses)
                )
              }
              className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="kasir">Kasir</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
              {(currentUser?.hak_akses === 'developer' || currentUser?.hak_akses === 'super_admin') && (
                <option value="developer">Developer</option>
              )}
            </select>
          </div>
          <Input label="Email" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          <Input label="No. Telepon" value={form.no_telp} onChange={e => f('no_telp', e.target.value)} />
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
            <span>
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">Login PIN Kasir</span>
              <span className="block text-[11px] text-slate-400">Hanya untuk role kasir</span>
            </span>
            <input
              type="checkbox"
              checked={form.pin_enabled}
              onChange={e => setForm(prev => ({ ...prev, pin_enabled: e.target.checked }))}
              disabled={form.hak_akses !== 'kasir'}
              className="w-4 h-4 rounded accent-primary-500"
            />
          </label>
          <Input
            label={modal === 'add' ? 'PIN Kasir' : 'PIN Kasir Baru'}
            type="password"
            value={form.pin}
            onChange={e => f('pin', e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder={modal === 'add' ? '4-8 digit' : 'Kosongkan jika tidak diubah'}
            helperText="PIN disimpan sebagai bcrypt hash"
          />
          <Input
            label="Konfirmasi PIN"
            type="password"
            value={form.confirmPin}
            onChange={e => f('confirmPin', e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Ulangi PIN"
          />
          <Input
            label="Masa Akses"
            type="date"
            value={form.access_expires_at}
            onChange={e => f('access_expires_at', e.target.value)}
            helperText={formHasUnlimitedAccess ? 'Developer selalu tanpa batas' : 'Kosongkan untuk akses tanpa batas'}
            disabled={formHasUnlimitedAccess || (modal === 'edit' && isDeveloperAccount(selected))}
          />
        </div>
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Izin Fitur</h3>
          </div>
          <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin">
            {permissionGroupsView}
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        open={modal === 'password'}
        onClose={closeModal}
        title="Ubah Password"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleChangePassword} className="w-full sm:w-auto">Ubah Password</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Ubah password untuk user <strong>{selected?.nama_lengkap}</strong>
        </p>
        <div className="space-y-3">
          <Input
            label="Password Baru *"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Masukkan password baru"
          />
          <Input
            label="Konfirmasi Password Baru *"
            type="password"
            value={confirmNewPassword}
            onChange={e => setConfirmNewPassword(e.target.value)}
            placeholder="Konfirmasi password baru"
          />
        </div>
      </Modal>

      {/* Extend Access Modal */}
      <Modal
        open={modal === 'extend'}
        onClose={closeModal}
        title="Perpanjang Akses"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleExtendAccess} className="w-full sm:w-auto">Perpanjang</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            User <strong>{selected?.nama_lengkap}</strong> aktif sampai {formatDate(selected?.access_expires_at)}.
          </p>
          <Input
            label="Tambah Hari *"
            type="number"
            min={1}
            value={extendDays}
            onChange={e => setExtendDays(e.target.value)}
            helperText="Perpanjangan dihitung dari tanggal berakhir saat ini jika masih aktif"
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={modal === 'delete'}
        onClose={closeModal}
        title="Hapus User"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">Batal</Button>
            <Button variant="danger" loading={loading} onClick={handleDelete} className="w-full sm:w-auto">Hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Yakin ingin menghapus user <strong>{selected?.nama_lengkap}</strong>? Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        open={modal === 'permissions'}
        onClose={closeModal}
        title={`Izin Akses — ${selected?.nama_pengguna}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} className="w-full sm:w-auto">Batal</Button>
            <Button loading={loading} onClick={handleSavePermissions} className="w-full sm:w-auto">Simpan Izin</Button>
          </>
        }
      >
        {permissionGroupsView}
      </Modal>
      </>
      )}
    </div>
  )
}

// ─── DevicesTab ───────────────────────────────────────────────────────────────
interface DeviceRow {
  id: number
  username: string
  nama_lengkap?: string | null
  device_id: string | null
  device_name: string | null
  platform: string | null
  os_name: string | null
  app_version?: string | null
  ip_address: string | null
  last_seen_at: string | null
  first_seen_at?: string | null
  status: string
}

function DevicesTab({ currentUser }: { currentUser: string }) {
  const toast = useToast()
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const r = await api<DeviceRow[]>('device:getAll')
    if (r.success) setDevices((r.data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const revoke = async (id: number) => {
    if (!confirm('Revoke device ini? User akan di-logout dari device tersebut.')) return
    await api('device:revoke', id, currentUser)
    toast('Device berhasil di-revoke', 'success')
    load()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-white">Riwayat Device User</h3>
        <Button icon={<RefreshCw size={14} />} variant="ghost" onClick={load}>Refresh</Button>
      </div>
      {loading ? <SkeletonPage rows={3} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2">User</th>
                <th>Device</th>
                <th>Platform</th>
                <th>OS</th>
                <th>IP</th>
                <th>Status</th>
                <th>Terakhir Aktif</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {devices.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">Belum ada device tercatat</td></tr>
              ) : devices.map((d: any) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2">
                    <p className="font-medium">{d.username}</p>
                    <p className="text-[10px] text-slate-400">{d.nama_lengkap || '-'}</p>
                  </td>
                  <td className="text-slate-600 dark:text-slate-400">
                    <p>{d.device_name || d.device_id?.slice(0, 12) || '—'}</p>
                    <p className="text-[10px] text-slate-400">{d.app_version || d.device_id?.slice(0, 12) || '-'}</p>
                  </td>
                  <td>
                    <span className="flex items-center gap-1 text-xs">
                      {d.platform === 'android' ? <Smartphone size={12} /> : <Monitor size={12} />}
                      {d.platform || '—'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">{d.os_name || '—'}</td>
                  <td className="text-xs font-mono text-slate-500">{d.ip_address || '—'}</td>
                  <td>
                    <Badge
                      label={(d.status || 'active').toUpperCase()}
                      variant={d.status === 'active' ? 'green' : d.status === 'blocked' ? 'red' : 'amber'}
                    />
                  </td>
                  <td className="text-xs text-slate-500">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('id-ID') : '—'}</td>
                  <td>
                    <button
                      onClick={() => revoke(d.id)}
                      disabled={d.status !== 'active'}
                      className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
