// Complete base schema and reference seeds for WariPOS
// Ensures that a fresh clone without an existing database file initializes all tables.

export const BASE_SCHEMA_SQL: string = `
CREATE TABLE IF NOT EXISTS mediasoft_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      normal_balance TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_activity_log (
    kd_log INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    aktivitas TEXT NOT NULL,
    modul TEXT NOT NULL,
    tgl_aktivitas TEXT NOT NULL,
    ip_address TEXT,
    detail TEXT
, device_id TEXT, user_agent TEXT, event_type TEXT DEFAULT 'general', created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_app_update_rules (
            id TEXT PRIMARY KEY,
            platform TEXT,
            latest_version TEXT,
            minimum_version TEXT,
            release_notes TEXT,
            download_url TEXT,
            mode TEXT,
            is_active INTEGER,
            updated_at TEXT
          );
CREATE TABLE IF NOT EXISTS mediasoft_app_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    release_notes TEXT,
    download_url TEXT,
    is_critical INTEGER DEFAULT 0,
    released_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mediasoft_asset_depreciation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      periode_bulan INTEGER NOT NULL,
      periode_tahun INTEGER NOT NULL,
      nilai_awal REAL DEFAULT 0,
      beban_penyusutan REAL DEFAULT 0,
      akumulasi REAL DEFAULT 0,
      nilai_akhir REAL DEFAULT 0,
      tgl_dibuat TEXT NOT NULL
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      tgl TEXT NOT NULL,
      jam_masuk TEXT,
      jam_keluar TEXT,
      lokasi_masuk TEXT,
      lokasi_keluar TEXT,
      foto_masuk TEXT,
      foto_keluar TEXT,
      status TEXT DEFAULT 'HADIR',
      keterlambatan_menit INTEGER DEFAULT 0,
      catatan TEXT,
      approved_by TEXT,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_auth_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        last_seen_at TEXT,
        ip_address TEXT,
        device_id TEXT,
        device_name TEXT,
        user_agent TEXT
      , platform TEXT DEFAULT NULL, os_name TEXT DEFAULT NULL, app_version TEXT DEFAULT NULL, is_revoked INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS mediasoft_backup (
    kd_backup INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_file TEXT NOT NULL,
    ukuran INTEGER,
    tgl_backup TEXT NOT NULL,
    username TEXT,
    keterangan TEXT
, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_bank TEXT NOT NULL,
      nomor_rekening TEXT NOT NULL,
      atas_nama TEXT,
      saldo_awal REAL DEFAULT 0,
      saldo_saat_ini REAL DEFAULT 0,
      mata_uang TEXT DEFAULT 'IDR',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_account_id INTEGER NOT NULL,
      tgl TEXT NOT NULL,
      jenis TEXT NOT NULL,
      jumlah REAL NOT NULL,
      keterangan TEXT,
      kategori TEXT,
      referensi TEXT,
      is_reconciled INTEGER DEFAULT 0,
      tgl_rekonsiliasi TEXT,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_barang (kd_barang VARCHAR (25) NOT NULL PRIMARY KEY, nama_barang VARCHAR (150), tgl_wkt_simpan DATETIME, tgl_wkt_ubah DATETIME, foto_barang VARCHAR (255), deskripsi_barang VARCHAR (255), nama_pengguna VARCHAR (50), stok INTEGER DEFAULT (0), kd_satuan INTEGER DEFAULT (0), jenis_transaksi VARCHAR (7) DEFAULT INCOME, kd_kategori_barang INTEGER DEFAULT (0), stok_minimum INTEGER DEFAULT 5, barcode TEXT, expired_date TEXT, batch_number TEXT, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_barang_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      stok INTEGER DEFAULT 0,
      expired_date TEXT,
      warehouse_id INTEGER,
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_barang_serials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      serial_no TEXT NOT NULL,
      status TEXT DEFAULT 'AVAILABLE',
      warehouse_id INTEGER,
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_barcode_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT DEFAULT 'MS',
    next_number INTEGER DEFAULT 1,
    length INTEGER DEFAULT 13,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mediasoft_branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        is_warehouse INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kategori TEXT,
      periode_bulan INTEGER,
      periode_tahun INTEGER NOT NULL,
      jumlah_anggaran REAL DEFAULT 0,
      jumlah_terealisasi REAL DEFAULT 0,
      selisih REAL DEFAULT 0,
      catatan TEXT,
      status TEXT DEFAULT 'AKTIF',
      dibuat_oleh TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_campaign_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      kd_customer TEXT,
      no_telp TEXT,
      email TEXT,
      status TEXT,
      tgl TEXT NOT NULL,
      error_message TEXT
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      tipe TEXT NOT NULL,
      subjek TEXT,
      konten TEXT NOT NULL,
      target TEXT,
      target_kustom TEXT,
      status TEXT DEFAULT 'DRAFT',
      tgl_terjadwal TEXT,
      tgl_terkirim TEXT,
      total_target INTEGER DEFAULT 0,
      total_terkirim INTEGER DEFAULT 0,
      total_gagal INTEGER DEFAULT 0,
      total_dibuka INTEGER DEFAULT 0,
      dibuat_oleh TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      exchange_rate REAL DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_customer (
    kd_customer TEXT PRIMARY KEY NOT NULL,
    nama_customer TEXT NOT NULL,
    no_telp TEXT,
    email TEXT,
    alamat TEXT,
    tgl_lahir TEXT,
    poin INTEGER DEFAULT 0,
    total_belanja REAL DEFAULT 0,
    tgl_daftar TEXT,
    status TEXT DEFAULT 'Aktif'
, tier_id INTEGER DEFAULT 1, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_customer_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_customer TEXT,
      nama TEXT NOT NULL,
      kd_transaksi TEXT,
      rating INTEGER DEFAULT 5,
      kategori TEXT,
      pesan TEXT,
      status TEXT DEFAULT 'BARU',
      dibalas_oleh TEXT,
      balasan TEXT,
      tgl_dibuat TEXT NOT NULL
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_daily_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT NOT NULL,
        judul TEXT NOT NULL,
        isi TEXT NOT NULL,
        jenis TEXT DEFAULT 'info',
        username TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE IF NOT EXISTS mediasoft_debt_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (debt_id) REFERENCES mediasoft_debts(id),
    FOREIGN KEY (created_by) REFERENCES mediasoft_pengguna(nama_pengguna)
);
CREATE TABLE IF NOT EXISTS mediasoft_debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('HUTANG', 'PIUTANG')),
    customer_id TEXT,
    supplier_id TEXT,
    penjualan_id TEXT,
    pembelian_id TEXT,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    remaining_amount REAL NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'UNPAID' CHECK(status IN ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES mediasoft_customer(kd_customer),
    FOREIGN KEY (supplier_id) REFERENCES mediasoft_supplier(kd_suplier),
    FOREIGN KEY (penjualan_id) REFERENCES mediasoft_penjualan(kd_tansaksi_jual),
    FOREIGN KEY (pembelian_id) REFERENCES mediasoft_pembelian(kd_tansaksi_beli)
);
CREATE TABLE IF NOT EXISTS mediasoft_delivery_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_delivery TEXT NOT NULL UNIQUE,
      kd_transaksi TEXT,
      nama_penerima TEXT NOT NULL,
      no_telp_penerima TEXT,
      alamat TEXT NOT NULL,
      catatan_alamat TEXT,
      latitude REAL,
      longitude REAL,
      jarak_km REAL,
      biaya_ongkir REAL DEFAULT 0,
      status TEXT DEFAULT 'MENUNGGU',
      kurir TEXT,
      estimasi_sampai TEXT,
      tgl_diantar TEXT,
      tgl_sampai TEXT,
      bukti_foto TEXT,
      tanda_tangan TEXT,
      catatan TEXT,
      dibuat_oleh TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_delivery_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_kendaraan TEXT NOT NULL,
      plat_nomor TEXT NOT NULL,
      jenis TEXT,
      kapasitas_maks REAL,
      biaya_per_km REAL DEFAULT 0,
      status TEXT DEFAULT 'TERSEDIA',
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_dokumen TEXT,
      nama TEXT NOT NULL,
      tipe TEXT NOT NULL,
      kategori TEXT,
      file_path TEXT,
      file_size INTEGER,
      file_type TEXT,
      catatan TEXT,
      tags TEXT,
      status TEXT DEFAULT 'AKTIF',
      dibuat_oleh TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_dynamic_pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kd_barang TEXT,
      kategori_id INTEGER,
      tipe TEXT NOT NULL,
      nilai REAL DEFAULT 0,
      kondisi TEXT,
      prioritas INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      tgl_mulai TEXT,
      tgl_berakhir TEXT,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_ecommerce_api (
        id INTEGER PRIMARY KEY DEFAULT 1,
        api_key TEXT DEFAULT '',
        api_secret TEXT DEFAULT '',
        webhook_url TEXT DEFAULT '',
        enabled INTEGER DEFAULT 0,
        updated_at TEXT
      , whatsapp_number TEXT DEFAULT NULL, payment_link TEXT DEFAULT NULL, auto_activate INTEGER DEFAULT 0, activation_plan_id INTEGER DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_ecommerce_provider_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        platform TEXT DEFAULT 'woocommerce',
        store_url TEXT DEFAULT '',
        consumer_key TEXT DEFAULT '',
        consumer_secret TEXT DEFAULT '',
        enabled INTEGER DEFAULT 0,
        auto_sync INTEGER DEFAULT 0,
        interval_minutes INTEGER DEFAULT 30,
        last_sync_at TEXT,
        last_status TEXT DEFAULT 'Belum pernah sync',
        last_error TEXT DEFAULT '',
        updated_at TEXT
      );
CREATE TABLE IF NOT EXISTS mediasoft_ecommerce_sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL
      );
CREATE TABLE IF NOT EXISTS mediasoft_ecommerce_sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        next_retry_at TEXT,
        status TEXT DEFAULT 'pending',
        last_error TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
CREATE TABLE IF NOT EXISTS mediasoft_employee_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      nomor_kontrak TEXT NOT NULL UNIQUE,
      jenis_kontrak TEXT NOT NULL,
      tgl_mulai TEXT NOT NULL,
      tgl_berakhir TEXT,
      durasi_bulan INTEGER,
      jabatan TEXT NOT NULL,
      departemen TEXT,
      gaji_pokok REAL DEFAULT 0,
      tunjangan REAL DEFAULT 0,
      uang_makan REAL DEFAULT 0,
      uang_transport REAL DEFAULT 0,
      jam_kerja TEXT,
      hari_kerja TEXT,
      hak_cuti_tahunan INTEGER DEFAULT 12,
      masa_percobaan_bulan INTEGER DEFAULT 3,
      status TEXT DEFAULT 'AKTIF',
      lampiran TEXT,
      catatan TEXT,
      dibuat_oleh TEXT,
      tgl_dibuat TEXT NOT NULL,
      diperbarui_oleh TEXT,
      tgl_diperbarui TEXT
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nik TEXT NOT NULL UNIQUE,
      nama_lengkap TEXT NOT NULL,
      tempat_lahir TEXT,
      tgl_lahir TEXT,
      jenis_kelamin TEXT,
      alamat TEXT,
      no_telp TEXT,
      email TEXT,
      agama TEXT,
      status_perkawinan TEXT,
      pendidikan_terakhir TEXT,
      jurusan TEXT,
      nama_ibu TEXT,
      no_rekening TEXT,
      bank TEXT,
      bpjs_kesehatan TEXT,
      bpjs_ketenagakerjaan TEXT,
      npwp TEXT,
      tgl_masuk TEXT NOT NULL,
      tgl_keluar TEXT,
      status_karyawan TEXT DEFAULT 'AKTIF',
      jabatan TEXT,
      departemen TEXT,
      gaji_pokok REAL DEFAULT 0,
      tunjangan REAL DEFAULT 0,
      jam_kerja_per_hari REAL DEFAULT 8,
      foto TEXT,
      catatan TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    user_id TEXT,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES mediasoft_pengguna(nama_pengguna)
);
CREATE TABLE IF NOT EXISTS mediasoft_fixed_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_aset TEXT NOT NULL UNIQUE,
      nama_aset TEXT NOT NULL,
      kategori TEXT,
      deskripsi TEXT,
      tgl_perolehan TEXT NOT NULL,
      harga_perolehan REAL DEFAULT 0,
      nilai_residu REAL DEFAULT 0,
      masa_manfaat_tahun INTEGER DEFAULT 5,
      metode_penyusutan TEXT DEFAULT 'GARIS_LURUS',
      nilai_buku REAL DEFAULT 0,
      akumulasi_penyusutan REAL DEFAULT 0,
      lokasi TEXT,
      penanggung_jawab TEXT,
      status TEXT DEFAULT 'AKTIF',
      foto TEXT,
      catatan TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_floor_layouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kapasitas INTEGER DEFAULT 0,
      width INTEGER DEFAULT 800,
      height INTEGER DEFAULT 600,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_forecast_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      tgl_forecast TEXT NOT NULL,
      prediksi_penjualan REAL DEFAULT 0,
      confidence_lower REAL DEFAULT 0,
      confidence_upper REAL DEFAULT 0,
      metode TEXT,
      tgl_dibuat TEXT NOT NULL
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_forecast_settings (
      id INTEGER PRIMARY KEY,
      metode TEXT DEFAULT 'MOVING_AVERAGE',
      periode_hari INTEGER DEFAULT 30,
      periode_data INTEGER DEFAULT 90,
      is_active INTEGER DEFAULT 0,
      updated_at TEXT
    , created_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_gift_card_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gift_card_id INTEGER NOT NULL,
      kd_transaksi TEXT,
      jumlah REAL DEFAULT 0,
      sisa_saldo REAL DEFAULT 0,
      tgl TEXT NOT NULL
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_gift_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT NOT NULL UNIQUE,
      nominal REAL DEFAULT 0,
      saldo REAL DEFAULT 0,
      pembeli TEXT,
      penerima TEXT,
      pesan TEXT,
      masa_berlaku TEXT,
      status TEXT DEFAULT 'AKTIF',
      tgl_dibeli TEXT,
      tgl_digunakan TEXT,
      dibuat_oleh TEXT,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_grup_pengguna (
    nama_grup VARCHAR(50) PRIMARY KEY NOT NULL
);
CREATE TABLE IF NOT EXISTS mediasoft_grup_pengguna_hak_akses (
  nama_grup VARCHAR(50) NOT NULL,
  menu_code VARCHAR(50) NOT NULL,
  status VARCHAR(5) NOT NULL DEFAULT 'True',
  PRIMARY KEY (nama_grup, menu_code)
);
CREATE TABLE IF NOT EXISTS mediasoft_harga (kd_barang VARCHAR (25) PRIMARY KEY NOT NULL, harga_barang DOUBLE DEFAULT (0), potongan INTEGER DEFAULT (0), harga_modal DOUBLE DEFAULT (0), created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_harga_temp (kd_harga_temp INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, kd_barang VARCHAR (25), harga_barang DOUBLE DEFAULT (0), harga_modal DOUBLE DEFAULT (0), potongan INTEGER DEFAULT (0), nama_pengguna VARCHAR (50));
CREATE TABLE IF NOT EXISTS mediasoft_histori_harga (kd_histori_harga INTEGER PRIMARY KEY AUTOINCREMENT, tgl_penetappan DATETIME, kd_barang VARCHAR (25), harga_modal DOUBLE DEFAULT (0) NOT NULL, harga_jual DOUBLE NOT NULL DEFAULT (0), disc INTEGER DEFAULT (0));
CREATE TABLE IF NOT EXISTS mediasoft_historiprint_gantishift (kd_print_ganti_shift VARCHAR (25) PRIMARY KEY NOT NULL, tgl_wkt_print DATETIME, username_print VARCHAR (50));
CREATE TABLE IF NOT EXISTS mediasoft_historiprint_pemasukan (kd_print_masuk VARCHAR (25) PRIMARY KEY NOT NULL, tgl_wkt_print DATETIME, username_print VARCHAR (50), dari_tanggal DATE, sampai_tanggal DATE);
CREATE TABLE IF NOT EXISTS mediasoft_historiprint_pengeluaran (kd_print_keluar VARCHAR (25) PRIMARY KEY NOT NULL, tgl_wkt_print DATETIME, username_print VARCHAR (50), dari_tanggal DATE, sampai_tanggal DATE);
CREATE TABLE IF NOT EXISTS mediasoft_hpp_calculations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT    NOT NULL,
  nama_produk  TEXT    NOT NULL,
  modal        REAL    NOT NULL DEFAULT 0,
  biaya_lain   REAL    NOT NULL DEFAULT 0,
  total_hpp    REAL    NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS "mediasoft_identitas" (
	"kode"	INTEGER,
	"namatoko"	varchar(255),
	"alamattoko"	TEXT,
	"nomortelptoko"	TEXT,
	"nomorwaowner"	varchar(14),
	"alamatemailowner"	varchar(100), logo TEXT, npwp TEXT, pajak_persen REAL DEFAULT 0, auto_barcode INTEGER DEFAULT 1, barcode_prefix TEXT DEFAULT 'POS', auto_print INTEGER DEFAULT 0, struk_footer TEXT DEFAULT 'Terima kasih atas kunjungan Anda', auto_backup INTEGER DEFAULT 1, backup_retention INTEGER DEFAULT 7, notif_stok INTEGER DEFAULT 1, min_stok INTEGER DEFAULT 5, license_server_url TEXT, license_admin_token TEXT, license_admin_refresh_token TEXT, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL,
	PRIMARY KEY("kode")
);
CREATE TABLE IF NOT EXISTS mediasoft_industry_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      ai_enabled INTEGER DEFAULT 0,
      ai_provider TEXT DEFAULT 'local',
      ai_model TEXT DEFAULT '',
      ai_base_url TEXT DEFAULT '',
      ai_api_key TEXT DEFAULT '',
      google_sheets_enabled INTEGER DEFAULT 0,
      google_sheets_webapp_url TEXT DEFAULT '',
      auto_backup_enabled INTEGER DEFAULT 1,
      backup_retention_days INTEGER DEFAULT 30,
      updated_at TEXT
    );
CREATE TABLE IF NOT EXISTS mediasoft_journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      reference TEXT DEFAULT '',
      description TEXT NOT NULL,
      created_by TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      memo TEXT DEFAULT '',
      FOREIGN KEY(entry_id) REFERENCES mediasoft_journal_entries(id),
      FOREIGN KEY(account_id) REFERENCES mediasoft_accounts(id)
    );
CREATE TABLE IF NOT EXISTS mediasoft_kas_drawer (
    kd_kas TEXT PRIMARY KEY NOT NULL,
    tgl_buka TEXT NOT NULL,
    tgl_tutup TEXT,
    username TEXT NOT NULL,
    modal_awal REAL DEFAULT 0,
    total_penjualan REAL DEFAULT 0,
    total_pengeluaran REAL DEFAULT 0,
    saldo_akhir REAL DEFAULT 0,
    selisih REAL DEFAULT 0,
    status TEXT DEFAULT 'OPEN',
    catatan TEXT
, total_pemasukan REAL DEFAULT 0, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_kas_transaksi (
    kd_kas_transaksi INTEGER PRIMARY KEY AUTOINCREMENT,
    kd_kas TEXT NOT NULL,
    tgl_transaksi TEXT NOT NULL,
    jenis TEXT NOT NULL,
    jumlah REAL NOT NULL,
    keterangan TEXT,
    username TEXT
, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_kategori_barang (kd_kategori_barang INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, kategori_barang VARCHAR (50), created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_kds_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kds_order_id INTEGER NOT NULL,
      kd_barang TEXT NOT NULL,
      nama_item TEXT NOT NULL,
      qty INTEGER DEFAULT 1,
      catatan TEXT,
      status TEXT DEFAULT 'BARU',
      waktu_mulai_masak TEXT,
      waktu_selesai TEXT
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_kds_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_transaksi TEXT NOT NULL,
      nomor_meja TEXT,
      nomor_antrian INTEGER,
      status TEXT DEFAULT 'BARU',
      prioritas INTEGER DEFAULT 0,
      catatan TEXT,
      nama_pelanggan TEXT,
      jenis_order TEXT DEFAULT 'DINE_IN',
      waktu_masuk TEXT NOT NULL,
      waktu_mulai_masak TEXT,
      waktu_selesai TEXT,
      waktu_siap TEXT,
      waktu_disajikan TEXT,
      dapur TEXT,
      dibuat_oleh TEXT
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_loyalty_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  benefits TEXT,
  color TEXT DEFAULT '#FFD700',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mediasoft_marketplace_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      store_url TEXT DEFAULT '',
      api_key TEXT DEFAULT '',
      api_secret TEXT DEFAULT '',
      auto_sync INTEGER DEFAULT 0,
      sync_stock INTEGER DEFAULT 1,
      sync_orders INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      last_sync_at TEXT,
      last_status TEXT DEFAULT 'Belum pernah sync',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
CREATE TABLE IF NOT EXISTS mediasoft_marketplace_sku_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      local_sku TEXT NOT NULL,
      remote_sku TEXT NOT NULL,
      remote_product_id TEXT DEFAULT '',
      last_stock INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT,
      UNIQUE(channel_id, local_sku, remote_sku)
    );
CREATE TABLE IF NOT EXISTS mediasoft_marketplace_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_notification_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        stok_menipis INTEGER DEFAULT 1,
        stok_habis INTEGER DEFAULT 1,
        hutang_jatuh_tempo INTEGER DEFAULT 1,
        lisensi_expire INTEGER DEFAULT 1,
        target_penjualan INTEGER DEFAULT 0,
        min_stok INTEGER DEFAULT 5,
        notif_wa INTEGER DEFAULT 0,
        wa_number TEXT DEFAULT '',
        notif_in_app INTEGER DEFAULT 1,
        quiet_start TEXT DEFAULT '22:00',
        quiet_end TEXT DEFAULT '06:00',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE IF NOT EXISTS mediasoft_notifikasi (
    kd_notifikasi INTEGER PRIMARY KEY AUTOINCREMENT,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    jenis TEXT NOT NULL,
    tgl_dibuat TEXT NOT NULL,
    dibaca INTEGER DEFAULT 0,
    username TEXT,
    link TEXT
);
CREATE TABLE IF NOT EXISTS mediasoft_payment_details (id INTEGER PRIMARY KEY AUTOINCREMENT, penjualan_id TEXT NOT NULL, payment_method_id INTEGER NOT NULL, amount REAL NOT NULL, reference_number TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL, FOREIGN KEY (penjualan_id) REFERENCES mediasoft_penjualan(kd_tansaksi_jual) ON DELETE CASCADE, FOREIGN KEY (payment_method_id) REFERENCES mediasoft_payment_methods(id));
CREATE TABLE IF NOT EXISTS mediasoft_payment_gateway_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      provider TEXT DEFAULT 'midtrans',
      server_key TEXT DEFAULT '',
      client_key TEXT DEFAULT '',
      is_production INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 0,
      updated_at TEXT
    );
CREATE TABLE IF NOT EXISTS mediasoft_payment_method (
    kd_payment_method TEXT PRIMARY KEY NOT NULL,
    nama_method TEXT NOT NULL,
    jenis TEXT NOT NULL CHECK(jenis IN ('CASH', 'CARD', 'EWALLET', 'QRIS', 'TRANSFER', 'CREDIT')),
    status TEXT DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Nonaktif')),
    icon TEXT,
    fee_persen REAL DEFAULT 0,
    fee_fixed REAL DEFAULT 0,
    min_amount REAL DEFAULT 0,
    max_amount REAL DEFAULT 0,
    deskripsi TEXT,
    tgl_dibuat TEXT DEFAULT (datetime('now')),
    tgl_diupdate TEXT
);
CREATE TABLE IF NOT EXISTS mediasoft_payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('TUNAI', 'TRANSFER', 'KARTU', 'EWALLET', 'QRIS')),
    account_number TEXT,
    account_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_payment_qris_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        transaction_status TEXT DEFAULT '',
        qr_image_url TEXT DEFAULT '',
        transaction_id TEXT DEFAULT '',
        paid_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
CREATE TABLE IF NOT EXISTS mediasoft_payment_refund (
    kd_refund TEXT PRIMARY KEY NOT NULL,
    kd_payment_transaction TEXT NOT NULL,
    kd_transaksi_jual TEXT NOT NULL,
    jumlah_refund REAL NOT NULL,
    alasan TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED', 'COMPLETED', 'FAILED')),
    
    -- Midtrans refund
    midtrans_refund_id TEXT,
    midtrans_refund_key TEXT,
    
    -- Approval
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    tgl_request TEXT DEFAULT (datetime('now')),
    tgl_approved TEXT,
    tgl_processed TEXT,
    tgl_completed TEXT,
    
    catatan TEXT,
    
    FOREIGN KEY (kd_payment_transaction) REFERENCES mediasoft_payment_transaction(kd_payment_transaction),
    FOREIGN KEY (kd_transaksi_jual) REFERENCES mediasoft_penjualan(kd_tansaksi_jual)
);
CREATE TABLE IF NOT EXISTS mediasoft_payment_settlement (
    kd_settlement INTEGER PRIMARY KEY AUTOINCREMENT,
    tgl_settlement TEXT NOT NULL,
    tgl_mulai TEXT NOT NULL,
    tgl_selesai TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    total_transaksi INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    total_fee REAL DEFAULT 0,
    net_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    settlement_file TEXT,
    catatan TEXT,
    tgl_dibuat TEXT DEFAULT (datetime('now')),
    username TEXT
);
CREATE TABLE IF NOT EXISTS mediasoft_payment_transaction (
    kd_payment_transaction TEXT PRIMARY KEY NOT NULL,
    kd_transaksi_jual TEXT NOT NULL,
    kd_payment_method TEXT NOT NULL,
    jumlah REAL NOT NULL,
    fee REAL DEFAULT 0,
    net_amount REAL NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED')),
    
    -- Midtrans specific fields
    midtrans_order_id TEXT UNIQUE,
    midtrans_transaction_id TEXT,
    midtrans_transaction_status TEXT,
    payment_type TEXT,
    
    -- Payment details
    va_number TEXT,
    bank TEXT,
    qr_code_url TEXT,
    deeplink_url TEXT,
    
    -- Timestamps
    expired_at TEXT,
    paid_at TEXT,
    settlement_time TEXT,
    tgl_dibuat TEXT DEFAULT (datetime('now')),
    tgl_diupdate TEXT,
    
    -- Metadata
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    notes TEXT,
    
    FOREIGN KEY (kd_transaksi_jual) REFERENCES mediasoft_penjualan(kd_tansaksi_jual) ON DELETE CASCADE,
    FOREIGN KEY (kd_payment_method) REFERENCES mediasoft_payment_method(kd_payment_method)
);
CREATE TABLE IF NOT EXISTS mediasoft_payment_webhook_log (
    kd_webhook_log INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    transaction_status TEXT,
    payment_type TEXT,
    gross_amount REAL,
    signature_key TEXT,
    raw_payload TEXT, -- JSON
    tgl_received TEXT DEFAULT (datetime('now')),
    processed INTEGER DEFAULT 0,
    error_message TEXT
);
CREATE TABLE IF NOT EXISTS mediasoft_payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      periode_bulan INTEGER NOT NULL,
      periode_tahun INTEGER NOT NULL,
      gaji_pokok REAL DEFAULT 0,
      tunjangan REAL DEFAULT 0,
      uang_makan REAL DEFAULT 0,
      uang_transport REAL DEFAULT 0,
      lembur REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      komisi REAL DEFAULT 0,
      potongan REAL DEFAULT 0,
      potongan_bpjs REAL DEFAULT 0,
      potongan_pph REAL DEFAULT 0,
      potongan_lain REAL DEFAULT 0,
      total_gaji REAL DEFAULT 0,
      tgl_bayar TEXT,
      metode_bayar TEXT,
      status TEXT DEFAULT 'DRAFT',
      catatan TEXT,
      dibuat_oleh TEXT,
      tgl_dibuat TEXT NOT NULL,
      disetujui_oleh TEXT,
      tgl_disetujui TEXT,
      dibayar_oleh TEXT,
      tgl_dibayar TEXT
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_payroll_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_id INTEGER NOT NULL,
      komponen TEXT NOT NULL,
      tipe TEXT NOT NULL,
      jumlah REAL DEFAULT 0,
      keterangan TEXT
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_pembelian (kd_tansaksi_beli VARCHAR (50) PRIMARY KEY CONSTRAINT "0" NOT NULL, tgl_wkt_transaksi DATETIME, deskripsi VARCHAR (255), kd_suplier VARCHAR (50), username_transaksi VARCHAR (50), total_qty INTEGER DEFAULT (0), sub_total DOUBLE DEFAULT (0), yang_dibayar DOUBLE DEFAULT (0), kembalian DOUBLE DEFAULT (0), sisa_hutang DOUBLE DEFAULT 0, status VARCHAR(20) DEFAULT 'LUNAS', catatan TEXT, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_pembelian_detail (kd_trans_beli_detail INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, kd_tansaksi_beli VARCHAR (50) CONSTRAINT "0" NOT NULL DEFAULT (0), kd_barang VARCHAR (25), harga_beli INTEGER DEFAULT (0), qty INTEGER DEFAULT (0), disc INTEGER DEFAULT (0), harga_disc DOUBLE DEFAULT (0), total_harga_beli DOUBLE DEFAULT (0), nama_pengguna VARCHAR (50), tgl_waktu_input DATETIME, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_pengguna (nama_pengguna VARCHAR (50) NOT NULL PRIMARY KEY, kata_sandi VARCHAR (150), nama_lengkap VARCHAR (50), tgl_wkt_simpan DATETIME, tgl_wkt_edit DATETIME, status_user VARCHAR (11) DEFAULT Aktif NOT NULL, terakhir_login DATETIME, email TEXT, no_telp TEXT, password_hash_type TEXT DEFAULT 'sha1', hak_akses TEXT DEFAULT 'kasir', access_expires_at TEXT, must_change_password INTEGER DEFAULT 0, pin_hash TEXT, pin_hash_type TEXT DEFAULT 'bcrypt', pin_enabled INTEGER DEFAULT 0, subscription_plan_id INTEGER DEFAULT NULL, subscription_expires_at TEXT DEFAULT NULL, is_buyer INTEGER DEFAULT 0, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL, foto TEXT);
CREATE TABLE IF NOT EXISTS "mediasoft_pengguna_hak_akses_android" (
	"id_hak_akses"	INTEGER,
	"kd_hak"	VARCHAR(50),
	"status"	VARCHAR(5),
	"nama_pengguna"	VARCHAR(50),
	PRIMARY KEY("id_hak_akses" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS mediasoft_penjualan (kd_tansaksi_jual VARCHAR (25) PRIMARY KEY CONSTRAINT "0" NOT NULL, tgl_wkt_transaksi DATETIME, deskripsi VARCHAR (255), username_transaksi VARCHAR (50), total_qty INTEGER DEFAULT (0), sub_total DOUBLE DEFAULT (0), yang_dibayar DOUBLE DEFAULT (0), kembalian DOUBLE DEFAULT (0), jenis_pembayaran VARCHAR DEFAULT TUNAI NOT NULL, pajak REAL DEFAULT 0, kd_customer TEXT, payment_status TEXT DEFAULT 'PENDING', payment_method_used TEXT, payment_fee REAL DEFAULT 0, tax_amount REAL DEFAULT 0, discount_amount REAL DEFAULT 0, shift_id INTEGER REFERENCES mediasoft_shifts(id), branch_id INTEGER DEFAULT 1, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_penjualan_detail (kd_trans_jual_detail INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, kd_tansaksi_jual VARCHAR (25) CONSTRAINT "0" NOT NULL DEFAULT (0), kd_barang VARCHAR (25), harga_modal INTEGER DEFAULT (0), harga_jual INTEGER DEFAULT (0), qty INTEGER DEFAULT (0), disc INTEGER DEFAULT (0), harga_disc DOUBLE DEFAULT (0), total_harga_jual DOUBLE DEFAULT (0), nama_pengguna VARCHAR (50), tgl_waktu_input DATETIME, created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_penyetokkan (kd_penyetokkan VARCHAR (50) PRIMARY KEY NOT NULL, tgl_wkt_nyetok DATETIME, username_nyetok VARCHAR (50), total_inputan_nyetok INTEGER DEFAULT (0));
CREATE TABLE IF NOT EXISTS mediasoft_penyetokkan_detail (kd_nyetok_detail INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, kd_penyetokkan VARCHAR (50), kd_barang VARCHAR (25), qty INTEGER DEFAULT (0), stok_tersisa INTEGER DEFAULT (0), total_stok INTEGER DEFAULT (0), nama_pengguna VARCHAR (50), tgl_wkt_input DATETIME);
CREATE TABLE IF NOT EXISTS mediasoft_petty_cash (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT NOT NULL,
        keterangan TEXT NOT NULL,
        kategori TEXT DEFAULT 'Lainnya',
        jumlah REAL DEFAULT 0,
        jenis TEXT DEFAULT 'keluar',
        username TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE IF NOT EXISTS mediasoft_popup_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      code            TEXT NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      description     TEXT,
      cta_text        TEXT DEFAULT 'Upgrade Sekarang',
      cta_url         TEXT,
      whatsapp_number TEXT,
      pricing_html    TEXT,
      is_active       INTEGER DEFAULT 1,
      trigger_on      TEXT DEFAULT '{}',
      updated_at      TEXT DEFAULT (datetime('now'))
    , created_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL, image_url TEXT DEFAULT NULL, severity TEXT DEFAULT 'warning', dismissible INTEGER DEFAULT 1, force_popup INTEGER DEFAULT 0, force_popup_until TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barang_id TEXT NOT NULL,
    image_path TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barang_id) REFERENCES mediasoft_barang(kd_barang) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS mediasoft_promos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- PERCENTAGE, FIXED, BUY_X_GET_Y, BUNDLE
  value REAL NOT NULL,
  min_purchase REAL DEFAULT 0,
  max_discount REAL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  conditions TEXT, -- JSON
  created_at TEXT NOT NULL
, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      kd_barang TEXT NOT NULL,
      nama_bahan TEXT NOT NULL,
      qty REAL DEFAULT 0,
      satuan TEXT,
      harga_per_unit REAL DEFAULT 0,
      sub_total REAL DEFAULT 0,
      persentase_terpakai REAL DEFAULT 100
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      nama_resep TEXT NOT NULL,
      hasil_produksi INTEGER DEFAULT 1,
      satuan_hasil TEXT,
      biaya_produksi REAL DEFAULT 0,
      harga_jual REAL DEFAULT 0,
      margin REAL DEFAULT 0,
      petunjuk TEXT,
      waktu_produksi_menit INTEGER,
      kategori TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_reconciliation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_account_id INTEGER NOT NULL,
      periode_bulan INTEGER NOT NULL,
      periode_tahun INTEGER NOT NULL,
      saldo_buku REAL DEFAULT 0,
      saldo_bank REAL DEFAULT 0,
      selisih REAL DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      catatan TEXT,
      tgl_rekonsiliasi TEXT,
      dibuat_oleh TEXT,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_reservasi TEXT NOT NULL UNIQUE,
      nama_pelanggan TEXT NOT NULL,
      no_telp TEXT,
      email TEXT,
      jumlah_tamu INTEGER DEFAULT 1,
      tgl_reservasi TEXT NOT NULL,
      jam_reservasi TEXT NOT NULL,
      jam_berakhir TEXT,
      table_id INTEGER,
      catatan TEXT,
      status TEXT DEFAULT 'MENUNGGU',
      sumber TEXT DEFAULT 'MANUAL',
      deposit REAL DEFAULT 0,
      dibuat_oleh TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_return_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL,
  barang_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  subtotal REAL NOT NULL,
  reason TEXT
);
CREATE TABLE IF NOT EXISTS mediasoft_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT NOT NULL,
  penjualan_id TEXT,
  customer_id TEXT,
  total_amount REAL NOT NULL,
  refund_method TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'PENDING',
  created_by TEXT,
  approved_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
, stock_applied INTEGER DEFAULT 0, approved_at TEXT, rejected_at TEXT, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_satuan (kd_satuan INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, nama_satuan VARCHAR (30), created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_security_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        login_attempts INTEGER DEFAULT 5,
        lock_duration INTEGER DEFAULT 15,
        session_timeout INTEGER DEFAULT 30,
        require_strong_password INTEGER DEFAULT 1,
        two_factor_enabled INTEGER DEFAULT 0,
        ip_whitelist TEXT DEFAULT '[]',
        updated_at TEXT
      );
CREATE TABLE IF NOT EXISTS mediasoft_shift_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      tgl TEXT NOT NULL,
      shift TEXT NOT NULL,
      jam_masuk TEXT NOT NULL,
      jam_keluar TEXT NOT NULL,
      catatan TEXT,
      dibuat_oleh TEXT,
      tgl_dibuat TEXT NOT NULL
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_number TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    opening_balance REAL NOT NULL,
    closing_balance REAL,
    expected_balance REAL,
    difference REAL,
    total_sales REAL DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
    FOREIGN KEY (user_id) REFERENCES mediasoft_pengguna(nama_pengguna)
);
CREATE TABLE IF NOT EXISTS mediasoft_stock_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kd_barang TEXT NOT NULL,
        nama_barang TEXT NOT NULL,
        jenis TEXT NOT NULL,
        qty INTEGER DEFAULT 0,
        stok_sebelum INTEGER DEFAULT 0,
        stok_sesudah INTEGER DEFAULT 0,
        keterangan TEXT,
        username TEXT DEFAULT '',
        direction TEXT DEFAULT 'neutral',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE IF NOT EXISTS mediasoft_stock_opname (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opname_number TEXT NOT NULL,
  opname_date TEXT NOT NULL,
  total_items INTEGER DEFAULT 0,
  total_difference INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  notes TEXT,
  created_by TEXT,
  approved_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mediasoft_stock_opname_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opname_id INTEGER NOT NULL,
  barang_id TEXT NOT NULL,
  system_stock INTEGER NOT NULL,
  physical_stock INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS mediasoft_stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      from_warehouse_id INTEGER NOT NULL,
      to_warehouse_id INTEGER NOT NULL,
      qty INTEGER DEFAULT 0,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL
    , from_branch_id INTEGER, to_branch_id INTEGER, notes TEXT, transferred_by TEXT);
CREATE TABLE IF NOT EXISTS mediasoft_stok (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kd_barang TEXT NOT NULL,
        jumlah INTEGER DEFAULT 0,
        branch_id INTEGER DEFAULT 1,
        UNIQUE(kd_barang, branch_id)
      );
CREATE TABLE IF NOT EXISTS mediasoft_storefront_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_order TEXT NOT NULL UNIQUE,
      nama_pelanggan TEXT NOT NULL,
      email TEXT,
      no_telp TEXT,
      alamat TEXT,
      catatan TEXT,
      subtotal REAL DEFAULT 0,
      ongkir REAL DEFAULT 0,
      diskon REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'BARU',
      metode_pembayaran TEXT,
      status_pembayaran TEXT DEFAULT 'BELUM_BAYAR',
      bukti_bayar TEXT,
      kurir TEXT,
      no_resi TEXT,
      kd_transaksi TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_storefront_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      tampilkan INTEGER DEFAULT 1,
      harga_online REAL,
      stok_online INTEGER,
      foto_tambahan TEXT,
      deskripsi_online TEXT,
      seo_title TEXT,
      seo_description TEXT,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_storefront_settings (
      id INTEGER PRIMARY KEY,
      domain TEXT,
      nama_toko TEXT,
      deskripsi TEXT,
      logo TEXT,
      warna_utama TEXT DEFAULT '#6366f1',
      meta_tags TEXT,
      google_analytics TEXT,
      is_active INTEGER DEFAULT 0,
      metode_pengiriman TEXT,
      metode_pembayaran TEXT,
      kebijakan_privacy TEXT,
      syarat_ketentuan TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    , synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_struk_settings (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  show_logo         INTEGER DEFAULT 1,
  show_alamat       INTEGER DEFAULT 1,
  show_telepon      INTEGER DEFAULT 1,
  show_email        INTEGER DEFAULT 1,
  show_kasir        INTEGER DEFAULT 1,
  show_customer     INTEGER DEFAULT 1,
  footer_text       TEXT DEFAULT 'Terima kasih atas kunjungan Anda',
  qris_image        TEXT,
  qris_enabled      INTEGER DEFAULT 0,
  updated_at        TEXT NOT NULL
, printer_type TEXT DEFAULT 'thermal', paper_size TEXT DEFAULT '58mm', layout_type TEXT DEFAULT 'classic', created_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_subscription_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        duration_days INTEGER NOT NULL,
        features TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        is_recommended INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT
      , max_devices INTEGER DEFAULT 1, max_transactions_per_day INTEGER DEFAULT -1, max_products INTEGER DEFAULT -1, max_users INTEGER DEFAULT 1, feature_flags TEXT DEFAULT '{}', synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL, code TEXT DEFAULT NULL, description TEXT DEFAULT NULL, currency TEXT DEFAULT 'IDR', sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS mediasoft_supplier (kd_suplier VARCHAR (50) PRIMARY KEY NOT NULL, nama_suplier VARCHAR (150), alamat_suplier VARCHAR (255), no_telp_hp VARCHAR (14), tgl_wkt_simpan DATETIME, tgl_wkt_edit DATETIME, nama_pengguna VARCHAR (50), email TEXT, status TEXT DEFAULT 'Aktif', created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_layout_id INTEGER,
      nomor_meja TEXT NOT NULL,
      label TEXT,
      kapasitas INTEGER DEFAULT 4,
      posisi_x REAL DEFAULT 0,
      posisi_y REAL DEFAULT 0,
      bentuk TEXT DEFAULT 'persegi',
      lebar INTEGER DEFAULT 60,
      tinggi INTEGER DEFAULT 60,
      status TEXT DEFAULT 'KOSONG',
      qr_code TEXT,
      catatan TEXT,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_tax_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rate REAL NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mediasoft_tip_distribution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tip_pooling_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      jumlah REAL DEFAULT 0,
      persentase REAL DEFAULT 0,
      catatan TEXT
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_tip_pooling (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tgl TEXT NOT NULL,
      total_tip REAL DEFAULT 0,
      jumlah_karyawan INTEGER DEFAULT 0,
      tip_per_orang REAL DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      catatan TEXT,
      dibuat_oleh TEXT,
      tgl_dibuat TEXT NOT NULL
    , created_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_tutorials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS mediasoft_user_devices (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL,
      device_id     TEXT NOT NULL,
      device_name   TEXT,
      platform      TEXT,
      os_name       TEXT,
      app_version   TEXT,
      ip_address    TEXT,
      last_seen_at  TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      status        TEXT NOT NULL DEFAULT 'active',
      revoked_at    TEXT,
      revoked_by    TEXT,
      UNIQUE(username, device_id)
    );
CREATE TABLE IF NOT EXISTS mediasoft_user_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, preference_key TEXT NOT NULL, preference_value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES mediasoft_pengguna(nama_pengguna) ON DELETE CASCADE, UNIQUE(user_id, preference_key));
CREATE TABLE IF NOT EXISTS mediasoft_vendor_portal_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id TEXT NOT NULL,
      portal_enabled INTEGER DEFAULT 1,
      token TEXT,
      dapat_melihat_po INTEGER DEFAULT 1,
      dapat_mengirim_invoice INTEGER DEFAULT 1,
      dapat_melihat_status INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_warehouse_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      kd_barang TEXT NOT NULL,
      qty INTEGER DEFAULT 0,
      updated_at TEXT,
      UNIQUE(warehouse_id, kd_barang)
    );
CREATE TABLE IF NOT EXISTS mediasoft_warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    , updated_at TEXT DEFAULT NULL, synced_at TEXT DEFAULT NULL, device_id TEXT DEFAULT NULL);
CREATE TABLE IF NOT EXISTS mediasoft_whatsapp_broadcast_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      target_type TEXT NOT NULL,
      total_targets INTEGER DEFAULT 0,
      delivered INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      scheduled_at TEXT,
      sent_at TEXT,
      status TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS mediasoft_whatsapp_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      api_key TEXT DEFAULT '',
      enabled INTEGER DEFAULT 0,
      notify_on_sale INTEGER DEFAULT 1,
      notify_on_return INTEGER DEFAULT 1,
      notify_on_low_stock INTEGER DEFAULT 0,
      notify_on_payment INTEGER DEFAULT 1,
      message_template TEXT DEFAULT 'Terima kasih {customer}! Pesanan Anda sebesar {total} telah diterima. No. Transaksi: {invoice}',
      updated_at TEXT
    , provider TEXT DEFAULT 'fonnte', rate_limit_per_minute INTEGER DEFAULT 20);
CREATE TABLE IF NOT EXISTS mediasoft_whatsapp_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
`.trim();

