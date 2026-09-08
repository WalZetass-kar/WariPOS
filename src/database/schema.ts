import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const pengguna = sqliteTable('mediasoft_pengguna', {
  nama_pengguna: text('nama_pengguna').primaryKey(),
  kata_sandi: text('kata_sandi'),
  nama_lengkap: text('nama_lengkap'),
  tgl_wkt_simpan: text('tgl_wkt_simpan'),
  tgl_wkt_edit: text('tgl_wkt_edit'),
  status_user: text('status_user').default('Aktif').notNull(),
  terakhir_login: text('terakhir_login'),
  hak_akses: text('hak_akses').default('kasir').notNull(), // developer, admin, operator, kasir
  email: text('email'),
  no_telp: text('no_telp'),
  access_expires_at: text('access_expires_at'),
  password_hash_type: text('password_hash_type').default('sha1'), // sha1, bcrypt
  must_change_password: integer('must_change_password').default(0),
  pin_hash: text('pin_hash'),
  pin_hash_type: text('pin_hash_type').default('bcrypt'),
  pin_enabled: integer('pin_enabled').default(0),
  subscription_plan_id: integer('subscription_plan_id'),
  subscription_expires_at: text('subscription_expires_at'),
  is_buyer: integer('is_buyer').default(0),
  foto: text('foto'),
})

export const satuan = sqliteTable('mediasoft_satuan', {
  kd_satuan: integer('kd_satuan').primaryKey({ autoIncrement: true }),
  nama_satuan: text('nama_satuan'),
})

export const kategoriBarang = sqliteTable('mediasoft_kategori_barang', {
  kd_kategori_barang: integer('kd_kategori_barang').primaryKey({ autoIncrement: true }),
  kategori_barang: text('kategori_barang'),
})

export const barang = sqliteTable('mediasoft_barang', {
  kd_barang: text('kd_barang').primaryKey(),
  nama_barang: text('nama_barang'),
  tgl_wkt_simpan: text('tgl_wkt_simpan'),
  tgl_wkt_ubah: text('tgl_wkt_ubah'),
  foto_barang: text('foto_barang'),
  deskripsi_barang: text('deskripsi_barang'),
  nama_pengguna: text('nama_pengguna'),
  stok: integer('stok').default(0),
  stok_minimum: integer('stok_minimum').default(5),
  kd_satuan: integer('kd_satuan').default(0),
  jenis_transaksi: text('jenis_transaksi').default('INCOME'),
  kd_kategori_barang: integer('kd_kategori_barang').default(0),
  barcode: text('barcode'),
  expired_date: text('expired_date'),
})

export const harga = sqliteTable('mediasoft_harga', {
  kd_barang: text('kd_barang').primaryKey(),
  harga_barang: real('harga_barang').default(0),
  potongan: integer('potongan').default(0),
  harga_modal: real('harga_modal').default(0),
})

export const penjualan = sqliteTable('mediasoft_penjualan', {
  kd_tansaksi_jual: text('kd_tansaksi_jual').primaryKey(),
  tgl_wkt_transaksi: text('tgl_wkt_transaksi'),
  deskripsi: text('deskripsi'),
  username_transaksi: text('username_transaksi'),
  total_qty: integer('total_qty').default(0),
  sub_total: real('sub_total').default(0),
  pajak: real('pajak').default(0),
  yang_dibayar: real('yang_dibayar').default(0),
  kembalian: real('kembalian').default(0),
  jenis_pembayaran: text('jenis_pembayaran').default('TUNAI'),
  discount_amount: real('discount_amount').default(0),
  shift_id: integer('shift_id'),
  kd_customer: text('kd_customer'),
})

export const penjualanDetail = sqliteTable('mediasoft_penjualan_detail', {
  kd_trans_jual_detail: integer('kd_trans_jual_detail').primaryKey({ autoIncrement: true }),
  kd_tansaksi_jual: text('kd_tansaksi_jual'),
  kd_barang: text('kd_barang'),
  harga_modal: integer('harga_modal').default(0),
  harga_jual: integer('harga_jual').default(0),
  qty: integer('qty').default(0),
  disc: integer('disc').default(0),
  harga_disc: real('harga_disc').default(0),
  total_harga_jual: real('total_harga_jual').default(0),
  nama_pengguna: text('nama_pengguna'),
  tgl_waktu_input: text('tgl_waktu_input'),
})

export const identitas = sqliteTable('mediasoft_identitas', {
  kode: integer('kode').primaryKey(),
  namatoko: text('namatoko'),
  alamattoko: text('alamattoko'),
  nomortelptoko: text('nomortelptoko'),
  nomorwaowner: text('nomorwaowner'),
  alamatemailowner: text('alamatemailowner'),
  logo: text('logo'),
  npwp: text('npwp'),
  pajak_persen: real('pajak_persen').default(0),
  auto_barcode: integer('auto_barcode').default(1),
  barcode_prefix: text('barcode_prefix').default('POS'),
  auto_print: integer('auto_print').default(0),
  struk_footer: text('struk_footer').default('Terima kasih atas kunjungan Anda'),
  auto_backup: integer('auto_backup').default(1),
  backup_retention: integer('backup_retention').default(7),
  notif_stok: integer('notif_stok').default(1),
  min_stok: integer('min_stok').default(5),
})

