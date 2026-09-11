
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import * as schema from './schema.js'
import { BASE_SCHEMA_SQL, BASE_SEED_SQL } from './baseSchema.js'

function copyBundledDatabaseIfNeeded(targetPath: string) {
  if (fs.existsSync(targetPath)) return

  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, 'sistem_pos.db')
    : path.join(process.cwd(), 'sistem_pos.db')

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })

  if (fs.existsSync(bundledPath)) {
    fs.copyFileSync(bundledPath, targetPath)
  }
}

// Resolve DB path: packaged apps must write to userData, not install resources.
function getDbPath(): string {
  if (app.isPackaged) {
    const userDbPath = path.join(app.getPath('userData'), 'sistem_pos.db')
    copyBundledDatabaseIfNeeded(userDbPath)
    return userDbPath
  }
  return path.join(process.cwd(), 'sistem_pos.db')
}

let sqlite = new Database(getDbPath())
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// Run migrations on startup
function runMigrations() {
  try {
    // Ensure all 123 base tables exist on fresh clone or new database
    const hasCoreTables = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='mediasoft_penjualan'").get()
    if (!hasCoreTables) {
      console.log('[Database] Fresh database detected. Initializing all base tables...')
      sqlite.exec(BASE_SCHEMA_SQL)
      sqlite.exec(BASE_SEED_SQL)
      console.log('[Database] Base tables and seed reference data initialized successfully.')
    }

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS mediasoft_pengguna (
        nama_pengguna TEXT PRIMARY KEY,
        kata_sandi TEXT,
        nama_lengkap TEXT,
        tgl_wkt_simpan TEXT,
        tgl_wkt_edit TEXT,
        status_user TEXT NOT NULL DEFAULT 'Aktif',
        terakhir_login TEXT,
        hak_akses TEXT NOT NULL DEFAULT 'kasir',
        email TEXT,
        no_telp TEXT,
        access_expires_at TEXT,
        password_hash_type TEXT DEFAULT 'sha1',
        must_change_password INTEGER DEFAULT 0,
        pin_hash TEXT,
        pin_hash_type TEXT DEFAULT 'bcrypt',
        pin_enabled INTEGER DEFAULT 0,
        foto TEXT
      )
    `)

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS mediasoft_activity_log (
        kd_log INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        aktivitas TEXT NOT NULL,
        modul TEXT NOT NULL,
        tgl_aktivitas TEXT NOT NULL,
        ip_address TEXT,
        device_id TEXT,
        user_agent TEXT,
        detail TEXT
      )
    `)

    // Check if password_hash_type column exists
    const columns = sqlite.prepare("PRAGMA table_info(mediasoft_pengguna)").all() as Array<{ name: string }>
    const hasPasswordHashType = columns.some(col => col.name === 'password_hash_type')
    
    if (!hasPasswordHashType) {
      console.log('CRITICAL: password_hash_type column is missing!')
      console.log('Adding password_hash_type column...')
      try {
        sqlite.exec(`ALTER TABLE mediasoft_pengguna ADD COLUMN password_hash_type TEXT DEFAULT 'sha1';`)
        sqlite.exec(`UPDATE mediasoft_pengguna SET password_hash_type = 'sha1' WHERE password_hash_type IS NULL;`)
        console.log(' password_hash_type column added successfully')
      } catch (err: unknown) {
        if (err instanceof Error && err.message?.includes('duplicate column')) {
          console.log(' password_hash_type column already exists')
        } else {
          const message = err instanceof Error ? err.message : String(err)
          console.error(' Failed to add password_hash_type column:', message)
          console.error('Please close all database connections and restart the app')
          throw new Error('Database migration failed: password_hash_type column is required but could not be added')
        }
      }
    } else {
      console.log(' password_hash_type column exists')
    }

    const hasMustChangePassword = columns.some(col => col.name === 'must_change_password')
    if (!hasMustChangePassword) {
      console.log('Adding must_change_password column...')
      try {
        sqlite.exec(`ALTER TABLE mediasoft_pengguna ADD COLUMN must_change_password INTEGER DEFAULT 0;`)
        sqlite.exec(`
          UPDATE mediasoft_pengguna
          SET must_change_password = 1
          WHERE COALESCE(status_user, 'Aktif') = 'Aktif'
        `)
        console.log(' must_change_password column added successfully')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        if (!message.includes('duplicate column')) {
          console.error('Failed to add must_change_password column:', message)
        }
      }
    }

    const ensurePenggunaColumn = (name: string, definition: string) => {
      if (!columns.some(col => col.name === name)) {
        console.log(`Adding ${name} column to mediasoft_pengguna...`)
        try {
          sqlite.exec(`ALTER TABLE mediasoft_pengguna ADD COLUMN ${name} ${definition};`)
          console.log(` ${name} column added successfully`)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error(`Failed to add ${name} column:`, message)
          }
        }
      }
    }

    ensurePenggunaColumn('pin_hash', 'TEXT')
    ensurePenggunaColumn('pin_hash_type', "TEXT DEFAULT 'bcrypt'")
    ensurePenggunaColumn('pin_enabled', 'INTEGER DEFAULT 0')
    ensurePenggunaColumn('foto', 'TEXT')

    const activityColumns = sqlite.prepare("PRAGMA table_info(mediasoft_activity_log)").all() as Array<{ name: string }>
    const ensureActivityColumn = (name: string, definition: string) => {
      if (!activityColumns.some(col => col.name === name)) {
        console.log(`Adding ${name} column to mediasoft_activity_log...`)
        try {
          sqlite.exec(`ALTER TABLE mediasoft_activity_log ADD COLUMN ${name} ${definition};`)
          console.log(` ${name} column added successfully`)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error(`Failed to add ${name} column:`, message)
          }
        }
      }
    }

    ensureActivityColumn('device_id', 'TEXT')
    ensureActivityColumn('user_agent', 'TEXT')

    sqlite.exec(`
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
      )
    `)
    
    const hasEmail = columns.some(col => col.name === 'email')
    if (!hasEmail) {
      console.log('Adding email column...')
        try {
          sqlite.exec(`ALTER TABLE mediasoft_pengguna ADD COLUMN email TEXT;`)
          console.log(' email column added successfully')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error('Failed to add email column:', message)
          }
        }
      }
      
      const hasNoTelp = columns.some(col => col.name === 'no_telp')
      if (!hasNoTelp) {
        console.log('Adding no_telp column...')
        try {
          sqlite.exec(`ALTER TABLE mediasoft_pengguna ADD COLUMN no_telp TEXT;`)
          console.log(' no_telp column added successfully')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error('Failed to add no_telp column:', message)
          }
        }
      }

      const hasAccessExpiresAt = columns.some(col => col.name === 'access_expires_at')
      if (!hasAccessExpiresAt) {
        console.log('Adding access_expires_at column...')
        try {
          sqlite.exec(`ALTER TABLE mediasoft_pengguna ADD COLUMN access_expires_at TEXT;`)
          console.log(' access_expires_at column added successfully')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error('Failed to add access_expires_at column:', message)
          }
        }
      }

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS mediasoft_grup_pengguna (
          nama_grup TEXT PRIMARY KEY
        )
      `)
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS mediasoft_grup_pengguna_hak_akses (
          nama_grup TEXT NOT NULL,
          menu_code TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'True',
          PRIMARY KEY (nama_grup, menu_code)
        )
      `)

      const userPrefsSql = sqlite.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mediasoft_user_preferences'"
      ).get() as { sql?: string } | undefined
      if (userPrefsSql?.sql?.includes('REFERENCES mediasoft_pengguna(id)')) {
        console.log('Rebuilding user preferences table with valid pengguna foreign key...')
        sqlite.pragma('foreign_keys = OFF')
        try {
          sqlite.exec(`
            ALTER TABLE mediasoft_user_preferences RENAME TO mediasoft_user_preferences_old;
            CREATE TABLE mediasoft_user_preferences (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              preference_key TEXT NOT NULL,
              preference_value TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES mediasoft_pengguna(nama_pengguna) ON DELETE CASCADE,
              UNIQUE(user_id, preference_key)
            );
            INSERT OR IGNORE INTO mediasoft_user_preferences (user_id, preference_key, preference_value, created_at, updated_at)
            SELECT CAST(user_id AS TEXT), preference_key, preference_value, created_at, updated_at
            FROM mediasoft_user_preferences_old
            WHERE CAST(user_id AS TEXT) IN (SELECT nama_pengguna FROM mediasoft_pengguna);
            DROP TABLE mediasoft_user_preferences_old;
          `)
        } finally {
          sqlite.pragma('foreign_keys = ON')
        }
        console.log(' user preferences foreign key fixed')
      } else {
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS mediasoft_user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            preference_key TEXT NOT NULL,
            preference_value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES mediasoft_pengguna(nama_pengguna) ON DELETE CASCADE,
            UNIQUE(user_id, preference_key)
          )
        `)
      }

      const paymentDetailsSql = sqlite.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mediasoft_payment_details'"
      ).get() as { sql?: string } | undefined
      if (paymentDetailsSql?.sql?.includes('REFERENCES mediasoft_penjualan(id)')) {
        console.log('Rebuilding payment details table with valid penjualan foreign key...')
        sqlite.pragma('foreign_keys = OFF')
        try {
          sqlite.exec(`
            ALTER TABLE mediasoft_payment_details RENAME TO mediasoft_payment_details_old;
            CREATE TABLE mediasoft_payment_details (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              penjualan_id TEXT NOT NULL,
              payment_method_id INTEGER NOT NULL,
              amount REAL NOT NULL,
              reference_number TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (penjualan_id) REFERENCES mediasoft_penjualan(kd_tansaksi_jual) ON DELETE CASCADE,
              FOREIGN KEY (payment_method_id) REFERENCES mediasoft_payment_methods(id)
            );
            INSERT OR IGNORE INTO mediasoft_payment_details (penjualan_id, payment_method_id, amount, reference_number, created_at)
            SELECT CAST(penjualan_id AS TEXT), payment_method_id, amount, reference_number, created_at
            FROM mediasoft_payment_details_old
            WHERE CAST(penjualan_id AS TEXT) IN (SELECT kd_tansaksi_jual FROM mediasoft_penjualan)
              AND payment_method_id IN (SELECT id FROM mediasoft_payment_methods);
            DROP TABLE mediasoft_payment_details_old;
          `)
        } finally {
          sqlite.pragma('foreign_keys = ON')
        }
        console.log(' payment details foreign key fixed')
      }
      
      const kasCols = sqlite.prepare("PRAGMA table_info(mediasoft_kas_drawer)").all() as Array<{ name: string }>
      if (!kasCols.some(col => col.name === 'total_pemasukan')) {
        console.log('Adding total_pemasukan column to kas_drawer...')
        try {
          sqlite.exec(`ALTER TABLE mediasoft_kas_drawer ADD COLUMN total_pemasukan REAL DEFAULT 0;`)
          console.log(' total_pemasukan column added successfully')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error('Failed to add total_pemasukan column:', message)
          }
        }
      }

      const penjualanCols = sqlite.prepare("PRAGMA table_info(mediasoft_penjualan)").all() as Array<{ name: string }>
      if (!penjualanCols.some(col => col.name === 'discount_amount')) {
        console.log('Adding discount_amount column to penjualan...')
        try {
          sqlite.exec(`ALTER TABLE mediasoft_penjualan ADD COLUMN discount_amount REAL DEFAULT 0;`)
          console.log(' discount_amount column added successfully')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error('Failed to add discount_amount column:', message)
          }
        }
      }
      if (!penjualanCols.some(col => col.name === 'shift_id')) {
        console.log('Adding shift_id column to penjualan...')
        try {
          sqlite.exec(`ALTER TABLE mediasoft_penjualan ADD COLUMN shift_id INTEGER;`)
          console.log(' shift_id column added successfully')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('duplicate column')) {
            console.error('Failed to add shift_id column:', message)
          }
        }
      }
    
  } catch (error: any) {
    console.error(' Migration error:', error.message)
    throw error // Throw critical errors to prevent app from starting with broken schema
  }

  // ── Subscription Plans table ──
  try {
    sqlite.exec(`
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
      )
    `)
    // Seed default plans if table is empty
    const count = sqlite.prepare('SELECT COUNT(*) as cnt FROM mediasoft_subscription_plans').get() as { cnt: number }
    if (count.cnt === 0) {
      const now = new Date().toISOString()
      sqlite.prepare(`INSERT INTO mediasoft_subscription_plans (name, price, duration_days, features, is_active, is_recommended, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run('Harian', 15000, 1, JSON.stringify(['Transaksi tak terbatas', 'Export laporan dasar', 'Support email']), 1, 0, now)
      sqlite.prepare(`INSERT INTO mediasoft_subscription_plans (name, price, duration_days, features, is_active, is_recommended, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run('Bulanan', 299000, 30, JSON.stringify(['Semua fitur Harian', 'Multi-user (3 akun)', 'Export Excel & PDF', 'Laporan lanjutan', 'Backup otomatis', 'Support prioritas']), 1, 1, now)
      sqlite.prepare(`INSERT INTO mediasoft_subscription_plans (name, price, duration_days, features, is_active, is_recommended, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run('Tahunan', 2899000, 365, JSON.stringify(['Semua fitur Bulanan', 'Multi-user (unlimited)', 'Stok opname', 'Manajemen hutang', 'Shift management', 'API access', 'Support 24/7']), 1, 0, now)
      console.log('[Database] Seeded default subscription plans')
    }
  } catch (err: any) {
    console.error('[Database Warning] Subscription plans migration:', err.message)
  }

  // ── Advanced Features Migration ──
  try {
  // Payment gateway settings
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_payment_gateway_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      provider TEXT DEFAULT 'midtrans',
      server_key TEXT DEFAULT '',
      client_key TEXT DEFAULT '',
      is_production INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 0,
      updated_at TEXT
    )
  `)
  sqlite.prepare('INSERT OR IGNORE INTO mediasoft_payment_gateway_settings (id) VALUES (1)').run()

  // 1. Struk Settings
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_struk_settings (
      id INTEGER PRIMARY KEY,
      printer_type TEXT DEFAULT 'thermal',
      paper_size TEXT DEFAULT '58mm',
      layout_type TEXT DEFAULT 'classic',
      show_logo INTEGER DEFAULT 1,
      show_alamat INTEGER DEFAULT 1,
      show_telepon INTEGER DEFAULT 1,
      show_email INTEGER DEFAULT 1,
      show_kasir INTEGER DEFAULT 1,
      show_customer INTEGER DEFAULT 1,
      footer_text TEXT DEFAULT 'Terima kasih atas kunjungan Anda',
      qris_image TEXT,
      qris_enabled INTEGER DEFAULT 0,
      updated_at TEXT
    )
  `)
  // Check for missing columns in existing struk_settings
  const strukCols = sqlite.prepare("PRAGMA table_info(mediasoft_struk_settings)").all() as Array<{ name: string }>
  const ensureStrukColumn = (name: string, definition: string) => {
    if (!strukCols.some(col => col.name === name)) {
      sqlite.exec(`ALTER TABLE mediasoft_struk_settings ADD COLUMN ${name} ${definition}`)
    }
  }
  ensureStrukColumn('printer_type', "TEXT DEFAULT 'thermal'")
  ensureStrukColumn('paper_size', "TEXT DEFAULT '58mm'")
  ensureStrukColumn('layout_type', "TEXT DEFAULT 'classic'")
  ensureStrukColumn('show_logo', 'INTEGER DEFAULT 1')
  ensureStrukColumn('show_alamat', 'INTEGER DEFAULT 1')
  ensureStrukColumn('show_telepon', 'INTEGER DEFAULT 1')
  ensureStrukColumn('show_email', 'INTEGER DEFAULT 1')
  ensureStrukColumn('show_kasir', 'INTEGER DEFAULT 1')
  ensureStrukColumn('show_customer', 'INTEGER DEFAULT 1')
  ensureStrukColumn('footer_text', "TEXT DEFAULT 'Terima kasih atas kunjungan Anda'")
  ensureStrukColumn('qris_image', 'TEXT')
  ensureStrukColumn('qris_enabled', 'INTEGER DEFAULT 0')
  ensureStrukColumn('updated_at', 'TEXT')
  sqlite.prepare('INSERT OR IGNORE INTO mediasoft_struk_settings (id, updated_at) VALUES (1, ?)').run(new Date().toISOString())

  // 2. Currencies
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      exchange_rate REAL DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)

  // 3. Warehouses
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)

  // 4. Batches
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_barang_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      stok INTEGER DEFAULT 0,
      expired_date TEXT,
      warehouse_id INTEGER,
      created_at TEXT NOT NULL
    )
  `)

  // 5. Serials
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_barang_serials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      serial_no TEXT NOT NULL,
      status TEXT DEFAULT 'AVAILABLE',
      warehouse_id INTEGER,
      created_at TEXT NOT NULL
    )
  `)

  // 6. Stock Transfers
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      from_warehouse_id INTEGER,
      to_warehouse_id INTEGER,
      from_branch_id INTEGER,
      to_branch_id INTEGER,
      qty INTEGER DEFAULT 0,
      notes TEXT,
      username TEXT,
      transferred_by TEXT,
      created_at TEXT NOT NULL
    )
  `)
  // Add missing columns for existing databases
  const stCols = sqlite.prepare("PRAGMA table_info(mediasoft_stock_transfers)").all() as Array<{ name: string }>
  if (!stCols.some(col => col.name === 'from_branch_id')) {
    sqlite.exec("ALTER TABLE mediasoft_stock_transfers ADD COLUMN from_branch_id INTEGER")
  }
  if (!stCols.some(col => col.name === 'to_branch_id')) {
    sqlite.exec("ALTER TABLE mediasoft_stock_transfers ADD COLUMN to_branch_id INTEGER")
  }
  if (!stCols.some(col => col.name === 'notes')) {
    sqlite.exec("ALTER TABLE mediasoft_stock_transfers ADD COLUMN notes TEXT")
  }
  if (!stCols.some(col => col.name === 'transferred_by')) {
    sqlite.exec("ALTER TABLE mediasoft_stock_transfers ADD COLUMN transferred_by TEXT")
  }

  // 7. Promos (if not already handled)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_promos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL DEFAULT 0,
      min_purchase REAL DEFAULT 0,
      max_discount REAL,
      start_date TEXT,
      end_date TEXT,
      start_time TEXT,
      end_time TEXT,
      usage_limit INTEGER,
      usage_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      conditions TEXT,
      created_at TEXT NOT NULL
    )
  `)

  // 8. Audit Trail
  sqlite.exec(`
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
    )
  `)

    console.log('[Database] Advanced features migrations completed')
  } catch (err: any) {
    console.error('[Database Warning] Advanced features migration error:', err.message)
  }

  // ── Branch Support Migration ──
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS mediasoft_stok (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kd_barang TEXT NOT NULL,
        jumlah INTEGER DEFAULT 0,
        branch_id INTEGER DEFAULT 1,
        UNIQUE(kd_barang, branch_id)
      )
    `)
    const pjCols = sqlite.prepare("PRAGMA table_info(mediasoft_penjualan)").all() as Array<{ name: string }>
    if (!pjCols.some(col => col.name === 'branch_id')) {
      sqlite.exec("ALTER TABLE mediasoft_penjualan ADD COLUMN branch_id INTEGER DEFAULT 1")
    }
    console.log('[Database] Branch support migration completed')
  } catch (err: any) {
    console.error('[Database Warning] Branch support migration:', err.message)
  }
}

// Run migrations before creating drizzle instance
runMigrations()

// Add license server config columns to identitas table
;(function addLicenseColumns() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_identitas (
      kode INTEGER PRIMARY KEY,
      namatoko TEXT,
      alamattoko TEXT,
      nomortelptoko TEXT,
      nomorwaowner TEXT,
      alamatemailowner TEXT,
      logo TEXT,
      npwp TEXT,
      pajak_persen REAL DEFAULT 0,
      auto_barcode INTEGER DEFAULT 1,
      barcode_prefix TEXT DEFAULT 'POS',
      auto_print INTEGER DEFAULT 0,
      struk_footer TEXT DEFAULT 'Terima kasih atas kunjungan Anda',
      auto_backup INTEGER DEFAULT 1,
      backup_retention INTEGER DEFAULT 7,
      notif_stok INTEGER DEFAULT 1,
      min_stok INTEGER DEFAULT 5
    )
  `)
  const cols = sqlite.prepare('PRAGMA table_info(mediasoft_identitas)').all() as Array<{ name: string }>
  const names = cols.map(c => c.name)
  if (!names.includes('license_server_url')) {
    sqlite.exec(`ALTER TABLE mediasoft_identitas ADD COLUMN license_server_url TEXT`)
  }
  if (!names.includes('license_admin_token')) {
    sqlite.exec(`ALTER TABLE mediasoft_identitas ADD COLUMN license_admin_token TEXT`)
  }
  if (!names.includes('license_admin_refresh_token')) {
    sqlite.exec(`ALTER TABLE mediasoft_identitas ADD COLUMN license_admin_refresh_token TEXT`)
  }
})()

