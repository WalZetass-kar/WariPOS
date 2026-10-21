import bcrypt from 'bcryptjs';
import fs from 'fs';
import { db } from './db';
import { config } from './config';

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      email           TEXT    NOT NULL UNIQUE,
      phone           TEXT,
      password_hash   TEXT    NOT NULL,
      role            TEXT    NOT NULL DEFAULT 'user',     -- super_admin | admin | user
      status          TEXT    NOT NULL DEFAULT 'active',   -- active | suspended | banned
      must_change_pwd INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plans (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT    NOT NULL UNIQUE,             -- DEMO | BASIC | PRO | ENTERPRISE
      name          TEXT    NOT NULL,
      description   TEXT,
      price         REAL    NOT NULL DEFAULT 0,
      currency      TEXT    NOT NULL DEFAULT 'IDR',
      duration_days INTEGER NOT NULL DEFAULT 30,
      is_active     INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS features (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT    NOT NULL UNIQUE,
      name        TEXT    NOT NULL,
      description TEXT,
      category    TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan_features (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id     INTEGER NOT NULL,
      feature_id  INTEGER NOT NULL,
      is_enabled  INTEGER NOT NULL DEFAULT 1,
      limit_value INTEGER,                      -- NULL = unlimited
      UNIQUE (plan_id, feature_id),
      FOREIGN KEY (plan_id)    REFERENCES plans(id)    ON DELETE CASCADE,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      plan_id    INTEGER NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'active', -- active | expired | suspended | cancelled
      started_at TEXT    NOT NULL DEFAULT (datetime('now')),
      expired_at TEXT,
      notes      TEXT,
      created_by INTEGER,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );
    CREATE INDEX IF NOT EXISTS idx_subs_user ON user_subscriptions(user_id, status);

    CREATE TABLE IF NOT EXISTS user_feature_overrides (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      feature_id  INTEGER NOT NULL,
      is_enabled  INTEGER NOT NULL,
      limit_value INTEGER,
      UNIQUE (user_id, feature_id),
      FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_tokens (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      device_id      TEXT    NOT NULL,
      device_name    TEXT,
      platform       TEXT,
      refresh_hash   TEXT    NOT NULL,
      last_seen_at   TEXT,
      last_ip        TEXT,
      is_revoked     INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, device_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      device_id     TEXT,
      feature_code  TEXT NOT NULL,
      amount        INTEGER NOT NULL DEFAULT 1,
      period_bucket TEXT NOT NULL,                -- YYYY-MM-DD
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_usage_lookup
      ON usage_logs(user_id, feature_code, period_bucket);

    CREATE TABLE IF NOT EXISTS payments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      plan_id      INTEGER,
      amount       REAL    NOT NULL,
      currency     TEXT    DEFAULT 'IDR',
      method       TEXT,
      status       TEXT    NOT NULL DEFAULT 'pending', -- pending | success | failed | refunded
      external_ref TEXT,
      proof_url    TEXT,
      notes        TEXT,
      paid_at      TEXT,
      approved_by  INTEGER,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS popup_settings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      code            TEXT    NOT NULL UNIQUE,    -- DEMO_LIMIT | EXPIRED | FEATURE_LOCKED
      title           TEXT    NOT NULL,
      description     TEXT,
      cta_text        TEXT,
      cta_url         TEXT,
      whatsapp_number TEXT,
      image_url       TEXT,
      pricing_html    TEXT,
      is_active       INTEGER NOT NULL DEFAULT 1,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      action      TEXT NOT NULL,
      metadata    TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function seed() {
  // ===== Default super admin =====
  const adminCount = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin'`).get() as { c: number };
  if (adminCount.c === 0) {
    const hash = bcrypt.hashSync(config.ADMIN_PASSWORD, 12);
    db.prepare(
      `INSERT INTO users (name, email, password_hash, role, status, must_change_pwd)
       VALUES (?, ?, ?, 'super_admin', 'active', 1)`,
    ).run(config.ADMIN_NAME, config.ADMIN_EMAIL, hash);

    if (config.ADMIN_PASSWORD_GENERATED) {
      // The generated password never reaches the log, it is written to a file
      // that only the owner can read.
      try {
        fs.mkdirSync(config.DATA_DIR, { recursive: true });
        fs.writeFileSync(
          config.CREDENTIALS_FILE,
          `email: ${config.ADMIN_EMAIL}\npassword: ${config.ADMIN_PASSWORD}\n`,
          { mode: 0o600, flag: 'wx' },
        );
        console.warn(
          `[seed] Super admin dibuat. Kredensial awal disimpan di ${config.CREDENTIALS_FILE} (mode 0600).`,
        );
      } catch (err: any) {
        if (err?.code !== 'EEXIST') throw err;
        console.warn(`[seed] Super admin dibuat, file kredensial sudah ada: ${config.CREDENTIALS_FILE}`);
      }
    } else {
      console.warn(`[seed] Super admin dibuat untuk ${config.ADMIN_EMAIL}.`);
    }
  }

  // ===== Master features =====
  const featureMaster: Array<[string, string, string, number]> = [
    ['products', 'Produk', 'core', 10],
    ['categories', 'Kategori', 'core', 20],
    ['transactions', 'Transaksi', 'core', 30],
    ['print_receipt', 'Cetak Struk', 'core', 40],
    ['barcode_scan', 'Scan Barcode', 'tools', 50],
    ['stock', 'Stok Barang', 'core', 60],
    ['discount', 'Diskon', 'finance', 70],
    ['tax', 'Pajak', 'finance', 80],
    ['debt', 'Hutang/Piutang', 'finance', 90],
    ['reports', 'Laporan', 'report', 100],
    ['export_excel', 'Export Excel', 'report', 110],
    ['export_pdf', 'Export PDF', 'report', 120],
    ['multi_cashier', 'Multi Kasir', 'tools', 130],
    ['multi_branch', 'Multi Cabang', 'tools', 140],
    ['backup', 'Backup Data', 'tools', 150],
    ['restore', 'Restore Data', 'tools', 160],
    ['supplier', 'Supplier', 'finance', 170],
    ['customer', 'Customer & Loyalty', 'finance', 180],
    ['shift', 'Shift Kasir', 'tools', 190],
    ['return_refund', 'Return & Refund', 'finance', 200],
  ];
  const insertFeature = db.prepare(
    `INSERT OR IGNORE INTO features (code, name, category, sort_order) VALUES (?, ?, ?, ?)`,
  );
  for (const [code, name, category, sort] of featureMaster) {
    insertFeature.run(code, name, category, sort);
  }

  // ===== Plans =====
  const insertPlan = db.prepare(
    `INSERT OR IGNORE INTO plans (code, name, description, price, duration_days, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
    // Demo plan removed

  // ===== Plan ↔ Features =====
  const planFeatureMap: Record<string, Array<[string, boolean, number | null]>> = {
    DEMO: [
      ['products', true, 30],
      ['categories', true, null],
      ['transactions', true, 20],
      ['print_receipt', true, null],
      ['barcode_scan', true, null],
    ],
    BASIC: [
      ['products', true, 500],
      ['categories', true, null],
      ['transactions', true, null],
      ['print_receipt', true, null],
      ['barcode_scan', true, null],
      ['stock', true, null],
      ['discount', true, null],
      ['reports', true, null],
      ['export_excel', true, null],
      ['backup', true, null],
      ['supplier', true, null],
      ['customer', true, null],
    ],
    PRO: [
      ['products', true, null],
      ['categories', true, null],
      ['transactions', true, null],
      ['print_receipt', true, null],
      ['barcode_scan', true, null],
      ['stock', true, null],
      ['discount', true, null],
      ['tax', true, null],
      ['reports', true, null],
      ['export_excel', true, null],
      ['export_pdf', true, null],
      ['backup', true, null],
      ['restore', true, null],
      ['supplier', true, null],
      ['customer', true, null],
      ['shift', true, null],
      ['return_refund', true, null],
      ['debt', true, null],
      ['multi_cashier', true, null],
    ],
    ENTERPRISE: [], // diisi semua di bawah
    PRO_ANNUAL: [], // diisi semua di bawah
    LIFETIME: [], // diisi semua di bawah
  };

  const allFeatureCodes = featureMaster.map(([c]) => c);
  planFeatureMap.ENTERPRISE = allFeatureCodes.map((c) => [c, true, null]);
  planFeatureMap.PRO_ANNUAL = allFeatureCodes.map((c) => [c, true, null]);
  planFeatureMap.LIFETIME = allFeatureCodes.map((c) => [c, true, null]);

  const upsertPF = db.prepare(`
    INSERT INTO plan_features (plan_id, feature_id, is_enabled, limit_value)
    VALUES ((SELECT id FROM plans WHERE code = ?), (SELECT id FROM features WHERE code = ?), ?, ?)
    ON CONFLICT(plan_id, feature_id)
    DO UPDATE SET is_enabled = excluded.is_enabled, limit_value = excluded.limit_value
  `);

  for (const [planCode, list] of Object.entries(planFeatureMap)) {
    for (const [featureCode, enabled, limit] of list) {
      upsertPF.run(planCode, featureCode, enabled ? 1 : 0, limit);
    }
  }

  // ===== Default popup =====
  const popupCount = db.prepare(`SELECT COUNT(*) AS c FROM popup_settings`).get() as { c: number };
  if (popupCount.c === 0) {
    const insertPopup = db.prepare(
      `INSERT INTO popup_settings (code, title, description, cta_text, cta_url, whatsapp_number, pricing_html)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insertPopup.run(
      'DEMO_LIMIT',
      'Limit Demo Tercapai',
      'Anda telah mencapai batas pemakaian harian akun demo. Upgrade ke paket berbayar untuk akses tanpa batas.',
      'Upgrade Sekarang',
      config.APP_BILLING_URL,
      config.APP_WHATSAPP,
      `<ul><li><b>Basic</b> Rp 99.000/bln</li><li><b>Pro</b> Rp 249.000/bln</li><li><b>Enterprise</b> Rp 599.000/bln</li><li><b>Tahunan</b> Rp 1.999.000/thn</li><li><b>Lifetime</b> Rp 4.999.000 sekali bayar</li></ul>`,
    );
    insertPopup.run(
      'EXPIRED',
      'Langganan Anda Sudah Berakhir',
      'Akun Anda sudah expired. Perpanjang agar bisa mengakses kembali fitur-fitur POS.',
      'Perpanjang Sekarang',
      config.APP_BILLING_URL,
      config.APP_WHATSAPP,
      `<p>Hubungi admin untuk perpanjangan paket.</p>`,
    );
    insertPopup.run(
      'FEATURE_LOCKED',
      'Fitur Ini Terkunci',
      'Fitur yang Anda akses tidak tersedia di paket saat ini. Upgrade untuk membukanya.',
      'Lihat Paket',
      config.APP_BILLING_URL,
      config.APP_WHATSAPP,
      `<p>Upgrade ke <b>Basic</b>, <b>Pro</b>, atau <b>Enterprise</b>.</p>`,
    );
  }

    // Demo user creation removed

  console.log('[seed] Done.');
}

if (require.main === module) {
  migrate();
  seed();
}
