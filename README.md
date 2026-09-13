# WariPOS - Modern Point of Sale & Retail Management System

WariPOS adalah aplikasi kasir (Point of Sale) dan manajemen retail multi-platform yang dibangun dengan arsitektur **offline-first**, dirancang untuk beroperasi secara mandiri di komputer desktop (Windows dan Linux) maupun perangkat mobile (Android dan Web Browser).

- **Pengembang**: WalZetass-Kar
- **Repositori Resmi**: https://github.com/WalZetass-kar/WariPOS
- **Unduh Rilis Android (APK Siap Pakai)**: https://github.com/WalZetass-kar/WariPOS/releases/latest
- **Lisensi**: MIT License
- **Kategori**: Next-Gen Enterprise & Retail Point of Sale Application

---

## Daftar Isi

1. Ringkasan Eksekutif & Nilai Fungsional
2. Presentasi Fungsional Fitur WariPOS
   - A. Sistem Kasir & Penjualan POS (Point of Sale)
   - B. Manajemen Struk Transaksi (Thermal ESC/POS & Digital Nota)
   - C. Manajemen Kas & Rekonsiliasi Shift Kasir
   - D. Manajemen Inventori & Kontrol Stok Real-Time
   - E. Manajemen Pengguna, Otorisasi Bertingkat (RBAC) & PIN Kilat
   - F. Sinkronisasi Data Google Sheets & Pencadangan Terenkripsi
   - G. Analisis Bisnis, Laba Rugi & Pelaporan Keuangan
   - H. Personalisasi Tema Toko & Antarmuka Multi-Device
3. Demo Aplikasi Android (Pre-built Release APK)
   - Spesifikasi Paket Rilis Android
   - Panduan Pemasangan via ADB
   - Panduan Pemasangan Manual via Berkas APK
4. Bukti Rekayasa Sistem & Modifikasi Arsitektur (Engineering Highlights)
   - Arsitektur Hybrid Berlapis (Separation of Concerns)
   - Engine Database Lokal Offline-First (ACID Compliance)
   - Algoritma Dynamic Stacking Struk Thermal & PDF
   - Geometri Lekukan Konsentris Presisi (C1 Tangent Fillet)
   - Manajemen State Global Terstruktur (Zustand Stores)
   - Rangkaian Pengujian Otomatis (187 Unit & Integration Tests)
   - Standar Keamanan & Perlindungan Data Perusahaan
5. Panduan Instalasi Lingkungan Pengembang (Developer Setup)
   - Prasyarat Perangkat Lunak
   - Kloning Repositori & Konfigurasi Lingkungan
   - Menjalankan Aplikasi Desktop Electron
   - Menjalankan & Membangun Aplikasi Android
6. Referensi Perintah Skrip Proyek
7. Lisensi & Hak Cipta

---

## 1. Ringkasan Eksekutif & Nilai Fungsional

Sebagian besar pelaku usaha retail dan UMKM menghadapi kendala operasional yang kritis saat menggunakan aplikasi kasir berbasis komputasi awan murni (cloud-only POS): gangguan koneksi internet langsung melumpuhkan transaksi pelanggan, biaya sewa server bulanan yang membebani, risiko kehilangan data saat server pihak ketiga mengalami downtime, serta format cetak struk yang sering kali tidak kompatibel dengan printer kasir termal standar.

WariPOS hadir menyelesaikan seluruh permasalahan tersebut melalui pendekatan rekayasa modern:
1. **Operasional Tanpa Ketergantungan Internet (100% Offline-First)**: Seluruh pencatatan transaksi, pemotongan stok, pembuatan invoice, dan cetak struk dieksekusi langsung pada database SQLite lokal perangkat. Toko tetap melayani pelanggan tanpa jeda waktu saat jaringan internet mati.
2. **Kedaulatan & Keamanan Data Toko**: Data transaksi tersimpan aman di perangkat pemilik usaha, dilengkapi opsi sinkronisasi otomatis ke Google Sheets pribadi dan backup lokal/cloud terenkripsi.
3. **Efisiensi Multi-Platform Nyata**: Satu basis kode TypeScript modular yang melayani ekosistem desktop kasir utama (PC/laptop) dan perangkat mobile kasir (ponsel pintar/tablet) dengan konsistensi data yang utuh.

---

## 2. Presentasi Fungsional Fitur WariPOS

WariPOS menyediakan solusi kasir end-to-end yang mencakup seluruh alur bisnis toko:

