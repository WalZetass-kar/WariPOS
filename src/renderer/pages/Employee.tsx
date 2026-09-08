import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Users, UserCheck, UserX, Clock } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonStatGrid, SkeletonSpinner } from '../components/Skeleton'
import { api } from '../utils/api'
import { formatRupiah, formatDate } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

interface Employee {
  id_karyawan: number
  nik: string
  nama_lengkap: string
  tempat_lahir: string
  tgl_lahir: string
  jenis_kelamin: string
  alamat: string
  no_telp: string
  email: string
  agama: string
  status_perkawinan: string
  pendidikan_terakhir: string
  jurusan: string
  nama_ibu: string
  no_rekening: string
  bank: string
  bpjs_kesehatan: string
  bpjs_ketenagakerjaan: string
  npwp: string
  tgl_masuk: string
  status_karyawan: string
  jabatan: string
  departemen: string
  gaji_pokok: number
  tunjangan: number
  jam_kerja_per_hari: number
  catatan: string
  created_at: string
  updated_at: string
}

type EmployeeForm = Omit<Employee, 'id_karyawan' | 'created_at' | 'updated_at' | 'gaji_pokok' | 'tunjangan' | 'jam_kerja_per_hari'> & {
  gaji_pokok: number | ''
  tunjangan: number | ''
  jam_kerja_per_hari: number | ''
}

const emptyForm: EmployeeForm = {
  nik: '', nama_lengkap: '', tempat_lahir: '', tgl_lahir: '', jenis_kelamin: 'L',
  alamat: '', no_telp: '', email: '', agama: '', status_perkawinan: 'BELUM KAWIN',
  pendidikan_terakhir: '', jurusan: '', nama_ibu: '', no_rekening: '', bank: '',
  bpjs_kesehatan: '', bpjs_ketenagakerjaan: '', npwp: '', tgl_masuk: '',
  status_karyawan: 'AKTIF', jabatan: '', departemen: '',
  gaji_pokok: '', tunjangan: '', jam_kerja_per_hari: 8, catatan: ''
}