export const supplier = sqliteTable('mediasoft_supplier', {
  kd_suplier: text('kd_suplier').primaryKey(),
  nama_suplier: text('nama_suplier'),
  alamat_suplier: text('alamat_suplier'),
  no_telp_hp: text('no_telp_hp'),
  tgl_wkt_simpan: text('tgl_wkt_simpan'),
  tgl_wkt_edit: text('tgl_wkt_edit'),
  nama_pengguna: text('nama_pengguna'),
  email: text('email'),
  status: text('status').default('Aktif'),
})

// NEW TABLES

export const customer = sqliteTable('mediasoft_customer', {
  kd_customer: text('kd_customer').primaryKey(),
  nama_customer: text('nama_customer').notNull(),
  no_telp: text('no_telp'),
  email: text('email'),
  alamat: text('alamat'),
  tgl_lahir: text('tgl_lahir'),
  poin: integer('poin').default(0),
  total_belanja: real('total_belanja').default(0),
  tgl_daftar: text('tgl_daftar'),
  status: text('status').default('Aktif'),
})

export const kasDrawer = sqliteTable('mediasoft_kas_drawer', {
  kd_kas: text('kd_kas').primaryKey(),
  tgl_buka: text('tgl_buka').notNull(),
  tgl_tutup: text('tgl_tutup'),
  username: text('username').notNull(),
  modal_awal: real('modal_awal').default(0),
  total_penjualan: real('total_penjualan').default(0),
  total_pemasukan: real('total_pemasukan').default(0),
  total_pengeluaran: real('total_pengeluaran').default(0),
  saldo_akhir: real('saldo_akhir').default(0),
  selisih: real('selisih').default(0),
  status: text('status').default('OPEN'), // OPEN, CLOSED
  catatan: text('catatan'),
})

export const kasTransaksi = sqliteTable('mediasoft_kas_transaksi', {
  kd_kas_transaksi: integer('kd_kas_transaksi').primaryKey({ autoIncrement: true }),
  kd_kas: text('kd_kas').notNull(),
  tgl_transaksi: text('tgl_transaksi').notNull(),
  jenis: text('jenis').notNull(), // MASUK, KELUAR
  jumlah: real('jumlah').notNull(),
  keterangan: text('keterangan'),
  username: text('username'),
})

export const notifikasi = sqliteTable('mediasoft_notifikasi', {
  kd_notifikasi: integer('kd_notifikasi').primaryKey({ autoIncrement: true }),
  judul: text('judul').notNull(),
  pesan: text('pesan').notNull(),
  jenis: text('jenis').notNull(), // STOK, EXPIRED, SYSTEM, INFO
  tgl_dibuat: text('tgl_dibuat').notNull(),
  dibaca: integer('dibaca').default(0), // 0 = belum, 1 = sudah
  username: text('username'),
  link: text('link'),
})

export const backup = sqliteTable('mediasoft_backup', {
  kd_backup: integer('kd_backup').primaryKey({ autoIncrement: true }),
  nama_file: text('nama_file').notNull(),
  ukuran: integer('ukuran'),
  tgl_backup: text('tgl_backup').notNull(),
  username: text('username'),
  keterangan: text('keterangan'),
})

export const pembelian = sqliteTable('mediasoft_pembelian', {
  kd_pembelian: text('kd_tansaksi_beli').primaryKey(),
  tgl_pembelian: text('tgl_wkt_transaksi'),
  deskripsi: text('deskripsi'),
  kd_suplier: text('kd_suplier'),
  username: text('username_transaksi'),
  total_qty: integer('total_qty').default(0),
  sub_total: real('sub_total').default(0),
  yang_dibayar: real('yang_dibayar').default(0),
  kembalian: real('kembalian').default(0),
  sisa_hutang: real('sisa_hutang').default(0),
  status: text('status').default('LUNAS'),
  catatan: text('catatan'),
})

export const pembelianDetail = sqliteTable('mediasoft_pembelian_detail', {
  kd_pembelian_detail: integer('kd_trans_beli_detail').primaryKey({ autoIncrement: true }),
  kd_pembelian: text('kd_tansaksi_beli').notNull(),
  kd_barang: text('kd_barang').notNull(),
  qty: integer('qty').default(0),
  harga_beli: integer('harga_beli').default(0),
  disc: integer('disc').default(0),
  harga_disc: real('harga_disc').default(0),
  total: real('total_harga_beli').default(0),
  nama_pengguna: text('nama_pengguna'),
  tgl_waktu_input: text('tgl_waktu_input'),
})

export const activityLog = sqliteTable('mediasoft_activity_log', {
  kd_log: integer('kd_log').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  aktivitas: text('aktivitas').notNull(),
  modul: text('modul').notNull(), // LOGIN, PRODUK, TRANSAKSI, dll
  tgl_aktivitas: text('tgl_aktivitas').notNull(),
  ip_address: text('ip_address'),
  device_id: text('device_id'),
  user_agent: text('user_agent'),
  detail: text('detail'),
  event_type: text('event_type').default('general'),
})

export const authSessions = sqliteTable('mediasoft_auth_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  token_hash: text('token_hash').notNull().unique(),
  issued_at: text('issued_at').notNull(),
  expires_at: text('expires_at').notNull(),
  revoked_at: text('revoked_at'),
  last_seen_at: text('last_seen_at'),
  ip_address: text('ip_address'),
  device_id: text('device_id'),
  device_name: text('device_name'),
  user_agent: text('user_agent'),
  platform: text('platform'),
  os_name: text('os_name'),
  app_version: text('app_version'),
  is_revoked: integer('is_revoked').default(0),
})