// License integration migration (idempotent)
;(function licenseIntegrationMigration() {
  function addCol(table: string, col: string, def: string) {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (!cols.some(c => c.name === col)) {
      try {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
      } catch (err: any) {
        console.error(`[Database Error] License migration failed for ${table}.${col}:`, err.message)
      }
    }
  }

  function tableExists(table: string): boolean {
    const row = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { name?: string } | undefined
    return !!row?.name
  }

  function ensureSyncMetadata(table: string) {
    if (!tableExists(table)) return
    addCol(table, 'created_at', 'TEXT DEFAULT NULL')
    addCol(table, 'updated_at', 'TEXT DEFAULT NULL')
    addCol(table, 'synced_at', 'TEXT DEFAULT NULL')
    addCol(table, 'device_id', 'TEXT DEFAULT NULL')
  }

  // mediasoft_pengguna
  addCol('mediasoft_pengguna', 'subscription_plan_id', 'INTEGER DEFAULT NULL')
  addCol('mediasoft_pengguna', 'subscription_expires_at', 'TEXT DEFAULT NULL')
  addCol('mediasoft_pengguna', 'is_buyer', 'INTEGER DEFAULT 0')

  // mediasoft_auth_sessions
  addCol('mediasoft_auth_sessions', 'platform', 'TEXT DEFAULT NULL')
  addCol('mediasoft_auth_sessions', 'os_name', 'TEXT DEFAULT NULL')
  addCol('mediasoft_auth_sessions', 'app_version', 'TEXT DEFAULT NULL')
  addCol('mediasoft_auth_sessions', 'is_revoked', 'INTEGER DEFAULT 0')
  sqlite.exec(`UPDATE mediasoft_auth_sessions SET is_revoked = 0 WHERE is_revoked IS NULL`)

  // mediasoft_subscription_plans
  addCol('mediasoft_subscription_plans', 'code', 'TEXT DEFAULT NULL')
  addCol('mediasoft_subscription_plans', 'description', 'TEXT DEFAULT NULL')
  addCol('mediasoft_subscription_plans', 'currency', "TEXT DEFAULT 'IDR'")
  addCol('mediasoft_subscription_plans', 'sort_order', 'INTEGER DEFAULT 0')
  addCol('mediasoft_subscription_plans', 'max_devices', 'INTEGER DEFAULT 1')
  addCol('mediasoft_subscription_plans', 'max_transactions_per_day', 'INTEGER DEFAULT -1')
  addCol('mediasoft_subscription_plans', 'max_products', 'INTEGER DEFAULT -1')
  addCol('mediasoft_subscription_plans', 'max_users', 'INTEGER DEFAULT 1')
  addCol('mediasoft_subscription_plans', 'feature_flags', "TEXT DEFAULT '{}'")

  // Weekly Plan
  const weeklyFlags = JSON.stringify({
    reports: true,
    export_excel: false,
    export_pdf: true,
    multi_user: true,
    backup: true,
    restore: false,
    stock_opname: false,
    debt_management: false,
    shift_management: true,
    api_access: false,
  })
  const weeklyPlan = sqlite.prepare("SELECT id FROM mediasoft_subscription_plans WHERE name = 'Mingguan' OR code = 'WEEKLY' LIMIT 1").get() as { id: number } | undefined
  if (!weeklyPlan) {
    sqlite.prepare(`
      INSERT INTO mediasoft_subscription_plans
        (code, name, price, duration_days, features, is_active, is_recommended, created_at,
         max_devices, max_transactions_per_day, max_products, max_users, feature_flags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'WEEKLY',
      'Mingguan',
      19000,
      7,
      JSON.stringify(['Paket 7 hari', 'Max 1 perangkat', 'Max 2 kasir/pengguna', 'Batas 100 transaksi/hari', 'Cetak struk & laporan']),
      1,
      0,
      new Date().toISOString(),
      1,
      100,
      100,
      2,
      weeklyFlags
    )
  }

  sqlite.prepare(`
    UPDATE mediasoft_subscription_plans
    SET code = 'WEEKLY',
        duration_days = 7,
        max_devices = 1,
        max_transactions_per_day = 100,
        max_products = 100,
        max_users = 2,
        feature_flags = ?
    WHERE name = 'Mingguan' OR code = 'WEEKLY'
  `).run(weeklyFlags)

  // Monthly Plan
  const monthlyFlags = JSON.stringify({
    reports: true,
    export_excel: true,
    export_pdf: true,
    multi_user: true,
    backup: true,
    restore: false,
    stock_opname: false,
    debt_management: true,
    shift_management: true,
    api_access: false,
  })
  sqlite.prepare(`
    UPDATE mediasoft_subscription_plans
    SET code = 'PRO_MONTHLY',
        duration_days = 30,
        max_devices = 3,
        max_transactions_per_day = -1,
        max_products = 1000,
        max_users = 5,
        feature_flags = ?
    WHERE name = 'Bulanan' OR code = 'PRO_MONTHLY' OR code = 'MONTHLY'
  `).run(monthlyFlags)

  // Yearly Plan (10 devices, 15 users as explicitly requested by user)
  const yearlyFlags = JSON.stringify({
    reports: true,
    export_excel: true,
    export_pdf: true,
    multi_user: true,
    backup: true,
    restore: true,
    stock_opname: true,
    debt_management: true,
    shift_management: true,
    api_access: true,
    multi_branch: true,
    return_refund: true,
  })
  sqlite.prepare(`
    UPDATE mediasoft_subscription_plans
    SET code = 'PRO_ANNUAL',
        duration_days = 365,
        max_devices = 10,
        max_transactions_per_day = -1,
        max_products = -1,
        max_users = 15,
        feature_flags = ?
    WHERE name = 'Tahunan' OR code = 'PRO_ANNUAL' OR code = 'YEARLY'
  `).run(yearlyFlags)

  const lifetimeFlags = JSON.stringify({
    reports: true,
    export_excel: true,
    export_pdf: true,
    multi_user: true,
    backup: true,
    restore: true,
    stock_opname: true,
    debt_management: true,
    shift_management: true,
    api_access: true,
    multi_branch: true,
    return_refund: true,
  })
  const lifetimePlan = sqlite.prepare(
    `SELECT id FROM mediasoft_subscription_plans WHERE name = 'Sekali Beli Seumur Hidup' OR code = 'LIFETIME' LIMIT 1`
  ).get() as { id: number } | undefined
  if (!lifetimePlan) {
    sqlite.prepare(`
      INSERT INTO mediasoft_subscription_plans
        (code, name, price, duration_days, features, is_active, is_recommended, created_at,
         max_devices, max_transactions_per_day, max_products, max_users, feature_flags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'LIFETIME',
      'Sekali Beli Seumur Hidup',
      2500000,
      0,
      JSON.stringify([
        'Sekali bayar',
        'Akses permanen tanpa tanggal habis',
        'Max 20 perangkat & 50 pengguna',
        'Semua fitur operasional aktif',
        'Multi-user dan multi cabang',
        'Backup/restore, laporan, retur, hutang/piutang, shift, dan API',
      ]),
      1,
      1,
      new Date().toISOString(),
      20,
      -1,
      -1,
      50,
      lifetimeFlags,
    )
  }
  sqlite.prepare(`
    UPDATE mediasoft_subscription_plans
    SET is_recommended = CASE WHEN name = 'Sekali Beli Seumur Hidup' OR code = 'LIFETIME' THEN 1 ELSE 0 END
  `).run()
  sqlite.prepare(`
    UPDATE mediasoft_subscription_plans
    SET code = 'LIFETIME',
        duration_days = 0,
        max_devices = 20,
        max_users = 50,
        max_transactions_per_day = -1,
        max_products = -1,
        is_active = 1,
        feature_flags = ?
    WHERE name = 'Sekali Beli Seumur Hidup' OR code = 'LIFETIME'
  `).run(lifetimeFlags)

  const trialFlags = JSON.stringify({
    reports: false,
    export_excel: false,
    export_pdf: false,
    multi_user: false,
    backup: false,
    restore: false,
    stock_opname: false,
    debt_management: false,
    shift_management: false,
    api_access: false,
    multi_branch: false,
    return_refund: false,
  })
  const trialPlan = sqlite.prepare(
    `SELECT id FROM mediasoft_subscription_plans WHERE name = 'Trial 3 Hari' LIMIT 1`
  ).get() as { id: number } | undefined
  if (!trialPlan) {
    sqlite.prepare(`
      INSERT INTO mediasoft_subscription_plans
        (name, price, duration_days, features, is_active, is_recommended, created_at,
         max_devices, max_transactions_per_day, max_products, max_users, feature_flags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Trial 3 Hari',
      0,
      3,
      JSON.stringify([
        'Trial terbatas 3 hari',
        '1 device',
        '20 transaksi per hari',
        '30 produk',
        'Fitur premium terkunci',
      ]),
      0,
      0,
      new Date().toISOString(),
      1,
      20,
      30,
      1,
      trialFlags,
    )
  }

  // mediasoft_activity_log
  addCol('mediasoft_activity_log', 'event_type', "TEXT DEFAULT 'general'")

  // mediasoft_ecommerce_api
  addCol('mediasoft_ecommerce_api', 'whatsapp_number', 'TEXT DEFAULT NULL')
  addCol('mediasoft_ecommerce_api', 'payment_link', 'TEXT DEFAULT NULL')
  addCol('mediasoft_ecommerce_api', 'auto_activate', 'INTEGER DEFAULT 0')
  addCol('mediasoft_ecommerce_api', 'activation_plan_id', 'INTEGER DEFAULT NULL')

  // Tabel baru: user_devices
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_devices_username ON mediasoft_user_devices(username)`)
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_devices_status ON mediasoft_user_devices(status)`)
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON mediasoft_user_devices(last_seen_at)`)
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_device ON mediasoft_auth_sessions(username, device_id)`)
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON mediasoft_activity_log(event_type, tgl_aktivitas)`)

  // Tabel baru: popup_rules
  sqlite.exec(`
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
    )
  `)
  addCol('mediasoft_popup_rules', 'image_url', 'TEXT DEFAULT NULL')
  addCol('mediasoft_popup_rules', 'severity', "TEXT DEFAULT 'warning'")
  addCol('mediasoft_popup_rules', 'dismissible', 'INTEGER DEFAULT 1')
  addCol('mediasoft_popup_rules', 'force_popup', 'INTEGER DEFAULT 0')
  addCol('mediasoft_popup_rules', 'force_popup_until', 'TEXT DEFAULT NULL')

  // Seed popup rules
  const popups = [
    ['DEMO_LIMIT',    'Batas Demo Tercapai',   'Anda telah mencapai batas akun demo. Upgrade untuk akses penuh.'],
    ['ACCESS_EXPIRING', 'Trial Hampir Habis', 'Trial Anda segera berakhir. Upgrade sekarang agar transaksi dan data toko tetap berjalan.'],
    ['EXPIRED',       'Langganan Habis',        'Masa langganan Anda sudah berakhir. Perpanjang untuk melanjutkan.'],
    ['FEATURE_LOCKED','Fitur Ini Terkunci',     'Fitur ini tidak tersedia di paket Anda saat ini.'],
    ['DEVICE_LIMIT',  'Batas Device Tercapai',  'Anda telah mencapai batas jumlah device untuk paket ini.'],
    ['TRANSACTION_LIMIT', 'Limit Transaksi Tercapai', 'Limit transaksi harian paket Anda sudah habis. Upgrade paket untuk melanjutkan transaksi.'],
    ['PRODUCT_LIMIT', 'Limit Produk Tercapai', 'Limit jumlah produk paket Anda sudah habis. Upgrade paket untuk menambah produk.'],
  ]
  const insertPopup = sqlite.prepare(
    `INSERT OR IGNORE INTO mediasoft_popup_rules (code, title, description) VALUES (?, ?, ?)`
  )
  for (const [code, title, desc] of popups) insertPopup.run(code, title, desc)

  for (const table of [
    'mediasoft_pengguna',
    'mediasoft_barang',
    'mediasoft_harga',
    'mediasoft_kategori_barang',
    'mediasoft_satuan',
    'mediasoft_supplier',
    'mediasoft_customer',
    'mediasoft_penjualan',
    'mediasoft_penjualan_detail',
    'mediasoft_payment_details',
    'mediasoft_payment_methods',
    'mediasoft_tax_rates',
    'mediasoft_returns',
    'mediasoft_return_items',
    'mediasoft_pembelian',
    'mediasoft_pembelian_detail',
    'mediasoft_kas_drawer',
    'mediasoft_kas_transaksi',
    'mediasoft_stock_opnames',
    'mediasoft_stock_opname_items',
    'mediasoft_backup',
    'mediasoft_activity_log',
    'mediasoft_identitas',
    'mediasoft_subscription_plans',
    'mediasoft_struk_settings',
    'mediasoft_popup_rules',
    'mediasoft_branches',
    'mediasoft_warehouses',
    'mediasoft_promos',
    'mediasoft_employees',
    'mediasoft_employee_contracts',
    'mediasoft_attendance',
    'mediasoft_payroll',
    'mediasoft_payroll_details',
    'mediasoft_tip_pooling',
    'mediasoft_tip_distribution',
    'mediasoft_shift_schedules',
    'mediasoft_kds_orders',
    'mediasoft_kds_order_items',
    'mediasoft_floor_layouts',
    'mediasoft_tables',
    'mediasoft_reservations',
    'mediasoft_recipes',
    'mediasoft_recipe_ingredients',
    'mediasoft_delivery_orders',
    'mediasoft_delivery_vehicles',
    'mediasoft_bank_accounts',
    'mediasoft_bank_transactions',
    'mediasoft_reconciliation',
    'mediasoft_fixed_assets',
    'mediasoft_asset_depreciation',
    'mediasoft_budgets',
    'mediasoft_gift_cards',
    'mediasoft_gift_card_usage',
    'mediasoft_customer_feedback',
    'mediasoft_campaigns',
    'mediasoft_campaign_logs',
    'mediasoft_vendor_portal_settings',
    'mediasoft_storefront_settings',
    'mediasoft_storefront_products',
    'mediasoft_storefront_orders',
    'mediasoft_documents',
    'mediasoft_forecast_settings',
    'mediasoft_forecast_results',
    'mediasoft_dynamic_pricing_rules',
  ]) {
    ensureSyncMetadata(table)
  }
})()