export const BASE_SEED_SQL: string = `
INSERT OR IGNORE INTO mediasoft_identitas (kode, namatoko, alamattoko, nomortelptoko, pajak_persen, auto_print, struk_footer) VALUES (1, 'WariPOS Store', 'Jalan Utama No. 1', '08123456789', 0, 1, 'Terima kasih atas kunjungan Anda');
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (21, 'Makanan & Snack', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (22, 'Minuman', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (23, 'Elektronik', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (24, 'ATK (Alat Tulis Kantor)', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (25, 'Kosmetik & Perawatan', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (26, 'Obat & Kesehatan', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (27, 'Rumah Tangga', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (28, 'Jasa & Layanan', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (29, 'Pulsa & Token', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_kategori_barang ("kd_kategori_barang", "kategori_barang", "created_at", "updated_at", "synced_at", "device_id") VALUES (30, 'Lain-lain', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (1, 'Kg', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (2, 'Ton', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (4, 'Lembar', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (5, 'pcs', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (6, 'dus', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (7, 'Kali', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (8, 'Trip', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (9, 'Bulan', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (10, 'Tahun', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (11, 'Rim', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_satuan ("kd_satuan", "nama_satuan", "created_at", "updated_at", "synced_at", "device_id") VALUES (12, 'Liter', NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (1, 'Tunai', 'TUNAI', NULL, NULL, 1, '2026-05-03 15:36:44', '2026-05-03 15:36:44', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (2, 'Transfer Bank', 'TRANSFER', NULL, NULL, 1, '2026-05-03 15:36:44', '2026-05-03 15:36:44', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (3, 'Kartu Debit/Kredit', 'KARTU', NULL, NULL, 1, '2026-05-03 15:36:44', '2026-05-03 15:36:44', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (4, 'E-Wallet', 'EWALLET', NULL, NULL, 1, '2026-05-03 15:36:44', '2026-05-03 15:36:44', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (5, 'QRIS', 'QRIS', NULL, NULL, 1, '2026-05-03 15:36:44', '2026-05-03 15:36:44', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (6, 'Tunai', 'TUNAI', NULL, NULL, 1, '2026-05-03 15:36:55', '2026-05-03 15:36:55', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (7, 'Transfer Bank', 'TRANSFER', NULL, NULL, 1, '2026-05-03 15:36:55', '2026-05-03 15:36:55', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (8, 'Kartu Debit/Kredit', 'KARTU', NULL, NULL, 1, '2026-05-03 15:36:55', '2026-05-03 15:36:55', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (9, 'E-Wallet', 'EWALLET', NULL, NULL, 1, '2026-05-03 15:36:55', '2026-05-03 15:36:55', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (10, 'QRIS', 'QRIS', NULL, NULL, 1, '2026-05-03 15:36:55', '2026-05-03 15:36:55', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (11, 'Tunai', 'TUNAI', NULL, NULL, 1, '2026-05-03 15:37:12', '2026-05-03 15:37:12', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (12, 'Transfer Bank', 'TRANSFER', NULL, NULL, 1, '2026-05-03 15:37:12', '2026-05-03 15:37:12', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (13, 'Kartu Debit/Kredit', 'KARTU', NULL, NULL, 1, '2026-05-03 15:37:12', '2026-05-03 15:37:12', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (14, 'E-Wallet', 'EWALLET', NULL, NULL, 1, '2026-05-03 15:37:12', '2026-05-03 15:37:12', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (15, 'QRIS', 'QRIS', NULL, NULL, 1, '2026-05-03 15:37:12', '2026-05-03 15:37:12', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (16, 'Tunai', 'TUNAI', NULL, NULL, 1, '2026-05-03 15:54:47', '2026-05-03 15:54:47', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (17, 'Transfer Bank', 'TRANSFER', NULL, NULL, 1, '2026-05-03 15:54:47', '2026-05-03 15:54:47', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (18, 'Kartu Debit/Kredit', 'KARTU', NULL, NULL, 1, '2026-05-03 15:54:47', '2026-05-03 15:54:47', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (19, 'E-Wallet', 'EWALLET', NULL, NULL, 1, '2026-05-03 15:54:47', '2026-05-03 15:54:47', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (20, 'QRIS', 'QRIS', NULL, NULL, 1, '2026-05-03 15:54:47', '2026-05-03 15:54:47', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (21, 'Tunai', 'TUNAI', NULL, NULL, 1, '2026-05-06 23:23:42', '2026-05-06 23:23:42', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (22, 'Transfer Bank', 'TRANSFER', NULL, NULL, 1, '2026-05-06 23:23:42', '2026-05-06 23:23:42', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (23, 'Kartu Debit/Kredit', 'KARTU', NULL, NULL, 1, '2026-05-06 23:23:42', '2026-05-06 23:23:42', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (24, 'E-Wallet', 'EWALLET', NULL, NULL, 1, '2026-05-06 23:23:42', '2026-05-06 23:23:42', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_payment_methods ("id", "name", "type", "account_number", "account_name", "is_active", "created_at", "updated_at", "synced_at", "device_id") VALUES (25, 'QRIS', 'QRIS', NULL, NULL, 1, '2026-05-06 23:23:42', '2026-05-06 23:23:42', NULL, NULL);
INSERT OR IGNORE INTO mediasoft_grup_pengguna ("nama_grup") VALUES ('Developer');
INSERT OR IGNORE INTO mediasoft_grup_pengguna ("nama_grup") VALUES ('ihwalmaulana2');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_dashboard', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_barang', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_satuan', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_supplier', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_identitas', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_pengguna', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_hak_akses', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_setting_harga', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_penjualan', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_pembelian', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_export_db', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_dashboard', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_penjualan', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_barang', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_pembelian', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_branch', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_supplier', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_loyalty', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_promo', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_tutorials', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_hpp', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_whatsapp', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_print_queue', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_pengguna', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_plans', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_activity_log', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_export_db', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_security', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_ecommerce_api', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('ihwalmaulana2', 'nav_identitas', 'True');
INSERT OR IGNORE INTO mediasoft_grup_pengguna_hak_akses ("nama_grup", "menu_code", "status") VALUES ('Developer', 'nav_license_admin', 'True');
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (6, 'Trial 3 Hari', 0, 3, '["Trial akses penuh 3 hari","Semua modul & laporan aktif","Export Excel & PDF","Multi-user kasir & admin","Tanpa batasan transaksi & produk selama trial"]', 0, 0, '2026-05-21T13:51:06.282Z', '2026-08-29T13:42:00.893Z', 3, -1, -1, 10, '{"reports":true,"export_excel":true,"export_pdf":true,"multi_user":true,"backup":true,"restore":true,"stock_opname":true,"debt_management":true,"shift_management":true,"api_access":true,"multi_branch":true,"return_refund":true}', NULL, NULL, 'TRIAL_3_DAYS', NULL, 'IDR', 0);
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (11, 'Basic Bulanan', 99000, 30, '[]', 1, 0, '2026-05-21T15:45:12.502Z', '2026-05-31T13:12:23.500Z', 1, -1, 500, 1, '{"backup":true,"reports":true,"restore":false,"api_access":false,"export_pdf":false,"multi_user":false,"export_excel":false,"multi_branch":false,"stock_opname":false,"return_refund":true,"debt_management":false,"shift_management":false}', NULL, NULL, NULL, NULL, 'IDR', 0);
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (12, 'Pro Bulanan', 199000, 30, '[]', 1, 0, '2026-05-21T15:45:12.502Z', '2026-06-01T03:18:12.051Z', 3, -1, -1, 5, '{"backup":true,"reports":true,"restore":true,"api_access":true,"export_pdf":true,"multi_user":true,"export_excel":true,"multi_branch":false,"stock_opname":true,"return_refund":true,"debt_management":true,"shift_management":true}', NULL, NULL, NULL, NULL, 'IDR', 0);
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (13, 'contoh', 1000, 3, '["tes"]', 1, 0, '2026-05-30T05:28:31.818Z', NULL, 1, -1, -1, 1, '{}', NULL, NULL, NULL, NULL, 'IDR', 0);
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (14, 'Tahunan', 1999000, 365, '[]', 1, 0, '2026-06-01T03:20:08.333Z', '2026-09-09T14:47:20.340Z', 10, -1, -1, 15, '{"reports":true,"export_excel":true,"export_pdf":true,"multi_user":true,"backup":true,"restore":true,"stock_opname":true,"debt_management":true,"shift_management":true,"api_access":true,"multi_branch":true,"return_refund":true}', NULL, NULL, 'PRO_ANNUAL', NULL, 'IDR', 0);
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (15, 'Paket Tahunan', 2899000, 365, '[]', 1, 0, '2026-06-02T16:27:19.025Z', '2026-06-02T16:46:54.073Z', 999, -1, -1, 999, '{"backup":true,"reports":true,"restore":true,"api_access":true,"export_pdf":true,"multi_user":true,"auto_backup":true,"export_data":true,"pos_cashier":true,"export_excel":true,"multi_branch":true,"stock_opname":true,"basic_reports":true,"return_refund":true,"debt_management":true,"advanced_reports":true,"shift_management":true,"inventory_management":true}', NULL, NULL, NULL, NULL, 'IDR', 0);
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (16, 'Sekali Beli Seumur Hidup', 99000, 0, '[]', 1, 1, '2026-06-03T15:46:15.811Z', '2026-06-17T05:44:39.427Z', 20, -1, -1, 50, '{"reports":true,"export_excel":true,"export_pdf":true,"multi_user":true,"backup":true,"restore":true,"stock_opname":true,"debt_management":true,"shift_management":true,"api_access":true,"multi_branch":true,"return_refund":true}', NULL, NULL, 'LIFETIME', NULL, 'IDR', 0);
INSERT OR IGNORE INTO mediasoft_subscription_plans ("id", "name", "price", "duration_days", "features", "is_active", "is_recommended", "created_at", "updated_at", "max_devices", "max_transactions_per_day", "max_products", "max_users", "feature_flags", "synced_at", "device_id", "code", "description", "currency", "sort_order") VALUES (17, 'Mingguan', 19000, 7, '["Paket 7 hari","Max 1 perangkat","Max 2 kasir/pengguna","Batas 100 transaksi/hari","Cetak struk & laporan"]', 1, 0, '2026-09-03T00:40:51.508Z', NULL, 1, 100, 100, 2, '{"reports":true,"export_excel":false,"export_pdf":true,"multi_user":true,"backup":true,"restore":false,"stock_opname":false,"debt_management":false,"shift_management":true,"api_access":false}', NULL, NULL, 'WEEKLY', NULL, 'IDR', 0);
`.trim();