export const subscriptionPlans = sqliteTable('mediasoft_subscription_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  duration_days: integer('duration_days').notNull(),
  features: text('features').default('[]'), // JSON array of strings
  is_active: integer('is_active').default(1), // 1 = active, 0 = inactive
  is_recommended: integer('is_recommended').default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
  max_devices: integer('max_devices').default(1),
  max_transactions_per_day: integer('max_transactions_per_day').default(-1),
  max_products: integer('max_products').default(-1),
  max_users: integer('max_users').default(1),
  feature_flags: text('feature_flags').default('{}'), // JSON object: { "reports": true }
})

export const userDevices = sqliteTable('mediasoft_user_devices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  device_id: text('device_id').notNull(),
  device_name: text('device_name'),
  platform: text('platform'),
  os_name: text('os_name'),
  app_version: text('app_version'),
  ip_address: text('ip_address'),
  last_seen_at: text('last_seen_at'),
  first_seen_at: text('first_seen_at'),
  status: text('status').default('active').notNull(),
  revoked_at: text('revoked_at'),
  revoked_by: text('revoked_by'),
})

export const popupRules = sqliteTable('mediasoft_popup_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  cta_text: text('cta_text').default('Upgrade Sekarang'),
  cta_url: text('cta_url'),
  whatsapp_number: text('whatsapp_number'),
  pricing_html: text('pricing_html'),
  is_active: integer('is_active').default(1),
  trigger_on: text('trigger_on').default('{}'),
  updated_at: text('updated_at'),
})

export const tutorials = sqliteTable('mediasoft_tutorials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  created_at: text('created_at').notNull(),
})

export const hppCalculations = sqliteTable('mediasoft_hpp_calculations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: text('user_id').notNull(),
  nama_produk: text('nama_produk').notNull(),
  modal: real('modal').default(0),
  biaya_lain: real('biaya_lain').default(0),
  total_hpp: real('total_hpp').default(0),
  created_at: text('created_at').notNull(),
})

// --- ADVANCED FEATURES TABLES ---

export const strukSettings = sqliteTable('mediasoft_struk_settings', {
  id: integer('id').primaryKey(),
  printer_type: text('printer_type').default('thermal'),
  paper_size: text('paper_size').default('58mm'), // 58mm, 80mm
  layout_type: text('layout_type').default('classic'), // classic, modern, minimal
  show_logo: integer('show_logo').default(1),
  show_alamat: integer('show_alamat').default(1),
  show_telepon: integer('show_telepon').default(1),
  show_email: integer('show_email').default(1),
  show_kasir: integer('show_kasir').default(1),
  show_customer: integer('show_customer').default(1),
  footer_text: text('footer_text').default('Terima kasih atas kunjungan Anda'),
  qris_image: text('qris_image'),
  qris_enabled: integer('qris_enabled').default(0),
  updated_at: text('updated_at'),
})

export const currencies = sqliteTable('mediasoft_currencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(), // USD, EUR, IDR
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  exchange_rate: real('exchange_rate').default(1),
  is_default: integer('is_default').default(0),
  is_active: integer('is_active').default(1),
  created_at: text('created_at').notNull(),
})

export const barangBatches = sqliteTable('mediasoft_barang_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_barang: text('kd_barang').notNull(),
  batch_no: text('batch_no').notNull(),
  stok: integer('stok').default(0),
  expired_date: text('expired_date'),
  warehouse_id: integer('warehouse_id'),
  created_at: text('created_at').notNull(),
})

export const barangSerials = sqliteTable('mediasoft_barang_serials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_barang: text('kd_barang').notNull(),
  serial_no: text('serial_no').notNull(),
  status: text('status').default('AVAILABLE'), // AVAILABLE, SOLD, RETURNED
  warehouse_id: integer('warehouse_id'),
  created_at: text('created_at').notNull(),
})

export const warehouses = sqliteTable('mediasoft_warehouses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  location: text('location'),
  is_active: integer('is_active').default(1),
  created_at: text('created_at').notNull(),
})

export const stockTransfers = sqliteTable('mediasoft_stock_transfers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_barang: text('kd_barang').notNull(),
  from_warehouse_id: integer('from_warehouse_id').notNull(),
  to_warehouse_id: integer('to_warehouse_id').notNull(),
  qty: integer('qty').default(0),
  username: text('username').notNull(),
  created_at: text('created_at').notNull(),
})

export const promos = sqliteTable('mediasoft_promos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // PERCENTAGE, FIXED, BUY_X_GET_Y, BUNDLE, HAPPY_HOUR
  value: real('value').default(0),
  min_purchase: real('min_purchase').default(0),
  max_discount: real('max_discount'),
  start_date: text('start_date'),
  end_date: text('end_date'),
  start_time: text('start_time'), // For happy hour
  end_time: text('end_time'), // For happy hour
  usage_limit: integer('usage_limit'),
  usage_count: integer('usage_count').default(0),
  is_active: integer('is_active').default(1),
  conditions: text('conditions'), // JSON
  created_at: text('created_at').notNull(),
})

export const auditTrail = sqliteTable('mediasoft_audit_trail', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  action: text('action').notNull(),
  table_name: text('table_name'),
  record_id: text('record_id'),
  old_values: text('old_values'), // JSON
  new_values: text('new_values'), // JSON
  ip_address: text('ip_address'),
  created_at: text('created_at').notNull(),
})

// ─── HR & EMPLOYEE ───────────────────────────────────────────────────

