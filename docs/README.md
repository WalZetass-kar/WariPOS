# 🏛️ Dokumentasi Arsitektur & Teknis WariPOS

Selamat datang di dokumentasi teknis dan arsitektur resmi **WariPOS** (*Next-Gen All-in-One Smart POS & Ecosystem for Sustainable UMKM Growth*). Dokumen ini merupakan panduan tunggal komprehensif yang merangkum seluruh arsitektur sistem, komunikasi lintas panel, sinkronisasi data *True Offline-First*, alur build multi-platform, integrasi lisensi, payment gateway, serta panduan refaktor sistem.

---

## 📑 Daftar Isi
1. [Arsitektur Sistem & Batasan Panel (App Panel Boundaries)](#1-arsitektur-sistem--batasan-panel)
2. [Komunikasi Antar Panel (User Panel ↔ Developer Panel)](#2-komunikasi-antar-panel-user-panel--developer-panel)
3. [Arsitektur Sinkronisasi Multi-Platform & True Offline-First](#3-arsitektur-sinkronisasi-multi-platform--true-offline-first)
4. [Panduan Build Multi-Platform (Desktop, Android, iOS)](#4-panduan-build-multi-platform-desktop-android-ios)
5. [Developer Operations & License Center](#5-developer-operations--license-center)
6. [Integrasi Pembayaran & Riset Payment Gateway](#6-integrasi-pembayaran--riset-payment-gateway)
7. [Production Deployment & Security Hardening Checklist](#7-production-deployment--security-hardening-checklist)
8. [Rencana Uji Coba Lisensi Mobile (Android & iOS)](#8-rencana-uji-coba-lisensi-mobile-android--ios)
9. [Laporan Verifikasi & Catatan Teknis Rilis](#9-laporan-verifikasi--catatan-teknis-rilis)
10. [Analisis & Panduan Refaktor Monorepo](#10-analisis--panduan-refaktor-monorepo)

---

## 1. Arsitektur Sistem & Batasan Panel

WariPOS menggabungkan operasional kasir harian (*User Panel*) dan pusat kendali lisensi/pengembang (*Developer Panel*) dalam satu basis kode terpadu yang efisien dan aman.

### Batasan Rute (Route Boundaries)
- `/app` atau `/` : **User Panel / POS App** (Kasir, Transaksi, Produk, Laporan, KDS, Customer Display, Queue, Payroll).
- `/developer` atau `/license-admin` : **Developer Panel / License Center** (Monitoring perangkat, lisensi, update APK, analitik pendapatan).
- `/login` : Titik masuk autentikasi bersama (Shared login entry).
- `/license` : Mengarahkan ke `/app/payment` untuk alur pembayaran dan aktivasi lisensi pengguna.

> **Catatan Kompatibilitas**: Rute warisan (*legacy routes*) seperti `/produk`, `/transaksi`, `/payment`, dan `/license-admin` tetap dipertahankan dengan mekanisme redirect otomatis agar deep-link lama tidak rusak.

### Batasan Kode Sumber (Source Boundaries)
- `src/apps/user-panel` : Komposisi rute dan shell User Panel.
- `src/apps/developer-panel` : Komposisi rute dan shell Developer Panel.
- `src/apps/routing` : Route guards frontend berbasis peran.
- `src/shared/config/rbac.ts` : Konfigurasi peran bersama (*Role-Based Access Control*).
- `src/platform/desktop` : Adapter platform Electron Desktop.
- `src/platform/mobile` : Adapter platform Capacitor Mobile.
- `src/platform/web` : Adapter platform web Vite.

### Role-Based Access Control (RBAC)
Peran pengguna yang didukung:
1. `developer` — Akses penuh tanpa batas ke sistem POS, Developer Panel, dan License Server.
2. `super_admin` — Akses penuh ke seluruh fitur operasional dan lisensi lokal.
3. `admin` — Manajemen inventori, laporan keuangan, pengaturan toko, dan pengguna.
4. `operator` / `kasir` — Transaksi penjualan kasir kilat, hold/resume cart, dan cetak struk.
5. `demo` — Mode eksplorasi dengan pembatasan mutasi data kritis.

Keamanan diperkuat ganda: **Frontend Route Guards** melindungi antarmuka pengguna, sementara **Backend Middleware (`demoGuardV2.ts` dan IPC Handlers)** memverifikasi setiap kanal IPC sehingga pengguna tidak dapat membypass keamanan melalui manipulasi URL.

---

## 2. Komunikasi Antar Panel (User Panel ↔ Developer Panel)

### Diagram Arsitektur Komunikasi
```
┌─────────────────────────────────────┐         ┌──────────────────────────────────┐
│      Developer Panel (Desktop)      │         │     User Panel (Desktop/Mobile)  │
│                                     │         │                                  │
│  - License Management               │         │  - POS / Kasir Kilat             │
│  - User Management                  │◄────────┤  - Inventori & HPP               │
│  - Plan & Pricing                   │  Shared │  - KDS & Queue Display           │
│  - Suspend/Revoke Device            │ Database│  - Laporan Laba Rugi             │
│  - App Update & Broadcast           │         │  - WhatsApp Digital Receipt      │
└─────────────────────────────────────┘         └──────────────────────────────────┘
                   │                                              │
                   └──────────────────────┬───────────────────────┘
                                          │
                                 ┌────────▼────────┐
                                 │ Shared Database │
                                 │  sistem_pos.db  │
                                 │                 │
                                 │ - Pengguna      │
                                 │ - Identitas     │
                                 │ - Subscription  │
                                 │ - Penjualan/Log │
                                 └─────────────────┘
```

### Fitur & Saluran IPC Developer Panel
1. **License Management** (`/license-admin`):
   - Aktivasi lisensi baru, suspend perangkat, revoke lisensi permanen, dan perubahan tier paket.
   - Channel: `license:getStats`, `license:getUsers`, `license:changeUserPlan`, `license:blockDevice`, `license:extendDeviceLicense`.
2. **User & Device Monitoring**:
   - Monitoring status perangkat aktif, sesi login, platform OS, dan waktu aktif terakhir (*heartbeat*).
   - Channel: `device:getAll`, `device:getByUser`, `device:revoke`, `device:getAllSessions`.
3. **App Update & Remote Broadcast**:
   - Menetapkan versi minimum aplikasi, rilis update APK, dan menyiarkan pengumuman/maintenance ke seluruh perangkat.
   - Channel: `license:getAppUpdates`, `license:saveAppUpdate`, `license:getAnnouncements`, `license:createAnnouncement`.

### Skema Paket Lisensi
| Paket | Kuota Pengguna | Kuota Produk | Fitur Unggulan |
|---|:---:|:---:|---|
| **Free / Trial** | 1 Kasir | 100 Produk | Transaksi dasar POS, masa aktif 3 hari trial. |
| **Basic** | 3 Pengguna | 500 Produk | Laporan penjualan standar, struk thermal Bluetooth. |
| **Pro** | 10 Pengguna | 5.000 Produk | KDS Dapur, Layar Antrean, WhatsApp receipt, export Excel/PDF. |
| **Enterprise / Lifetime** | Unlimited | Unlimited | Semua modul aktif, AI Business Advisor, multi-cabang, tanpa kedaluwarsa. |

---

## 3. Arsitektur Sinkronisasi Multi-Platform & True Offline-First

WariPOS dirancang dengan prinsip **100% True Offline-First**. Operasional kasir dan pencatatan transaksi tidak boleh terhenti sedikit pun hanya karena koneksi internet lambat atau mati listrik.

### Lapisan Runtime Platform
1. **Desktop (Electron)**:
   - Menjalankan Electron Main Process dengan basis data SQLite lokal (`better-sqlite3`).
   - Berfungsi ganda sebagai **Local Sync Server** pada port default `38573` via jaringan LAN Wi-Fi lokal.
   - Menangani cetak struk hardware via direct USB/ESC-POS, export PDF/Excel berkecepatan tinggi, dan backup lokal terenkripsi.
2. **Mobile (Capacitor Android / iOS)**:
   - Membungkus output web Vite dengan jembatan native Capacitor SQLite/local storage (`mobileApi.ts`).
   - Menyimpan seluruh transaksi secara lokal saat offline dan meneruskannya ke Sync Server desktop atau Supabase Cloud saat online.
   - Mendukung hardware mobile: Barcode scanner kamera, biometric auth (sidik jari), dan thermal printer Bluetooth.

### Strategi Penanganan Konflik Data (Conflict Handling)
- **Append-Only Transaction Log**: Setiap transaksi penjualan menghasilkan nomor faktur unik berbasis UUID perangkat + timestamp lokal sehingga tidak pernah terjadi tabrakan nomor faktur antar kasir.
- **Timestamp Versioning**: Mutasi data barang atau harga menggunakan timestamp pembaruan terakhir (`updated_at`). Controller desktop bertindak sebagai *source of truth* lokal.
- **Kalkulasi Stok Dinamis**: Pengurangan stok dihitung dari agregasi akumulatif log penjualan riil, bukan dengan menimpa nilai angka mentah (*raw value overwrite*).

---

## 4. Panduan Build Multi-Platform (Desktop, Android, iOS)

### Runtime Database & Lokasi Penyimpanan
Pada Desktop terpasang (*packaged app*), template `sistem_pos.db` disalin otomatis ke direktori data pengguna yang memiliki hak tulis penuh:
- **Windows**: `%APPDATA%/WariPOS/sistem_pos.db` (dan `%APPDATA%/WariPOS/backups/`)
- **Linux**: `~/.config/WariPOS/sistem_pos.db` (dan `~/.config/WariPOS/backups/`)
- **macOS**: `~/Library/Application Support/WariPOS/sistem_pos.db`
- **Android**: Direktori internal aplikasi via Capacitor SQLite persistence dan Filesystem API.

### Pemeriksaan Preflight Resources
Sebelum melakukan packaging, jalankan perintah preflight untuk memastikan aset wajib lengkap:
```bash
npm run verify:build-resources
```
Resource yang divalidasi meliputi database awal, direktori migrasi, icon launcher (`build/icon.png`, `build/icon.ico`), dan konfigurasi platform.

### Perintah Kompilasi Desktop
```bash
# Windows Installer & Portable
npm run build:desktop:windows  # atau npm run build:win

# Linux AppImage & Debian Package
npm run build:desktop:linux    # atau npm run build:linux

# macOS DMG & ZIP (Wajib dijalankan di macOS)
npm run build:desktop:mac      # atau npm run build:mac
```

### Perintah Kompilasi Mobile Android
```bash
# 1. Build APK Debug untuk pengujian lokal cepat
npm run android:debug

# 2. Sinkronisasi aset web ke folder Android Capacitor
npm run android:sync

# 3. Build Signed Release APK (Siap didistribusikan ke HP/Tablet)
npm run android:release

# 4. Build Signed Android App Bundle (AAB) untuk Google Play Store
npm run android:aab
```
*Hasil rilis APK akan tersimpan rapi di folder:* `release/WariPOS.apk` *(~19.9 MB)*.

### Perintah Kompilasi iOS / iPadOS
*(Memerlukan perangkat macOS dengan Xcode dan Apple Developer Account)*:
```bash
npm run build:ios
npm run ios:open
```
Buka project di Xcode (`ios/App/App.xcodeproj`), atur Signing & Capabilities, pilih Team pengembang, lalu lakukan **Product > Archive**.

---

## 5. Developer Operations & License Center

Pusat kendali Developer Operations WariPOS mengelola autentikasi admin, validasi lisensi cloud, monitoring perangkat, dan force update.

### Endpoint Supabase & Edge Functions
- **Base Endpoint**: `https://azhkvmkmimepmflzqqty.supabase.co/functions/v1/mediasoft-license`
- **Rute Layanan**:
  - `/auth/login` & `/auth/refresh`: Autentikasi pengembang dengan auto-refresh token JWT.
  - `/heartbeat`: Pembaruan status perangkat online/offline dan deteksi versi aplikasi.
  - `/app-update`: Pengecekan versi rilis terbaru dan mode *force update*.
  - `/announcements`: Penyiaran notifikasi dan pengumuman sistem.
  - `/errors`: Penerimaan log galat dan crash frontend otomatis.
  - `/payments`: Registrasi dan verifikasi bukti transfer lisensi pembeli.

### Keamanan & Role-Level Security (RLS)
- `SUPABASE_SERVICE_ROLE_KEY` hanya tersimpan aman sebagai secret di sisi server Edge Function.
- Klien aplikasi hanya menyimpan token akses pengguna yang telah login secara aman di `secureStorage`.
- Akses ke fungsi administrasi dibatasi melalui tabel `license_admins` dan helper database `public.is_app_admin()`.

---

## 6. Integrasi Pembayaran & Riset Payment Gateway

### Fase 1: Manual Transfer & WhatsApp Confirmation (Aktif)
- **Alur Transaksi**:
  1. Pengguna membuka menu *Pembayaran Lisensi* dan memilih paket yang diinginkan.
  2. Sistem mencatat transaksi di Supabase dengan status `pending` dan provider `manual_whatsapp`.
  3. Aplikasi otomatis membuka WhatsApp admin/developer dengan format pesan invoice siap kirim.
  4. Pengembang menerima bukti transfer, lalu menekan tombol **Approve** di Developer Panel.
  5. Status lisensi pengguna otomatis aktif dan diperpanjang seketika.

### Fase 2: Otomasi Gateway (Midtrans Snap & QRIS)
- Gateway Midtrans telah disiapkan di layer server untuk mendukung pembayaran otomatis instan:
  - Dukungan QRIS dinamis (GoPay, OVO, DANA, ShopeePay, LinkAja, BCA Mobile).
  - Webhook HTTP notification terhubung ke Supabase Edge Function untuk auto-approval tanpa intervensi manual.

---

## 7. Production Deployment & Security Hardening Checklist

Sebelum mendistribusikan aplikasi ke pengguna produksi:
- [x] **DevTools Disabled**: DevTools dinonaktifkan pada build production Electron.
- [x] **Context Isolation & Sandbox**: Diaktifkan penuh pada Electron main process dengan whitelist saluran IPC di `src/main/preload.cjs`.
- [x] **Cleartext Traffic Disabled**: Android release memblokir traffic HTTP polos tanpa enkripsi, kecuali jika mode pairing LAN diaktifkan (`ZETASS_POS_ALLOW_LAN_HTTP=true`).
- [x] **Certificate Pinning**: Diterapkan untuk domain endpoint Supabase utama.
- [x] **Offline Grace Period**: Ditetapkan default 72 - 720 jam sebelum verifikasi lisensi cloud diwajibkan kembali.
- [x] **Automated Tests**: Seluruh 172 unit tests lulus uji (`pnpm test` / `vitest`).
- [x] **TypeScript Verification**: Tidak ada galat tipe data (`pnpm typecheck` / `tsc`).

---

## 8. Rencana Uji Coba Lisensi Mobile (Android & iOS)

Checklist pengujian pada perangkat mobile fisik sebelum rilis:
1. **Registrasi Trial**: Akun baru berhasil dibuat dengan masa aktif trial 3 hari.
2. **Device Persistence**: Nilai `device_id` tetap konsisten dan tidak berubah setelah aplikasi ditutup paksa atau HP direstart.
3. **Sinkronisasi Lisensi**: Berjalan mulus saat aplikasi pertama kali dibuka, saat kembali dari latar belakang (*focus/resume*), dan secara periodik tiap interval.
4. **Blokir Perangkat**: Saat perangkat diblokir dari Developer Panel, aplikasi mobile langsung menampilkan dialog terkunci dan memblokir akses kasir.
5. **Mode Offline**: Aplikasi tetap dapat bertransaksi lancar saat mode pesawat (tanpa internet) selama masa *grace period* masih berlaku.
6. **Hardware Periferal**: Barcode scanner kamera berfungsi tajam dan pencetakan struk Bluetooth thermal mini berjalan lancar.

---

## 9. Laporan Verifikasi & Catatan Teknis Rilis

### Riwayat Hasil Kompilasi Terverifikasi
| Platform | Target Berkas | Status Build | Catatan Rilis |
|---|---|:---:|---|
| **Android APK** | `release/WariPOS.apk` | ✅ Berhasil (19.9 MB) | Signed Release APK, R8 optimization aktif. |
| **Android AAB** | `release/WariPOS.aab` | ✅ Berhasil (13.9 MB) | Format distribusi Google Play Store. |
| **Linux Desktop** | `release/WariPOS-2.1.0-linux-x86_64.AppImage` | ✅ Berhasil | Portable Linux executable. |
| **Linux Debian** | `release/WariPOS-2.1.0-linux-amd64.deb` | ✅ Berhasil | Paket instalasi Debian / Ubuntu. |
| **Windows Desktop** | `release/WariPOS-2.1.0-win-x64.exe` | ✅ Berhasil | Portable Windows x64 executable. |
| **Windows Archive** | `release/WariPOS-2.1.0-win-x64.zip` | ✅ Berhasil | Ekstrak dan jalankan tanpa installer. |
| **iOS / iPadOS** | `ios/App/App.xcodeproj` | ✅ Berhasil Sync | Siap di-archive via Xcode di macOS. |

---

## 10. Analisis & Panduan Refaktor Monorepo

### Struktur Paket Monorepo Target
Untuk pengembangan modular jangka panjang, repositori mendukung arsitektur *pnpm workspace*:
```
WariPOS/
├── packages/
│   ├── shared-lib/                    # Tipe data, utilitas, schema database bersama
│   ├── zetass-pos-user/               # Aplikasi operasional POS kasir
│   └── zetass-pos-developer-panel/    # Aplikasi pengembang & lisensi terpisah
├── src/                               # Monolith terpadu yang aktif saat ini (Production Core)
├── android/                           # Proyek native Android Capacitor
├── ios/                               # Proyek native iOS Capacitor
├── docs/                              # Dokumentasi arsitektur dan teknis (berkas ini)
└── release/                           # Output biner installer APK dan Desktop
```

### Panduan Pemeliharaan Kode
- **State Management**: Gunakan Zustand store di `src/renderer/stores/` (`useCartStore` untuk keranjang kasir, `useAppStore` untuk preferensi aplikasi).
- **Penambahan Kanal IPC Baru**: Daftarkan nama saluran di `src/main/preload.cjs` (whitelist), buat handler di `src/main/ipcHandlers.ts`, dan sediakan adapter offline mobile di `src/renderer/utils/mobileApi.ts`.
- **Ekspor Dokumen**: Seluruh fungsi cetak struk dan laporan terpusat di `src/backend/services/export.ts` dengan branding WariPOS.
