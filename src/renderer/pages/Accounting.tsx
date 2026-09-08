import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Plus,
  RefreshCw,
  Save,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  Edit2,
  Trash2,
  DollarSign,
  ArrowRight,
  Filter,
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { formatRupiah } from '../utils/format'
import { SkeletonPage } from '../components/Skeleton'

interface Account {
  id: number
  code: string
  name: string
  type: string
  normal_balance: string
  is_active: number
}

interface AccountingSummary {
  sales: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  cashIn: number
  cashOut: number
  cashBalanceEstimate: number
  receivables: number
  payables: number
}

interface TrialBalanceRow extends Account {
  debit: number
  credit: number
  balance: number
}

interface JournalEntry {
  id: number
  entry_date: string
  reference: string
  description: string
  lines: Array<{ code: string; name: string; debit: number; credit: number }>
}

type TabType = 'neraca' | 'jurnal' | 'coa'

const today = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

export default function Accounting() {
  const toast = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState<TabType>('neraca')
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(monthStart)
  const [endDate, setEndDate] = useState(today)
  const [preset, setPreset] = useState<'thisMonth' | 'today' | 'thisYear' | 'custom'>('thisMonth')

  // Data
  const [summary, setSummary] = useState<AccountingSummary | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [trial, setTrial] = useState<TrialBalanceRow[]>([])
  const [journals, setJournals] = useState<JournalEntry[]>([])

  // Bagan Akun (COA) state
  const [coaFilter, setCoaFilter] = useState<'ALL' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('ALL')
  const [coaSearch, setCoaSearch] = useState('')
  const [accountModal, setAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountForm, setAccountForm] = useState({ id: undefined as number | undefined, code: '', name: '', type: 'ASSET', is_active: 1 })
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Jurnal state
  const [journalSearch, setJournalSearch] = useState('')
  const [savingJournal, setSavingJournal] = useState(false)
  const [journalForm, setJournalForm] = useState({
    description: '',
    reference: '',
    debitAccount: '',
    creditAccount: '',
    amount: '',
  })

  const handlePresetChange = (selected: 'thisMonth' | 'today' | 'thisYear' | 'custom') => {
    setPreset(selected)
    if (selected === 'today') {
      setStartDate(today)
      setEndDate(today)
    } else if (selected === 'thisMonth') {
      setStartDate(monthStart)
      setEndDate(today)
    } else if (selected === 'thisYear') {
      setStartDate(yearStart)
      setEndDate(today)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [summaryRes, accountsRes, trialRes, journalRes] = await Promise.all([
        api<AccountingSummary>('accounting:getSummary', startDate, endDate),
        api<Account[]>('accounting:getAccounts'),
        api<TrialBalanceRow[]>('accounting:getTrialBalance', startDate, endDate),
        api<JournalEntry[]>('accounting:getJournalEntries', 50),
      ])
      if (summaryRes.success) setSummary(summaryRes.data ?? null)
      if (accountsRes.success) setAccounts(accountsRes.data ?? [])
      if (trialRes.success) setTrial(trialRes.data ?? [])
      if (journalRes.success) setJournals(journalRes.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const activeAccounts = useMemo(() => accounts.filter(a => a.is_active), [accounts])

  // Filtered COA
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchType = coaFilter === 'ALL' || acc.type === coaFilter
      const q = coaSearch.toLowerCase()
      const matchSearch = !q || acc.code.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q)
      return matchType && matchSearch
    })
  }, [accounts, coaFilter, coaSearch])

  // Filtered Journals
  const filteredJournals = useMemo(() => {
    if (!journalSearch.trim()) return journals
    const q = journalSearch.toLowerCase()
    return journals.filter(j =>
      j.description.toLowerCase().includes(q) ||
      j.reference.toLowerCase().includes(q) ||
      j.lines.some(l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q))
    )
  }, [journals, journalSearch])

  // Trial Balance totals
  const trialTotals = useMemo(() => {
    const totalDebit = trial.reduce((sum, r) => sum + (r.debit || 0), 0)
    const totalCredit = trial.reduce((sum, r) => sum + (r.credit || 0), 0)
    const isBalanced = Math.round(totalDebit) === Math.round(totalCredit)
    const diff = Math.abs(totalDebit - totalCredit)
    return { totalDebit, totalCredit, isBalanced, diff }
  }, [trial])

  // Account modal openers
  const openAddAccount = () => {
    setEditingAccount(null)
    setAccountForm({ id: undefined, code: '', name: '', type: 'ASSET', is_active: 1 })
    setAccountModal(true)
  }

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc)
    setAccountForm({ id: acc.id, code: acc.code, name: acc.name, type: acc.type, is_active: acc.is_active })
    setAccountModal(true)
  }

  const saveAccount = async () => {
    if (!accountForm.code.trim() || !accountForm.name.trim()) {
      return toast('Kode dan nama akun wajib diisi', 'error')
    }
    setSavingAccount(true)
    const r = await api('accounting:saveAccount', accountForm)
    setSavingAccount(false)
    if (r.success) {
      toast(editingAccount ? 'Akun berhasil diperbarui' : 'Akun berhasil ditambahkan')
      setAccountModal(false)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const toggleAccountStatus = async (acc: Account) => {
    const updated = { ...acc, is_active: acc.is_active === 1 ? 0 : 1 }
    const r = await api('accounting:saveAccount', updated)
    if (r.success) {
      toast(`Akun ${acc.code} ${updated.is_active === 1 ? 'diaktifkan' : 'dinonaktifkan'}`)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) return
    setDeletingAccount(true)
    const r = await api('accounting:deleteAccount', deleteConfirm.id)
    setDeletingAccount(false)
    if (r.success) {
      toast(r.message as string || 'Akun berhasil dihapus')
      setDeleteConfirm(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  // Create Journal Entry
  const createJournal = async () => {
    const amount = Number(journalForm.amount || 0)
    if (!journalForm.description.trim()) {
      return toast('Deskripsi transaksi jurnal wajib diisi', 'error')
    }
    if (!journalForm.debitAccount || !journalForm.creditAccount) {
      return toast('Pilih akun debit dan akun kredit', 'error')
    }
    if (journalForm.debitAccount === journalForm.creditAccount) {
      return toast('Akun debit dan kredit tidak boleh sama', 'error')
    }
    if (amount <= 0) {
      return toast('Nominal jurnal harus lebih dari 0', 'error')
    }

    setSavingJournal(true)
    const r = await api('accounting:createJournalEntry', {
      entry_date: today,
      reference: journalForm.reference.trim(),
      description: journalForm.description.trim(),
      created_by: user?.nama_pengguna || 'User',
      lines: [
        { account_id: Number(journalForm.debitAccount), debit: amount, credit: 0 },
        { account_id: Number(journalForm.creditAccount), debit: 0, credit: amount },
      ],
    })
    setSavingJournal(false)
    if (r.success) {
      toast('Jurnal umum berhasil dicatat')
      setJournalForm({ description: '', reference: '', debitAccount: '', creditAccount: '', amount: '' })
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  if (loading && accounts.length === 0) return <SkeletonPage rows={6} />

  const TABS: Array<{ id: TabType; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'neraca', label: 'Neraca Saldo & Laba', icon: <TrendingUp size={16} />, desc: 'Ikhtisar laba rugi dan keseimbangan saldo akun' },
    { id: 'jurnal', label: 'Jurnal Umum', icon: <BookOpen size={16} />, desc: 'Pencatatan mutasi transaksi debit & kredit' },
    { id: 'coa', label: 'Bagan Akun (COA)', icon: <Layers size={16} />, desc: 'Master daftar akun akuntansi dan saldo normal' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="text-primary-500" size={28} />
            Akuntansi & Pembukuan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kelola bagan akun (COA), entri jurnal umum, laporan laba rugi, dan neraca saldo toko.
          </p>
        </div>
        <Button onClick={load} loading={loading} variant="secondary" icon={<RefreshCw size={16} />}>
          Refresh
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              tab === t.id
                ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ======================= TAB 1: NERACA SALDO & LABA ======================= */}
      {tab === 'neraca' && (
        <div className="space-y-4">
          {/* Periode Filter */}
          <Card>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary-600" />
                  <span>Periode Data</span>
                </label>
                <div className="flex gap-1.5">
                  {(['thisMonth', 'today', 'thisYear', 'custom'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePresetChange(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        preset === p
                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p === 'thisMonth' ? 'Bulan Ini' : p === 'today' ? 'Hari Ini' : p === 'thisYear' ? 'Tahun Ini' : 'Kustom'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 flex-1">
                <Input
                  label="Mulai"
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value)
                    setPreset('custom')
                  }}
                />
                <Input
                  label="Sampai"
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value)
                    setPreset('custom')
                  }}
                />
              </div>

              <Button onClick={load} loading={loading} className="h-10">
                Terapkan Periode
              </Button>
            </div>
          </Card>

          {/* Metric KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
              <Metric label="Total Penjualan" value={summary.sales} tone="green" />
              <Metric label="HPP (Modal Pokok)" value={summary.cogs} tone="amber" />
              <Metric label="Laba Kotor" value={summary.grossProfit} tone="green" />
              <Metric label="Beban Operasional" value={summary.expenses} tone="amber" />
              <Metric label="Laba Bersih" value={summary.netProfit} tone={summary.netProfit >= 0 ? 'green' : 'red'} />
              <Metric label="Estimasi Kas" value={summary.cashBalanceEstimate} tone="blue" />
              <Metric label="Total Piutang" value={summary.receivables} tone="blue" />
              <Metric label="Total Hutang" value={summary.payables} tone="red" />
            </div>
          )}

          {/* Balance Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
              trialTotals.isBalanced
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {trialTotals.isBalanced ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-600" />}
              <span>
                {trialTotals.isBalanced
                  ? 'Neraca Saldo Seimbang (Balance) — Total Debit dan Kredit cocok.'
                  : `Neraca Belum Seimbang! Selisih: ${formatRupiah(trialTotals.diff)}`}
              </span>
            </div>
            <div className="flex items-center gap-4 text-right">
              <span>Debit: <strong>{formatRupiah(trialTotals.totalDebit)}</strong></span>
              <span>Kredit: <strong>{formatRupiah(trialTotals.totalCredit)}</strong></span>
            </div>
          </div>

          {/* Neraca Saldo Table */}
          <Card title="Neraca Saldo (Trial Balance)" subtitle="Rincian mutasi debit, kredit, dan saldo berjalan seluruh akun aktif">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-extrabold text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Kode</th>
                    <th className="px-4 py-3 text-left">Nama Akun</th>
                    <th className="px-4 py-3 text-left">Tipe</th>
                    <th className="px-4 py-3 text-left">Saldo Normal</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Kredit</th>
                    <th className="px-4 py-3 text-right pr-4">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trial.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Belum ada mutasi akun pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    trial.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">{row.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.name}</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={row.type}
                            variant={
                              row.type === 'ASSET' ? 'blue' :
                              row.type === 'LIABILITY' ? 'red' :
                              row.type === 'EQUITY' ? 'purple' :
                              row.type === 'REVENUE' ? 'green' : 'amber'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{row.normal_balance}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          {row.debit > 0 ? formatRupiah(row.debit) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          {row.credit > 0 ? formatRupiah(row.credit) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right pr-4 font-bold text-slate-900 dark:text-white">
                          {formatRupiah(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {trial.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold text-xs border-t-2 border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Total Keseluruhan:
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                        {formatRupiah(trialTotals.totalDebit)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                        {formatRupiah(trialTotals.totalCredit)}
                      </td>
                      <td className="px-4 py-3 text-right pr-4 font-mono">
                        <span className={trialTotals.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                          {trialTotals.isBalanced ? 'SEIMBANG' : `SELISIH ${formatRupiah(trialTotals.diff)}`}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= TAB 2: JURNAL UMUM ======================= */}
      {tab === 'jurnal' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Input Manual Jurnal */}
            <Card title="Entri Jurnal Baru" subtitle="Catat mutasi transaksi debit & kredit seimbang" className="xl:col-span-1">
              <div className="space-y-3">
                <Input
                  label="Deskripsi Transaksi *"
                  value={journalForm.description}
                  onChange={e => setJournalForm({ ...journalForm, description: e.target.value })}
                  placeholder="Contoh: Pembayaran Biaya Listrik Toko"
                />

                <Input
                  label="Nomor Referensi"
                  value={journalForm.reference}
                  onChange={e => setJournalForm({ ...journalForm, reference: e.target.value })}
                  placeholder="Contoh: BKK-001 / INV-04"
                />

                <SelectAccount
                  label="Akun Debit (D) *"
                  value={journalForm.debitAccount}
                  accounts={activeAccounts}
                  onChange={value => setJournalForm({ ...journalForm, debitAccount: value })}
                />

                <SelectAccount
                  label="Akun Kredit (K) *"
                  value={journalForm.creditAccount}
                  accounts={activeAccounts}
                  onChange={value => setJournalForm({ ...journalForm, creditAccount: value })}
                />

                <Input
                  label="Nominal (Rp) *"
                  type="number"
                  value={journalForm.amount}
                  onChange={e => setJournalForm({ ...journalForm, amount: e.target.value })}
                  placeholder="0"
                />

                {/* Preview Seimbang */}
                {Number(journalForm.amount || 0) > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <p className="font-bold text-slate-600 dark:text-slate-300">Pratinjau Jurnal:</p>
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>(D) {accounts.find(a => String(a.id) === journalForm.debitAccount)?.name || 'Akun Debit'}</span>
                      <span>{formatRupiah(Number(journalForm.amount || 0))}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-medium pl-3">
                      <span>(K) {accounts.find(a => String(a.id) === journalForm.creditAccount)?.name || 'Akun Kredit'}</span>
                      <span>{formatRupiah(Number(journalForm.amount || 0))}</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={createJournal}
                  loading={savingJournal}
                  icon={<Save size={16} />}
                  className="w-full mt-2"
                >
                  Simpan Jurnal
                </Button>
              </div>
            </Card>

            {/* Riwayat Feed Jurnal */}
            <Card
              title="Riwayat Jurnal Umum"
              subtitle={`Menampilkan ${filteredJournals.length} entri jurnal terakhir`}
              className="xl:col-span-2"
              action={
                <div className="w-48 sm:w-64">
                  <Input
                    placeholder="Cari deskripsi / referensi..."
                    value={journalSearch}
                    onChange={e => setJournalSearch(e.target.value)}
                    icon={<Search size={14} />}
                  />
                </div>
              }
            >
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {filteredJournals.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-slate-400">
                    {journalSearch ? 'Tidak ada jurnal yang sesuai pencarian.' : 'Belum ada entri jurnal manual tercatat.'}
                  </div>
                ) : (
                  filteredJournals.map(entry => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3.5 hover:border-primary-200 dark:hover:border-primary-800 transition-all shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{entry.description}</span>
                          {entry.reference && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                              {entry.reference}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {entry.entry_date} {entry.lines.length > 0 && `• ${entry.lines.length} Baris`}
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-1.5">
                        {entry.lines.map((line, idx) => (
                          <div
                            key={`${entry.id}-${idx}`}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{line.code}</span>
                              <span className="text-slate-800 dark:text-slate-200 font-medium">{line.name}</span>
                            </div>
                            <div className="font-mono font-bold">
                              {line.debit > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400">D {formatRupiah(line.debit)}</span>
                              ) : (
                                <span className="text-blue-600 dark:text-blue-400">K {formatRupiah(line.credit)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: BAGAN AKUN (COA) ======================= */}
      {tab === 'coa' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Type Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCoaFilter(type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      coaFilter === type
                        ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {type === 'ALL' ? 'Semua Kategori' : type}
                  </button>
                ))}
              </div>

              {/* Actions & Search */}
              <div className="flex items-center gap-2">
                <div className="w-48 sm:w-60">
                  <Input
                    placeholder="Cari kode / nama akun..."
                    value={coaSearch}
                    onChange={e => setCoaSearch(e.target.value)}
                    icon={<Search size={14} />}
                  />
                </div>
                <Button onClick={openAddAccount} icon={<Plus size={16} />} className="shrink-0">
                  Tambah Akun
                </Button>
              </div>
            </div>
          </Card>

          {/* Table Master COA */}
          <Card title={`Daftar Master Akun (${filteredAccounts.length} Akun)`} subtitle="Kelola nomor akun, kategori, posisi normal, dan status keaktifan">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-extrabold text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Kode</th>
                    <th className="px-4 py-3 text-left">Nama Akun</th>
                    <th className="px-4 py-3 text-left">Tipe Kategori</th>
                    <th className="px-4 py-3 text-left">Posisi Saldo Normal</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center pr-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        Tidak ada akun yang sesuai dengan filter atau pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map(acc => (
                      <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">{acc.code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{acc.name}</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={acc.type}
                            variant={
                              acc.type === 'ASSET' ? 'blue' :
                              acc.type === 'LIABILITY' ? 'red' :
                              acc.type === 'EQUITY' ? 'purple' :
                              acc.type === 'REVENUE' ? 'green' : 'amber'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {acc.normal_balance === 'DEBIT' ? (
                            <span className="text-emerald-600 font-bold">DEBIT</span>
                          ) : (
                            <span className="text-blue-600 font-bold">CREDIT</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            label={acc.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                            variant={acc.is_active === 1 ? 'green' : 'gray'}
                          />
                        </td>
                        <td className="px-4 py-3 text-center pr-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleAccountStatus(acc)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                              title={acc.is_active === 1 ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                            >
                              <Badge label={acc.is_active === 1 ? 'Nonaktifkan' : 'Aktifkan'} variant="gray" />
                            </button>
                            <button
                              onClick={() => openEditAccount(acc)}
                              className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/40 text-primary-600 transition-colors"
                              title="Edit Akun"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(acc)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors"
                              title="Hapus Akun"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================= MODALS ======================= */}

      {/* Modal Add / Edit Account */}
      <Modal
        open={accountModal}
        onClose={() => setAccountModal(false)}
        title={editingAccount ? `Edit Akun: ${editingAccount.code}` : 'Tambah Akun COA Baru'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAccountModal(false)}>
              Batal
            </Button>
            <Button onClick={saveAccount} loading={savingAccount}>
              {editingAccount ? 'Perbarui Akun' : 'Simpan Akun'}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kode Akun *"
              value={accountForm.code}
              onChange={e => setAccountForm({ ...accountForm, code: e.target.value })}
              placeholder="Contoh: 1150 / 5200"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tipe Kategori *</label>
              <select
                value={accountForm.type}
                onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-primary-500"
              >
                <option value="ASSET">ASSET (Aktiva/Harta)</option>
                <option value="LIABILITY">LIABILITY (Kewajiban/Hutang)</option>
                <option value="EQUITY">EQUITY (Modal)</option>
                <option value="REVENUE">REVENUE (Pendapatan)</option>
                <option value="EXPENSE">EXPENSE (Beban/Biaya)</option>
              </select>
            </div>
          </div>

          <Input
            label="Nama Akun *"
            value={accountForm.name}
            onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
            placeholder="Contoh: Kas Kecil / Beban Sewa"
          />

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
            <p>
              Saldo Normal otomatis:{' '}
              <strong className="text-slate-900 dark:text-white">
                {['ASSET', 'EXPENSE'].includes(accountForm.type) ? 'DEBIT' : 'CREDIT'}
              </strong>
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal Confirm Delete Account */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Konfirmasi Hapus Akun"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDeleteAccount} loading={deletingAccount}>
              Hapus / Nonaktifkan
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Apakah Anda yakin ingin menghapus akun <strong>{deleteConfirm?.code} - {deleteConfirm?.name}</strong>?
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Jika akun sudah pernah digunakan dalam jurnal umum, akun akan dinonaktifkan secara aman agar riwayat keuangan tetap terjaga.
        </p>
      </Modal>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue'
}) {
  const color = {
    slate: 'text-slate-900 dark:text-white',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-rose-600 dark:text-rose-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
  }[tone]

  return (
    <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-base sm:text-lg font-black ${color}`}>{formatRupiah(value)}</p>
    </Card>
  )
}

function SelectAccount({
  label,
  value,
  accounts,
  onChange,
}: {
  label: string
  value: string
  accounts: Account[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-primary-500"
      >
        <option value="">-- Pilih Akun --</option>
        {accounts.map(account => (
          <option key={account.id} value={account.id}>
            {account.code} - {account.name} ({account.type})
          </option>
        ))}
      </select>
    </label>
  )
}
