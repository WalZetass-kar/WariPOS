import { db } from '../../database/connection.js'
import {
  employees,
  employeeContracts,
  attendance,
  payroll,
  payrollDetails,
  tipPooling,
  tipDistribution,
  shiftSchedules,
} from '../../database/schema.js'
import { eq, and, or, desc, gte, lte, like } from 'drizzle-orm'

export class EmployeeModel {
  static generateKode(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 9000 + 1000).toString()
    return `KAR${year}${month}${day}${random}`
  }

  // ─── EMPLOYEE CRUD ───────────────────────────────────────────────

  static getAll() {
    return db.select().from(employees).orderBy(desc(employees.tgl_masuk)).all()
  }

  static getById(id: number) {
    return db.select().from(employees).where(eq(employees.id, id)).get()
  }

  static create(data: {
    nik: string
    nama_lengkap: string
    tempat_lahir?: string | null
    tgl_lahir?: string | null
    jenis_kelamin?: string | null
    alamat?: string | null
    no_telp?: string | null
    email?: string | null
    agama?: string | null
    status_perkawinan?: string | null
    pendidikan_terakhir?: string | null
    jurusan?: string | null
    nama_ibu?: string | null
    no_rekening?: string | null
    bank?: string | null
    bpjs_kesehatan?: string | null
    bpjs_ketenagakerjaan?: string | null
    npwp?: string | null
    tgl_masuk: string
    tgl_keluar?: string | null
    status_karyawan?: string | null
    jabatan?: string | null
    departemen?: string | null
    gaji_pokok?: number | null
    tunjangan?: number | null
    jam_kerja_per_hari?: number | null
    foto?: string | null
    catatan?: string | null
  }) {
    const now = new Date().toISOString()
    return db.insert(employees).values({
      ...data,
      status_karyawan: data.status_karyawan || 'AKTIF',
      gaji_pokok: data.gaji_pokok ?? 0,
      tunjangan: data.tunjangan ?? 0,
      jam_kerja_per_hari: data.jam_kerja_per_hari ?? 8,
      created_at: now,
      updated_at: now,
    }).run()
  }

  static update(id: number, data: Partial<{
    nik: string
    nama_lengkap: string
    tempat_lahir: string | null
    tgl_lahir: string | null
    jenis_kelamin: string | null
    alamat: string | null
    no_telp: string | null
    email: string | null
    agama: string | null
    status_perkawinan: string | null
    pendidikan_terakhir: string | null
    jurusan: string | null
    nama_ibu: string | null
    no_rekening: string | null
    bank: string | null
    bpjs_kesehatan: string | null
    bpjs_ketenagakerjaan: string | null
    npwp: string | null
    tgl_masuk: string
    tgl_keluar: string | null
    status_karyawan: string | null
    jabatan: string | null
    departemen: string | null
    gaji_pokok: number | null
    tunjangan: number | null
    jam_kerja_per_hari: number | null
    foto: string | null
    catatan: string | null
  }>) {
    return db.update(employees).set({
      ...data,
      updated_at: new Date().toISOString(),
    }).where(eq(employees.id, id)).run()
  }

  static delete(id: number) {
    return db.delete(employees).where(eq(employees.id, id)).run()
  }

  static search(query: string) {
    const q = `%${query}%`
    return db.select().from(employees)
      .where(
        or(
          like(employees.nik, q),
          like(employees.nama_lengkap, q),
          like(employees.jabatan, q),
          like(employees.departemen, q),
          like(employees.no_telp, q),
          like(employees.email, q),
        )
      )
      .orderBy(desc(employees.tgl_masuk))
      .all()
  }

  static getByStatus(status: string) {
    return db.select().from(employees)
      .where(eq(employees.status_karyawan, status))
      .orderBy(desc(employees.tgl_masuk))
      .all()
  }

  // ─── CONTRACTS ───────────────────────────────────────────────────

  static getContracts(employeeId: number) {
    return db.select().from(employeeContracts)
      .where(eq(employeeContracts.employee_id, employeeId))
      .orderBy(desc(employeeContracts.tgl_mulai))
      .all()
  }

  static getContractById(id: number) {
    return db.select().from(employeeContracts).where(eq(employeeContracts.id, id)).get()
  }

  static createContract(data: {
    employee_id: number
    nomor_kontrak: string
    jenis_kontrak: string
    tgl_mulai: string
    tgl_berakhir?: string | null
    durasi_bulan?: number | null
    jabatan: string
    departemen?: string | null
    gaji_pokok?: number | null
    tunjangan?: number | null
    uang_makan?: number | null
    uang_transport?: number | null
    jam_kerja?: string | null
    hari_kerja?: string | null
    hak_cuti_tahunan?: number | null
    masa_percobaan_bulan?: number | null
    lampiran?: string | null
    catatan?: string | null
    dibuat_oleh: string
  }) {
    const now = new Date().toISOString()
    return db.insert(employeeContracts).values({
      ...data,
      status: 'AKTIF',
      gaji_pokok: data.gaji_pokok ?? 0,
      tunjangan: data.tunjangan ?? 0,
      uang_makan: data.uang_makan ?? 0,
      uang_transport: data.uang_transport ?? 0,
      hak_cuti_tahunan: data.hak_cuti_tahunan ?? 12,
      masa_percobaan_bulan: data.masa_percobaan_bulan ?? 3,
      tgl_dibuat: now,
    }).run()
  }

  static updateContract(id: number, data: Partial<{
    nomor_kontrak: string
    jenis_kontrak: string
    tgl_mulai: string
    tgl_berakhir: string | null
    durasi_bulan: number | null
    jabatan: string
    departemen: string | null
    gaji_pokok: number | null
    tunjangan: number | null
    uang_makan: number | null
    uang_transport: number | null
    jam_kerja: string | null
    hari_kerja: string | null
    hak_cuti_tahunan: number | null
    masa_percobaan_bulan: number | null
    status: string | null
    lampiran: string | null
    catatan: string | null
    diperbarui_oleh: string | null
  }>) {
    return db.update(employeeContracts).set({
      ...data,
      tgl_diperbarui: new Date().toISOString(),
    }).where(eq(employeeContracts.id, id)).run()
  }

  static terminateContract(id: number, data: {
    tgl_berakhir: string
    catatan?: string | null
    diperbarui_oleh?: string | null
  }) {
    return db.update(employeeContracts).set({
      status: 'BERAKHIR',
      tgl_berakhir: data.tgl_berakhir,
      catatan: data.catatan ?? null,
      diperbarui_oleh: data.diperbarui_oleh ?? null,
      tgl_diperbarui: new Date().toISOString(),
    }).where(eq(employeeContracts.id, id)).run()
  }

  // ─── ATTENDANCE ──────────────────────────────────────────────────

  static getAttendance(date: string) {
    return db.select().from(attendance)
      .where(eq(attendance.tgl, date))
      .orderBy(desc(attendance.jam_masuk))
      .all()
  }

  static getAttendanceByEmployee(id: number, startDate: string, endDate: string) {
    return db.select().from(attendance)
      .where(and(
        eq(attendance.employee_id, id),
        gte(attendance.tgl, startDate),
        lte(attendance.tgl, endDate),
      ))
      .orderBy(desc(attendance.tgl))
      .all()
  }

  static clockIn(data: {
    employee_id: number
    tgl: string
    jam_masuk: string
    status?: string | null
    lokasi_masuk?: string | null
    foto_masuk?: string | null
    catatan?: string | null
  }) {
    const now = new Date().toISOString()
    return db.insert(attendance).values({
      employee_id: data.employee_id,
      tgl: data.tgl,
      jam_masuk: data.jam_masuk,
      lokasi_masuk: data.lokasi_masuk ?? null,
      foto_masuk: data.foto_masuk ?? null,
      catatan: data.catatan ?? null,
      status: data.status || 'HADIR',
      keterlambatan_menit: 0,
      created_at: now,
    }).run()
  }

  static clockOut(id: number, data: {
    jam_keluar: string
    lokasi_keluar?: string | null
    foto_keluar?: string | null
    catatan?: string | null
  }) {
    return db.update(attendance).set({
      jam_keluar: data.jam_keluar,
      lokasi_keluar: data.lokasi_keluar ?? null,
      foto_keluar: data.foto_keluar ?? null,
      catatan: data.catatan ?? null,
    }).where(eq(attendance.id, id)).run()
  }

  static getAttendanceSummary(employeeId: number, month: number, year: number) {
    const monthStr = String(month).padStart(2, '0')
    const startDate = `${year}-${monthStr}-01`
    const endDate = `${year}-${monthStr}-31`

    const records = db.select().from(attendance)
      .where(and(
        eq(attendance.employee_id, employeeId),
        gte(attendance.tgl, startDate),
        lte(attendance.tgl, endDate),
      ))
      .all()

    const total_hadir = records.filter(r => r.status === 'HADIR').length
    const total_terlambat = records.filter(r => r.status === 'TERLAMBAT').length
    const total_izin = records.filter(r => r.status === 'IZIN').length
    const total_sakit = records.filter(r => r.status === 'SAKIT').length
    const total_cuti = records.filter(r => r.status === 'CUTI').length
    const total_alpa = records.filter(r => r.status === 'ALPA').length
    const total_keterlambatan_menit = records.reduce((sum, r) => sum + (r.keterlambatan_menit || 0), 0)

    return {
      employee_id: employeeId,
      bulan: month,
      tahun: year,
      total_hari: records.length,
      total_hadir,
      total_terlambat,
      total_izin,
      total_sakit,
      total_cuti,
      total_alpa,
      total_keterlambatan_menit,
    }
  }

  // ─── PAYROLL ─────────────────────────────────────────────────────

  static getPayroll(month: number, year: number) {
    const list = db.select().from(payroll)
      .where(and(
        eq(payroll.periode_bulan, month),
        eq(payroll.periode_tahun, year),
      ))
      .orderBy(desc(payroll.tgl_dibuat))
      .all()

    return list.map(p => {
      const emp = db.select().from(employees).where(eq(employees.id, p.employee_id)).get()
      return {
        ...p,
        nama_karyawan: emp?.nama_lengkap,
        nik: emp?.nik,
        jabatan: emp?.jabatan,
        departemen: emp?.departemen,
      }
    })
  }

  static getPayrollByEmployee(id: number, month: number, year: number) {
    return db.select().from(payroll)
      .where(and(
        eq(payroll.employee_id, id),
        eq(payroll.periode_bulan, month),
        eq(payroll.periode_tahun, year),
      ))
      .get()
  }

  static createPayroll(data: {
    employee_id: number
    periode_bulan: number
    periode_tahun: number
    gaji_pokok?: number | null
    tunjangan?: number | null
    uang_makan?: number | null
    uang_transport?: number | null
    lembur?: number | null
    bonus?: number | null
    komisi?: number | null
    potongan?: number | null
    potongan_bpjs?: number | null
    potongan_pph?: number | null
    potongan_lain?: number | null
    total_gaji?: number | null
    catatan?: string | null
    dibuat_oleh: string
  }) {
    const now = new Date().toISOString()
    const total =
      (data.gaji_pokok ?? 0) +
      (data.tunjangan ?? 0) +
      (data.uang_makan ?? 0) +
      (data.uang_transport ?? 0) +
      (data.lembur ?? 0) +
      (data.bonus ?? 0) +
      (data.komisi ?? 0) -
      (data.potongan ?? 0) -
      (data.potongan_bpjs ?? 0) -
      (data.potongan_pph ?? 0) -
      (data.potongan_lain ?? 0)

    return db.insert(payroll).values({
      employee_id: data.employee_id,
      periode_bulan: data.periode_bulan,
      periode_tahun: data.periode_tahun,
      gaji_pokok: data.gaji_pokok ?? 0,
      tunjangan: data.tunjangan ?? 0,
      uang_makan: data.uang_makan ?? 0,
      uang_transport: data.uang_transport ?? 0,
      lembur: data.lembur ?? 0,
      bonus: data.bonus ?? 0,
      komisi: data.komisi ?? 0,
      potongan: data.potongan ?? 0,
      potongan_bpjs: data.potongan_bpjs ?? 0,
      potongan_pph: data.potongan_pph ?? 0,
      potongan_lain: data.potongan_lain ?? 0,
      total_gaji: data.total_gaji ?? total,
      status: 'DRAFT',
      dibuat_oleh: data.dibuat_oleh,
      tgl_dibuat: now,
    }).run()
  }

  static updatePayrollStatus(id: number, status: string) {
    return db.update(payroll).set({ status }).where(eq(payroll.id, id)).run()
  }

  static generatePayrollSlip(id: number) {
    const p = db.select().from(payroll).where(eq(payroll.id, id)).get()
    if (!p) return null

    const emp = db.select().from(employees).where(eq(employees.id, p.employee_id)).get()
    const details = db.select().from(payrollDetails)
      .where(eq(payrollDetails.payroll_id, id))
      .all()

    return {
      payroll: p,
      employee: emp,
      details,
      total_penambah: details
        .filter(d => d.tipe === 'PENAMBAH')
        .reduce((sum, d) => sum + (d.jumlah || 0), 0),
      total_pengurang: details
        .filter(d => d.tipe === 'PENGURANG')
        .reduce((sum, d) => sum + (d.jumlah || 0), 0),
    }
  }

  static getPayrollSummary(month: number, year: number) {
    const records = db.select().from(payroll)
      .where(and(
        eq(payroll.periode_bulan, month),
        eq(payroll.periode_tahun, year),
      ))
      .all()

    const total_gaji = records.reduce((sum, r) => sum + (r.total_gaji || 0), 0)
    const total_lembur = records.reduce((sum, r) => sum + (r.lembur || 0), 0)
    const total_bonus = records.reduce((sum, r) => sum + (r.bonus || 0), 0)
    const total_potongan = records.reduce((sum, r) => sum + (r.potongan || 0) + (r.potongan_bpjs || 0) + (r.potongan_pph || 0) + (r.potongan_lain || 0), 0)
    const total_karyawan = records.length
    const total_dibayar = records.filter(r => r.status === 'DIBAYAR').length

    return {
      bulan: month,
      tahun: year,
      total_karyawan,
      total_dibayar,
      total_gaji,
      total_lembur,
      total_bonus,
      total_potongan,
      rata_rata_gaji: total_karyawan > 0 ? total_gaji / total_karyawan : 0,
    }
  }

  // ─── PAYROLL DETAILS ─────────────────────────────────────────────

  static getDetails(payrollId: number) {
    return db.select().from(payrollDetails)
      .where(eq(payrollDetails.payroll_id, payrollId))
      .all()
  }

  static addDetail(data: {
    payroll_id: number
    komponen: string
    tipe: string
    jumlah?: number | null
    keterangan?: string | null
  }) {
    return db.insert(payrollDetails).values({
      payroll_id: data.payroll_id,
      komponen: data.komponen,
      tipe: data.tipe,
      jumlah: data.jumlah ?? 0,
      keterangan: data.keterangan ?? null,
    }).run()
  }

  static deleteDetail(id: number) {
    return db.delete(payrollDetails).where(eq(payrollDetails.id, id)).run()
  }

  // ─── TIP POOLING ─────────────────────────────────────────────────

  static getTipPoolings() {
    return db.select().from(tipPooling).orderBy(desc(tipPooling.tgl)).all()
  }

  static createTipPooling(data: {
    tgl: string
    total_tip?: number | null
    jumlah_karyawan?: number | null
    tip_per_orang?: number | null
    catatan?: string | null
    dibuat_oleh: string
  }) {
    const now = new Date().toISOString()
    return db.insert(tipPooling).values({
      tgl: data.tgl,
      total_tip: data.total_tip ?? 0,
      jumlah_karyawan: data.jumlah_karyawan ?? 0,
      tip_per_orang: data.tip_per_orang ?? 0,
      status: 'DRAFT',
      catatan: data.catatan ?? null,
      dibuat_oleh: data.dibuat_oleh,
      tgl_dibuat: now,
    }).run()
  }

  static distributeTip(id: number, distributions: {
    employee_id: number
    jumlah: number
    persentase?: number | null
    catatan?: string | null
  }[]) {
    const pooling = db.select().from(tipPooling).where(eq(tipPooling.id, id)).get()
    if (!pooling) return null

    for (const dist of distributions) {
      db.insert(tipDistribution).values({
        tip_pooling_id: id,
        employee_id: dist.employee_id,
        jumlah: dist.jumlah,
        persentase: dist.persentase ?? 0,
        catatan: dist.catatan ?? null,
      }).run()
    }

    db.update(tipPooling).set({
      status: 'DIDISTRIBUSI',
      jumlah_karyawan: distributions.length,
      tip_per_orang: distributions.length > 0 ? distributions[0].jumlah : 0,
    }).where(eq(tipPooling.id, id)).run()

    return { distributed: distributions.length }
  }

  static getTipDistributions(poolingId: number) {
    return db.select().from(tipDistribution)
      .where(eq(tipDistribution.tip_pooling_id, poolingId))
      .all()
  }

  // ─── SHIFT SCHEDULE ──────────────────────────────────────────────

  static getSchedules(date: string) {
    return db.select().from(shiftSchedules)
      .where(eq(shiftSchedules.tgl, date))
      .orderBy(shiftSchedules.shift)
      .all()
  }

  static getSchedulesByEmployee(id: number, startDate: string, endDate: string) {
    return db.select().from(shiftSchedules)
      .where(and(
        eq(shiftSchedules.employee_id, id),
        gte(shiftSchedules.tgl, startDate),
        lte(shiftSchedules.tgl, endDate),
      ))
      .orderBy(desc(shiftSchedules.tgl))
      .all()
  }

  static createSchedule(data: {
    employee_id: number
    tgl: string
    shift: string
    jam_masuk: string
    jam_keluar: string
    catatan?: string | null
    dibuat_oleh: string
  }) {
    const now = new Date().toISOString()
    return db.insert(shiftSchedules).values({
      employee_id: data.employee_id,
      tgl: data.tgl,
      shift: data.shift,
      jam_masuk: data.jam_masuk,
      jam_keluar: data.jam_keluar,
      catatan: data.catatan ?? null,
      dibuat_oleh: data.dibuat_oleh,
      tgl_dibuat: now,
    }).run()
  }

  static deleteSchedule(id: number) {
    return db.delete(shiftSchedules).where(eq(shiftSchedules.id, id)).run()
  }
}