export default function Employee() {
  const toast = useToast()
  const { user } = useAuth()
  const [data, setData] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

  const load = async () => {
    const r = await api<Employee[]>(search ? 'employee:search' : 'employee:getAll', search || undefined)
    if (r.success) setData(r.data ?? [])
    setLoadingData(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!search) { load(); return }
    const t = setTimeout(() => load(), 500)
    return () => clearTimeout(t)
  }, [search])

  const statusVariant = (s: string) => {
    if (s === 'AKTIF') return 'green'
    if (s === 'RESIGN') return 'red'
    if (s === 'PHK') return 'amber'
    return 'yellow'
  }

  const openEdit = (e: Employee) => {
    setForm({
      nik: e.nik, nama_lengkap: e.nama_lengkap, tempat_lahir: e.tempat_lahir,
      tgl_lahir: e.tgl_lahir, jenis_kelamin: e.jenis_kelamin, alamat: e.alamat,
      no_telp: e.no_telp, email: e.email, agama: e.agama,
      status_perkawinan: e.status_perkawinan, pendidikan_terakhir: e.pendidikan_terakhir,
      jurusan: e.jurusan, nama_ibu: e.nama_ibu, no_rekening: e.no_rekening,
      bank: e.bank, bpjs_kesehatan: e.bpjs_kesehatan,
      bpjs_ketenagakerjaan: e.bpjs_ketenagakerjaan, npwp: e.npwp,
      tgl_masuk: e.tgl_masuk, status_karyawan: e.status_karyawan,
      jabatan: e.jabatan, departemen: e.departemen, gaji_pokok: e.gaji_pokok,
      tunjangan: e.tunjangan, jam_kerja_per_hari: e.jam_kerja_per_hari, catatan: e.catatan
    })
    setEditingId(e.id_karyawan)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.nik || !form.nama_lengkap) return toast('NIK dan Nama Lengkap wajib diisi', 'error')
    
    const sanitizedPayload = {
      ...form,
      gaji_pokok: Number(form.gaji_pokok) || 0,
      tunjangan: Number(form.tunjangan) || 0,
      jam_kerja_per_hari: Number(form.jam_kerja_per_hari) || 8,
    }

    setLoading(true)
    const r = editingId
      ? await api('employee:update', editingId, sanitizedPayload)
      : await api('employee:create', sanitizedPayload)
    setLoading(false)
    if (r.success) {
      toast(r.message as string)
      setModal(null)
      setForm(emptyForm)
      setEditingId(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    const r = await api('employee:delete', deleteTarget.id_karyawan)
    setLoading(false)
    if (r.success) {
      toast(r.message as string)
      setDeleteTarget(null)
      load()
    } else {
      toast(r.message as string, 'error')
    }
  }

  const countByStatus = (s: string) => data.filter(e => e.status_karyawan === s).length

  return (
    <div className="space-y-4">
      {loadingData ? (
        <>
          <SkeletonStatGrid count={4} />
          <SkeletonSpinner label="Memuat data karyawan..." />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Total Karyawan" action={<Users size={16} className="text-primary-500" />}>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{data.length}</p>
            </Card>
            <Card title="Aktif" action={<UserCheck size={16} className="text-emerald-500" />}>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{countByStatus('AKTIF')}</p>
            </Card>
            <Card title="Resign/PHK" action={<UserX size={16} className="text-red-500" />}>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">{countByStatus('RESIGN') + countByStatus('PHK')}</p>
            </Card>
            <Card title="Cuti" action={<Clock size={16} className="text-amber-500" />}>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">{countByStatus('CUTI')}</p>
            </Card>
          </div>

          <Card>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Cari NIK atau Nama..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  icon={<Search size={16} />}
                />
              </div>
              <Button icon={<Plus size={16} />} onClick={() => { setForm(emptyForm); setEditingId(null); setModal('add') }}>
                Tambah Karyawan
              </Button>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[900px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">NIK</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nama</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Jabatan</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Departemen</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Telepon</th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 sm:px-4 py-10 text-center text-slate-400 text-sm">
                          Belum ada data karyawan
                        </td>
                      </tr>
                    ) : (
                      data.map(e => (
                        <tr key={e.id_karyawan} className="hover:bg-primary-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-3 sm:px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">{e.nik}</td>
                          <td className="px-3 sm:px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{e.nama_lengkap}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600 dark:text-slate-400">{e.jabatan}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600 dark:text-slate-400">{e.departemen}</td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <Badge label={e.status_karyawan} variant={statusVariant(e.status_karyawan)} />
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600 dark:text-slate-400">{e.no_telp || '-'}</td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500 transition-colors" title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Hapus">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Modal
            open={modal === 'add' || modal === 'edit'}
            onClose={() => setModal(null)}
            title={editingId ? 'Edit Karyawan' : 'Tambah Karyawan'}
            size="xl"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModal(null)}>Batal</Button>
                <Button loading={loading} onClick={handleSave}>{editingId ? 'Simpan' : 'Tambah'}</Button>
              </>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="NIK *" value={form.nik} onChange={e => setForm(p => ({ ...p, nik: e.target.value }))} placeholder="NIK" />
              <Input label="Nama Lengkap *" value={form.nama_lengkap} onChange={e => setForm(p => ({ ...p, nama_lengkap: e.target.value }))} placeholder="Nama lengkap" />
              <Input label="Tempat Lahir" value={form.tempat_lahir} onChange={e => setForm(p => ({ ...p, tempat_lahir: e.target.value }))} placeholder="Tempat lahir" />
              <Input label="Tanggal Lahir" type="date" value={form.tgl_lahir} onChange={e => setForm(p => ({ ...p, tgl_lahir: e.target.value }))} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Jenis Kelamin</label>
                <select value={form.jenis_kelamin} onChange={e => setForm(p => ({ ...p, jenis_kelamin: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <Input label="No. Telepon" value={form.no_telp} onChange={e => setForm(p => ({ ...p, no_telp: e.target.value }))} placeholder="No telepon" />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
              <Input label="Agama" value={form.agama} onChange={e => setForm(p => ({ ...p, agama: e.target.value }))} placeholder="Agama" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status Perkawinan</label>
                <select value={form.status_perkawinan} onChange={e => setForm(p => ({ ...p, status_perkawinan: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                  <option value="BELUM KAWIN">Belum Kawin</option>
                  <option value="KAWIN">Kawin</option>
                  <option value="CERAI">Cerai</option>
                </select>
              </div>
              <Input label="Pendidikan Terakhir" value={form.pendidikan_terakhir} onChange={e => setForm(p => ({ ...p, pendidikan_terakhir: e.target.value }))} placeholder="Pendidikan terakhir" />
              <Input label="Jurusan" value={form.jurusan} onChange={e => setForm(p => ({ ...p, jurusan: e.target.value }))} placeholder="Jurusan" />
              <Input label="Nama Ibu" value={form.nama_ibu} onChange={e => setForm(p => ({ ...p, nama_ibu: e.target.value }))} placeholder="Nama ibu kandung" />
              <Input label="No. Rekening" value={form.no_rekening} onChange={e => setForm(p => ({ ...p, no_rekening: e.target.value }))} placeholder="No rekening" />
              <Input label="Bank" value={form.bank} onChange={e => setForm(p => ({ ...p, bank: e.target.value }))} placeholder="Nama bank" />
              <Input label="BPJS Kesehatan" value={form.bpjs_kesehatan} onChange={e => setForm(p => ({ ...p, bpjs_kesehatan: e.target.value }))} placeholder="No BPJS Kesehatan" />
              <Input label="BPJS Ketenagakerjaan" value={form.bpjs_ketenagakerjaan} onChange={e => setForm(p => ({ ...p, bpjs_ketenagakerjaan: e.target.value }))} placeholder="No BPJS Ketenagakerjaan" />
              <Input label="NPWP" value={form.npwp} onChange={e => setForm(p => ({ ...p, npwp: e.target.value }))} placeholder="NPWP" />
              <Input label="Tanggal Masuk" type="date" value={form.tgl_masuk} onChange={e => setForm(p => ({ ...p, tgl_masuk: e.target.value }))} />
              <Input label="Jabatan" value={form.jabatan} onChange={e => setForm(p => ({ ...p, jabatan: e.target.value }))} placeholder="Jabatan" />
              <Input label="Departemen" value={form.departemen} onChange={e => setForm(p => ({ ...p, departemen: e.target.value }))} placeholder="Departemen" />
              <Input label="Gaji Pokok" type="number" value={form.gaji_pokok} onChange={e => setForm(p => ({ ...p, gaji_pokok: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) }))} placeholder="0" />
              <Input label="Tunjangan" type="number" value={form.tunjangan} onChange={e => setForm(p => ({ ...p, tunjangan: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) }))} placeholder="0" />
              <Input label="Jam Kerja per Hari" type="number" value={form.jam_kerja_per_hari} onChange={e => setForm(p => ({ ...p, jam_kerja_per_hari: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) }))} placeholder="8" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status Karyawan</label>
                <select value={form.status_karyawan} onChange={e => setForm(p => ({ ...p, status_karyawan: e.target.value as any }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                  <option value="AKTIF">Aktif</option>
                  <option value="RESIGN">Resign</option>
                  <option value="PHK">PHK</option>
                  <option value="CUTI">Cuti</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Alamat</label>
                <textarea value={form.alamat} onChange={e => setForm(p => ({ ...p, alamat: e.target.value }))} rows={3} placeholder="Alamat lengkap"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Catatan</label>
                <textarea value={form.catatan} onChange={e => setForm(p => ({ ...p, catatan: e.target.value }))} rows={2} placeholder="Catatan"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
            </div>
          </Modal>

          <ConfirmDialog
            open={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Hapus Karyawan"
            message={`Karyawan "${deleteTarget?.nama_lengkap ?? ''}" akan dihapus dari sistem.`}
            confirmText="Hapus"
            variant="danger"
            loading={loading}
          >
            {deleteTarget && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex justify-between"><span className="text-slate-500">NIK</span><span className="font-semibold text-slate-800 dark:text-slate-100">{deleteTarget.nik}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Nama</span><span className="font-semibold text-slate-800 dark:text-slate-100">{deleteTarget.nama_lengkap}</span></div>
              </div>
            )}
          </ConfirmDialog>
        </>
      )}
    </div>
  )
}
