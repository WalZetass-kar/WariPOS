# Changelog

## [1.0.4] - 2026-10-21

### Fixed

- Sesi tidak lagi terputus sendiri di Android. Nilai sesi yang terenkripsi dibaca
  dari cache memori, dan pembacaan yang gagal tidak lagi dianggap sesi
  kedaluwarsa.
- Akses developer hanya dari peran di database. Pola nama pengguna, nama lengkap,
  dan surel yang tertulis di kode dihapus, akun lama dipromosikan sekali lewat
  migrasi.
- Secret JWT dan kata sandi admin server lisensi dibangkitkan acak, production
  menolak nilai lemah, kata sandi awal tidak lagi dicetak ke log, dan akun wajib
  mengganti kata sandi sebelum memakai endpoint lain.
- Token admin lisensi dienkripsi saat disimpan di database.
- Kredensial Supabase tidak lagi tertulis di dalam kode sumber, semuanya
  dibaca dari environment build.
- Riwayat stok tercatat dengan nama kolom yang sama dengan skema, sebelumnya
  setiap pencatatan gagal diam-diam.
- Metode pembayaran dikonsolidasi ke satu tabel, baris dari tabel lama disalin
  saat aplikasi start.

### Added

- Sinkronisasi multi perangkat dengan antrean mutasi dan aturan konflik eksplisit.
  Transaksi bersifat append-only, stok dikirim sebagai delta, dan perubahan
  dengan waktu yang sama dicatat sebagai konflik untuk ditinjau.
- 36 berkas pengujian dengan 316 test, harness database SQLite in memory dengan
  skema aplikasi, dan 2 skenario end-to-end alur kasir memakai Playwright.
- Pipeline CI dengan audit dependency, CodeQL, coverage, build macOS dan iOS,
  code signing Windows, SBOM CycloneDX, dan provenance.
- Sakelar bahasa Indonesia dan English di Pengaturan Tampilan.
- Lint berjalan tanpa galat pada pemasangan bersih.

### Changed

- Satu lockfile dan satu package manager, dependensi tidak terpakai dibuang,
  folder paket yang usang dikeluarkan dari workspace, dan komponen yang tidak
  lagi dirutekan dihapus.
- Google Sheets memakai satu skrip Apps Script sebagai sumber kebenaran.

## [2.0.0] - 2026-07-22

### 🛠️ Improvements

- huhhh (65083d6)
- tanks for everythink (7ebe7c0)
- update jumat (f9ee5ef)
- update aghhh (fd3d47f)
- tanks for everythink (4110124)
- update besar otw launching (8184d9b)
- update fitur besar (e6d0928)
- part xxxxx (934f2ad)
- update keamanan (43ad927)
- update aplikasi (8b12fa8)
- Update README.md (eb8d03c)
- Update README.md (87ac042)
- pembersih (62ccb91)
- update besar part 3 (44ac1b8)
- update (6fb7f4a)
- ketinggalan (2059089)
- update lagiii (8b86226)
- update besar langganan (323923c)
- update (8e50557)

## [2.0.0] - 2026-07-22

### ✨ New Features

- Complete POS system with Electron + React + Capacitor
- Multi-platform support (Windows, Linux, Android)
- License management system
- Real-time sync between Developer Panel and User Panel
- WhatsApp integration
- Barcode scanner support
- PDF export with jspdf
- Excel export with xlsx/exceljs
- Biometric authentication
- Print queue system
- Backup & restore functionality

### 🐛 Bug Fixes

- Database initialization stability improvements
- Electron preload script reliability
- Android network security configuration

### ⚡ Performance

- Code splitting with manual chunks optimization
- Terser minification with 2-pass compression
- Vendor chunk separation for optimal caching

### 🔒 Security

- Context isolation enabled
- Node integration disabled in renderer
- Certificate pinning for API endpoints
- Demo mode security hardening
- DevTools disabled in production

### 🛠 Improvements

- Professional CI/CD pipeline with GitHub Actions
- Automated release workflow for Windows, Linux, and Android
- Semantic versioning with automated sync
- Generated release notes with SHA256 checksums