### A. Sistem Kasir & Penjualan POS (Point of Sale)
- **Katalog Produk Cepat**: Navigasi produk visual berbasis kategori dengan pencarian instan berbasis teks dan pemindaian barcode.
- **Dukungan Barcode Scanner Fleksibel**: Kompatibel dengan pemindai barcode perangkat keras (USB/Wireless HID scanner) maupun pemindai kamera bawaan ponsel/tablet Android.
- **Kuantitas & Diskon Fleksibel**: Perhitungan diskon per item (persentase/nominal) serta diskon promo keseluruhan keranjang belanja.
- **Manajemen Keranjang Tertahan (Held Cart / Hold Transaction)**: Kasir dapat menahan transaksi yang sedang berlangsung untuk melayani antrean pelanggan berikutnya, kemudian memulihkan transaksi tertahan tersebut kapan saja tanpa kehilangan data keranjang.
- **Sistem Pembayaran Terpadu (Split Payment Support)**:
  - **Tunai**: Kalkulasi otomatis nominal bayar, kalkulator uang pecahan kilat, dan penghitungan kembalian presisi.
  - **QRIS Dinamis / Statis**: Penayangan kode QRIS toko dengan verifikasi transaksi.
  - **Transfer Bank**: Pencatatan nomor rekening dan bank tujuan pembayaran toko.
- **Integrasi Member / Pelanggan**: Pencatatan poin belanja loyalitas pelanggan secara otomatis berdasarkan kelipatan nilai transaksi.
- **Fitur Retur Penjualan**: Pengembalian produk dengan audit pengembalian dana dan penyesuaian stok otomatis.

### B. Manajemen Struk Transaksi (Thermal ESC/POS & Digital Nota)
- **Dynamic Vertical Stacking**: Algoritma layout struk cerdas yang memisahkan nama produk panjang, detail kuantitas, harga satuan, dan total subtotal pada baris independen sehingga teks tidak pernah saling bertumpuk (anti-overlap).
- **Kompatibilitas Printer Luas**: Mendukung printer thermal standar industri ukuran kertas 58mm dan 80mm melalui koneksi USB, Bluetooth ESC/POS, maupun Network/LAN printer.
- **Ekspor PDF Thermal Kontinu**: Penentuan tinggi halaman PDF dihitung dinamis mengikuti jumlah item belanja (`calculateReceiptPdfHeight`) menghasilkan satu dokumen PDF utuh tanpa pemotongan halaman artifisial.
- **Nota Digital WhatsApp Satu Klik**: Pengiriman salinan struk belanja langsung ke nomor WhatsApp pelanggan dengan format nota bersih, profesional, dan siap baca.

### C. Manajemen Kas & Rekonsiliasi Shift Kasir
- **Pembukaan Kas Harian (Open Shift)**: Pencatatan modal awal uang tunai di laci kasir saat kasir memulai jam operasional.
- **Audit Penutupan Kas (Close Shift)**: Formulir rekonsiliasi fisik uang laci vs catatan sistem secara real-time untuk mendeteksi status seimbang (balance), kelebihan kas (surplus), atau selisih kurang (defisit).
- **Laporan Ringkasan Shift Kasir**: Cetak laporan rekap penjualan tunai, non-tunai, modal awal, dan laba per kasir per shift kerja.

### D. Manajemen Inventori & Kontrol Stok Real-Time
- **Stok Otomatis Terhubung Transaksi**: Setiap penjualan langsung memotong stok di tingkat database lokal secara atomik.
- **Peringatan Batas Minimum Stok (Low Stock Alert)**: Notifikasi dini saat stok barang menyentuh ambang batas minimum untuk mencegah kehabisan produk populer.
- **Riwayat Mutasi Barang**: Pencatatan detail barang masuk, barang keluar, penyesuaian stok manual (stock opname), dan pencatatan alasan selisih.
- **Impor & Ekspor Spreadsheet**: Fasilitas impor massal data produk dan ekspor katalog barang ke format CSV/Excel.

### E. Manajemen Pengguna, Otorisasi Bertingkat (RBAC) & PIN Kilat
- **Hierarki Peran (Role-Based Access Control)**:
  - **Owner / Super Admin**: Akses penuh ke seluruh konfigurasi toko, laporan laba rugi, manajemen pengguna, dan sinkronisasi.
  - **Admin**: Akses operasional toko, master produk, supplier, dan laporan transaksi.
  - **Supervisor**: Otorisasi pembatalan transaksi, diskon khusus, dan audit kas.
  - **Kasir**: Akses fokus pada layar penjualan POS dan laporan shift pribadi.
