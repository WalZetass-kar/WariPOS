# WariPOS - Point of Sale & Retail Management System

WariPOS adalah aplikasi kasir (Point of Sale) dan manajemen retail multi-platform dengan arsitektur **offline-first**, dirancang untuk kebutuhan operasional toko di komputer desktop (Windows dan Linux), perangkat mobile (Android), maupun peramban web (Web Browser).

- **Pengembang**: WalZetass-Kar
- **Repositori Resmi**: https://github.com/WalZetass-kar/WariPOS
- **Unduh APK Rilis Siap Pakai**: https://github.com/WalZetass-kar/WariPOS/releases/latest
- **Lisensi**: MIT License

---

## Daftar Isi

1. Tentang WariPOS & Fitur Utama
2. Tech Stack & Bahasa Pemrograman
3. Prasyarat Sistem (System Requirements)
4. Panduan Instalasi Langkah Demi Langkah
   - Langkah 1: Kloning Repositori
   - Langkah 2: Konfigurasi File Environment
   - Langkah 3: Pemasangan Dependensi
5. Cara Menjalankan Aplikasi
   - Menjalankan Mode Desktop (Electron)
   - Menjalankan Mode Web / Mobile Preview
   - Menjalankan Pengujian Otomatis (Unit Tests)
   - Pengecekan Tipe Data TypeScript
6. Panduan Aplikasi Mobile Android
   - Opsi A: Memasang Berkas APK Siap Pakai (Rekomendasi)
   - Opsi B: Membangun APK dari Kode Sumber (Build Manual)
7. Referensi Perintah Skrip Proyek
8. Lisensi & Kontak Pengembang

---

## 1. Tentang WariPOS & Fitur Utama

WariPOS dibangun untuk memberikan keandalan penuh bagi pelaku usaha toko retail, F&B, dan UMKM. Mengusung konsep **offline-first**, seluruh proses transaksi, pemotongan stok, pembuatan nota, dan pencatatan keuangan disimpan langsung di database SQLite lokal perangkat, sehingga kasir dapat terus beroperasi melayani pembeli tanpa gangguan saat jaringan internet terputus.

### Fitur Utama Aplikasi:

- **Transaksi POS Kilat**:
  - Katalog produk visual berbasis kategori dengan pencarian instan.
  - Dukungan pemindai barcode USB/Wireless hardware dan pemindai kamera bawaan ponsel.
  - Multi-metode pembayaran: Tunai (dengan kalkulator kembalian otomatis), QRIS, dan Transfer Bank.
  - Fitur simpan/tahan transaksi (Held Cart) untuk melayani antrean pelanggan berikutnya tanpa kehilangan keranjang belanja.
  - Fitur retur barang dan pencatatan pengembalian dana.
- **Manajemen Struk & Nota Digital**:
  - Cetak struk termal ESC/POS (USB dan Bluetooth 58mm / 80mm).
  - Penataan vertikal dinamis (Dynamic Stacking) agar nama barang, kuantitas, dan harga tidak pernah saling bertumpuk.
  - Ekspor dokumen PDF kontinu tanpa potongan halaman.
  - Bagikan salinan nota digital langsung ke nomor WhatsApp pelanggan dengan satu klik.
- **Manajemen Kas & Shift Kasir**:
  - Pencatatan modal awal kasir (Open Shift).
  - Formulir rekonsiliasi uang fisik di laci saat tutup kasir (Close Shift) dengan audit otomatis status seimbang, surplus, atau defisit.
  - Laporan rekapitulasi shift kasir siap cetak.
- **Kontrol Inventori & Stok Real-Time**:
  - Pengurangan stok otomatis setiap kali transaksi berhasil.
  - Notifikasi peringatan batas minimum stok (Low Stock Alert).
  - Riwayat mutasi barang masuk, barang keluar, dan penyesuaian stok (Stock Opname).
  - Fasilitas impor dan ekspor data produk dalam format CSV/Excel.
- **Manajemen Pengguna & Login Kilat PIN**:
  - Pengaturan peran bertingkat (Owner, Admin, Supervisor, Kasir).
  - Login cepat menggunakan PIN angka 4 hingga 8 digit khusus kasir untuk mempercepat pergantian shift kerja di layar sentuh.
- **Sinkronisasi Data & Cadangan (Backup)**:
  - Integrasi langsung ke spreadsheet Google Sheets toko pribadi (tab Penjualan, Laba Rugi, Stok, dan Pelanggan).
  - Pencadangan database lokal terstruktur dengan kartu arsip mandiri di layar mobile.