// Feature Tables Migration
;(function migrateNewFeatureTables() {
  // ─── HR & EMPLOYEE ──────────────────────────────────────────────
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_payroll_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_id INTEGER NOT NULL,
      komponen TEXT NOT NULL,
      tipe TEXT NOT NULL,
      jumlah REAL DEFAULT 0,
      keterangan TEXT
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_tip_distribution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tip_pooling_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      jumlah REAL DEFAULT 0,
      persentase REAL DEFAULT 0,
      catatan TEXT
    )
  `)
  sqlite.exec(`
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
    )
  `)

  // ─── KDS & TABLES ───────────────────────────────────────────────
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_floor_layouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kapasitas INTEGER DEFAULT 0,
      width INTEGER DEFAULT 800,
      height INTEGER DEFAULT 600,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)

  // ─── RECIPE ─────────────────────────────────────────────────────
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)

  // ─── DELIVERY ───────────────────────────────────────────────────
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_delivery_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_kendaraan TEXT NOT NULL,
      plat_nomor TEXT NOT NULL,
      jenis TEXT,
      kapasitas_maks REAL,
      biaya_per_km REAL DEFAULT 0,
      status TEXT DEFAULT 'TERSEDIA',
      created_at TEXT NOT NULL
    )
  `)

  // ─── FINANCE ────────────────────────────────────────────────────
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)

  // ─── MARKETING ──────────────────────────────────────────────────
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_gift_card_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gift_card_id INTEGER NOT NULL,
      kd_transaksi TEXT,
      jumlah REAL DEFAULT 0,
      sisa_saldo REAL DEFAULT 0,
      tgl TEXT NOT NULL
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_campaign_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      kd_customer TEXT,
      no_telp TEXT,
      email TEXT,
      status TEXT,
      tgl TEXT NOT NULL,
      error_message TEXT
    )
  `)

  // ─── COMMERCE ───────────────────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_vendor_portal_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id TEXT NOT NULL,
      portal_enabled INTEGER DEFAULT 1,
      token TEXT,
      dapat_melihat_po INTEGER DEFAULT 1,
      dapat_mengirim_invoice INTEGER DEFAULT 1,
      dapat_melihat_status INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)
  sqlite.exec(`
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
    )
  `)

  // ─── DOCUMENTS ──────────────────────────────────────────────────
  sqlite.exec(`
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
    )
  `)

  // ─── FORECASTING ────────────────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_forecast_settings (
      id INTEGER PRIMARY KEY,
      metode TEXT DEFAULT 'MOVING_AVERAGE',
      periode_hari INTEGER DEFAULT 30,
      periode_data INTEGER DEFAULT 90,
      is_active INTEGER DEFAULT 0,
      updated_at TEXT
    )
  `)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mediasoft_forecast_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kd_barang TEXT NOT NULL,
      tgl_forecast TEXT NOT NULL,
      prediksi_penjualan REAL DEFAULT 0,
      confidence_lower REAL DEFAULT 0,
      confidence_upper REAL DEFAULT 0,
      metode TEXT,
      tgl_dibuat TEXT NOT NULL
    )
  `)
  sqlite.exec(`
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
    )
  `)
})()

;(function normalizeLocalDeveloperRole() {
  try {
    sqlite.prepare(`
      UPDATE mediasoft_pengguna
      SET hak_akses = 'developer'
      WHERE hak_akses = 'superadmin'
    `).run()
  } catch (err: any) {
    console.error('[Database Warning] Developer role normalization:', err.message)
  }
})()

export const db = drizzle(sqlite, { schema })
export type DB = typeof db
export { sqlite }

export function reopenDatabase(): void {
  try { sqlite.close() } catch {}
  sqlite = new Database(getDbPath())
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
}