export const employees = sqliteTable('mediasoft_employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nik: text('nik').notNull().unique(),
  nama_lengkap: text('nama_lengkap').notNull(),
  tempat_lahir: text('tempat_lahir'),
  tgl_lahir: text('tgl_lahir'),
  jenis_kelamin: text('jenis_kelamin'), // L, P
  alamat: text('alamat'),
  no_telp: text('no_telp'),
  email: text('email'),
  agama: text('agama'),
  status_perkawinan: text('status_perkawinan'), // BELUM_MENIKAH, MENIKAH, CERAI
  pendidikan_terakhir: text('pendidikan_terakhir'),
  jurusan: text('jurusan'),
  nama_ibu: text('nama_ibu'),
  no_rekening: text('no_rekening'),
  bank: text('bank'),
  bpjs_kesehatan: text('bpjs_kesehatan'),
  bpjs_ketenagakerjaan: text('bpjs_ketenagakerjaan'),
  npwp: text('npwp'),
  tgl_masuk: text('tgl_masuk').notNull(),
  tgl_keluar: text('tgl_keluar'),
  status_karyawan: text('status_karyawan').default('AKTIF'), // AKTIF, RESIGN, PHK, CUTI
  jabatan: text('jabatan'),
  departemen: text('departemen'),
  gaji_pokok: real('gaji_pokok').default(0),
  tunjangan: real('tunjangan').default(0),
  jam_kerja_per_hari: real('jam_kerja_per_hari').default(8),
  foto: text('foto'),
  catatan: text('catatan'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

export const employeeContracts = sqliteTable('mediasoft_employee_contracts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employee_id: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  nomor_kontrak: text('nomor_kontrak').notNull().unique(),
  jenis_kontrak: text('jenis_kontrak').notNull(), // PKWT, PKWTT, MAGANG, PROYEK
  tgl_mulai: text('tgl_mulai').notNull(),
  tgl_berakhir: text('tgl_berakhir'),
  durasi_bulan: integer('durasi_bulan'),
  jabatan: text('jabatan').notNull(),
  departemen: text('departemen'),
  gaji_pokok: real('gaji_pokok').default(0),
  tunjangan: real('tunjangan').default(0),
  uang_makan: real('uang_makan').default(0),
  uang_transport: real('uang_transport').default(0),
  jam_kerja: text('jam_kerja'), // JSON: {senin: {start: "08:00", end: "17:00"}, ...}
  hari_kerja: text('hari_kerja'), // JSON: ["senin","selasa","rabu","kamis","jumat"]
  hak_cuti_tahunan: integer('hak_cuti_tahunan').default(12),
  masa_percobaan_bulan: integer('masa_percobaan_bulan').default(3),
  status: text('status').default('AKTIF'), // AKTIF, BERAKHIR, DIPUTUS, DIPERBARUI
  lampiran: text('lampiran'), // path to file
  catatan: text('catatan'),
  dibuat_oleh: text('dibuat_oleh'),
  tgl_dibuat: text('tgl_dibuat').notNull(),
  diperbarui_oleh: text('diperbarui_oleh'),
  tgl_diperbarui: text('tgl_diperbarui'),
})

export const attendance = sqliteTable('mediasoft_attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employee_id: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  tgl: text('tgl').notNull(),
  jam_masuk: text('jam_masuk'),
  jam_keluar: text('jam_keluar'),
  lokasi_masuk: text('lokasi_masuk'),
  lokasi_keluar: text('lokasi_keluar'),
  foto_masuk: text('foto_masuk'),
  foto_keluar: text('foto_keluar'),
  status: text('status').default('HADIR'), // HADIR, IZIN, SAKIT, CUTI, ALPA, TERLAMBAT
  keterlambatan_menit: integer('keterlambatan_menit').default(0),
  catatan: text('catatan'),
  approved_by: text('approved_by'),
  created_at: text('created_at').notNull(),
})

export const payroll = sqliteTable('mediasoft_payroll', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employee_id: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  periode_bulan: integer('periode_bulan').notNull(), // 1-12
  periode_tahun: integer('periode_tahun').notNull(),
  gaji_pokok: real('gaji_pokok').default(0),
  tunjangan: real('tunjangan').default(0),
  uang_makan: real('uang_makan').default(0),
  uang_transport: real('uang_transport').default(0),
  lembur: real('lembur').default(0),
  bonus: real('bonus').default(0),
  komisi: real('komisi').default(0),
  potongan: real('potongan').default(0), // JSON: keterlambatan, dll
  potongan_bpjs: real('potongan_bpjs').default(0),
  potongan_pph: real('potongan_pph').default(0),
  potongan_lain: real('potongan_lain').default(0),
  total_gaji: real('total_gaji').default(0),
  tgl_bayar: text('tgl_bayar'),
  metode_bayar: text('metode_bayar'), // TUNAI, TRANSFER
  status: text('status').default('DRAFT'), // DRAFT, DISETUJUI, DIBAYAR
  catatan: text('catatan'),
  dibuat_oleh: text('dibuat_oleh'),
  tgl_dibuat: text('tgl_dibuat').notNull(),
  disetujui_oleh: text('disetujui_oleh'),
  tgl_disetujui: text('tgl_disetujui'),
  dibayar_oleh: text('dibayar_oleh'),
  tgl_dibayar: text('tgl_dibayar'),
})

export const payrollDetails = sqliteTable('mediasoft_payroll_details', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  payroll_id: integer('payroll_id').notNull().references(() => payroll.id, { onDelete: 'cascade' }),
  komponen: text('komponen').notNull(), // Gaji Pokok, Tunjangan, Lembur, dll
  tipe: text('tipe').notNull(), // PENAMBAH, PENGURANG
  jumlah: real('jumlah').default(0),
  keterangan: text('keterangan'),
})