- **Personalisasi Tampilan Toko**:
  - Pilihan 10 palet warna aksen tema toko.
  - Dukungan Mode Terang (Light), Mode Gelap (Dark), dan Mode OLED.
  - Tata letak responsif dengan bilah navigasi bawah ponsel yang proporsional.

---

## 2. Tech Stack & Bahasa Pemrograman

Proyek WariPOS dikembangkan menggunakan bahasa pemrograman dan teknologi modern berikut:

### Bahasa Pemrograman:
- **TypeScript (TS & TSX)**: Digunakan untuk seluruh lapisan antarmuka pengguna, logika bisnis, state management, dan skrip controller backend.
- **JavaScript (CJS & MJS)**: Digunakan untuk skrip otomasi proses build, sinkronisasi versi, dan pengemasan aset.
- **SQL**: Digunakan untuk skema relasional tabel database, indeks, dan migrasi struktur data.
- **Java & Kotlin**: Digunakan pada konfigurasi dan modul jembatan native platform Android.
- **CSS / HTML**: Digunakan untuk penataan tampilan antarmuka responsif melalui TailwindCSS.

### Framework & Library Utama:
| Komponen | Teknologi | Fungsi |
|---|---|---|
| Frontend UI | React 18 & TailwindCSS | Antarmuka pengguna responsif desktop dan mobile |
| Build Tool | Vite 5 | Bundler aplikasi web dan dev server berkecepatan tinggi |
| State Management | Zustand | Manajemen state global keranjang belanja dan preferensi |
| Desktop Runtime | Electron 31 | Runtime native untuk sistem operasi Windows dan Linux |
| Mobile Engine | Capacitor 8 | Jembatan native Android untuk akses kamera scanner dan storage |
| Database Lokal | SQLite (`better-sqlite3` & `@capacitor-community/sqlite`) | Database lokal ACID tanpa perlu instalasi server database eksternal |
| Testing | Vitest | Rangkaian pengujian unit dan integrasi otomatis (187 tests) |
| Ikon & Animasi | Lucide Icons & Framer Motion | Komponen visual dan transisi antarmuka |

---

## 3. Prasyarat Sistem (System Requirements)

Sebelum melakukan kloning dan menjalankan proyek ini dari kode sumber, pastikan perangkat komputer Anda telah terpasang perangkat lunak berikut:

1. **Node.js**:
   - **Wajib menggunakan versi LTS (v20.x atau v22.x)** dari https://nodejs.org.
   - *Catatan*: Hindari versi non-LTS (seperti Node.js v24) agar binary native SQLite (`better-sqlite3`) dapat langsung terunduh otomatis tanpa perlu memasang Visual Studio C++ Build Tools.
2. **Package Manager (pnpm)**:
   - Disarankan menggunakan `pnpm` untuk instalasi dependensi yang cepat dan hemat penyimpanan:
     ```bash
     npm install -g pnpm
     ```
