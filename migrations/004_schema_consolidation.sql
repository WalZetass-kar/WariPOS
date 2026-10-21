-- Konsolidasi skema yang sebelumnya ganda.
--
-- 1. Tabel mediasoft_payment_method (tunggal) adalah sisa versi lama.
--    Aplikasi memakai mediasoft_payment_methods (jamak) sebagai satu-satunya
--    sumber data metode pembayaran. Baris lama yang belum ada di sana
--    disalin masuk, lalu tabel lama ditandai tidak aktif dipakai.
-- 2. Panjang kolom jenis_transaksi dilebarkan supaya cocok dengan tipe
--    Drizzle dan tidak memotong nilai baru.
-- 3. Riwayat stok memakai satu set nama kolom: jenis dan username.

-- ── 1. Metode pembayaran ────────────────────────────────────────────────
INSERT OR IGNORE INTO mediasoft_payment_methods (name, type, is_active, created_at)
SELECT
  nama_method,
  CASE jenis
    WHEN 'CASH' THEN 'TUNAI'
    WHEN 'CARD' THEN 'KARTU'
    WHEN 'EWALLET' THEN 'EWALLET'
    WHEN 'QRIS' THEN 'QRIS'
    WHEN 'TRANSFER' THEN 'TRANSFER'
    ELSE 'TUNAI'
  END,
  CASE WHEN status = 'Aktif' THEN 1 ELSE 0 END,
  datetime('now')
FROM mediasoft_payment_method
WHERE NOT EXISTS (
  SELECT 1 FROM mediasoft_payment_methods m
  WHERE m.type = CASE legacy.jenis
    WHEN 'CASH' THEN 'TUNAI'
    WHEN 'CARD' THEN 'KARTU'
    WHEN 'EWALLET' THEN 'EWALLET'
    WHEN 'QRIS' THEN 'QRIS'
    WHEN 'TRANSFER' THEN 'TRANSFER'
    ELSE 'TUNAI'
  END
);

-- ── 2. Panjang kolom jenis transaksi ─────────────────────────────────────
-- SQLite tidak membatasi panjang VARCHAR seperti MySQL, jadi tidak ada data
-- yang perlu diubah. Bentuk kolom diselaraskan di src/database/baseSchema.ts
-- supaya DDL dan Drizzle punya tipe yang sama.