export const tipPooling = sqliteTable('mediasoft_tip_pooling', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgl: text('tgl').notNull(),
  total_tip: real('total_tip').default(0),
  jumlah_karyawan: integer('jumlah_karyawan').default(0),
  tip_per_orang: real('tip_per_orang').default(0),
  status: text('status').default('DRAFT'), // DRAFT, DIDISTRIBUSI
  catatan: text('catatan'),
  dibuat_oleh: text('dibuat_oleh'),
  tgl_dibuat: text('tgl_dibuat').notNull(),
})

export const tipDistribution = sqliteTable('mediasoft_tip_distribution', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tip_pooling_id: integer('tip_pooling_id').notNull().references(() => tipPooling.id, { onDelete: 'cascade' }),
  employee_id: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  jumlah: real('jumlah').default(0),
  persentase: real('persentase').default(0),
  catatan: text('catatan'),
})

export const shiftSchedules = sqliteTable('mediasoft_shift_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employee_id: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  tgl: text('tgl').notNull(),
  shift: text('shift').notNull(), // PAGI, SIANG, MALAM, CUSTOM
  jam_masuk: text('jam_masuk').notNull(),
  jam_keluar: text('jam_keluar').notNull(),
  catatan: text('catatan'),
  dibuat_oleh: text('dibuat_oleh'),
  tgl_dibuat: text('tgl_dibuat').notNull(),
})

// ─── KITCHEN DISPLAY SYSTEM ──────────────────────────────────────────

export const kdsOrders = sqliteTable('mediasoft_kds_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_transaksi: text('kd_transaksi').notNull().references(() => penjualan.kd_tansaksi_jual, { onDelete: 'cascade' }),
  nomor_meja: text('nomor_meja'),
  nomor_antrian: integer('nomor_antrian'),
  status: text('status').default('BARU'), // BARU, DIMASAK, SIAP, DISAJIKAN, SELESAI
  prioritas: integer('prioritas').default(0), // 0=normal, 1=tinggi
  catatan: text('catatan'),
  nama_pelanggan: text('nama_pelanggan'),
  jenis_order: text('jenis_order').default('DINE_IN'), // DINE_IN, TAKE_AWAY, DELIVERY
  waktu_masuk: text('waktu_masuk').notNull(),
  waktu_mulai_masak: text('waktu_mulai_masak'),
  waktu_selesai: text('waktu_selesai'),
  waktu_siap: text('waktu_siap'),
  waktu_disajikan: text('waktu_disajikan'),
  dapur: text('dapur'), // HOT_KITCHEN, COLD_KITCHEN, PASTRY, BAR
  dibuat_oleh: text('dibuat_oleh'),
})

export const kdsOrderItems = sqliteTable('mediasoft_kds_order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kds_order_id: integer('kds_order_id').notNull().references(() => kdsOrders.id, { onDelete: 'cascade' }),
  kd_barang: text('kd_barang').notNull(),
  nama_item: text('nama_item').notNull(),
  qty: integer('qty').default(1),
  catatan: text('catatan'),
  status: text('status').default('BARU'), // BARU, DIMASAK, SIAP, DISAJIKAN
  waktu_mulai_masak: text('waktu_mulai_masak'),
  waktu_selesai: text('waktu_selesai'),
})

// ─── TABLE MANAGEMENT ────────────────────────────────────────────────

export const floorLayouts = sqliteTable('mediasoft_floor_layouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama: text('nama').notNull(),
  kapasitas: integer('kapasitas').default(0),
  width: integer('width').default(800),
  height: integer('height').default(600),
  is_active: integer('is_active').default(1),
  created_at: text('created_at').notNull(),
})

export const tables = sqliteTable('mediasoft_tables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  floor_layout_id: integer('floor_layout_id').references(() => floorLayouts.id, { onDelete: 'set null' }),
  nomor_meja: text('nomor_meja').notNull(),
  label: text('label'), // misal: "Meja VIP 1"
  kapasitas: integer('kapasitas').default(4),
  posisi_x: real('posisi_x').default(0),
  posisi_y: real('posisi_y').default(0),
  bentuk: text('bentuk').default('persegi'), // persegi, bundar
  lebar: integer('lebar').default(60),
  tinggi: integer('tinggi').default(60),
  status: text('status').default('KOSONG'), // KOSONG, TERISI, RESERVASI, MAINTENANCE
  qr_code: text('qr_code'),
  catatan: text('catatan'),
  created_at: text('created_at').notNull(),
})

// ─── RESERVATION / BOOKING ──────────────────────────────────────────