3. **Git**:
   - Terpasang di sistem operasi untuk melakukan kloning repositori (https://git-scm.com).
4. **Java Development Kit (JDK 17)**:
   - Diperlukan hanya jika Anda ingin melakukan kompilasi modul Android native atau menjalankan Gradle.
   - Disarankan menggunakan OpenJDK 17 atau Eclipse Temurin 17 (https://adoptium.net).
5. **Android SDK & Platform Tools (Opsional)**:
   - Terpasang melalui Android Studio jika Anda ingin menguji atau mem-build aplikasi Android langsung dari komputer.

---

## 4. Panduan Instalasi Langkah Demi Langkah

### Langkah 1: Kloning Repositori
Buka terminal atau Git Bash, lalu jalankan perintah kloning repositori:
```bash
git clone https://github.com/WalZetass-kar/WariPOS.git
cd WariPOS
```

### Langkah 2: Konfigurasi File Environment
Salin berkas contoh konfigurasi lingkungan ke berkas `.env`:
```bash
cp .env.example .env
```
*(Bagi pengguna Windows Command Prompt: gunakan perintah `copy .env.example .env`)*.

Konfigurasi bawaan sudah siap digunakan untuk operasional lokal offline.

### Langkah 3: Pemasangan Dependensi
Pasang seluruh paket dependensi proyek menggunakan `pnpm`:
```bash
pnpm install
```

---

## 5. Cara Menjalankan Aplikasi

### Menjalankan Mode Desktop (Electron)
Untuk menjalankan aplikasi kasir desktop dengan antarmuka native Electron dan live-reload:
```bash
pnpm dev
```
Perintah ini akan menjalankan Vite dev server di latar belakang dan langsung membuka jendela aplikasi WariPOS Desktop.

### Menjalankan Mode Web / Mobile Preview
Jika Anda ingin menjalankan aplikasi di peramban web atau melakukan pratinjau antarmuka ponsel di jaringan lokal:
```bash
pnpm dev:mobile
```
Buka browser di alamat `http://localhost:5173`. Anda dapat menekan tombol `F12` lalu memilih mode **Device Toolbar** untuk melihat simulasi layar ponsel pintar atau tablet POS.

### Menjalankan Pengujian Otomatis (Unit Tests)
Proyek WariPOS dilengkapi rangkaian 22 test suites (187 unit tests) untuk menguji integritas kalkulasi transaksi, validasi keamanan, dan format struk:
```bash
pnpm test
```

### Pengecekan Tipe Data TypeScript
Untuk memvalidasi kesesuaian tipe data TypeScript pada seluruh kode sumber frontend dan backend:
```bash
pnpm typecheck
```

---

## 6. Panduan Aplikasi Mobile Android

### Opsi A: Memasang Berkas APK Siap Pakai (Rekomendasi)
Jika Anda hanya ingin langsung mencoba aplikasi di perangkat Android fisik atau tablet kasir tanpa perlu kompilasi:
1. Unduh berkas `WariPOS.apk` versi terbaru dari halaman [GitHub Releases](https://github.com/WalZetass-kar/WariPOS/releases/latest).
2. Pasang langsung ke perangkat Android via ADB (jika ponsel terhubung ke komputer dengan USB Debugging aktif):
   ```bash
   adb install -r release/WariPOS.apk
   ```
3. Atau salin berkas `WariPOS.apk` ke penyimpanan ponsel, buka melalui file manager perangkat, dan izinkan pemasangan aplikasi.

### Opsi B: Membangun APK dari Kode Sumber (Build Manual)
Jika Anda ingin mengompilasi berkas APK secara mandiri:
1. Kompilasi aset web dan sinkronisasikan ke modul Android:
   ```bash
   pnpm mobile:sync:android
   ```
2. Bangun berkas APK rilis bertanda tangan:
   ```bash
   pnpm android:release
   ```
   Hasil APK siap pakai akan otomatis disalin ke lokasi: `release/WariPOS.apk`.
3. Jika ingin membuka proyek Android langsung di Android Studio:
   ```bash
   pnpm android:open
   ```

---

## 7. Referensi Perintah Skrip Proyek

Berikut adalah rangkuman perintah skrip yang sering digunakan dalam pengembangan WariPOS:

| Perintah | Deskripsi Fungsi |
|---|---|
| `pnpm dev` | Menjalankan Vite dev server dan membuka aplikasi Desktop Electron |
| `pnpm dev:mobile` | Menjalankan dev server untuk akses web dan mobile di jaringan lokal |
| `pnpm test` | Menjalankan seluruh pengujian unit otomatis menggunakan Vitest |
| `pnpm typecheck` | Memeriksa validitas tipe data TypeScript di frontend dan backend |
| `pnpm mobile:sync:android` | Mengompilasi kode web dan menyinkronkan aset ke folder native Android |
| `pnpm android:release` | Membangun paket rilis Android APK bertanda tangan (`release/WariPOS.apk`) |
| `pnpm android:aab` | Membangun paket Android App Bundle (.aab) untuk rilis Google Play Store |
| `pnpm android:open` | Membuka proyek Android langsung pada aplikasi Android Studio |
| `pnpm build:desktop` | Mengompilasi seluruh aset web dan proses utama Electron untuk produksi |
| `pnpm desktop:win:installer` | Membangun paket installer Windows NSIS `.exe` (64-bit) |
| `pnpm desktop:linux` | Membangun paket distribusi Linux (.deb dan .AppImage) |

---

## 8. Lisensi & Kontak Pengembang

Proyek ini dirilis secara terbuka di bawah lisensi **MIT License**. Kode sumber bebas digunakan, dikembangkan, dan dimanfaatkan untuk kebutuhan operasional bisnis retail maupun komersial.

- **Pengembang**: WalZetass-Kar
- **Repositori Proyek**: https://github.com/WalZetass-kar/WariPOS
- **Unduh Rilis Resmi**: https://github.com/WalZetass-kar/WariPOS/releases

Hak Cipta (c) 2026 WalZetass-Kar. Seluruh hak cipta dilindungi undang-undang.
