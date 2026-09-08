import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, XCircle, AlertTriangle, Calendar, PlusCircle, LogIn, LogOut, UserCheck, Info, ArrowRight, Users } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatDate } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

interface Attendance {
  id_absensi: number
  id_karyawan: number
  tgl: string
  jam_masuk: string | null
  jam_keluar: string | null
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'CUTI' | 'ALPA' | 'TERLAMBAT'
  keterlambatan_menit: number | null
  catatan: string | null
  created_at: string
  updated_at: string
  karyawan_nama?: string
  karyawan_nik?: string
}

interface Employee {
  id_karyawan: number
  nik: string
  nama_lengkap: string
  status_karyawan: string
  jabatan?: string
}

interface Summary {
  total_hadir: number
  total_terlambat: number
  total_izin: number
  total_sakit: number
  total_cuti: number
  total_alpa: number
}

const statusVariant = (s: string) => {
  switch (s) {
    case 'HADIR': return 'green'
    case 'TERLAMBAT': return 'yellow'
    case 'IZIN':
    case 'SAKIT':
    case 'CUTI': return 'blue'
    case 'ALPA': return 'red'
    default: return 'gray'
  }
}

export default function Attendance() {
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<Attendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [filterEmployee, setFilterEmployee] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Status modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [customStatus, setCustomStatus] = useState<'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'CUTI' | 'ALPA'>('HADIR')
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5))
  const [customNotes, setCustomNotes] = useState('')

  const load = async () => {
    const [r1, r2, r3] = await Promise.all([
      api<Attendance[]>('attendance:getAll', selectedDate),
      api<Employee[]>('employee:getAll'),
      api<Summary>('attendance:getSummary', selectedDate),
    ])
    if (r1.success) setData(r1.data ?? [])
    if (r2.success) setEmployees(r2.data ?? [])
    if (r3.success) setSummary(r3.data ?? null)
    setLoadingData(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (!loadingData) load() }, [selectedDate])

  const handleClockIn = async (employeeId: number, statusVal = 'HADIR', timeVal?: string, notes = '') => {
    setLoading(true)
    const jam = timeVal || new Date().toTimeString().slice(0, 5)
    const r = await api('attendance:clockIn', {
      employee_id: employeeId,
      tgl: selectedDate,
      jam_masuk: jam,
      status: statusVal,
      catatan: notes,
    })
    setLoading(false)
    if (r.success) {
      toast(r.message as string || 'Absensi masuk berhasil dicatat', 'success')
      setStatusModalOpen(false)
      load()
    } else {
      toast(r.message as string || 'Gagal mencatat absensi masuk', 'error')
    }
  }

  const handleClockOut = async (idAbsensi: number, employeeId: number) => {
    setLoading(true)
    const jam = new Date().toTimeString().slice(0, 5)
    const r = await api('attendance:clockOut', idAbsensi || employeeId, {
      jam_keluar: jam,
    })
    setLoading(false)
    if (r.success) {
      toast(r.message as string || 'Absensi keluar berhasil dicatat', 'success')
      load()
    } else {
      toast(r.message as string || 'Gagal mencatat absensi keluar', 'error')
    }
  }

  const openStatusModal = (emp: Employee) => {
    setSelectedEmployee(emp)
    setCustomStatus('HADIR')
    setCustomTime(new Date().toTimeString().slice(0, 5))
    setCustomNotes('')
    setStatusModalOpen(true)
  }

  // Active employees merged with attendance records
  const mergedRows = useMemo(() => {
    const activeEmps = employees.filter(e => e.status_karyawan === 'AKTIF')
    const filtered = filterEmployee
      ? activeEmps.filter(e => e.id_karyawan === parseInt(filterEmployee))
      : activeEmps

    return filtered.map(emp => {
      const rec = data.find(d => d.id_karyawan === emp.id_karyawan)
      return {
        emp,
        rec,
        status: rec ? rec.status : 'BELUM ABSEN',
        jam_masuk: rec?.jam_masuk || '-',
        jam_keluar: rec?.jam_keluar || '-',
        keterlambatan: rec?.keterlambatan_menit != null ? `${rec.keterlambatan_menit} mnt` : '-',
        catatan: rec?.catatan || '-',
      }
    })
  }, [employees, data, filterEmployee])

  return (
    <div className="space-y-4 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="text-red-600" size={26} />
            Absensi & Kehadiran Karyawan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola absensi masuk/keluar harian, izin, sakit, cuti, dan keterlambatan staf.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/employee')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs"
        >
          <Users size={14} className="text-primary-600" />
          <span>Kelola Data Karyawan</span>
          <ArrowRight size={13} className="text-slate-400" />
        </button>
      </div>

      {/* Workflow Guide Card */}
      <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-slate-50/60 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <Info size={17} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Alur Penggunaan Fitur Absensi & Terhubung ke Payroll
              </h3>
              <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                Otomatis
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Sistem mencatat presensi harian karyawan aktif dan otomatis terhubung ke perhitungan gaji:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-2.5 text-xs">
              <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <p className="font-bold text-blue-600 dark:text-blue-400">1. Data Karyawan</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Daftarkan karyawan berstatus <strong>AKTIF</strong> di menu SDM.</p>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <p className="font-bold text-emerald-600 dark:text-emerald-400">2. Clock-In (Masuk)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Klik <strong>Masuk</strong> saat hadir, atau <strong>Izin/Status</strong> untuk sakit/cuti.</p>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <p className="font-bold text-amber-600 dark:text-amber-400">3. Clock-Out (Keluar)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Klik <strong>Keluar</strong> saat pulang kerja untuk merekam durasi jam kerja.</p>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <p className="font-bold text-purple-600 dark:text-purple-400">4. Otomatis ke Payroll</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Rekap kehadiran otomatis masuk kalkulasi gaji di menu <strong>Payroll</strong>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loadingData ? (
        <>
          <SkeletonStatGrid count={5} />
          <SkeletonSpinner label="Memuat data absensi karyawan..." />
        </>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card className="p-4 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Hadir</span>
                <CheckCircle size={16} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {summary?.total_hadir ?? 0}
              </p>
            </Card>

            <Card className="p-4 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Terlambat</span>
                <Clock size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {summary?.total_terlambat ?? 0}
              </p>
            </Card>

            <Card className="p-4 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Izin / Sakit / Cuti</span>
                <AlertTriangle size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
                {(summary?.total_izin ?? 0) + (summary?.total_sakit ?? 0) + (summary?.total_cuti ?? 0)}
              </p>
            </Card>

            <Card className="p-4 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Alpa</span>
                <XCircle size={16} className="text-red-500" />
              </div>
              <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-2">
                {summary?.total_alpa ?? 0}
              </p>
            </Card>

            <Card className="p-4 border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Tanggal</span>
                <Calendar size={16} className="text-primary-500" />
              </div>
              <p className="text-sm font-black text-slate-800 dark:text-white mt-3 truncate">
                {formatDate(selectedDate)}
              </p>
            </Card>
          </div>

          {/* Filters & Actions */}
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="w-full sm:w-44">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-52">
                  <select
                    value={filterEmployee}
                    onChange={e => setFilterEmployee(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 shadow-sm"
                  >
                    <option value="">Semua Karyawan</option>
                    {employees.filter(e => e.status_karyawan === 'AKTIF').map(e => (
                      <option key={e.id_karyawan} value={e.id_karyawan}>
                        {e.nama_lengkap} ({e.nik})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button onClick={load} variant="secondary" size="sm" icon={<Clock size={14} />}>
                Perbarui
              </Button>
            </div>
          </Card>

          {/* Table */}
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-300 uppercase">Karyawan</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-300 uppercase">Jam Masuk</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-300 uppercase">Jam Keluar</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-300 uppercase">Catatan</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-300 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mergedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="max-w-sm mx-auto space-y-2.5">
                          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            Belum Ada Karyawan Aktif yang Terdaftar
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Fitur absensi harian membutuhkan data staf berstatus aktif. Silakan tambahkan data karyawan terlebih dahulu.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => navigate('/employee')}
                            icon={<ArrowRight size={14} />}
                            className="mt-1"
                          >
                            Tambah / Kelola Karyawan
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    mergedRows.map(({ emp, rec, status, jam_masuk, jam_keluar, catatan }) => (
                      <tr key={emp.id_karyawan} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{emp.nama_lengkap}</div>
                          <div className="text-[11px] text-slate-400 font-mono">NIK: {emp.nik} {emp.jabatan ? `· ${emp.jabatan}` : ''}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {jam_masuk}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {jam_keluar}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Badge label={status} variant={statusVariant(status)} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-[160px] truncate">
                          {catatan}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!rec?.jam_masuk ? (
                              <>
                                <Button
                                  size="sm"
                                  icon={<LogIn size={13} />}
                                  loading={loading}
                                  onClick={() => handleClockIn(emp.id_karyawan, 'HADIR')}
                                >
                                  Masuk
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<PlusCircle size={13} />}
                                  onClick={() => openStatusModal(emp)}
                                >
                                  Izin/Status
                                </Button>
                              </>
                            ) : !rec?.jam_keluar ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<LogOut size={13} />}
                                  loading={loading}
                                  onClick={() => handleClockOut(rec.id_absensi, emp.id_karyawan)}
                                >
                                  Keluar
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => openStatusModal(emp)}
                                  className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1"
                                >
                                  Ubah
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openStatusModal(emp)}
                                className="text-xs font-bold text-primary-600 hover:underline px-2 py-1"
                              >
                                Selesai (Edit)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Status Modal */}
          <Modal
            open={statusModalOpen}
            onClose={() => setStatusModalOpen(false)}
            title={`Catat Absensi: ${selectedEmployee?.nama_lengkap ?? ''}`}
          >
            <div className="space-y-4 p-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status Kehadiran</label>
                <select
                  value={customStatus}
                  onChange={e => setCustomStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-600 shadow-sm"
                >
                  <option value="HADIR">Hadir Tepat Waktu</option>
                  <option value="TERLAMBAT">Terlambat</option>
                  <option value="IZIN">Izin</option>
                  <option value="SAKIT">Sakit</option>
                  <option value="CUTI">Cuti</option>
                  <option value="ALPA">Alpa / Tanpa Keterangan</option>
                </select>
              </div>

              {(customStatus === 'HADIR' || customStatus === 'TERLAMBAT') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Jam Masuk</label>
                  <Input
                    type="time"
                    value={customTime}
                    onChange={e => setCustomTime(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Catatan / Alasan</label>
                <textarea
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  placeholder="Contoh: Sakit flu dengan surat dokter, izin urusan keluarga, dll."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-600 shadow-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
                  Batal
                </Button>
                <Button
                  loading={loading}
                  onClick={() => {
                    if (selectedEmployee) {
                      handleClockIn(selectedEmployee.id_karyawan, customStatus, customTime, customNotes)
                    }
                  }}
                >
                  Simpan Absensi
                </Button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  )
}