export const reservations = sqliteTable('mediasoft_reservations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nomor_reservasi: text('nomor_reservasi').notNull().unique(),
  nama_pelanggan: text('nama_pelanggan').notNull(),
  no_telp: text('no_telp'),
  email: text('email'),
  jumlah_tamu: integer('jumlah_tamu').default(1),
  tgl_reservasi: text('tgl_reservasi').notNull(),
  jam_reservasi: text('jam_reservasi').notNull(),
  jam_berakhir: text('jam_berakhir'),
  table_id: integer('table_id').references(() => tables.id, { onDelete: 'set null' }),
  catatan: text('catatan'),
  status: text('status').default('MENUNGGU'), // MENUNGGU, KONFIRMASI, HADIR, BATAL, SELESAI
  sumber: text('sumber').default('MANUAL'), // MANUAL, ONLINE, WHATSAPP
  deposit: real('deposit').default(0),
  dibuat_oleh: text('dibuat_oleh'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

// ─── RECIPE / BOM ───────────────────────────────────────────────────

export const recipes = sqliteTable('mediasoft_recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_barang: text('kd_barang').notNull().references(() => barang.kd_barang, { onDelete: 'cascade' }),
  nama_resep: text('nama_resep').notNull(),
  hasil_produksi: integer('hasil_produksi').default(1), // berapa unit yang dihasilkan
  satuan_hasil: text('satuan_hasil'),
  biaya_produksi: real('biaya_produksi').default(0),
  harga_jual: real('harga_jual').default(0),
  margin: real('margin').default(0),
  petunjuk: text('petunjuk'), // instruksi langkah demi langkah
  waktu_produksi_menit: integer('waktu_produksi_menit'),
  kategori: text('kategori'), // MAKANAN, MINUMAN, SNACK, LAINNYA
  is_active: integer('is_active').default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

export const recipeIngredients = sqliteTable('mediasoft_recipe_ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recipe_id: integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  kd_barang: text('kd_barang').notNull().references(() => barang.kd_barang, { onDelete: 'cascade' }), // bahan baku
  nama_bahan: text('nama_bahan').notNull(),
  qty: real('qty').default(0),
  satuan: text('satuan'),
  harga_per_unit: real('harga_per_unit').default(0),
  sub_total: real('sub_total').default(0),
  persentase_terpakai: real('persentase_terpakai').default(100), // waste %
})

// ─── DELIVERY / LOGISTICS ───────────────────────────────────────────

export const deliveryOrders = sqliteTable('mediasoft_delivery_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nomor_delivery: text('nomor_delivery').notNull().unique(),
  kd_transaksi: text('kd_transaksi').references(() => penjualan.kd_tansaksi_jual, { onDelete: 'set null' }),
  nama_penerima: text('nama_penerima').notNull(),
  no_telp_penerima: text('no_telp_penerima'),
  alamat: text('alamat').notNull(),
  catatan_alamat: text('catatan_alamat'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  jarak_km: real('jarak_km'),
  biaya_ongkir: real('biaya_ongkir').default(0),
  status: text('status').default('MENUNGGU'), // MENUNGGU, DIPROSES, DIANTAR, TERKIRIM, GAGAL
  kurir: text('kurir'),
  estimasi_sampai: text('estimasi_sampai'),
  tgl_diantar: text('tgl_diantar'),
  tgl_sampai: text('tgl_sampai'),
  bukti_foto: text('bukti_foto'),
  tanda_tangan: text('tanda_tangan'),
  catatan: text('catatan'),
  dibuat_oleh: text('dibuat_oleh'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

export const deliveryVehicles = sqliteTable('mediasoft_delivery_vehicles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama_kendaraan: text('nama_kendaraan').notNull(),
  plat_nomor: text('plat_nomor').notNull(),
  jenis: text('jenis'), // MOTOR, MOBIL, PICKUP, TRUK
  kapasitas_maks: real('kapasitas_maks'),
  biaya_per_km: real('biaya_per_km').default(0),
  status: text('status').default('TERSEDIA'), // TERSEDIA, DIGUNAKAN, SERVICE
  created_at: text('created_at').notNull(),
})

// ─── BANK RECONCILIATION ────────────────────────────────────────────

export const bankAccounts = sqliteTable('mediasoft_bank_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama_bank: text('nama_bank').notNull(),
  nomor_rekening: text('nomor_rekening').notNull(),
  atas_nama: text('atas_nama'),
  saldo_awal: real('saldo_awal').default(0),
  saldo_saat_ini: real('saldo_saat_ini').default(0),
  mata_uang: text('mata_uang').default('IDR'),
  is_active: integer('is_active').default(1),
  created_at: text('created_at').notNull(),
})

export const bankTransactions = sqliteTable('mediasoft_bank_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bank_account_id: integer('bank_account_id').notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  tgl: text('tgl').notNull(),
  jenis: text('jenis').notNull(), // DEBIT, KREDIT
  jumlah: real('jumlah').notNull(),
  keterangan: text('keterangan'),
  kategori: text('kategori'), // SETORAN, PENARIKAN, TRANSFER, BIAYA_ADMIN, BUNGA
  referensi: text('referensi'),
  is_reconciled: integer('is_reconciled').default(0),
  tgl_rekonsiliasi: text('tgl_rekonsiliasi'),
  created_at: text('created_at').notNull(),
})

export const reconciliation = sqliteTable('mediasoft_reconciliation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bank_account_id: integer('bank_account_id').notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  periode_bulan: integer('periode_bulan').notNull(),
  periode_tahun: integer('periode_tahun').notNull(),
  saldo_buku: real('saldo_buku').default(0),
  saldo_bank: real('saldo_bank').default(0),
  selisih: real('selisih').default(0),
  status: text('status').default('DRAFT'), // DRAFT, COCOK, TIDAK_COCOK
  catatan: text('catatan'),
  tgl_rekonsiliasi: text('tgl_rekonsiliasi'),
  dibuat_oleh: text('dibuat_oleh'),
  created_at: text('created_at').notNull(),
})

// ─── FIXED ASSETS ───────────────────────────────────────────────────

export const fixedAssets = sqliteTable('mediasoft_fixed_assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kode_aset: text('kode_aset').notNull().unique(),
  nama_aset: text('nama_aset').notNull(),
  kategori: text('kategori'), // TANAH, BANGUNAN, KENDARAAN, PERALATAN, ELEKTRONIK, FURNITURE, LAINNYA
  deskripsi: text('deskripsi'),
  tgl_perolehan: text('tgl_perolehan').notNull(),
  harga_perolehan: real('harga_perolehan').default(0),
  nilai_residu: real('nilai_residu').default(0),
  masa_manfaat_tahun: integer('masa_manfaat_tahun').default(5),
  metode_penyusutan: text('metode_penyusutan').default('GARIS_LURUS'), // GARIS_LURUS, SALDO_MENURUN
  nilai_buku: real('nilai_buku').default(0),
  akumulasi_penyusutan: real('akumulasi_penyusutan').default(0),
  lokasi: text('lokasi'),
  penanggung_jawab: text('penanggung_jawab'),
  status: text('status').default('AKTIF'), // AKTIF, DISEWAKAN, PERBAIKAN, DIHAPUSKAN, TERJUAL
  foto: text('foto'),
  catatan: text('catatan'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

export const assetDepreciation = sqliteTable('mediasoft_asset_depreciation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  asset_id: integer('asset_id').notNull().references(() => fixedAssets.id, { onDelete: 'cascade' }),
  periode_bulan: integer('periode_bulan').notNull(),
  periode_tahun: integer('periode_tahun').notNull(),
  nilai_awal: real('nilai_awal').default(0),
  beban_penyusutan: real('beban_penyusutan').default(0),
  akumulasi: real('akumulasi').default(0),
  nilai_akhir: real('nilai_akhir').default(0),
  tgl_dibuat: text('tgl_dibuat').notNull(),
})

// ─── BUDGETING ──────────────────────────────────────────────────────

export const budgets = sqliteTable('mediasoft_budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama: text('nama').notNull(),
  kategori: text('kategori'), // OPERASIONAL, PEMASARAN, GAJI, INVESTASI, LAINNYA
  periode_bulan: integer('periode_bulan'),
  periode_tahun: integer('periode_tahun').notNull(),
  jumlah_anggaran: real('jumlah_anggaran').default(0),
  jumlah_terealisasi: real('jumlah_terealisasi').default(0),
  selisih: real('selisih').default(0),
  catatan: text('catatan'),
  status: text('status').default('AKTIF'), // AKTIF, TERCAPAI, MELEBIHI
  dibuat_oleh: text('dibuat_oleh'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

// ─── GIFT CARD ──────────────────────────────────────────────────────

export const giftCards = sqliteTable('mediasoft_gift_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kode: text('kode').notNull().unique(),
  nominal: real('nominal').default(0),
  saldo: real('saldo').default(0),
  pembeli: text('pembeli'),
  penerima: text('penerima'),
  pesan: text('pesan'),
  masa_berlaku: text('masa_berlaku'),
  status: text('status').default('AKTIF'), // AKTIF, TERPAKAI, EXPIRED, DICAIRKAN
  tgl_dibeli: text('tgl_dibeli'),
  tgl_digunakan: text('tgl_digunakan'),
  dibuat_oleh: text('dibuat_oleh'),
  created_at: text('created_at').notNull(),
})

export const giftCardUsage = sqliteTable('mediasoft_gift_card_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gift_card_id: integer('gift_card_id').notNull().references(() => giftCards.id, { onDelete: 'cascade' }),
  kd_transaksi: text('kd_transaksi'),
  jumlah: real('jumlah').default(0),
  sisa_saldo: real('sisa_saldo').default(0),
  tgl: text('tgl').notNull(),
})

// ─── CUSTOMER FEEDBACK ──────────────────────────────────────────────

export const customerFeedback = sqliteTable('mediasoft_customer_feedback', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_customer: text('kd_customer'),
  nama: text('nama').notNull(),
  kd_transaksi: text('kd_transaksi'),
  rating: integer('rating').default(5), // 1-5
  kategori: text('kategori'), // PELAYANAN, PRODUK, KEBERSIHAN, HARGA, LAINNYA
  pesan: text('pesan'),
  status: text('status').default('BARU'), // BARU, DIBACA, DIBALAS
  dibalas_oleh: text('dibalas_oleh'),
  balasan: text('balasan'),
  tgl_dibuat: text('tgl_dibuat').notNull(),
})

// ─── EMAIL/SMS CAMPAIGN ─────────────────────────────────────────────

export const campaigns = sqliteTable('mediasoft_campaigns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama: text('nama').notNull(),
  tipe: text('tipe').notNull(), // EMAIL, SMS, WHATSAPP
  subjek: text('subjek'),
  konten: text('konten').notNull(),
  target: text('target'), // SEMUA, PELANGGAN_AKTIF, PELANGGAN_NONAKTIF, KUSTOM
  target_kustom: text('target_kustom'), // JSON: list customer IDs
  status: text('status').default('DRAFT'), // DRAFT, TERJADWAL, TERKIRIM, GAGAL
  tgl_terjadwal: text('tgl_terjadwal'),
  tgl_terkirim: text('tgl_terkirim'),
  total_target: integer('total_target').default(0),
  total_terkirim: integer('total_terkirim').default(0),
  total_gagal: integer('total_gagal').default(0),
  total_dibuka: integer('total_dibuka').default(0),
  dibuat_oleh: text('dibuat_oleh'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

export const campaignLogs = sqliteTable('mediasoft_campaign_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  campaign_id: integer('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  kd_customer: text('kd_customer'),
  no_telp: text('no_telp'),
  email: text('email'),
  status: text('status'), // TERKIRIM, GAGAL, DIBUKA, DIKLIK
  tgl: text('tgl').notNull(),
  error_message: text('error_message'),
})

// ─── VENDOR PORTAL ──────────────────────────────────────────────────

export const vendorPortalSettings = sqliteTable('mediasoft_vendor_portal_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplier_id: text('supplier_id').notNull(),
  portal_enabled: integer('portal_enabled').default(1),
  token: text('token'),
  dapat_melihat_po: integer('dapat_melihat_po').default(1),
  dapat_mengirim_invoice: integer('dapat_mengirim_invoice').default(1),
  dapat_melihat_status: integer('dapat_melihat_status').default(1),
  created_at: text('created_at').notNull(),
})

// ─── ONLINE STOREFRONT ──────────────────────────────────────────────

export const storefrontSettings = sqliteTable('mediasoft_storefront_settings', {
  id: integer('id').primaryKey(),
  domain: text('domain'),
  nama_toko: text('nama_toko'),
  deskripsi: text('deskripsi'),
  logo: text('logo'),
  warna_utama: text('warna_utama').default('#6366f1'),
  meta_tags: text('meta_tags'),
  google_analytics: text('google_analytics'),
  is_active: integer('is_active').default(0),
  metode_pengiriman: text('metode_pengiriman'), // JSON
  metode_pembayaran: text('metode_pembayaran'), // JSON
  kebijakan_privacy: text('kebijakan_privacy'),
  syarat_ketentuan: text('syarat_ketentuan'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

export const storefrontProducts = sqliteTable('mediasoft_storefront_products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_barang: text('kd_barang').notNull().references(() => barang.kd_barang, { onDelete: 'cascade' }),
  tampilkan: integer('tampilkan').default(1),
  harga_online: real('harga_online'),
  stok_online: integer('stok_online'),
  foto_tambahan: text('foto_tambahan'), // JSON
  deskripsi_online: text('deskripsi_online'),
  seo_title: text('seo_title'),
  seo_description: text('seo_description'),
  created_at: text('created_at').notNull(),
})

export const storefrontOrders = sqliteTable('mediasoft_storefront_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nomor_order: text('nomor_order').notNull().unique(),
  nama_pelanggan: text('nama_pelanggan').notNull(),
  email: text('email'),
  no_telp: text('no_telp'),
  alamat: text('alamat'),
  catatan: text('catatan'),
  subtotal: real('subtotal').default(0),
  ongkir: real('ongkir').default(0),
  diskon: real('diskon').default(0),
  total: real('total').default(0),
  status: text('status').default('BARU'), // BARU, DIKONFIRMASI, DIPROSES, DIKIRIM, SELESAI, BATAL
  metode_pembayaran: text('metode_pembayaran'),
  status_pembayaran: text('status_pembayaran').default('BELUM_BAYAR'), // BELUM_BAYAR, LUNAS, GAGAL, REFUND
  bukti_bayar: text('bukti_bayar'),
  kurir: text('kurir'),
  no_resi: text('no_resi'),
  kd_transaksi: text('kd_transaksi'), // linked to POS transaction
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

// ─── DOCUMENT MANAGEMENT ────────────────────────────────────────────

export const documents = sqliteTable('mediasoft_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nomor_dokumen: text('nomor_dokumen'),
  nama: text('nama').notNull(),
  tipe: text('tipe').notNull(), // KONTRAK, INVOICE, NOTA, LAPORAN, LAINNYA
  kategori: text('kategori'),
  file_path: text('file_path'),
  file_size: integer('file_size'),
  file_type: text('file_type'),
  catatan: text('catatan'),
  tags: text('tags'), // JSON
  status: text('status').default('AKTIF'),
  dibuat_oleh: text('dibuat_oleh'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

// ─── DEMAND FORECASTING ─────────────────────────────────────────────

export const forecastSettings = sqliteTable('mediasoft_forecast_settings', {
  id: integer('id').primaryKey(),
  metode: text('metode').default('MOVING_AVERAGE'), // MOVING_AVERAGE, EXPONENTIAL, TREND
  periode_hari: integer('periode_hari').default(30),
  periode_data: integer('periode_data').default(90), // data historis yang digunakan
  is_active: integer('is_active').default(0),
  updated_at: text('updated_at'),
})

export const forecastResults = sqliteTable('mediasoft_forecast_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kd_barang: text('kd_barang').notNull().references(() => barang.kd_barang, { onDelete: 'cascade' }),
  tgl_forecast: text('tgl_forecast').notNull(),
  prediksi_penjualan: real('prediksi_penjualan').default(0),
  confidence_lower: real('confidence_lower').default(0),
  confidence_upper: real('confidence_upper').default(0),
  metode: text('metode'),
  tgl_dibuat: text('tgl_dibuat').notNull(),
})

// ─── DYNAMIC PRICING ────────────────────────────────────────────────

export const dynamicPricingRules = sqliteTable('mediasoft_dynamic_pricing_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama: text('nama').notNull(),
  kd_barang: text('kd_barang').references(() => barang.kd_barang, { onDelete: 'set null' }),
  kategori_id: integer('kategori_id'),
  tipe: text('tipe').notNull(), // PERSENTASE, NOMINAL, HARGA_TETAP
  nilai: real('nilai').default(0),
  kondisi: text('kondisi'), // JSON: {waktu, stok, hari, jam}
  prioritas: integer('prioritas').default(0),
  is_active: integer('is_active').default(1),
  tgl_mulai: text('tgl_mulai'),
  tgl_berakhir: text('tgl_berakhir'),
  created_at: text('created_at').notNull(),
})
