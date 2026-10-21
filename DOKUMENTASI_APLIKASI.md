# Dokumentasi Produk & Audit Aplikasi WariPOS

Dokumen acuan untuk audit internal, penyusunan SRS, dan pembuatan website khusus WariPOS.

| Atribut | Nilai |
|---|---|
| Nama produk | WariPOS |
| Versi | 1.0.3 (`package.json`) |
| Deskripsi resmi | Desktop & Mobile Point of Sale Application |
| App ID | `com.wari.pos` |
| Pengembang | WalZetass-Kar |
| Lisensi | MIT |
| Repositori | https://github.com/WalZetass-kar/WariPOS |
| Rilis APK | https://github.com/WalZetass-kar/WariPOS/releases/latest |
| Bahasa antarmuka | Bahasa Indonesia, format mata uang Rupiah (IDR) |
| Tanggal penyusunan dokumen | 20 Oktober 2026 |

Semua angka, nama berkas, dan klaim teknis dalam dokumen ini diambil langsung dari kode sumber repositori pada revisi di atas. Bagian yang belum diimplementasikan ditandai secara eksplisit.

---

## Daftar Isi

1. [Ringkasan Produk](#1-ringkasan-produk)
2. [Posisi Produk dan Audiens](#2-posisi-produk-dan-audiens)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Peta Modul Fitur](#4-peta-modul-fitur)
5. [Rincian Fitur per Domain](#5-rincian-fitur-per-domain)
6. [Peta Layar dan Rute](#6-peta-layar-dan-rute)
7. [Sistem Warna dan Tema](#7-sistem-warna-dan-tema)
8. [Panel Pengembang dan Fitur Developer](#8-panel-pengembang-dan-fitur-developer)
9. [Model Data](#9-model-data)
10. [Lapisan Backend dan Kontrak API](#10-lapisan-backend-dan-kontrak-api)
11. [Sistem Lisensi dan Langganan](#11-sistem-lisensi-dan-langganan)
12. [Sinkronisasi dan Offline-First](#12-sinkronisasi-dan-offline-first)
13. [Keamanan](#13-keamanan)
14. [Kualitas, Pengujian, CI dan Rilis](#14-kualitas-pengujian-ci-dan-rilis)
15. [Performa](#15-performa)
16. [Perbedaan antar Platform](#16-perbedaan-antar-platform)
17. [Aksesibilitas dan UX](#17-aksesibilitas-dan-ux)
18. [Temuan Audit](#18-temuan-audit)
19. [Panduan Penggunaan Dokumen Ini untuk Website](#19-panduan-penggunaan-dokumen-ini-untuk-website)
20. [Glosarium](#20-glosarium)
21. [Lampiran: Indeks Berkas Penting](#21-lampiran-indeks-berkas-penting)

---

## 1. Ringkasan Produk

WariPOS adalah aplikasi kasir (point of sale) dan sistem manajemen retail yang berjalan di tiga bentuk: aplikasi desktop berbasis Electron untuk Windows dan Linux, aplikasi native Android dan iOS berbasis Capacitor, serta antarmuka web yang dibangun dari bundel Vite yang sama.

Arsitekturnya offline-first. Transaksi, pemotongan stok, pencetakan struk, dan pencatatan keuangan ditulis ke database SQLite lokal perangkat. Kasir tetap dapat melayani pembeli ketika koneksi internet terputus, lalu data disinkronkan ketika jaringan kembali tersedia.

Cakupan modul yang sudah berjalan pada kode saat ini:

| Domain | Ringkasan |
|---|---|
| Transaksi POS | Keranjang, promo, PPN, tiga metode pembayaran, QRIS, simpan/tahan transaksi, struk cetak |
| Katalog | Produk, kategori, satuan, barcode, impor CSV, pembaruan harga massal, foto produk |
| Inventori | Stok opname, transfer antar cabang dan gudang, batch, nomor seri, riwayat mutasi |
| Kas dan shift | Modal awal, tutup kas dengan rekonsiliasi, shift kasir, arus kas, petty cash |
| Keuangan | Buku besar, jurnal umum, neraca saldo, pajak, aset tetap, anggaran, rekening bank |
| Relasi | Pelanggan, poin, level loyalitas, pemasok, penilaian pemasok, hutang piutang |
| Sumber daya manusia | Karyawan, kontrak, absensi, penggajian, jadwal shift, komisi sales, tip pooling |
| Restoran | Kitchen display, meja dan tata letak, reservasi, resep dan HPP, kurir, antrian |
|sfnPembayaran | Midtrans, QRIS statis, invoice, permintaan pembayaran manual, cetak struk termal |
| Integrasi | Google Sheets, WhatsApp (Fonnte), marketplace, WooCommerce, toko online, e-commerce API |
|BX Bantuan | WariAI, tutorial, notifikasi, log keamanan, audit trail, backup, display pelanggan, layar antrian |

---

## 2. Posisi Produk dan Audiens

### 2.1 Dua mode operasi

Aplikasi dijalankan dalam dua mode bisnis yang dapat ditukar kapan saja dari sidebar, topbar, atau menu profil pada ponsel.

| Mode | Perilaku |
|---|---|
| Retail (default) | Fokus pada katalog produk, kasir cepat, struk, dan stok |
| Restoran F&B | Menambah grup menu Operasional dan F&B, pemilih nomor meja, tipe pesanan DINE_IN, TAKEAWAY, DELIVERY, nomor antrian otomatis, dan baris tambahan pada struk |

Fitur F&B hanya bisa diakses ketika mode restoran aktif. Penjaga rute berada di `src/apps/routing/RouteGuards.tsx` dengan komponen `RequireRestaurantMode`.

### 2.2 Peran pengguna

Enam peran dengan level numerik, dari `src/shared/config/rbac.ts`:

| Peran | Level | Gambaran singkat |
|---|---|---|
| developer | 50 | Akses penuh, satu-satunya yang boleh membuka Panel Pengembang |
| super_admin | 45 | Alias `superadmin`, setara developer untuk sebagian besar jalur |
| admin | 40 | Alias `owner`, mengelola operasional dan pengguna |
| operator | 30 | Mengelola operasional harian tanpa hak reset data |
| kasir | 20 | Alias `user`, fokus transaksi |
| demo | 10 | Mode baca, seluruh jalur tulis diblokir |

Penegatasan kontrol terjadi di tiga lapis: penjaga rute di sisi renderer, `shouldBlockChannel` pada `src/backend/middleware/demoGuardV2.ts`, dan sesi otoritatif di proses utama melalui `demoSessionManager`.

### 2.3 Terminal yang dituju

| Terminal | Peran |
|---|---|
| Meja kasir Windows di toko | Kasir butuh layanan cepat, struk termal Bluetooth, dan offline penuh |
| Tablet kasir Android | Tim yang berpindah lokasi, butuh mode restoran, nomor meja, dan KDS |
| Layar TV dan display pelanggan | Menampilkan antrian dan keranjang yang sedang berjalan |
| Ponsel untuk staf | Cek harga di rak, stok opname, input penjualan di luar meja kasir |
| Pengembang dan super admin | Panel lisensi, manajemen paket, monitoring perangkat |

---

## 3. Arsitektur Sistem

### 3.1 Lapisan

```
┌────────────────────────────────────────────────────────────┐
│ Renderer (React 18 + Tailwind 3.4 + Vite 5)               │
│  75 halaman · HashRouter · lazy-load · contexts + hooks   │
└───────────────┬────────────────────────────────────────────┘
                │ window.api.invoke (IPC)  |  mobileApi (fallback)
┌───────────────┴──────────────────┐  ┌──────────────────────┐
│ Electron Main (src/main)          │  │ Capacitor Native     │
│  ipcHandlers · syncServer        │  │  SQLite, Barcode,    │
│  syncClient · platformSecurity    │  │  Filesystem, Network │
│  secureStorage · sentry           │  │  LocalNotifications  │
└───────────────┬──────────────────┘  └──────────┬───────────┘
                │                                   │
┌───────────────┴───────────────────────────────────┴───────────┐
│ Backend (src/backend)  Controller → Model → Service          │
│  56 controller · 24 model · 20 service · 3 middleware        │
└───────────────┬───────────────────────────────────────────────┘
                │
┌───────────────┴───────────────────────────────────────────────┐
│ Data                                                            │
│  SQLite lokal (better-sqlite3 / @capacitor-community/sqlite)  │
│  123 tabel mediasoft_* · 47 index eksplisit · 2 view          │
│  License server (Express + SQLite) · Supabase Edge Function    │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 Skrip build dan runtime

| Bagian | Teknologi | Sumber |
|---|---|---|
| Antarmuka | React 18, TypeScript 5.4 | `src/renderer` |
| Bundler | Vite 5, base `./`, alias `@` ke `src/renderer` | `vite.config.ts` |
| Bentuk | Electron 31 | `src/main` |
| Native mobile | Capacitor 8 | `android/`, `ios/`, `capacitor.config.ts` |
| Database | better-sqlite3 11, Drizzle ORM 0.33 | `src/database` |
| State | Store buatan sendiri berbasis `useSyncExternalStore` | `src/renderer/stores` |
| Server lisensi | Express, better-sqlite3, JWT, bcryptjs, Zod | `license-server/` |
| Cloud | Supabase (Auth, Postgres, Edge Function) | `supabase/` |
| Pengujian | Vitest 1.6, jsdom, Testing Library | `tests/` |
| Grafik | Recharts | `src/renderer/pages/Laporan.tsx` |
| Cetak | jsPDF, jspdf-autotable, ExcelJS, html2canvas, react-to-print | `src/renderer/utils` |

Catatan akurasi: `zustand` tercatat di `package.json` tetapi tidak dipakai di mana pun pada `src/`. State dikelola oleh `appStore.ts` dan `cartStore.ts` yang merupakan implementasi `useSyncExternalStore` buatan sendiri.

### 3.3 Struktur direktori

| Direktori | Isi |
|---|---|
| `src/renderer` | Halaman, komponen, hooks, contexts, utils, styles, stores, license client |
| `src/backend` | Controller, model, service, middleware, utils, http |
| `src/database` | Skema Drizzle, DDL dasar, koneksi, migrasi |
| `src/main` | Proses utama Electron, IPC, sinkronisasi, keamanan platform |
| `src/shared` | Tipe bersama, validasi, RBAC, helper Google Sheets, Sanitizer |
| `src/platform` | Hanya README, penanda batas desktop, mobile, dan web |
| `src/apps` | Shell aplikasi, tabel rute alternatif, penjaga rute |
| `license-server` | Server lisensi Express mandiri |
| `supabase` | Skema SQL lisensi dan Edge Function `mediasoft-license` |
| `scripts` | Build, signing Android, QA stress, sinkronisasi versi |
| `migrations` | SQL untuk lisensi dan pengetatan kontrol akses |
| `tests` | 27 berkas pengujian |

---

## 4. Peta Modul Fitur

### 4.1 Modul transaksi

| Kemampuan | Detail |
|---|---|
| Katalog | Grid kartu foto atau tampilan daftar, pencarian instan pada nama, kode, dan barcode, filter kategori dengan penghitung |
| Pemindaian barcode | Scanner hardware USB atau wireless lewat keyboard wedge dengan timeout antar ketik 300 ms, plus pemindai kamera bawaan ponsel dengan torch, pilihan kamera depan dan belakang, mode satu kali atau berkelanjutan, getaran haptik |
| Keranjang | Pengatur jumlah dengan batas stok, diskon per item, total baris |
| Pelanggan | Pencarian nama atau telepon, tampilan poin, maksimal 8 pelanggan aktif teratas |
| Tipe pesanan | DINE_IN, TAKEAWAY, DELIVERY plus nomor meja, khusus mode restoran |
| Pembayaran | Tunai dengan kalkulator kembalian, Transfer, QRIS |
| Uang tunai cepat | Tombol nominal dibangun dari `getSmartCashAmounts`: uang pas, pembulatan ke atas dalam denomination Indonesia, hingga 6 tombol |
| Promo | Kode promo divalidasi terhadap minimum belanja, batas pakai, dan diskon maksimum |
| PPN | Selector Non-PPN atau PNN persentase, taken dari `tax:getActiveRate` dengan fallback 11 |
| Tahan transaksi | Maksimum 10 keranjang tertahan, tersimpan di `localStorage` |
| QRIS | Pembuatan sesi QR, polling status tiap 3 detik, pembayaran otomatis saat status paid, konfirmasi manual untuk QR statis, pembatalan |
| Struk | Modal struk dengan animasi keluar kertas termal, cetak, bagikan ke WhatsApp, simpan PNG, transaksi baru |
| Nomor antrian | Nomor harian otomatis, dikirim ke display pelanggan |

### 4.2 Modul inventori

| Kemampuan | Detail |
|---|---|
| Stok opname | Sesi opname, input stok fisik per item, selisih, persetujuan, hapus |
| Transfer | Antar cabang, antar gudang, riwayat transfer |
| Batch dan seri | Nomor batch dengan tanggal kedaluwarsa, nomor seri dengan status AVAILABLE, SOLD, RETURNED |
| Saldo per lokasi | Ringkasan stok per cabang dan gudang |
| Riwayat mutasi | Buku besar stok: barang masuk, keluar, penyesuaian |
| Impor produk | Impor CSV dengan unduhan templat |
| Pembaruan harga massal | Pemilih mode, pratinjau persentase, terapkan ke sekumpulan produk |
| Barcode otomatis | Prefix barcode dari identitas toko, nomor berikutnya, panjang 13 karakter |
| Resep dan HPP | Bill of materials, persentase terpakai, kalkulasi HPP, riwayat penggunaan |

### 4.3 Modul keuangan

| Kemampuan | Detail |
|---|---|
| Laporan penjualan | Rentang tanggal, tren harian, perbandingan penjualan, modal, laba |
| Laba rugi | Perhitungan laba kotor usaha dan margin |
| Produk terlaris | Peringkat produk dalam rentang terpilih |
| Stok | Ketersediaan stok, produk paling menipis, donat stok aman dan menipis |
| Pelanggan | Total belanja per pelanggan |
| Ekspor | PDF, Excel, CSV, dan Google Sheets |
| Akuntansi | Bagan akun, jurnal debit kredit, neraca saldo |
| Aset tetap | Kode aset, masa manfaat, metode garis lurus dan saldo menurun, nilai buku, riwayat penyusutan |
| Anggaran | Anggaran per kategori, realisasi, sisa |
| Rekening bank | Mutasi, rekonsiliasi, riwayat rekonsiliasi |
| Pajak | Ringkasan periode pajak |
| Arus kas dan petty cash | Alur masuk keluar kas |

### 4.4 Modul sumber daya manusia

| Kemampuan | Detail |
|---|---|
| Karyawan | Data diri, NIK, gaji pokok, tunjangan, jam kerja per hari, status Aktif, Cuti, Resign |
| Kontrak | Nomor kontrak, jenis kontrak, masa percobaan, hak cuti tahunan,. Keputusan putuskan kontrak |
| Absensi | Jam masuk dan keluar, lokasi, foto, keterlambatan dalam menit |
| Penggajian | Komponen Pengambah dan Pengurang, potongan BPJS dan PPh, slip gaji cetak, persetujuan, tandai sudah dibayar |
| Jadwal shift | CRUD jadwal, penugasan massal |
| Komisi sales | Target dan persentase komisi, riwayat per staf |
| Tip pooling | Pool tip dan distribusi ke karyawan |

### 4.5 Modul restoran

| Kemampuan | Detail |
|---|---|
| Kitchen display | Papan pesanan langsung, rata-rata waktu masak, konfirmasi status, panggil nomor antrian ke TV dan speaker, hapus riwayat |
| Meja dan tata letak | Layout lantai, posisi dan bentuk meja, kapasitas, status KOSONG, TERISI, RESERVASI, MAINTENANCE, QR per meja |
| Reservasi | Nomor reservasi, jumlah tamu, jam, sumber MANUAL, ONLINE, WHATSAPP, deposit, pembatalan |
| Resep | Hasil produksi, biaya produksi, margin, waktu produksi |
| Pengiriman | Nomor delivery, koordinat, jarak, ongkir, kurir, bukti foto, tanda tangan, armada kendaraan |

### 4.6 Modul komunikasi dan integrasi

| Kemampuan | Detail |
|---|---|
| WhatsApp | Provider Fonnte, API key, nomor, rate limit per menit, template, kanal, jam tenang |
| Broadcast | Pemilihan audiens, progres persentase, status per penerima, riwayat |
| Google Sheets | Apps Script Web App, uji koneksi, ekspor dashboard dan laporan, ekspor otomatis |
| AI | Provider Gemini atau OpenAI-compatible, API key, base URL, daftar model, uji koneksi, aksi terstruktur |
| Marketplace | Kanal toko, pemetaan SKU lokal ke SKU marketplace, sinkron stok, log sinkron, peringatan produk belum terpetakan |
| E-commerce API | Generate dan rotasi API key, dokumentasi, contoh penggunaan, WooCommerce, antrean sinkron stok |
| Toko online | Pengaturan toko, katalog online, pesanan online, perubahan status pesanan |
| Pembayaran | Midtrans Snap dan QRIS, QRIS statis berupa gambar, riwayat sesi, gateway dan kunci API |

---

## 5. Rincian Fitur per Domain

### 5.1 Autentikasi dan sesi

| Kemampuan | Detail teknis |
|---|---|
| Login kata sandi | Username atau email, bcrypt cost 12, SHA-1 lama dimigrasi otomatis, pengguna non-bcrypt dipaksa ganti sandi saat boot |
| Login PIN kasir | 4 sampai 8 digit, hash bcrypt pada kolom terpisah, key rate limiter terpisah dari kata sandi |
| Pendaftaran akun trial | Nama, nama toko, username, email, telepon, kata sandi, konfirmasi |
| Sesi | Token acak 32 byte, hanya hash SHA-256 yang disimpan, TTL 8 jam, revocation, `last_seen_at` |
| Timeout idle | 30 menit, peringatan toast 2 menit sebelum logout |
| Biometrik | `@capgo/capacitor-native-biometric` untuk buka aplikasi di perangkat native |
| Ingat username | Tersimpan di penyimpanan lokal |
| Modal wajib | Ganti kata sandi saat `must_change_password`, lengkapi identitas toko pada pemasangan baru |
| Indikator database | Lampu status koneksi database di halaman login |

### 5.2 Dashboard

Dua tab, Operasional dan Analisis, tab Analisis hanya untuk admin.

| Kartu dan grafik | Detail |
|---|---|
| Omzet hari ini | Total dan ringkasan struk |
| Uang di laci | Saldo kas drawer aktif |
| Perlu dicek | Peringatan stok menipis dan stok habis |
| Tren omzet | Grafik 7 hari |
| Produk terlaris | Minggu berjalan |
| Transaksi terakhir | 5 transaksi |
| Jam paling ramai | Statistik 30 hari |
| Kinerja kasir | Perbandingan antar kasir |
| Segmen pelanggan | VIP, aktif, nonaktif, ambang VIP Rp 1.000.000 |
| Ekspor | Tombol kirim ringkasan dashboard ke Google Sheets |
| Data contoh | Muat Data Contoh Toko untuk demo |
| Tutup shift | Modal tutup shift dengan hitung laci dari dashboard |

### 5.3 Struk dan pencetakan

| Jalur | Detail |
|---|---|
| ESC/POS Bluetooth | Web Bluetooth, service UUID diuji berurutan: `000018f0-…`, `e7810a71-…` Posnet, `49535343-…` ISSC, `0000ff00-…`, lalu seluruh primary service. Perintah init, align, bold, double height, double width, underline, feed, cut paper, drawer kick. Lebar 58 mm 32 kolom dan 80 mm 48 kolom dengan word wrap dinamis. Penulisan dipecah 128 byte dengan jeda 25 ms. Tersedia uji cetak |
| Cetak browser | `react-to-print` dengan `@page { size:auto; margin:0 }` dan `print-color-adjust: exact` |
| PDF | jsPDF dengan tinggi dinamis 80 mm, tanpa potongan halaman. Stiker meja 90 x 120 mm |
| Berkas lunak | html2canvas skala 2, simpan sebagai PNG, melalui `Filesystem` Capacitor di native dan unduhan di web |
| Excel | XLSX dari data struk |
| WhatsApp | Nomor dinormalisasi 08 menjadi 62, pesan berisi nomor transaksi, nomor antrian, tanggal, tipe pesanan, kasir, pelanggan, daftar item, subtotal, PPN, promo, total, metode, bayar, kembalian |
| Pengaturan struk | Jenis printer termal, A4, dot matrix; ukuran 58 atau 80 mm; tipe layout; toggle logo, alamat, telepon, email, kasir, pelanggan; footer; unggah gambar QRIS |
| Antrean cetak | Antrean pekerjaan, proses berikutnya, retry gagal, hapus, pengaturan printer, daftar printer |
| Fallback | Bila tidak ada printer Bluetooth, struk otomatis disimpan sebagai PDF dan pengguna diberi tahu |

### 5.4 Manajemen kas dan shift

| Kemampuan | Detail |
|---|---|
| Buka shift | Nomor shift unik, modal awal kasir, modal pembuka laci |
| Tutup shift | Saldo awal, saldo akhir, saldo yang diharapkan, selisih, total penjualan, jumlah transaksi |
| Audit tutup kas | Status seimbang, surplus, atau defisit |
| Transaksi kas | Pemasukan dan pengeluaran, riwayat, hapus |
| Kartu kas | Modal awal, total penjualan, total pengeluaran, kas seharusnya, transaksi hari ini |
| Rekap shift | Laporan siap cetak |

### 5.5 Pelanggan dan loyalitas

| Kemampuan | Detail |
|---|---|
| Data pelanggan | Nama, telepon, alamat, status aktif, catatan |
| Poin | Satu poin per Rp 10.000 subtotal,level tier menentukan diskon |
| Level loyalitas | Minimum poin, persen diskon, manfaat, warna level |
| Riwayat pembelian | Modal per pelanggan |
| Kartu member | Data kartu keanggotaan |
| Feedback | Rating, kategori, status BARU, DIBACA, DIBALAS |
| Segmentasi | VIP di atas Rp 1.000.000 total belanja |

### 5.6 Pengaturan sistem

Sembilan kategori dengan kotak pencarian, dapat ditautkan lewat `?category=` dan `?tab=`.

| Kategori | Isi |
|---|---|
| Tampilan | 18 warna tema ditambah pemilih hex, mode light, dark, system, auto, jadwal gelap otomatis, ukuran huruf compact, normal, large, radius sharp, medium, rounded |
| Akun | Profil pengguna, foto, nama lengkap, email, telepon, ganti sandi |
| Sinkronisasi | Aktifkan sinkron, mode server atau client, port 38573, base URL, token, nama perangkat, data pairing QR, uji koneksi, ganti token, daftar perangkat terhubung |
| Toko | Nama, telepon, WhatsApp owner, email owner, alamat, PPN persen, footer struk, prefix barcode, mode Retail atau Restoran |
| Perangkat | Lokasi database lokal, platform, versi aplikasi, pemakaian storage |
| Notifikasi | Stok minimum, retensi backup, toggle notifikasi |
| Backup | Auto-backup dan jumlah hari retensi |
| Jaringan | URL Google Sheets Apps Script, uji ekspor, ekspor dashboard otomatis, konfigurasi AI |
| Tentang | Versi, nomor WhatsApp dukungan yang bisa diedit, muat data contoh, zona berbahaya reset semua data dengan konfirmasi ketik `RESET SEMUA DATA` |

### 5.7 AI assistance (WariAI)

| Kemampuan | Detail |
|---|---|
| Percakapan | Kirim pesan, salin, jawab ulang, percakapan baru, hapus riwayat |
| Pengaturan | Provider, API key, model |
| Aksi cepat | Restock semua, analisis performa penjualan, deteksi stok menipis, optimasi HPP, backup database, buka semua tab, ringkasan bisnis |
| Mesin aksi | RESTOCK, RESTOCK_ALL, CREATE_PRODUCT, UPDATE_PRICE, CREATE_PROMO, BACKUP, NAVIGATE, NAVIGATE_LIST, CHANGE_THEME |
| Keluar aplikasi | `window` event `waripos:change-theme` untuk mengganti warna, mode, ukuran huruf, dan radius |

### 5.8 Display pelanggan dan layar antrian

| Layar | Isi |
|---|---|
| Display pelanggan | Cerminan keranjang langsung, subtotal, total, nama toko, nomor antrian, nomor meja, nama pelanggan, status idle, scanning, paying_qris, success, gambar QRIS. Sinkron lewat `BroadcastChannel`, `localStorage`, polling 1 detik, dan `postMessage` |
| Layar antrian | Daftar Preparing, Ready, Currently called, marquee berjalan, jam digital, pemanggilan suara dengan Web Speech API `id-ID` dan bunyi ding-dong, layar penuh |
| Halaman kendali | Buka jendela display, URL untuk Smart TV, panduan pemasangan TV, editor marquee, pemanggilan nomor manual, status antrian harian |

### 5.9 Keamanan dan jejak audit

| Modul | Isi |
|---|---|
| Log keamanan | Status keamanan, keamanan login, wymusz sandi kuat, kontrol sesi dan logout jarak jauh, 2FA, whitelist IP |
| Activity log | Daftar aktivitas dengan filter, hapus satu, hapus log lama |
| Audit trail | Riwayat perubahan dengan tampilan detail selisih nilai lama dan baru |
| Error log | Jenis error, pesan, stack trace, konteks, pengguna |
| Perangkat | Daftar perangkat aktif, revoking perangkat, batas perangkat per paket |

---

## 6. Peta Layar dan Rute

Tabel rute utama berada di `src/renderer/routes.tsx` dengan 80 deklarasi `path`. Semua halaman dimuat lewat `React.lazy`, dan delapan halaman inti dimuat saat idle lewat `preloadCorePages()`.

| Rute | Halaman | Peran minimum |
|---|---|---|
| `/login` | Login | publik |
| `/` | Dashboard | kasir |
| `/transaksi` | Kasir POS | kasir |
| `/produk` | Katalog Produk | kasir |
| `/kategori`, `/satuan` | Kategori, Satuan | kasir |
| `/riwayat` | Riwayat Transaksi | kasir |
| `/shifts` | Shift Kasir | kasir |
| `/kas` | Arus Kas | kasir |
| `/laporan` | Laporan Keuangan | operator |
| `/settings` | Pengaturan | kasir |
| `/users` | Kelola Pengguna | admin |
| `/security` | Log Keamanan | admin |
| `/audit-trail`, `/activity-log` | Jejak Audit, Activity Log | admin |
| `/backup` | Backup Database | developer |
| `/branch` | Cabang dan Transfer | developer |
| `/stock-opname` | Stok Opname | operator |
| `/stock-transfer` | Transfer Stok | operator |
| `/stock-history` | Riwayat Stok | kasir |
| `/price-list`, `/label-print` | Daftar Harga, Label Cetak | kasir |
| `/purchase` / `/pembelian` | Pembelian Stok | operator |
| `/supplier`, `/supplier-rating` | Pemasok, Rating | operator |
| `/customer` | Pelanggan dan Poin | kasir |
| `/loyalty`, `/membership-card` | Loyalitas, Kartu Member | operator |
| `/sales-commission` | Komisi Sales | admin |
| `/debts` | Hutang Piutang | operator |
| `/returns` | Retur Barang | operator |
| `/accounting` | Buku Akuntansi | operator |
| `/tax-report` | Laporan Pajak | operator |
| `/petty-cash`, `/cash-flow` | Petty Cash, Arus Kas | operator |
| `/bank-account` | Rekening Bank | operator |
| `/fixed-asset`, `/budget` | Aset Tetap, Anggaran | operator |
| `/promo` | Promo dan Diskon | operator |
| `/gift-card` | Gift Card | operator |
| `/campaign` | Kampanye | operator |
| `/storefront` | Toko Online | operator |
| `/marketplace` | Marketplace | operator |
| `/ecommerce-api` | E-commerce API | operator |
| `/payment-automation` | Pembayaran Digital | operator |
| `/payment`, `/subscription`, `/my-subscription` | Status dan Langganan | kasir |
| `/license-admin` | Panel Pengembang | developer |
| `/developer/*` | Panel Pengembang | developer |
| `/assistant` | WariAI | kasir |
| `/whatsapp` | WhatsApp Notifikasi | operator |
| `/print-queue` | Antrean Print | kasir |
| `/hpp` | Kalkulator HPP | operator |
| `/tutorials` | Tutorial dan Panduan | kasir |
| `/integrations` | Integrasi | operator |
| `/notification-settings` | Notifikasi | kasir |
| `/employee`, `/employee-contract`, `/attendance`, `/payroll`, `/shift-schedule` | Modul SDM | operator |
| `/tip-pooling` | Tip Pooling | operator |
| `/kitchen-display`, `/table-management`, `/reservation`, `/recipe`, `/delivery` | Modul restoran | mode restoran |
| `/customer-display`, `/queue-display` | Layar display dan antrian | di luar AppLayout |
| `/customer-display-page` | Display dan Antrian | kasir |
| `/daily-notes` | Catatan Harian | kasir |
| `/advanced-inventory` | Dialihkan ke `/branch` | tidak dipakai |

Halaman yang ada di kode namun tidak dirutekan: `OwnerDashboard.tsx`, `LicenseAdmin.tsx`, `SubscriptionPlans.tsx`, `Tax.tsx`, `AdvancedInventory.tsx`. `src/apps/user-panel/UserPanelRoutes.tsx` berisi 33 slug lama dan tidak diimpor oleh router aktif.

---

## 7. Sistem Warna dan Tema

### 7.1 Mekanisme

Token warna berada di `src/renderer/styles/themes.css` sebagai variabel CSS `--color-primary-50` sampai `--color-primary-900`, ditambah `--glass-shadow-rgb`, `--chart-bar-color`, dan empat token scrollbar. Tema dipasang sebagai atribut `data-theme` pada elemen `<html>`. Switching memakai `document.startViewTransition` dengan kelas `.theme-switching` untuk menekan transisi selama pergantian.

| Aspek | Nilai |
|---|---|
| Jumlah tema bawaan | 18 |
| Mode tampilan | light, dark, system, auto |
| Mode system | Mengikuti `prefers-color-scheme` secara langsung |
| Mode auto | Jadwal gelap, default 18.00 sampai 06.00, dicek tiap 60 detik, sadar jam melingkar |
| Ukuran huruf | compact, normal, large |
| Radius | sharp, medium, rounded |
| Warna kustom | Pemilih hex yang menurunkan seluruh skala 50 sampai 900, `--glass-shadow-rgb`, dan `--chart-bar-color` |
| Penyimpanan | `waripos_theme_color`, `theme`, `waripos_theme_mode`, `waripos_font_size`, `waripos_border_radius`, `waripos_auto_schedule_start`, `waripos_auto_schedule_end` |

Keterangan penting untuk website: aplikasi tidak punya tema OLED khusus. Mode gelap tersedia dan bekerja, tetapi tidak ada palet hitam pekat tersendiri. Pernyataan "tiga mode, termasuk OLED" pada README lama tidak sesuai dengan kode saat ini.

### 7.2 Palet 18 tema

Nilai diambil dari `src/renderer/styles/themes.css`.

| Tema | 50 | 500 | 600 | 700 | Nama warna |
|---|---|---|---|---|---|
| crimson | `#fff1f2` | `#f43f5e` | `#e11d48` | `#be123c` | Merah POS |
| rose | `#fff1f2` | `#f43f5e` | `#e11d48` | `#be123c` | Merah muda |
| indigo | `#eef2ff` | `#6366f1` | `#4f46e5` | `#4338ca` | Indigo roy |
| blue | `#eff6ff` | `#3b82f6` | `#2563eb` | `#1d4ed8` | Biru safir |
| emerald | `#ecfdf5` | `#10b981` | `#059669` | `#047857` | Hijau zamrud |
| green | `#f0fdf4` | `#22c55e` | `#16a34a` | `#15803d` | Hijau |
| teal | `#f0fdfa` | `#14b8a6` | `#0d9488` | `#0f766e` | Teal |
| cyan | `#ecfeff` | `#06b6d4` | `#0891b2` | `#0e7490` | Sian |
| sky | `#f0f9ff` | `#0ea5e9` | `#0284c7` | `#0369a1` | Langit |
| amber | `#fffbeb` | `#f59e0b` | `#d97706` | `#b45309` | Amber |
| orange | `#fff7ed` | `#f97316` | `#ea580c` | `#c2410c` | Oranye |
| gold | `#fefce8` | `#eab308` | `#ca8a04` | `#a16207` | Emas |
| pink | `#fdf2f8` | `#ec4899` | `#db2777` | `#be185d` | Pink |
| violet | `#f5f3ff` | `#8b5cf6` | `#7c3aed` | `#6d28d9` | Violet |
| purple | `#faf5ff` | `#a855f7` | `#9333ea` | `#7e22ce` | Ungu |
| slate | `#f8fafc` | `#64748b` | `#475569` | `#334155` | Slate |
| coffee | `#fdf8f6` | `#a27255` | `#8b5536` | `#74432a` | Kopi |

Dokumen ini tidak memuat warna hexadecimal di dalam byte. Seluruh warna berasal dari stylesheet aplikasi.

### 7.3 Aturan kontras

Komentar di `themes.css` menyatakanANCANGAN bahwa warna 600 sampai 700 dipilih agar rasio kontras terhadap teks putih mencapai minimal 4.5:1 sesuai WCAG AA, sementara 50 sampai 300 dipakai untuk permukaan dan badge, dan 400 sampai 500 untuk aksen dan visualisasi data. Warna dengan kontras paling rendah untuk tombolFilled adalah `gold` 700 `#a16207` dan `amber` 700 `#b45309`.

---

## 8. Panel Pengembang dan Fitur Developer

### 8.1 Panel Pengembang

Halaman `/license-admin` dengan `src/renderer/pages/LicenseCenter.tsx` dan subfolder `src/renderer/pages/license/`. Layout mandiri di `src/apps/developer-panel/DeveloperPanelLayout.tsx`, dijaga `RequireDeveloperPanel`. Total 17 tab dalam 5 kelompok.

| Kelompok | Tab |
|---|---|
| Ringkasan dan Server | Dashboard, Koneksi Server, Pendapatan |
| Pembeli dan Lisensi | Data Pembeli, Perangkat, Persetujuan Lisensi |
| Produk dan Paket | Paket Lisensi, Fitur Premium, Popup Upgrade |
| Operasional dan Update | Update Aplikasi, Broadcast Pesan, Log Error |
| Alat Sistem dan Backup | Pengguna Lokal, Backup Database, Log Keamanan, Activity Log, E-commerce API |

Modul admin terpisah di `src/renderer/license/admin/pages/`: DashboardPage, FeaturesPage, PaymentsPage, PlansPage, PopupsPage, UsersPage.

### 8.2 Kemampuan khas developer

| Kemampuan | Detail |
|---|---|
| Manajemen paket | Buat dan ubah paket, pemetaan fitur per paket dengan batas nilai |
| Manajemen fitur | Kode fitur, nama, kategori, urutan, status aktif |
| Popup upgrade | Kode, judul, teks tombol, URL, nomor WhatsApp, HTML harga, aturan pemicu, tingkat keseriusan, popup paksa sampai tanggal |
| Persetujuan pembayaran | Daftar pembayaran manual, setujui, tolak, hapus |
| Manajemen pembeli | Buat akun pembeli, ubah paket, reset kata sandi |
| Manajemen perangkat | Lihat perangkat, blokir, buka blokir |
| Pendapatan | Agregasi pembayaran per periode |
| Popup publik | Ambil popup konfigurasi dari server untuk ditampilkan ke pengguna |
| Update aplikasi | Riwayat versi, catatan rilis, URL unduhan, penanda kritis |
| Broadcast pesan | Pengumuman ke semua perangkat, dikirim lewat `BroadcastChannel` dan polling tiap 5 menit |
| Log error | Persistensi ke `mediasoft_error_logs` |

### 8.3 Perintah build

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Vite dev server plus jendela Electron |
| `pnpm dev:mobile` | Server Vite di `0.0.0.0:5173` untuk akses jaringan lokal |
| `pnpm dev:license` | Server lisensi dalam mode watch |
| `pnpm build:desktop` | Aset web plus proses utama Electron |
| `pnpm desktop:win:installer` | Installer Windows NSIS 64 bit, dibangun lewat Wine dari Linux |
| `pnpm desktop:linux` | AppImage, deb, dan tar.gz |
| `pnpm android:release` | APK rilis bertanda tangan |
| `pnpm android:aab` | Android App Bundle untuk Play Store |
| `pnpm ios:sync` | Sinkron aset ke proyek iOS |
| `pnpm typecheck` | Type check dua tsconfig |
| `pnpm test` | Seluruh unit test Vitest |
| `pnpm lint` | ESLint pada `src/**/*.ts` dan `src/**/*.tsx` |
| `pnpm qa:stress` | QA beban dengan kloning database, 1000 produk, 125 transaksi, uji pemulihan korrupsi |
| `pnpm sync:test` | Uji sinkronisasi perangkat |

---

## 9. Model Data

### 9.1 Angka ringkas

| Metrik | Nilai |
|---|---|
| Tabel `mediasoft_*` | 123 |
| Index eksplisit | 47 |
| View | 2 (`v_payment_summary`, `v_daily_settlement`) |
| Skema Drizzle | Sekitar 60 tabel |
| Skema SQL dasar | `src/database/baseSchema.ts`, 1411 baris |
| Mode jurnal | WAL, `foreign_keys = ON` |
| Lokasi database | `userData/sistem_pos.db` saat sudah dipaketkan, `process.cwd()` saat pengembangan |

### 9.2 Kelompok tabel

| Kelompok | Tabel utama |
|---|---|
| Identitas dan akses | `mediasoft_identitas`, `mediasoft_pengguna`, `mediasoft_auth_sessions`, `mediasoft_grup_pengguna`, `mediasoft_grup_pengguna_hak_akses`, `mediasoft_user_devices`, `mediasoft_user_preferences`, `mediasoft_security_settings` |
| Katalog | `mediasoft_barang`, `mediasoft_harga`, `mediasoft_harga_temp`, `mediasoft_histori_harga`, `mediasoft_kategori_barang`, `mediasoft_satuan`, `mediasoft_barang_batches`, `mediasoft_barang_serials`, `mediasoft_product_images`, `mediasoft_barcode_settings`, `mediasoft_currencies`, `mediasoft_tax_settings` |
| Penjualan dan pembelian | `mediasoft_penjualan`, `mediasoft_penjualan_detail`, `mediasoft_pembelian`, `mediasoft_pembelian_detail`, `mediasoft_penyetokkan`, `mediasoft_penyetokkan_detail` |
| Stok | `mediasoft_stok`, `mediasoft_branches`, `mediasoft_warehouses`, `mediasoft_warehouse_stock`, `mediasoft_stock_transfers`, `mediasoft_stock_history`, `mediasoft_stock_opname`, `mediasoft_stock_opname_details` |
| Kas dan shift | `mediasoft_shifts`, `mediasoft_kas_drawer`, `mediasoft_kas_transaksi`, `mediasoft_historiprint_*` |
| Pembayaran | `mediasoft_payment_method`, `mediasoft_payment_methods`, `mediasoft_payment_transaction`, `mediasoft_payment_details`, `mediasoft_payment_refund`, `mediasoft_payment_settlement`, `mediasoft_payment_qris_sessions`, `mediasoft_payment_webhook_log`, `mediasoft_payment_gateway_settings` |
| Pelanggan dan pemasok | `mediasoft_customer`, `mediasoft_customer_feedback`, `mediasoft_supplier`, `mediasoft_vendor_portal_settings`, `mediasoft_debts`, `mediasoft_debt_payments` |
| Loyalitas dan promosi | `mediasoft_loyalty_tiers`, `mediasoft_promos`, `mediasoft_gift_cards`, `mediasoft_gift_card_usage` |
| SDM | `mediasoft_employees`, `mediasoft_employee_contracts`, `mediasoft_attendance`, `mediasoft_payroll`, `mediasoft_payroll_details`, `mediasoft_shift_schedules`, `mediasoft_tip_pooling`, `mediasoft_tip_distribution`, `mediasoft_sales_commissions` |
| Restoran | `mediasoft_kds_orders`, `mediasoft_kds_order_items`, `mediasoft_floor_layouts`, `mediasoft_tables`, `mediasoft_reservations`, `mediasoft_recipes`, `mediasoft_recipe_ingredients`, `mediasoft_delivery_orders`, `mediasoft_delivery_vehicles` |
| Keuangan | `mediasoft_accounts`, `mediasoft_journal_entries`, `mediasoft_journal_lines`, `mediasoft_bank_accounts`, `mediasoft_bank_transactions`, `mediasoft_reconciliation`, `mediasoft_fixed_assets`, `mediasoft_asset_depreciation`, `mediasoft_budgets`, `mediasoft_petty_cash` |
| Integrasi | `mediasoft_ecommerce_api`, `mediasoft_ecommerce_provider_settings`, `mediasoft_ecommerce_sync_log`, `mediasoft_ecommerce_sync_queue`, `mediasoft_marketplace_channels`, `mediasoft_marketplace_sku_map`, `mediasoft_marketplace_sync_log`, `mediasoft_storefront_settings`, `mediasoft_storefront_products`, `mediasoft_storefront_orders`, `mediasoft_whatsapp_settings`, `mediasoft_whatsapp_templates`, `mediasoft_whatsapp_broadcast_history`, `mediasoft_campaigns`, `mediasoft_campaign_logs` |
| Konfigurasi | `mediasoft_industry_settings`, `mediasoft_struk_settings`, `mediasoft_notification_settings`, `mediasoft_notifikasi`, `mediasoft_daily_notes`, `mediasoft_tutorials`, `mediasoft_documents` |
| Audit dan sistem | `mediasoft_activity_log`, `mediasoft_audit_trail`, `mediasoft_error_logs`, `mediasoft_backup`, `mediasoft_app_updates`, `mediasoft_app_update_rules` |
| Lisensi lokal | `mediasoft_subscription_plans`, `mediasoft_popup_rules`, `mediasoft_dynamic_pricing_rules`, `mediasoft_forecast_settings`, `mediasoft_forecast_results` |

### 9.3 Relasi penting

| Relasi | Aturan |
|---|---|
| `mediasoft_penjualan.shift_id` | `mediasoft_shifts.id` |
| `mediasoft_penjualan_detail.kd_tansaksi_jual` | `mediasoft_penjualan.kd_tansaksi_jual` |
| `mediasoft_penjualan.branch_id` | Default 1 |
| `mediasoft_user_preferences.user_id` | `mediasoft_pengguna.nama_pengguna`, cascade delete |
| `mediasoft_employee_contracts.employee_id` | Cascade delete |
| `mediasoft_attendance.employee_id` | Cascade delete |
| `mediasoft_kds_orders.penjualan_id` | `mediasoft_penjualan`, cascade delete |
| `mediasoft_tables.floor_layout_id` | Set null |
| `mediasoft_reservations.table_id` | Set null |
| `mediasoft_recipe_ingredients` | Cascade delete ke `mediasoft_recipes` dan `mediasoft_barang` |
| `mediasoft_bank_transactions.bank_account_id` | Cascade delete |
| `mediasoft_asset_depreciation.fixed_asset_id` | Cascade delete |
| `mediasoft_payment_transaction.penjualan_id` | Cascade delete |
| `mediasoft_payment_details.penjualan_id` | Cascade delete ke `mediasoft_penjualan` |

### 9.4 Format transaksi

Nomor transaksi memakai pola `FJ-YYYYMMDD-SUFFIX`. Struk menampilkan nomor transaksi, nomor antrian, kasir, pelanggan, item dengan diskon per baris, subtotal, PPN, diskon promo, total bayar, metode, jumlah dibayar, kembalian, dan poin.

---

## 10. Lapisan Backend dan Kontrak API

### 10.1 Pola

Setiap method controller mengembalikan objek berbentuk `{ success, data?, message?, error_code? }` yang didefinisikan sebagai `IpcResponse` di `src/shared/types.ts`. Renderer memanggil lewat `window.api.invoke(channel, ...args)` pada Electron, atau lewat `mobileApi` pada native dan web.

### 10.2 Jumlah komponen

| Jenis | Jumlah | Lokasi |
|---|---|---|
| Controller | 56 | `src/backend/controllers` |
| Model | 24 | `src/backend/models` |
| Service | 20 | `src/backend/services` |
| Middleware | 3 | `src/backend/middleware` |
| Utilitas | 5 | `src/backend/utils` |

### 10.3 Controller utama

| Controller | Tanggung jawab |
|---|---|
| `AuthController` | Login kata sandi dan PIN, sesi, pendaftaran trial, ganti sandi, migrasi SHA-1 ke bcrypt, device binding, login admin dan pembeli remote |
| `PenjualanController` | Pipeline penjualan: hitung ulang harga dari database, cek stok, pajak, promo, syarat shift, poin pelanggan, update laci dan bank, pemotongan BOM, tiket KDS |
| `BarangController` | CRUD produk, paginasi, impor massal, pencarian |
| `UserController` | CRUD pengguna, ganti dan reset sandi, blokir, perpanjangan akses, matriks izin |
| `LicenseController` | Klien server lisensi, login admin dan pembeli, invoice, pembayaran, endpoint admin, sinkron dari server |
| `FeatureHubController` | 24 method untuk fitur panjang: catatan harian, petty cash, daftar harga, arus kas, ringkasan pajak, komisi, rating pemasok, keanggotaan, riwayat stok |
| `EmployeeController` | 34 method modul SDM |
| `KdsController` | 24 method untuk KDS, meja, reservasi, lantai |
| `BackupController` | Backup dan restore, varian zip, auto-backup |
| `LaporanController` | 9 query laporan: penjualan, detail item, pembayaran, laba rugi, produk terlaris, stok, kas, pelanggan, pembelian |
| `PaymentMethodController` | Metode pembayaran, konfigurasi Midtrans, sesi QRIS |
| `ExportController` | 20 method ekspor Excel, PDF, CSV |
| `AssistantController` | Tanya jawab AI, uji koneksi, daftar model |
| `AccountingController` | Bagan akun, jurnal, ringkasan, neraca saldo |
| `InventoryController` | 15 method gudang, batch, seri, transfer |
| `FinanceController` | 22 method bank, rekonsiliasi, aset tetap, anggaran |
| `MarketingController` | 15 method gift card, feedback, kampanye |
| `CommerceController` | 16 method toko online, portal pemasok, dokumen, peramalan, harga dinamis |
| `BranchController` | 10 method cabang, gudang, transfer |
| `EcommerceApiController` | Konfigurasi API, WooCommerce, antrean sinkron stok |
| `DemoGuard` (`demoGuardV2.ts`) | Gerbang IPC dengan daftar sekitar 200 kanal mutasi, daftar baca, kanal praketik, kanal publik lisensi, kanal khusus admin, kanal khusus operasional admin |
| `subscriptionGuard.ts` | Status langganan, batas transaksi harian, batas produk, aturan popup |

### 10.4 Kontrak eksposur

`src/main/preload.cjs` memuat himpunan `ALLOWED_CHANNELS`. Kanal yang tidak terdaftar ditolak sebelum menyentuh handler. Validasi input berlapis:

| Lapis | Mekanisme |
|---|---|
| Batas IPC | Sanitasi string dengan panjang maksimum 500, validasi wajib, validasi angka dengan rentang |
| Jalur simpan | `consumeApprovedSavePath`, jalur ekspor harus berasal dari dialog simpan native dan hanya dipakai sekali |
| Skema | Zod pada `src/backend/services/validation.ts` (7 skema) dan `src/shared/validation.ts` (6 skema) |
| Pengaman demo | `dbWriteGuard.ts` memblokir penulisan di lapisan database dengan `DemoWriteBlockedError` |
| Kepercayaan server | `buildTrustedItems` membaca ulang nama, harga, modal, dan stok dari database dan mengabaikan harga kiriman klien |
| Kursor SQL | Semua query runtime memakai parameter binding. Identifier dinamis divalidasi dengan regex dan allowlist kolom |

### 10.5 Pintasan keyboard

| Konteks | Pintasan |
|---|---|
| Global | `Ctrl/Cmd+N` transaksi baru, `Ctrl/Cmd+P` cetak, `Ctrl/Cmd+Shift+/` bantuan pintasan, `Ctrl/Cmd+K` palet pencarian cepat, `Ctrl/Cmd+Z` undo, `F11` layar penuh |
| Navigasi | `F1` transaksi, `F2` produk, `F3` riwayat, `F4` pelanggan, `F5` pemasok, `F6` pembelian, `F7` kas, `F8` laporan, `F9` pengaturan, `F10` dashboard |
| POS | `F1` fokus pencarian, `F2` keranjang dan fokus nominal, `F5` proses pembayaran, `Ctrl/Cmd+H` tahan transaksi, `Esc` kosongkan keranjang dan tutup modal, `Enter` kirim barcode atau ambil hasil pencarian pertama |
| Barcode | Aksen cetak apa pun masuk ke buffer barcode dengan timeout 300 ms, `Enter` mengirim |

---

## 11. Sistem Lisensi dan Langganan

### 11.1 Dua backend lisensi

| Backend | Peran |
|---|---|
| Server mandiri `license-server/` | Express dengan SQLite, JWT akses 15 menit dan refresh 30 hari, bcrypt, rate limit 30 permintaan per 15 menit pada `/api/auth` |
| Supabase Edge Function `mediasoft-license` | 1442 baris Deno, memakai `SUPABASE_SERVICE_ROLE_KEY`, memeriksa email, kunci lisensi, status pelanggan, langganan aktif, kedaluwarsa, dan batas perangkat |

### 11.2 Alur aktivasi

`POST /validate` pada Edge Function menjalankan enam pemeriksaan berurutan: email, kunci lisensi, dan deviceId wajib ada; kunci lisensi dicocokkan dengan metadata pelanggan; status pelanggan harus ACTIVE; langganan harus berstatus ACTIVE dan belum kedaluwarsa; batas perangkat dari `subscription_plans.max_devices` ditegakkan; perangkat yang belum terdaftar didaftarkan otomatis dengan nama, sistem operasi, dan versi aplikasi.

### 11.3 Model hak akses

```
features  →  plan_features (enabled + limit_value)  →  user_feature_overrides
                                                     ↓
                                               usage_logs (period_bucket YYYY-MM)
```

Kode fitur utama pada `src/renderer/license/index.ts`: products, categories, transactions, print_receipt, barcode_scan, stock, discount, tax, debt, reports, export_excel, export_pdf, multi_cashier, multi_branch, backup, restore, supplier, customer, shift, return_refund. Server lisensi melakukan seed 21 fitur master.

### 11.4 Paket dan harga

Harga berikut berasal dari seed skema `supabase/schema_license.sql` dan dapat berubah.

| Kode paket | Harga | Durasi |
|---|---|---|
| WEEKLY | Rp 19.000 | 7 hari |
| BASIC_MONTHLY | Rp 49.000 | 30 hari |
| PRO_MONTHLY | Rp 99.000 | 30 hari |
| PRO_YEARLY | Rp 990.000 | 365 hari |
| ENTERPRISE_LIFETIME | Rp 2.500.000 | tanpa kedaluwarsa |

Batas paket pada tabel `mediasoft_subscription_plans`: `max_devices`, `max_transactions_per_day` dengan nilai -1 berarti tanpa batas, `max_products`, `max_users`, serta `feature_flags` JSON.

### 11.5 Masa tenggang offline

| Aspek | Nilai |
|---|---|
| Variabel | `VITE_LICENSE_OFFLINE_GRACE_HOURS` |
| Default | 720 jam, setara 30 hari |
| Penyimpanan | `license_last_success_at` di secure storage terenkripsi |
| Perilaku | Saat server tidak terjangkau (`error_code = OFFLINE`) dan masa tenggang habis, popup paksa tanpa tombol tutup muncul, lalu logout 1,2 detik setelahnya |
| Penting | Respons OFFLINE tidak boleh memperbarui jam_clock. Hanya respons yang berhasil yang memperbarui it |
| Fallback login | Untuk pengguna pembeli, login remote gagal dengan OFFLINE akan memakai langganan lokal bila `subscription_expires_at` masih di masa depan, dan pencatatan `REMOTE_LICENSE_OFFLINE_FALLBACK` masuk ke activity log |
| Sinkronisasi lisensi | `license:syncBuyerLicense` tiap 12 detik saat tab terlihat, heartbeat tiap 60 detik, subscribe realtime Supabase |

### 11.6 Mode demo

| Aspek | Detail |
|---|---|
| Batas penggunaan | 10 transaksi |
| Penegakan | Semua kanal mutasi diblokir di renderer (`READ_PATTERNS`), di backend (`demoGuardV2`), dan di lapisan database (`dbWriteGuard`) |
| Tampilan | Banner DEMO MODE - READ ONLY, watermark ubin, tombol upgrade mengambang dengan sisa kuota |
| Pemicu popup | first_login, usage_limit, premium_feature, session_start, access_expiring, manual |
| Cooldown popup | 10 menit |

---

## 12. Sinkronisasi dan Offline-First

### 12.1 Arsitektur sinkron yang berjalan

Sinkronisasi yang berjalan bukan replikasi database. Perangkat klien menjadi proksi RPC ke satu SQLite otoritatif.

| Peran | Detail |
|---|---|
| Server sinkron | `src/main/syncServer.ts`, HTTP polos di `127.0.0.1`, port default 38573, `GET /health`, `POST /api/invoke` dengan body `{ token, channel, args, device }`, batas body 5 MB, CORS tetap ke `http://localhost:5173` |
| Autentikasi | Token 24 byte, dibandingkan dengan `crypto.timingSafeEqual` (waktu konstan) |
| Otorisasi kanal | `canInvokeRemoteSyncChannel`, kanal di luar allowlist mendapat 403 |
| Klien sinkron | `src/main/syncClient.ts`, timeout 12 detik, 33 kanal tetap lokal seperti ekspor, cetak, marketplace, dialog |
| Konfigurasi | AES-256-GCM dengan kunci scrypt, file `userData/sync-server.json` dan `sync-client.json`, mode 0600 |
| Validasi URL | HTTPS, atau HTTP hanya untuk IP privat dan `.local` |
| Perangkat | Dipantau di memori: deviceId, nama, user agent, alamat, waktu sightings, jumlah permintaan |

Perangkat remote memanggil handler controller yang sama dengan perangkat lokal. Sesi login dan logout ikut dicerminkan ke `demoSession`.

### 12.2 Antrean offline

`src/renderer/hooks/useOfflineQueue.ts` menyimpan operasi tertunda dalam bentuk terenkripsi di bawah kunci `offline_queue`, batas 3 percobaan, diputar ulang berurutan saat koneksi kembali. Tidak ada deteksi konflik pada jalur ini. Antrean memakai urutan(first write wins) tanparesolved merge.

### 12.3 Ketiadaan mesin konflik

Belum ada vektor jam, CRDT, atau last-write-wins pada sinkron server. `withOptimisticLock` di `src/backend/utils/transaction.ts` tersedia tetapi tidak terpakai karena tabel aplikasi tidak punya kolom versi. `src/shared/supabase/sync.ts` adalah kerangka dengan kode pseudo, array `pendingTasks` kosong, dan tabel `sync_queue` yang tidak pernah dibuat. Klaim "antrean sinkron offline-first" pada dokumentasi lama tidak sesuai dengan kode saat ini.

### 12.4 Google Sheets

| Aspek | Detail |
|---|---|
| Sumber payload | `src/shared/googleSheetsExport.ts` |
| Aksi dashboard | `append_dashboard` dengan tab Ringkasan, Penjualan 7 Hari, Jam Ramai Hari Ini, Transaksi Terbaru, Produk Terlaris, Ringkasan Alert, Stok Menipis |
| Aksi laporan | `append_report` dengan satu tab per laporan, judul, periode, waktu ekspor, kartu ringkasan opsional, baris judul, baris data |
| Sanitasi sel | `sanitizeSheetCell` membuang tab, carriage return, dan line feed |
| Apps Script tertanam | `src/shared/googleSheetsAppsScript.ts`, aksi test, append_dashboard, append_report, export_data, membuat tab bila belum ada, clear lalu tulis dari A1, autoResizeColumns |
| Berkas terdokumentasi | `docs/google-sheets-dashboard-webapp.gs` hanya menerima `append_dashboard` dan melempar galat untuk aksi lain |
| Berkas alternatif | `scripts/google-sheets-webapp.gs` lebih lengkap, mendukung `doGet`, membaca `SPREADSHEET_ID`, membuat spreadsheet bernama `Zetass Pos Export` bila belum ada, setFrozenRows |

---

## 13. Keamanan

### 13.1 Kontrol akses

| Kontrol | Detail |
|---|---|
| Hash kata sandi | bcrypt cost 12, SHA-1 lama dimigrasi saat login |
| Hash PIN | bcrypt, kolom terpisah, hanya untuk peran kasir |
| Sesi | Token acak 32 byte, hanya hash SHA-256 tersimpan, TTL 8 jam, dapat dicabut |
| Rate limit brute force | 5 percobaan dalam jendela 5 menit, kunci 15 menit, dikonfigurasi di `mediasoft_security_settings` |
| Timeout idle | 30 menit dengan peringatan 2 menit sebelumnya |
| Izin | 27 kode `nav_*`, default per peran, override per pengguna di `mediasoft_user_preferences` |
| Blokir perangkat | Status active, revoked, blocked, dengan `revoked_by` dan `revoked_at` |
| Sesi server | Refresh token di-hash SHA-256, deteksi token reuse mencabut seluruh token perangkat |

### 13.2 Enkripsi

| Aspek | Mekanisme |
|---|---|
| Kolom sensitif di SQLite | AES-256-GCM dengan kunci scrypt, format `v2gcm:salt:iv:tag:ct`, fallback ke CBC lama |
| Secure storage Electron | `electron.safeStorage` dengan fallback AES-256-GCM, kunci scrypt dari `userData` dan nama aplikasi, allowlist 13 nama kunci |
| Secure storage renderer | Web Crypto AES-256-GCM, kunci SHA-256 dari `zetass-pos-v2:${origin}`, prefiks `aes256:v2:`, nilai versi 1 dienkripsi ulang |
| Konfigurasi sinkron | AES-256-GCM dengan scrypt, mode berkas 0600 |
| PIN dan kata sandi | bcrypt |
| Token sesi dan refresh | SHA-256 saat disimpan |

### 13.3 Pengeras Electron

| Setting | Nilai |
|---|---|
| Konteks terisolasi | aktif |
| Integrasi Node | nonaktif |
| Sandbox | aktif |
| Keamanan web | aktif |
| CSP | `default-src 'self'`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`, connect-src dibatasi ke Supabase, OpenAI, Fonnte, QuickChart, dan script.google.com |
| Izin renderer | hanya media, notifikasi, fullscreen, dan hanya dari origin tepercaya |
| Pinning sertifikat | SPKI SHA-256 dibandingkan dengan `ZETASS_POS_CERT_PIN_SHA256`, default `ZcJbApTb7wyllleAjHw2vYAskqdT+DhMY9aPDFwAtf4=` |
| Navigasi | `setWindowOpenHandler` dan `will-navigate` memblokir target tak tepercaya |
| DevTools | Hanya pada mode pengembangan, F12 dan Ctrl+Shift+I/J/C diblokir di produksi |
| Deep link | `waripos://` dan `zetasspos://`, dengan single instance lock |

### 13.4 Kebersihan data sensitif

| Aspek | Detail |
|---|---|
| Redaksi log | `errorHandler.sanitizeContext` mengganti nilai kunci yang mengandung password, kata_sandi, token, secret, apiKey, api_key dengan `***REDACTED***` |
| Berkas sensitif | `.gitignore` mencakup `.env*` dan `.keys`, skrip signing menulis berkas mode 0600 |
| Kunci terenkripsi | `pos_session`, `auth_device_id`, `license_last_success_at`, `integrations.ai_api_key`, `offline_queue` |

---

## 14. Kualitas, Pengujian, CI dan Rilis

### 14.1 Pengujian

| Metrik | Nilai |
|---|---|
| Berkas pengujian | 27 |
| Jumlah test dan it | 222 |
| Runner | Vitest 1.6 dengan lingkungan jsdom |
| Berkas setup | `tests/setup.ts` dengan polyfill matchMedia, requestAnimationFrame, ResizeObserver, IntersectionObserver |
| Integrasi | `exportService.integration.test.ts` menjalankan pipeline ExcelJS dan jsPDF sungguhan |
| Komponen | `strukModalFeed.test.tsx` memakai Testing Library |
| QA manual di luar CI | `scripts/qa-ipc-smoke.mjs` menjalankan Electron sungguhan dengan database kloningan, `scripts/qa-stress.mjs` menguji 1000 produk, 125 transaksi, backup dan restore, serta pemulihan dari korupsi database |

Catatan: README menyebut 22 suite dan 187 test. Penghitungan aktual pada revisi ini adalah 27 berkas dan 222 pemanggilan test. Angka yang dipakai di website sebaiknya memakai hitungan aktual.

### 14.2 Cakupan pengujian

| Area | Berkas |
|---|---|
| Validasi | `validation.test.ts`, `validationUtils.test.ts` |
| Sanitasi | `sanitize.test.ts` |
| Logika autentikasi | `authLogic.test.ts`, `authController.test.ts`, `licenseSession.test.ts` |
| Kebijakan kata sandi | `passwordPolicy.test.ts`, `passwordPolicyV2.test.ts` |
| Perhitungan keranjang | `cartCalculations.test.ts` |
| Ekspor | `csvExport.test.ts`, `exportService.integration.test.ts`, `googleSheetsReportExport.test.ts` |
| Promo dan antrean | `promoLogic.test.ts`, `queueLogic.test.ts` |
| Tata letak struk | `receiptLayout.test.ts` |
| Gerbang demo | `demoGuardV2.test.ts` |
| Hooks | `useUndo.test.ts`, `useHoldCart.test.ts`, `useDebounce.test.ts` |
| Utilitas | `apiUtils.test.ts`, `ipcChannels.test.ts`, `format.test.ts`, `logDir.test.ts` |
| Integrasi lain | `whatsappService.test.ts`, `industryFeatures.test.ts`, `installerProcessCheck.test.ts` |

Yang belum ada: pelaporan cakupan, ambang cakupan, pengujian end-to-end (Playwright ada sebagai skrip tetapi paketnya tidak terpasang), pengujian untuk server lisensi dan Edge Function, serta pengujian regresi keamanan untuk daftar sekitar 200 kanal mutasi.

### 14.3 CI

Berkas `.github/workflows/ci.yml`, pemicu push ke `main` dan `develop` serta pull request ke `main`, Node 20, pnpm dengan lockfile beku.

| Job | Isi |
|---|---|
| lint | `npm run lint` |
| typecheck | `npm run typecheck` |
| test | `npm test` |
| build-desktop | Matriks ubuntu dan windows, butuh lint, typecheck, test, unggah `dist/` dan `dist-electron/` dengan retensi 3 hari |
| build-android | JDK Temurin 21, `npm run android:debug`, unggah APK dan AAB |

Yang belum ada: cache store pnpm, cakupan kode, pemindaian keamanan, job iOS, dan atestasi artefak.

### 14.4 Rilis

Berkas `.github/workflows/release.yml`, pemicu tag `v*`, dengan job validasi, build Windows, build Linux, build Android debug, build Android rilis, dan pembuatan rilis.

| Target | Format |
|---|---|
| Windows | NSIS installer, portable, zip, x64 |
| Linux | AppImage, deb, rpm, tar.gz |
| Android | APK rilis bertanda tangan dan AAB |

Rilis mencetak checksum SHA-256 dan mengunggah lewat `softprops/action-gh-release`. Yang belum ada: code signing Windows sehingga installer tidak ditandatangani, SBOM, provenance, job macOS, dan job iOS.

### 14.5 Konfigurasi Electron Builder

| Atribut | Nilai |
|---|---|
| appId | `com.wari.pos` |
| productName | WariPOS |
| Direktori keluaran | `release` |
| Berkas aplikasi | `dist/**/*`, `dist-electron/**/*` |
| extraResources | `migrations`, `build/icon.png`, `build/icon.ico` |
| Protocol | `waripos`, `zetasspos` |
| asarUnpack | `better-sqlite3`, `bindings`, `file-uri-to-path`, `**/*.node` |
| Nama artefak | `${productName}-${version}-${os}-${arch}.${ext}` |

---

## 15. Performa

| Area | Teknik |
|---|---|
| Database | Mode WAL, `foreign_keys = ON`, 47 index pada jalur panas, prepared statement yang dipakai ulang, batch insert, update, dan delete dalam satu transaksi, satu commit per penjualan |
| Kueri | Paginasi dengan limit dijepit 1 sampai 100, COUNT plus LIMIT dan OFFSET, pengurutan divalidasi dengan regex |
| View | `v_payment_summary` untuk rekap harian per metode, `v_daily_settlement` untuk pemecahan CASH, EWALLET, QRIS, CARD, TRANSFER |
| Server | `withRetry` dengan backoff eksponensial, timeout 12 detik pada sinkron, server sinkron hanya mendengarkan di loopback, `closeAllConnections` saat tutup |
| Menjadwal | Backup otomatis 02.00, pemeriksaan stok 08.00, pemeriksaan kedaluwarsa 08.00, pemeriksaan hutang jatuh tempo 08.00, pembersihan log activity hari Minggu 03.00 dengan retensi 90 hari, log error lebih dari 30 hari dihapus |
| Renderer | Debounce di `DataTable` dan halaman Produk, `useCallback` di 43 berkas, `useMemo` di 20 berkas, pemuatan halaman lazy, pra-pemuatan halaman inti saat idle |
| Bundler | Terser dengan `passes: 2`, `drop_debugger`, `pure_funcs` untuk console, `mangle.safari10`, main process di-bundle dengan esbuild |
| Penyimpanan native | SQLite Capacitor dengan penulisan tertunda dan fallback ke secure storage terenkripsi |

Dependency yang terpasang tetapi tidak dipakai: `react-virtuoso` untuk virtualisasi daftar, `vite-plugin-electron`, dan `vite-plugin-javascript-obfuscator`.

---

## 16. Perbedaan antar Platform

| Aspek | Desktop Electron | Native Android dan iOS | Web |
|---|---|---|---|
| Penyimpanan data | SQLite lewat IPC | SQLite Capacitor atau localStorage terenkripsi | localStorage sebagai fallback |
| Navigasi | Sidebar yang dapat dikecilkan plus topbar | Bilah bawah dengan tombol Kasir melayang 62 px plus drawer | Bilah bawah dan drawer |
| Fokus pencarian | Otomatis | Nonaktif agar keyboard virtual tidak muncul | Otomatis |
| Tombol kembali | Tidak berlaku | Modal lebih dulu, lalu navigasi, lalu tekan dua kali dalam 2 detik untuk keluar | Tidak berlaku |
| Pencetakan | Cetak peramban, ESC/POS Bluetooth, PDF, PNG, XLSX | ESC/POS Bluetooth, tulis berkas ke Documents, tanpa dialog cetak sistem | Cetak peramban dan unduhan |
| Notifikasi | Notifikasi dalam aplikasi | Notifikasi lokal Capacitor dengan kanal dan pengingat pagi | Notifikasi dalam aplikasi |
| Biometrik | Tidak berlaku | `@capgo/capacitor-native-biometric` | Tidak berlaku |
| Getaran | Tidak berlaku | `navigator.vibrate` untuk navigasi dan hasil pindai | Tidak berlaku |
| Sinkron | Server sinkron di `127.0.0.1:38573` | Klien sinkron ke server melalui base URL | Klien sinkron |

Perbedaan lain: pencarian produk di `Transaksi.tsx` sengaja tidak auto-focus di platform native. Pemilih nomor meja di POS memakai `table:getAll`.

---

## 17. Aksesibilitas dan UX

| Aspek | Implementasi |
|---|---|
| Peran ARIA | Label dan peran pada komponen interaktif |
| Reduction motion | `usePrefersReducedMotion` dihormati di semua animasi, termasuk modal QRIS, keluarnya struk, dan pull to refresh |
| Keyboard | Semua elemen interaktif dapat dicapai dan dioperasikan, modal dapat ditutup dengan `Escape` |
| Modal | `components/Modal.tsx` menjadi bottom sheet di ponsel dengan gagang geser, dialog terpusat di layar lebar, tutup dengan `Escape` atau klik latar |
| Toast | Satu pesan pada satu waktu, toast keranjang 1800 ms, toast lain 3200 ms |
| Notifikasi | Topbar polls setiap 90 detik, dijeda saat tab tidak terlihat, disegarkan saat `visibilitychange` |
| Pull to refresh | Ambang 100 px, cooldown 1 detik setelah mount, batal saat swipe horizontal, nonaktif di halaman transaksi |
| Onboarding | Tur 6 langkah, persists `hasSeenTour`. Tutorial peluncuran pertama 4 langkah khusus mobile dengan kunci `zetass_mobile_first_launch_tutorial_shown` |
| Modal | Modal konfirmasi tutup keranjang, modal ganti sandi paksa, modal lengkapi identitas toko |
| Suara | 5 berkas MP3 untuk suara kasir, klik produk, peringatan bahaya, pindai sukses, pindai gagal, dengan fallback Web Audio |

### 17.1 Localisasi

| Aspek | Nilai |
|---|---|
| Pustaka | i18next dan react-i18next, konfigurasi di `src/renderer/i18n.ts` |
| Bahasa | `id` sebagai default dengan fallback `id`, dan `en` sebagai bahasa kedua |
| Kunci | sekitar 180 per bahasa, kelompok `common`, `menu`, `products`, `transaction`, `login`, `dashboard`, `settings`, `backup`, serta judul fitur |
| Pemakaian | Hanya dipakai di `src/renderer/layouts/MobileBottomNav.tsx`. Seluruh halaman lain menulis teks Indonesia secara langsung |
| Sakelar bahasa | Tidak ada di dalam aplikasi |
| Format | `Intl` dan `toLocaleString('id-ID')`, fungsi `formatRupiah` di `src/renderer/utils/format.ts` |
| Ucapan antrian | `SpeechSynthesisUtterance` dengan `lang='id-ID'` dan pilihan suara `id-*` |

---

## 18. Temuan Audit

18 temuan, hasil pemeriksaan kode pada revisi ini.

| No | Severity | Temuan | Lokasi |
|---|---|---|---|
| 1 | High | `isDeveloperUser` memberi akses tanpa batas melalui pola nama pengguna, surel, dan nama yang ditulis langsung di kode | `src/shared/config/rbac.ts` L203-230 |
| 2 | High | Installer Windows tidak ditandatangani, `signAndEditExecutable` dimatikan, CI tidak mengimpor sertifikat | `package.json` L252, `.github/workflows/release.yml` |
| 3 | High | `npm run lint` gagal pada pemasangan bersih, plugin ESLint yang diimpor tidak ada di devDependencies | `eslint.config.js` L1-5 |
| 4 | High | `src/shared/supabase/sync.ts` adalah kerangka yang belum diimplementasikan, tabel `sync_queue` tidak pernah dibuat | `src/shared/supabase/sync.ts` L34-80 |
| 5 | Medium | Apps Script yang terdokumentasi menolak `append_report` dan `export_data` yang dikirim aplikasi, hanya `scripts/` yang mendukungnya | `docs/google-sheets-dashboard-webapp.gs` L20 |
| 6 | Medium | Server lisensi memakai secret JWT lemah dan kata sandi admin default, serta mencetak kata sandi ke stdout | `license-server/src/config.ts` L14-20, `license-server/src/migrations.ts` L162 |
| 7 | Medium | Kunci anon Supabase dan URL proyek ditulis langsung sebagai nilai default di kode | `src/shared/supabase/config.ts` L14-15, `src/backend/controllers/LicenseController.ts` L77 |
| 8 | Medium | `src/backend/utils/demoMode.ts` berisi fungsi keamanan tiruan yang selalu mengizinkan | `src/backend/utils/demoMode.ts` |
| 9 | Medium | Dua lockfile (`bun.lock` dan `pnpm-lock.yaml`) dan dua workspace, CI memakai pnpm saja | akar repositori |
| 10 | Medium | `react-virtuoso`, `vite-plugin-electron`, dan `vite-plugin-javascript-obfuscator` terpasang tanpa dipakai, `React.lazy` dipakai di 1 berkas | `package.json`, `src/renderer` |
| 11 | Medium | Skrip `playwright` ada tetapi Playwright tidak terpasang, tidak ada cakupan e2e | `package.json` L66 |
| 12 | Low | Tidak ada pelaporan atau ambang cakupan kode, hanya 1 uji integrasi dan 1 uji komponen | `tests/` |
| 13 | Low | Skema metode pembayaran ganda, `mediasoft_payment_method` dan `mediasoft_payment_methods`, serta stok ada di tiga tempat: `mediasoft_barang.stok`, `mediasoft_stok`, `mediasoft_warehouse_stock` | `src/database/baseSchema.ts` L727, L741, L1115 |
| 14 | Low | DDL `mediasoft_stock_history` memakai kolom `jenis` dan `username` sementara `PenjualanController` menulis `tipe` dan `user_id` | `src/database/baseSchema.ts` L1072-1084, `src/backend/controllers/PenjualanController.ts` |
| 15 | Low | `mediasoft_identitas` menyimpan `license_admin_token` dan `license_admin_refresh_token` dalam teks biasa | `src/database/baseSchema.ts` L558, `src/backend/controllers/LicenseController.ts` L37 |
| 16 | Low | Skema Drizzle mencakup sekitar 60 dari 123 tabel, sisanya SQL mentah, sehingga ada dua sumber kebenaran | `src/database/schema.ts`, `src/database/baseSchema.ts` |
| 17 | Low | DDL `mediasoft_barang` mendeklarasikan `jenis_transaksi VARCHAR(7)` sementara tipe Drizzle mengizinkan nilai lebih panjang | `src/database/baseSchema.ts` L126, `src/database/schema.ts` L47 |
| 18 | Info | `mediasoft_pengguna_hak_akses_android` dan tabel `historiprint_*` merupakan sisa kode lama yang tidak dipakai | `src/database/baseSchema.ts` L893, L540-542 |

---

## 19. Panduan Penggunaan Dokumen Ini untuk Website

### 19.1 Yang boleh diklaim

| Klaim | Sumber |
|---|---|
| Arsitektur offline-first dengan database SQLite lokal | `src/database/connection.ts`, `src/renderer/utils/mobileApi.ts` |
| Tiga bentuk platform: desktop Windows dan Linux, Android dan iOS, web | `src/main`, `android/`, `ios/`, `capacitor.config.ts` |
| 123 tabel data transaksi dan inventori | `sqlite_master` pada `sistem_pos.db` |
| 18 tema warna bawaan plus warna kustom | `src/renderer/styles/themes.css`, `src/renderer/contexts/ThemeContext.tsx` |
| 27 berkas pengujian dengan 222 test | `tests/` |
| 56 controller, 24 model, 20 service | `src/backend` |
| 80 deklarasi rute pada tabel rute | `src/renderer/routes.tsx` |
| Enam peran pengguna dengan 27 kode izin navigasi | `src/shared/config/rbac.ts` |
| Cetak struk termal ESC/POS 58 mm dan 80 mm | `src/renderer/utils/bluetoothPrinter.ts` |
| Ekspor PDF, Excel, CSV, dan Google Sheets | `src/backend/controllers/ExportController.ts`, `src/shared/googleSheetsExport.ts` |
| Masa tenggang offline 30 hari sebagai nilai bawaan | `src/renderer/contexts/AuthContext.tsx` L19 |

### 19.2 Yang tidak boleh muncul di website

| Dilarang | Alasan |
|---|---|
| Klaim kepatuhan seperti SOC 2, ISO 27001, atau PCI | Tidak ada audit pihak ketiga di repositori |
| Angka pengguna, transaksi, atau omzet tanpa sumber | Tidak ada data usage nyata di repositori |
| Testimoni dengan nama dan jabatan | Tidak ada satu pun testimoni nyata di repositori |
| Pernyataan "sinkronisasi offline-first antar perangkat" | Yang berjalan adalah proksi RPC ke satu database otoritatif |
| Pernyataan "tiga mode tampilan termasuk OLED" | Tidak ada tema OLED, hanya light, dark, system, dan auto |
| Pernyataan "aplikasi ini sudah diuji seluruhnya" | Tidak ada cakupan kode, e2e, atau pengujian server lisensi |
| Menjelaskan lebih dari 42 fiturnya sebagai satu kalimat | Modul terlalu luas, gunakan pengelompokan domain |

### 19.3 Struktur halaman website yang disarankan

Halaman beranda dapat memuat blok berikut: apa yang dikerjakan aplikasi, dua mode operasi retail dan restoran, tampilan layar kasir, cakupan modul per domain, pilihan platform, cara kerja offline-first, kontrol akses, dan cara mendapatkan versi siap pakai.

Halaman fitur dapat mengikuti pengelompokan pada Bab 4 dan 5, dengan tautan ke tangkapan layar asli per modul. Halaman developer dapat memakai Bab 8, 10, 11, dan 14, termasuk Panel Pengembang, server lisensi, CI, dan paket.

### 19.4 Elemen visual yang tersedia

Aset yang dapat dipakai langsung: 18 palet warna pada Bab 7.2, ikon di `build/icon.png` dan `build/icon.ico`, tangkapan layar dapat diambil dari menjalankan aplikasi. Rujukan interaksi: bilah bawah ponsel dengan tombol Kasir melayang, modal QRIS dengan QR 208 x 208, animasi struk termal keluar kertas, dan panel display pelanggan.

---

## 20. Glosarium

| Istilah | Pengertian |
|---|---|
| Shift | Periode kerja kasir dengan modal awal, saldo akhir, dan saldo yang diharapkan |
| Sisa | Selisih antara uang fisik di laci dan saldo yang diharapkan |
| Struk | Bukti cetak penjualan |
| QRIS | Standar pembayaran nontunai berbasis QR |
| BOM | Daftar bahan baku untuk satu resep |
| HPP | Harga pokok penjualan |
| Opname | Pencacatan stok fisik dibandingkan stok sistem |
| Batch | Nomor batch produk beserta tanggal kedaluwarsa |
| Serial | Nomor unit tunggal untuk barang berformasi unik |
| KDS | Kitchen display system, papan pesanan dapur |
| Demo | Mode uji coba dengan akses baca dan batas 10 transaksi |
| Popup | Dialog konfigurasi dari server yang dapat dipaksa muncul |
| Bundle | Satu berkas JavaScript yang dibundel menjadi satu berkas keluaran |
| SPKI | Subject Public Key Info, dasar pinning sertifikat |
| WAL | Write-Ahead Logging, mode jurnal SQLite untuk pembaca dan penulis secara bersamaan |

---

## 21. Lampiran: Indeks Berkas Penting

| Topik | Berkas |
|---|---|
| Tabel rute | `src/renderer/routes.tsx` |
| Penjaga rute | `src/apps/routing/RouteGuards.tsx` |
| RBAC dan peran | `src/shared/config/rbac.ts` |
| Layout aplikasi | `src/renderer/layouts/AppLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `MobileBottomNav.tsx` |
| Store | `src/renderer/stores/appStore.ts`, `cartStore.ts` |
| Contexts | `src/renderer/contexts/AuthContext.tsx`, `ThemeContext.tsx`, `ToastContext.tsx`, `DemoContext.tsx` |
| Hooks | `src/renderer/hooks/useKeyboardShortcuts.ts`, `useSessionTimeout.ts`, `useHoldCart.ts`, `useUndo.ts`, `useOfflineQueue.ts` |
| Komponen POS | `src/renderer/components/transaksi/` |
| Lisensi renderer | `src/renderer/license/apiClient.ts`, `FeatureContext.tsx`, `FeatureGate.tsx`, `index.ts` |
| Panel Pengembang | `src/renderer/pages/LicenseCenter.tsx`, `src/renderer/pages/license/`, `src/renderer/license/admin/` |
| Utilitas renderer | `src/renderer/utils/api.ts`, `mobileApi.ts`, `bluetoothPrinter.ts`, `receiptExporter.ts`, `whatsapp.ts`, `secureStorage.ts`, `sqlitePersistence.ts`, `sound.ts`, `systemNotification.ts`, `deepLinks.ts`, `biometric.ts` |
| Proses utama Electron | `src/main/index.ts`, `ipcHandlers.ts`, `preload.cjs`, `syncServer.ts`, `syncClient.ts`, `platformSecurity.ts`, `secureStorage.ts` |
| Backend | `src/backend/controllers/`, `models/`, `services/`, `middleware/`, `utils/` |
| Database | `src/database/baseSchema.ts`, `schema.ts`, `connection.ts` |
| Server lisensi | `license-server/src/index.ts`, `auth.ts`, `config.ts`, `migrations.ts`, `routes/`, `middleware/` |
| Edge Function | `supabase/functions/mediasoft-license/index.ts` |
| Skema cloud | `supabase/schema_license.sql` |
| Google Sheets | `src/shared/googleSheetsExport.ts`, `src/shared/googleSheetsAppsScript.ts`, `docs/google-sheets-dashboard-webapp.gs`, `scripts/google-sheets-webapp.gs` |
| Build dan QA | `scripts/bundle-main.cjs`, `build-windows.cjs`, `build-android.cjs`, `prepare-android-signing.cjs`, `verify-build-resources.cjs`, `qa-stress.mjs`, `qa-ipc-smoke.mjs` |
| CI dan rilis | `.github/workflows/ci.yml`, `.github/workflows/release.yml` |
| Dokumentasi lain | `README.md`, `ROADMAP.md`, `AUDIT_REPORT.md`, `CHANGELOG.md`, `docs/README.md` |

---

Dokumen ini disusun dari kode sumber repositori. Angka dan klaim harus diverifikasi ulang terhadap revisi terbaru sebelum dipakai pada website publik, karena beberapa bagian produk masih dalam tahap pengembangan, khususnya sinkronisasi antar perangkat, pelaporan cakupan pengujian, penandatanganan installer Windows, dan backbone sinkronisasi berbasis Supabase.