- **Login Kilat PIN Kasir**: Kasir dapat beralih akun atau masuk ke sistem kasir dalam 2 detik menggunakan PIN 4 hingga 8 digit angka terenkripsi tanpa perlu mengetikkan username dan password panjang di layar sentuh.

### F. Sinkronisasi Data Google Sheets & Pencadangan Terenkripsi
- **Sinkronisasi Multi-Tab Google Sheets**: Integrasi tanpa biaya server bulanan menggunakan Web App Google Apps Script toko pribadi. Sinkronisasi instan mencakup tab Penjualan, Laba Rugi, Katalog Barang, Mutasi Stok, dan Data Pelanggan.
- **Pencadangan Data Lokal & Cloud**: Fitur backup database terstruktur dengan antarmuka kartu mandiri (*bounded cards*) yang rapi di layar ponsel, mendukung unduh berkas backup, pemulihan (restore) instan, dan penghapusan arsip usang.

### G. Analisis Bisnis, Laba Rugi & Pelaporan Keuangan
- **Dashboard Ringkasan Eksekutif**: Visualisasi grafik tren omzet harian/mingguan/bulanan, total margin keuntungan, dan rata-rata nilai transaksi per pelanggan.
- **Laporan Laba Kotor & Bersih**: Perhitungan harga pokok penjualan (HPP) vs harga jual untuk menyajikan keuntungan riil bisnis.
- **Produk Terlaris (Top Selling Items)**: Peringkat produk dengan volume penjualan dan kontribusi omzet tertinggi.
- **Perhitungan Komisi Sales**: Sistem komisi staf penjualan berdasarkan persentase target penjualan yang tercapai.

### H. Personalisasi Tema Toko & Antarmuka Multi-Device
- **Palet Warna Aksen Dinamis**: Pilihan 10 tema warna toko (Emerald, Indigo, Blue, Amber, Rose, Violet, Slate, dll.) yang diterapkan konsisten pada elemen navigasi, tombol kasir, hingga badge notifikasi.
- **Mode Tampilan Layar**: Dukungan Mode Terang (Light Mode), Mode Gelap (Dark Mode), dan Mode Hemat Daya Layar OLED.
- **Responsif Mobile Adaptif**: Bilah navigasi bawah (*bottom bar*) dengan lekukan tombol kasir konsentris presisi, floating action button kasir proporsional, dan modal notifikasi terpusat.

---

## 3. Demo Aplikasi Android (Pre-built Release APK)

Bagi penguji, juri, maupun pemilik toko yang ingin langsung mencoba WariPOS di perangkat Android fisik tanpa perlu melakukan build manual:

### Spesifikasi Paket Rilis Android
- **Berkas Unduhan**: [`WariPOS.apk`](https://github.com/WalZetass-kar/WariPOS/releases/latest)
- **Versi Aplikasi**: `2.2.2` (`versionCode: 20202`)
- **Ukuran File**: ~20 MB
- **Application ID**: `com.wari.pos`
- **Target SDK**: `36` (Kompatibel dengan Android 16 dan perangkat modern)
- **Min SDK**: `26` (Mendukung Android 8.0 Oreo ke atas)
- **Status Tanda Tangan**: *Signed Release* (APK Signature Scheme v2)
- **Izin Native**: Kamera (Scanner Barcode), Biometrik/Fingerprint (Login Aman), Bluetooth (Thermal Printer), Jaringan Lokal/Internet.

### Panduan Pemasangan via ADB
Jika ponsel Anda terhubung ke laptop/komputer via kabel USB dengan opsi **USB Debugging** aktif:
```bash
adb install -r release/WariPOS.apk
```
Untuk langsung meluncurkan aplikasi di layar ponsel:
```bash
adb shell am start -n com.wari.pos/com.zetass.pos.MainActivity
```

### Panduan Pemasangan Manual via Berkas APK
1. Unduh berkas `WariPOS.apk` dari tautan [GitHub Releases](https://github.com/WalZetass-kar/WariPOS/releases/latest).
2. Salin berkas ke penyimpanan ponsel pintar atau tablet Android Anda.
3. Buka file manager di perangkat Anda, klik `WariPOS.apk`, lalu konfirmasikan instalasi aplikasi.
4. Buka WariPOS dan lakukan inisialisasi akun pemilik toko pertama kali.

---

## 4. Bukti Rekayasa Sistem & Modifikasi Arsitektur (Engineering Highlights)

WariPOS dirancang dan dikembangkan dengan standar rekayasa perangkat lunak profesional. Kode sumber dibangun dengan arsitektur modular, teruji, dan bebas dari ketergantungan pada template siap saji:

### A. Arsitektur Hybrid Berlapis (Separation of Concerns)
Struktur kode sumber menerapkan pemisahan lapisan tugas yang tegas:
- **Presentation Layer (`src/renderer`)**: Komponen antarmuka React modular berbasis fungsionalitas murni dengan pemisahan custom hooks (`useTransaksiState`, `useHoldCart`, `useUndo`, `useDebounce`).
- **State Management Layer (`src/renderer/stores`)**: State terpusat Zustand memisahkan data keranjang belanja aktif (`cartStore.ts`) dari preferensi aplikasi yang dipersistensikan (`appStore.ts`).
- **Hardware & Device Abstraction Layer (`src/renderer/utils`)**: Modul komunikasi driver perangkat keras independen untuk printer thermal ESC/POS Bluetooth, printer USB, pemindai barcode serial/kamera, dan sinkronisasi spreadsheet.
- **Native Runtime Adapters**: Penanganan native ganda melalui Electron IPC Whitelist untuk desktop dan Capacitor Native Plugins untuk Android.

### B. Engine Database Lokal Offline-First (ACID Compliance)
- Implementasi SQLite native menggunakan `better-sqlite3` pada platform Desktop dengan konfigurasi **WAL Mode (Write-Ahead Logging)** yang menjamin operasi baca-tulis konkuren berkecepatan tinggi tanpa resiko database lock.
- Penanganan skema database terkelola dengan modul migrasi otomatis (`migrations/`) yang memverifikasi integritas tabel saat startup aplikasi.

### C. Algoritma Dynamic Stacking Struk Thermal & PDF
- Masalah teks bertumpuk pada pencetakan thermal diatasi dengan sistem kalkulasi ketinggian vertikal dinamis:
  - Nama produk dipecah otomatis per baris (`splitTextToSize`) dengan alokasi ruang vertikal mandiri.
  - Baris kuantitas dan harga satuan ditempatkan pada baris baru di bawah nama barang, dipisahkan dari nominal subtotal di sisi kanan.
  - Fungsi `calculateReceiptPdfHeight` menghitung akumulasi tinggi konten faktual seluruh item sebelum kanvas PDF dirender, menjamin dokumen thermal PDF selalu utuh dalam 1 halaman kontinu tanpa terpotong.

### D. Geometri Lekukan Konsentris Presisi (C1 Tangent Fillet)
- Tombol Kasir mobile berdiameter 66px dengan elevasi luar 4px menempatkan titik pusat fisik tombol pada koordinat vertikal $(cx, 5)$.
- Jalur SVG *notch* dihitung secara analitis matematis menggunakan teorema Pythagoras:
  $$D = R_1 + R_2 = 42.5 + 14 = 56.5\text{px}$$
  $$x_{shoulder} = \sqrt{D^2 - (R_2 - cy)^2} = \sqrt{56.5^2 - 9^2} \approx 55.78\text{px}$$
  $$x_{inflect} = x_{shoulder} \times \frac{R_1}{D} \approx 41.96\text{px}, \quad y_{inflect} = cy + 9 \times \frac{R_1}{D} \approx 11.77\text{px}$$
- Menghasilkan celah udara seragam 5.5px konsentris sempurna di sekeliling tombol kasir dengan kontinuitas tangensial turunan pertama ($C^1$) yang mulus tanpa sudut patah.

### E. Manajemen State Global Terstruktur (Zustand Stores)
- State keranjang kasir (`useCartStore`) menangani penambahan item, kalkulasi kuantitas, penerapan promo, dan pemilihan pelanggan tanpa memicu re-render yang tidak perlu pada katalog barang.
- Preferensi UI dan shift kasir aktif dikelola terpisah di `useAppStore` dengan mekanisme filter penyimpanan (*partialize storage*) untuk menjaga privasi sesi kerja.

### F. Rangkaian Pengujian Otomatis (187 Unit & Integration Tests)
Proyek dilengkapi dengan 22 test suites yang mencakup 187 skenario unit test otomatis menggunakan Vitest:
- Kalkulasi keranjang, pajak, dan kembalian (`tests/cartCalculations.test.ts`).
- Validasi keamanan PIN dan masa aktif lisensi (`tests/authLogic.test.ts`).
- Layout rendering struk dinamis (`tests/receiptLayout.test.ts`).
- Validasi data masukan dan sanitasi XSS (`tests/sanitize.test.ts`, `tests/validationUtils.test.ts`).
- Kanal IPC whitelist dan proteksi peran pengguna (`tests/apiUtils.test.ts`, `tests/demoGuardV2.test.ts`).
- Format ekspor multi-tab Google Sheets (`tests/googleSheetsReportExport.test.ts`).

### G. Standar Keamanan & Perlindungan Data Perusahaan
- **Isolasi Proses Antarmuka**: Arsitektur proses Electron menerapkan `contextIsolation: true` dan `nodeIntegration: false`. Semua interaksi backend diverifikasi melalui kanal IPC bertipe aman.
- **Proteksi Kata Sandi & PIN**: Kredensial pengguna di-hash menggunakan algoritma `bcryptjs` dengan salt rounds terstandarisasi.
- **Sanitasi Data Masukan**: Pencegahan terhadap celah SQL Injection dan Cross-Site Scripting (XSS) pada seluruh input transaksi dan master barang.

---

## 5. Panduan Instalasi Lingkungan Pengembang (Developer Setup)

### Prasyarat Perangkat Lunak
- **Node.js**: Versi LTS (v20.x atau v22.x). Hindari versi non-LTS.
- **Package Manager**: `pnpm` (direkomendasikan versi 9 ke atas).
- **Java Development Kit**: OpenJDK 17 (diperlukan untuk kompilasi modul Android).
- **Android SDK**: Android Build-Tools versi 34.0.0 atau 35.0.0, Platform API 34/36.
- **Git**: Versi 2.30 ke atas.

### Kloning Repositori & Konfigurasi Lingkungan
```bash
# Klon repositori WariPOS
git clone https://github.com/WalZetass-kar/WariPOS.git
cd WariPOS

# Salin konfigurasi environment
cp .env.example .env

# Pasang seluruh dependensi proyek
pnpm install
```

### Menjalankan Aplikasi Desktop Electron
```bash
# Menjalankan server Vite dan jendela Desktop Electron (live-reload)
pnpm dev
```

### Menjalankan & Membangun Aplikasi Android
```bash
# Sinkronisasi aset web ke proyek Android
pnpm mobile:sync:android

# Membangun berkas APK rilis bertanda tangan
pnpm android:release

# Hasil berkas APK tersimpan di: release/WariPOS.apk
```

---

## 6. Referensi Perintah Skrip Proyek

| Perintah | Deskripsi Fungsi |
|---|---|
| `pnpm dev` | Menjalankan Vite dev server dan Electron desktop app secara bersamaan |
| `pnpm dev:mobile` | Menjalankan Vite dev server untuk pratinjau mobile di browser / jaringan lokal |
| `pnpm test` | Menjalankan seluruh 22 test suite (187 unit tests) via Vitest |
| `pnpm typecheck` | Menjalankan validasi tipe data TypeScript di frontend dan backend |
| `pnpm mobile:sync:android` | Mengompilasi bundel web dan menyinkronkan aset native Capacitor Android |
| `pnpm android:release` | Membangun paket rilis Android APK bertanda tangan (`release/WariPOS.apk`) |
| `pnpm android:aab` | Membangun Android App Bundle (.aab) untuk publikasi Google Play Store |
| `pnpm android:open` | Membuka proyek native Android langsung di Android Studio |
| `pnpm build:desktop` | Mengompilasi seluruh aset web dan skrip proses utama Electron |
| `pnpm desktop:win:installer` | Membangun installer desktop NSIS `.exe` untuk Windows 64-bit |
| `pnpm desktop:linux` | Membangun paket distribusi Linux (.deb dan .AppImage) |
| `pnpm rebuild:electron` | Kompilasi ulang binary native C++ better-sqlite3 untuk Electron |

---

## 7. Lisensi & Hak Cipta

Proyek ini dirilis di bawah lisensi terbuka **MIT License**. Kode sumber terbuka untuk dipelajari, dikembangkan, dan dimanfaatkan untuk kebutuhan operasional bisnis retail.

- **Pengembang**: WalZetass-Kar
- **Repositori Kode**: https://github.com/WalZetass-kar/WariPOS
- **Unduh Rilis APK**: https://github.com/WalZetass-kar/WariPOS/releases/latest

Hak Cipta (c) 2026 WalZetass-Kar. Seluruh hak cipta dilindungi undang-undang.
