/**
 * Database Initialization
 * Creates all tables needed for the application
 */

import { sqlite } from '../../database/connection.js'

export function initDatabase() {
  console.log(' Initializing database tables...')
  
  try {
    // Tax/PPN
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_tax_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rate REAL NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // Promo
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_promos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // Loyalty
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_loyalty_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        min_points INTEGER NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        benefits TEXT,
        color TEXT DEFAULT '#FFD700',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // Tutorials
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_tutorials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    // Shift, return, debt, and stock opname are operational tables. Keep them
    // available even when the app starts from an older bundled database.
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_number TEXT NOT NULL,
        user_id TEXT NOT NULL,
        start_time TEXT DEFAULT CURRENT_TIMESTAMP,
        end_time TEXT,
        opening_balance REAL DEFAULT 0,
        closing_balance REAL DEFAULT 0,
        expected_balance REAL DEFAULT 0,
        difference REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        total_transactions INTEGER DEFAULT 0,
        notes TEXT,
        status TEXT DEFAULT 'OPEN'
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT NOT NULL UNIQUE,
        penjualan_id TEXT NOT NULL,
        customer_id TEXT,
        total_amount REAL DEFAULT 0,
        refund_method TEXT DEFAULT 'TUNAI',
        reason TEXT,
        status TEXT DEFAULT 'PENDING',
        created_by TEXT,
        approved_by TEXT,
        stock_applied INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT,
        rejected_at TEXT
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_return_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        barang_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        reason TEXT
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_number TEXT NOT NULL,
        type TEXT NOT NULL,
        customer_id TEXT,
        supplier_id TEXT,
        penjualan_id TEXT,
        pembelian_id TEXT,
        total_amount REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL DEFAULT 0,
        due_date TEXT,
        status TEXT DEFAULT 'UNPAID',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'TUNAI',
        reference_number TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_stock_opname (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opname_number TEXT NOT NULL,
        opname_date TEXT NOT NULL,
        total_items INTEGER DEFAULT 0,
        total_difference REAL DEFAULT 0,
        notes TEXT,
        status TEXT DEFAULT 'DRAFT',
        created_by TEXT,
        approved_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_stock_opname_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opname_id INTEGER NOT NULL,
        barang_id TEXT NOT NULL,
        system_stock INTEGER DEFAULT 0,
        physical_stock INTEGER DEFAULT 0,
        difference INTEGER DEFAULT 0,
        notes TEXT
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_daily_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT NOT NULL,
        judul TEXT NOT NULL,
        isi TEXT NOT NULL,
        jenis TEXT DEFAULT 'info',
        username TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()

    sqlite.prepare(`
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
      )
    `).run()

    sqlite.prepare(`
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
      )
    `).run()

    sqlite.prepare(`
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
      )
    `).run()
    
    // Insert default data if empty
    const taxCount = sqlite.prepare('SELECT COUNT(*) as count FROM mediasoft_tax_settings').get() as any
    if (taxCount?.count === 0) {
      sqlite.prepare('INSERT INTO mediasoft_tax_settings (name, rate, is_active) VALUES (?, ?, ?)').run('PPN 10%', 10, 1)
      console.log(' Default tax created')
    }
    
    const loyaltyCount = sqlite.prepare('SELECT COUNT(*) as count FROM mediasoft_loyalty_tiers').get() as any
    if (loyaltyCount?.count === 0) {
      const tiers = [
        { name: 'Bronze', min_points: 0, discount_percent: 0, benefits: '1 point per Rp 10.000', color: '#CD7F32' },
        { name: 'Silver', min_points: 500, discount_percent: 2, benefits: '1.2x point + 2% diskon', color: '#C0C0C0' },
        { name: 'Gold', min_points: 2000, discount_percent: 5, benefits: '1.5x point + 5% diskon', color: '#FFD700' },
        { name: 'Platinum', min_points: 5000, discount_percent: 10, benefits: '2x point + 10% diskon', color: '#E5E4E2' },
      ]
      for (const t of tiers) {
        sqlite.prepare('INSERT INTO mediasoft_loyalty_tiers (name, min_points, discount_percent, benefits, color, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').run(t.name, t.min_points, t.discount_percent, t.benefits, t.color)
      }
      console.log(' Default loyalty tiers created')
    }

    const notifCount = sqlite.prepare('SELECT COUNT(*) as count FROM mediasoft_notification_settings').get() as any
    if (notifCount?.count === 0) {
      sqlite.prepare(`
        INSERT INTO mediasoft_notification_settings (
          id, stok_menipis, stok_habis, hutang_jatuh_tempo, lisensi_expire,
          target_penjualan, min_stok, notif_wa, wa_number, notif_in_app,
          quiet_start, quiet_end
        ) VALUES (1, 1, 1, 1, 1, 0, 5, 0, '', 1, '22:00', '06:00')
      `).run()
      console.log(' Default notification settings created')
    }
    
    console.log(' Database initialization complete')
  } catch (error) {
    console.error(' Database initialization failed:', error)
  }
}
