# WariPOS

Aplikasi Point of Sale (POS) & Manajemen Kasir Multi-Platform (Desktop Windows & Linux, Mobile Android, dan Web Browser) dengan arsitektur offline-first berbasis SQLite lokal serta sinkronisasi opsional ke Cloud Database dan Google Sheets.

Developer: WalZetass-Kar  
Repositori: https://github.com/WalZetass-kar/WariPOS  
Lisensi: MIT  
Platform yang Didukung: Windows 10/11 (64-bit), Linux (Debian/Ubuntu, Arch, Fedora), Android (8.0 Oreo ke atas), Web Browser  

---

## Daftar Isi

1. Tech Stack & Arsitektur
2. Opsi 1: Penggunaan Langsung Menggunakan Installer Siap Pakai
3. Opsi 2: Panduan Lengkap Instalasi & Setup di Komputer Baru (Developer Mode)
   - Prasyarat Sistem & Perangkat Lunak
   - Clone Repositori & Persiapan Environment
   - Instalasi Dependensi Proyek
   - Menjalankan Aplikasi Desktop Electron
   - Menjalankan & Membuka Aplikasi Android di Komputer Baru
     - Metode A: Melalui Android Studio
     - Metode B: Melalui Terminal & ADB ke HP Fisik / Emulator
     - Metode C: Live Dev Mode di Browser (Mobile View)
4. Panduan Alur Penggunaan Pertama Kali (First-Time User Guide)
   - Setup Akun Super Admin / Pemilik Toko
   - Konfigurasi Identitas Toko & Struk Belanja
   - Manajemen Produk & Kategori
   - Manajemen Kasir & Login Kilat Menggunakan PIN
   - Pembukaan Shift Kasir & Transaksi POS
   - Tutup Shift Kasir & Rekonsiliasi Uang Laci
   - Integrasi & Ekspor Data Transaksi ke Google Sheets
   - Kustomisasi Tema & Mode Tampilan Antarmuka
5. Referensi Perintah Skrip (NPM / PNPM Scripts)
6. Panduan Troubleshooting Masalah Umum
7. Standar Keamanan & Perlindungan Data
8. Lisensi & Pengembang

---

## 1. Tech Stack & Arsitektur

WariPOS dirancang dengan prinsip **offline-first**, memastikan operasional kasir tetap berjalan lancar 100% tanpa ketergantungan koneksi internet. Data transaksi disimpan langsung di database SQLite lokal perangkat.

| Komponen | Teknologi | Keterangan |
|---|---|---|
| Frontend UI | React 18, TypeScript, TailwindCSS, Lucide Icons | Antarmuka responsif untuk desktop dan layar sentuh tablet/ponsel |
| State Management | Zustand | State management global untuk keranjang belanja dan preferensi |
| Desktop Runtime | Electron 31, Vite 5 | Kemasan aplikasi desktop native Windows & Linux |
| Mobile Engine | Capacitor 8 | Jembatan native Android & iOS untuk akses kamera scanner & storage |
| Database Lokal | SQLite (better-sqlite3 / @capacitor-community/sqlite) | Penyimpanan transaksi lokal ACID tanpa konfigurasi server database |
| ORM | Drizzle ORM | Query builder bertipe aman dan migrasi skema terstruktur |
| Cloud & Ekspor | Supabase Edge Functions & Google Sheets API | Sinkronisasi cadangan awan dan pelaporan spreadsheet otomatis |
| Testing & CI/CD | Vitest, GitHub Actions | Unit testing otomatis dan automated build pipeline |

---

## 2. Opsi 1: Penggunaan Langsung Menggunakan Installer Siap Pakai

Jika Anda adalah pemilik toko, kasir, atau staf operasional yang ingin langsung menggunakan WariPOS tanpa perlu memasang Node.js, Git, atau tools pemrograman lainnya:

### A. Perangkat Android (HP / Tablet POS)
1. Unduh berkas installer `WariPOS.apk` dari menu [Releases GitHub](https://github.com/WalZetass-kar/WariPOS/releases/latest).
2. Salin berkas ke HP Android Anda, lalu buka file manager dan klik `WariPOS.apk`.
3. Jika muncul dialog peringatan keamanan, aktifkan izin "Instal aplikasi dari sumber tidak dikenal" untuk pengelola berkas Anda.
4. Klik **Instal** dan buka aplikasi WariPOS.

### B. Komputer Windows (Windows 10 / 11 64-bit)
1. Unduh berkas `WariPOS-win-x64.zip` dari [Releases GitHub](https://github.com/WalZetass-kar/WariPOS/releases/latest).
2. Ekstrak arsip ZIP tersebut ke folder pilihan Anda (misalnya `C:\Program Files\WariPOS` atau `D:\WariPOS`).
3. Buka folder hasil ekstrak dan jalankan `WariPOS.exe`.
4. Anda dapat membuat shortcut ke Desktop dengan klik kanan pada `WariPOS.exe` lalu pilih **Send to -> Desktop (create shortcut)**.

### C. Komputer Linux (Ubuntu, Debian, Linux Mint)
1. Unduh berkas `.deb` atau `.AppImage` dari [Releases GitHub](https://github.com/WalZetass-kar/WariPOS/releases/latest).
2. Untuk paket `.deb`:
   ```bash
   sudo dpkg -i WariPOS-linux-amd64.deb
   sudo apt-get install -f
   ```
3. Untuk paket universal `.AppImage`:
   ```bash
   chmod +x WariPOS-linux-x86_64.AppImage
   ./WariPOS-linux-x86_64.AppImage
   ```

---

## 3. Opsi 2: Panduan Lengkap Instalasi & Setup di Komputer Baru (Developer Mode)

Bagian ini memandu langkah demi langkah menyiapkan seluruh lingkungan pengembangan dari awal di komputer baru, baik di Windows, Linux, maupun macOS.

### Prasyarat Sistem & Perangkat Lunak

Sebelum mengunduh kode proyek, pastikan perangkat lunak berikut telah terpasang di komputer Anda:

#### 1. Git
- **Windows**: Unduh installer Git dari situs resmi https://git-scm.com dan jalankan instalasi dengan opsi default.
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt-get update && sudo apt-get install -y git
  ```
- **macOS**:
  ```bash
  xcode-select --install
  ```

#### 2. Node.js & npm (Wajib Menggunakan Versi LTS: v20.x atau v22.x)
Penting: Gunakan versi LTS (Node.js v20 atau v22). Jangan gunakan Node.js v24 atau versi development non-LTS karena modul native SQLite (`better-sqlite3`) belum menyediakan binary siap pakai (prebuilt binary) untuk Node 24, yang akan menyebabkan error `gyp ERR! find VS` saat instalasi.
- **Windows**: Unduh installer Node.js bertanda **LTS** dari https://nodejs.org.
- **Linux (Debian/Ubuntu)**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential python3 libsqlite3-dev
  ```
- Verifikasi instalasi:
  ```bash
  node -v
  npm -v
  ```

#### 3. pnpm (Package Manager Cepat)
Pasang pnpm secara global melalui npm:
```bash
npm install -g pnpm
pnpm -v
```

#### 4. Java Development Kit (JDK 17)
Diperlukan untuk kompilasi modul Android dan menjalankan Gradle:
- **Windows**: Unduh OpenJDK 17 atau Eclipse Temurin 17 dari https://adoptium.net.
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt-get install -y openjdk-17-jdk
  ```
- Pastikan variabel environment `JAVA_HOME` telah mengarah ke direktori instalasi JDK 17 dan verifikasi via terminal:
  ```bash
  java -version
  ```

#### 5. Android Studio & Android SDK (Khusus Pengembangan Mobile)
1. Unduh dan pasang **Android Studio** versi terbaru dari https://developer.android.com/studio.
2. Buka Android Studio, masuk ke menu **Settings / Preferences -> Appearance & Behavior -> System Settings -> Android SDK**.
3. Pada tab **SDK Platforms**, pastikan tercentang:
   - Android 14.0 (API 34) atau Android 13.0 (API 33).
4. Pada tab **SDK Tools**, pastikan tercentang:
   - Android SDK Build-Tools (versi 34.0.0 atau 35.0.0)
   - Android SDK Command-line Tools (latest)
   - Android SDK Platform-Tools (adb)
5. Atur variabel lingkungan `ANDROID_HOME`:
   - **Linux / macOS** (di `~/.bashrc` atau `~/.zshrc`):
     ```bash
     export ANDROID_HOME=$HOME/Android/Sdk
     export PATH=$PATH:$ANDROID_HOME/emulator
     export PATH=$PATH:$ANDROID_HOME/platform-tools
     export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
     ```
   - **Windows**: Tambahkan variabel pengguna `ANDROID_HOME` mengarah ke `%LOCALAPPDATA%\Android\Sdk` dan tambahkan `%ANDROID_HOME%\platform-tools` ke dalam `PATH`.

---

### Clone Repositori & Persiapan Environment

1. Buka Terminal / Git Bash / Command Prompt, lalu klon repositori WariPOS:
   ```bash
   git clone https://github.com/WalZetass-kar/WariPOS.git
   cd WariPOS
   ```

2. Siapkan berkas konfigurasi environment `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Pada Windows Command Prompt: gunakan `copy .env.example .env`)*

   Buka berkas `.env` dengan text editor pilihan Anda. Jika Anda ingin menggunakan sinkronisasi cloud atau Firebase, sesuaikan nilainya. Jika hanya digunakan secara offline lokal, konfigurasi bawaan sudah siap digunakan.

---

### Instalasi Dependensi Proyek

Jalankan perintah berikut di root folder `WariPOS`:
```bash
pnpm install
```

> **Catatan Teknis Kompilasi Modul Native SQLite:**  
> Skrip `postinstall` akan otomatis mengompilasi modul native `better-sqlite3` agar cocok dengan versi Node/Electron yang berjalan. Jika Anda menjumpai pesan modul ABI mismatch saat pertama kali menjalankan aplikasi, jalankan:
> ```bash
> pnpm run rebuild:electron
> ```

---

### Menjalankan Aplikasi Desktop Electron

Untuk menjalankan aplikasi desktop dalam mode pengembangan (live-reload):
```bash
pnpm dev
```

Proses yang terjadi di balik layar:
1. Server pengembang Vite aktif di port `5173`.
2. Electron mengompilasi skrip proses utama (`src/main`).
3. Jendela aplikasi WariPOS Desktop otomatis terbuka dengan antarmuka kasir responsif.

---

### Menjalankan & Membuka Aplikasi Android di Komputer Baru

Proyek WariPOS menggunakan **Capacitor 8** untuk mengintegrasikan kode antarmuka web React dengan platform native Android. Anda dapat menjalankan versi Android melalui dua metode:

#### Metode A: Melalui Android Studio

1. Lakukan kompilasi bundle web dan sinkronisasi aset ke folder Android:
   ```bash
   pnpm mobile:sync:android
   ```
2. Buka folder proyek Android langsung ke Android Studio:
   ```bash
   pnpm android:open
   ```
   *(Atau buka aplikasi Android Studio secara manual, klik **Open**, lalu pilih folder `WariPOS/android`)*.
3. Tunggu hingga proses **Gradle Sync** selesai mengunduh seluruh dependensi Android. Anda dapat melihat indikator progres di sudut kanan bawah Android Studio.
4. Hubungkan HP fisik Android Anda melalui kabel USB (pastikan USB Debugging aktif) atau buat Android Virtual Device (AVD) di menu **Device Manager**.
5. Pilih perangkat tujuan dari menu dropdown di bilah alat atas Android Studio.
6. Klik tombol **Run 'app'** (ikon panah segitiga hijau atau tekan tombol pintas `Shift + F10`).
7. Aplikasi WariPOS akan otomatis dikompilasi, dipasang, dan dibuka di perangkat Android Anda.

#### Metode B: Melalui Terminal & ADB (Tanpa Membuka Android Studio)

Metode ini sangat cepat jika Anda ingin menguji langsung ke HP fisik via kabel data:

1. **Aktifkan Mode Pengembang di HP Android**:
   - Buka menu **Pengaturan** -> **Tentang Ponsel**.
   - Ketuk kolom **Nomor Versi / Build Number** sebanyak 7 kali berturut-turut hingga muncul pesan konfirmasi pengembang.
   - Masuk ke **Pengaturan Tambahan / Sistem** -> **Opsi Pengembang**.
   - Aktifkan toggle **USB Debugging** (dan **Install via USB** jika tersedia di perangkat Anda).
2. Sambungkan HP ke laptop/komputer via kabel USB. Saat muncul dialog pop-up di layar ponsel, pilih **Izinkan USB Debugging**.
3. Buka Terminal dan pastikan perangkat HP Anda terdeteksi:
   ```bash
   adb devices
   ```
   Terminal akan menampilkan ID serial perangkat dengan status `device`.
4. Kompilasi bundle web dan sinkronisasi aset:
   ```bash
   pnpm mobile:sync:android
   ```
5. Kompilasi APK bertanda tangan (Signed Release):
   ```bash
   pnpm android:release
   ```
   *(Hasil kompilasi akan tersimpan di berkas `release/WariPOS.apk`)*
6. Pasang berkas APK langsung ke perangkat yang terhubung:
   ```bash
   adb install -r release/WariPOS.apk
   ```
7. Luncurkan aplikasi di ponsel langsung dari terminal:
   ```bash
   adb shell am start -n com.zetasspos.app/com.zetasspos.app.MainActivity
   ```

#### Metode C: Mode Preview Mobile di Browser

Jika Anda ingin melihat tata letak antarmuka mobile secara cepat tanpa perlu menyambungkan HP:
```bash
pnpm dev:mobile
```
Buka browser di alamat `http://localhost:5173`, tekan tombol `F12` untuk membuka Developer Tools, lalu aktifkan mode **Toggle Device Toolbar** (Ctrl+Shift+M) dan pilih tipe perangkat seperti *Pixel 7* atau *iPhone 14*.

---

## 4. Panduan Alur Penggunaan Pertama Kali (First-Time User Guide)

### Langkah 1: Setup Akun Super Admin / Pemilik Toko
Saat WariPOS dijalankan untuk pertama kali pada instalasi baru, database SQLite lokal masih dalam kondisi bersih. Aplikasi akan secara otomatis mendeteksi status ini dan menampilkan formulir **Setup Akun Pemilik**.
- Masukkan **Username** (contoh: `owner` atau `admin`).
- Masukkan **Nama Lengkap**.
- Masukkan **Password** (minimal 8 karakter kombinasi aman).
- Klik tombol **Buat Akun & Masuk**.

### Langkah 2: Konfigurasi Identitas Toko & Struk
1. Buka menu navigasi samping dan pilih menu **Pengaturan Toko**.
2. Lengkapi formulir informasi toko:
   - Nama Toko / Usaha.
   - Alamat Lengkap Toko.
   - Nomor Telepon / WhatsApp Toko.
   - Catatan Header Struk (misalnya: "Selamat Berbelanja").
   - Catatan Footer Struk (misalnya: "Barang yang sudah dibeli tidak dapat ditukar").
3. Klik **Simpan Pengaturan**. Informasi ini akan otomatis tercetak pada struk thermal dan struk WhatsApp pelanggan.

### Langkah 3: Manajemen Produk & Kategori
1. Masuk ke menu **Kategori Barang**: Tambahkan kelompok produk Anda (misalnya: *Makanan*, *Minuman*, *Sembako*, *Pakaian*).
2. Masuk ke menu **Data Barang / Produk**:
   - Klik **Tambah Produk Baru**.
   - Masukkan Kode Produk / Barcode (dapat diketik manual atau dipindai dengan barcode scanner).
   - Masukkan Nama Produk, Satuan (pcs, kg, porsi), dan Kategori.
   - Masukkan Harga Beli (modal) dan Harga Jual.
   - Masukkan Jumlah Stok Awal dan Batas Minimum Stok untuk peringatan stok menipis.
   - Klik **Simpan**.

### Langkah 4: Manajemen Kasir & Login Kilat Menggunakan PIN
Untuk mempercepat proses pergantian kasir tanpa harus mengetik password panjang:
1. Masuk ke menu **Pengguna** (hanya dapat diakses oleh peran Admin/Owner).
2. Klik **Tambah Pengguna Baru**:
   - Tentukan Username kasir (misal: `kasir1`).
   - Pilih peran (Role): **Kasir**.
   - Tentukan izin akses menu yang diperbolehkan.
3. Atur **PIN Kasir** (4 hingga 8 digit angka).
4. Simpan akun kasir.
5. Pada saat kasir akan melayani transaksi di perangkat mobile Android maupun desktop, kasir cukup memilih tab **Login PIN Kasir**, memasukkan PIN angka, dan langsung diarahkan ke layar kasir.

### Langkah 5: Pembukaan Shift Kasir & Transaksi Penjualan (POS)
1. **Buka Shift Kasir**:
   - Saat pertama kali masuk menu kasir di hari kerja baru, masukkan nominal modal awal kas laci (misal: Rp 100.000).
   - Klik **Buka Kas**.
2. **Melakukan Transaksi**:
   - Klik pada produk di katalog visual, atau pindai barcode produk menggunakan pemindai barcode / kamera HP.
   - Atur jumlah kuantitas (Qty), diskon per item jika ada.
   - Pilih Member / Pelanggan jika ingin mencatat poin belanja loyalitas.
   - Tentukan metode pembayaran:
     - **TUNAI**: Masukkan uang yang diterima pembeli; sistem otomatis menghitung nominal kembalian secara presisi.
     - **QRIS**: Tampilkan QRIS resmi; pembeli dapat memindai dari ponsel mereka.
     - **TRANSFER**: Pilih bank tujuan transfer toko.
   - Klik tombol **Bayar / Selesaikan Transaksi**.
3. **Cetak & Bagikan Struk**:
   - Cetak langsung ke printer thermal (USB / Bluetooth 58mm & 80mm).
   - Bagikan struk digital langsung ke nomor WhatsApp pelanggan dalam format nota rapi dengan sekali klik.

### Langkah 6: Tutup Shift Kasir & Rekonsiliasi Uang
1. Di akhir jam kerja kasir, masuk ke menu **Tutup Kas / Shift**.
2. Hitung jumlah uang fisik tunai yang ada di dalam laci kasir.
3. Masukkan nominal uang fisik tersebut ke dalam formulir tutup kas.
4. Sistem akan menampilkan rincian total transaksi tunai, non-tunai, modal awal, serta menghitung selisih kas (apakah seimbang, surplus, atau defisit).
5. Klik **Tutup Kas & Cetak Laporan Shift**.

### Langkah 7: Integrasi & Ekspor Data ke Google Sheets
WariPOS menyediakan integrasi langsung ke Google Sheets secara berkala atau satu kali klik:
1. Buka menu **Pengaturan Sinkronisasi / Integrasi**.
2. Masukkan URL Web App Google Apps Script toko Anda.
3. Klik **Uji Koneksi** untuk memastikan spreadsheet terhubung.
4. Data master barang, riwayat transaksi penjualan, dan rekap keuangan harian dapat disinkronkan langsung ke Google Sheets pemilik toko untuk dipantau secara langsung dari mana saja.

### Langkah 8: Kustomisasi Tema & Mode Tampilan Antarmuka
1. Masuk ke menu **Pengaturan Tema**.
2. Pilih palet warna aksen toko: Biru, Emerald, Indigo, Amber, Rose, atau Violet.
3. Pilih mode tampilan antarmuka: Mode Terang (Light), Mode Gelap (Dark), atau Mengikuti Pengaturan Sistem.
4. Tentukan tingkat kebulatan sudut elemen antarmuka (Rounded Radius).
5. Pengaturan tema disimpan secara permanen di preferensi perangkat Anda.

---

## 5. Referensi Perintah Skrip (NPM / PNPM Scripts)

Berikut adalah daftar lengkap perintah otomatis yang tersedia pada berkas `package.json`:

| Perintah | Deskripsi Fungsi |
|---|---|
| `pnpm dev` | Menjalankan server dev Vite dan membuka aplikasi Desktop Electron secara bersamaan |
| `pnpm dev:mobile` | Menjalankan server pengembang Vite untuk preview mobile di jaringan lokal |
| `pnpm build:desktop` | Melakukan kompilasi seluruh aset web frontend dan skrip proses utama Electron |
| `pnpm desktop:win` | Membangun paket portabel arsip ZIP untuk sistem operasi Windows 64-bit |
| `pnpm desktop:win:installer` | Membangun installer NSIS `.exe` resmi untuk Windows 64-bit |
| `pnpm desktop:linux` | Membangun paket distribusi Linux (.deb dan .AppImage) |
| `pnpm mobile:sync:android` | Mengompilasi kode React dan menyinkronkan aset web ke modul Android native |
| `pnpm android:open` | Membuka folder proyek Android native langsung di Android Studio |
| `pnpm android:debug` | Membangun berkas instalasi Android APK versi debug |
| `pnpm android:release` | Membangun berkas instalasi Android APK versi release bertanda tangan |
| `pnpm android:aab` | Membangun format Android App Bundle (.aab) untuk publikasi Google Play Store |
| `pnpm typecheck` | Menjalankan pemeriksaan validitas tipe data TypeScript di frontend dan backend |
| `pnpm test` | Menjalankan seluruh rangkaian unit testing menggunakan Vitest |
| `pnpm rebuild:electron` | Mengompilasi ulang modul native C++ better-sqlite3 khusus binary Electron |
| `pnpm rebuild:node` | Mengompilasi ulang modul native C++ better-sqlite3 untuk Node.js CLI runtime |

---

## 6. Panduan Troubleshooting Masalah Umum

### 1. Pesan Galat: `gyp ERR! find VS You need to install the latest version of Visual Studio` / `No prebuilt binaries found (target=24.x)` saat `pnpm install`
Penyebab: Anda menggunakan Node.js versi non-LTS (misalnya Node.js v24). Library SQLite native (`better-sqlite3`) belum menyediakan prebuilt binary untuk versi Node tersebut, sehingga sistem mencoba mengompilasinya dari kode sumber C++ dan menuntut Visual Studio C++ Build Tools.  
Solusi:
- **Solusi Utama (Sangat Disarankan)**: Pasang Node.js versi **LTS (v20.x atau v22.x)** dari https://nodejs.org. Pada versi LTS, binary prebuilt `better-sqlite3` akan langsung terunduh secara otomatis dalam hitungan detik tanpa perlu menginstal Visual Studio C++ sama sekali. Setelah mengganti versi Node.js, hapus folder `node_modules` lalu jalankan kembali `pnpm install`.
- **Solusi Alternatif**: Jika tetap harus di Node.js saat ini, jalankan instalasi tanpa mengeksekusi skrip kompilasi:
  ```bash
  pnpm install --ignore-scripts
  ```
  Kemudian lakukan rebuild khusus binary Electron:
  ```bash
  pnpm run rebuild:electron
  ```

### 2. Pesan Galat: `The module 'better-sqlite3.node' was compiled against a different Node.js version`
Penyebab: Versi binary Node.js sistem berbeda dengan internal runtime Electron.  
Solusi: Jalankan perintah kompilasi ulang modul:
```bash
pnpm run rebuild:electron
```

### 2. Pesan Galat: `Gradle sync failed` di Android Studio
Penyebab: Jalur JDK tidak sesuai atau versi Gradle belum terunduh sempurna.  
Solusi:
- Buka menu **File -> Settings -> Build, Execution, Deployment -> Build Tools -> Gradle**.
- Pada bagian **Gradle JDK**, pastikan memilih versi **JDK 17** (Embedded JDK atau JDK 17 yang terpasang).
- Klik tombol **Sync Project with Gradle Files** di pojok kanan atas Android Studio.

### 3. HP Tidak Terdeteksi saat Menjalankan `adb devices`
Penyebab: Driver USB vendor belum terpasang atau izin USB debugging belum diaktifkan.  
Solusi:
- Cabut kabel USB dan pasang kembali ke port USB lain di komputer Anda.
- Ganti mode sambungan USB di HP menjadi **Transfer File (MTP)**.
- Buka Opsi Pengembang di HP dan matikan lalu aktifkan kembali opsi **USB Debugging**.
- Jalankan perintah `adb kill-server && adb start-server`, lalu jalankan kembali `adb devices`.

### 4. Port 5173 Sudah Digunakan (`EADDRINUSE: address already in use :::5173`)
Penyebab: Ada proses Vite atau aplikasi web lain yang masih berjalan di latar belakang.  
Solusi:
- Cari dan hentikan proses yang menempati port 5173:
  - Linux/macOS: `npx kill-port 5173`
  - Windows: `netstat -ano | findstr :5173` lalu matikan PID terkait dengan `taskkill /PID <PID> /F`.

### 5. Ingin Mengulang Setup Akun Toko dari Awal (Reset Database Bersih)
Jika Anda ingin mengosongkan seluruh database lokal untuk memulai konfigurasi toko baru:
- Tutup aplikasi WariPOS.
- Hapus berkas `sistem_pos.db` dan `sistem_pos.db-wal` di folder root proyek (atau di folder AppData perangkat jika menggunakan versi installer).
- Jalankan kembali aplikasi; sistem akan otomatis memandu Anda ke formulir Setup Pemilik Toko baru.

---

## 7. Standar Keamanan & Perlindungan Data

- **Offline-First & Kedaulatan Data**: Basis data transaksi tersimpan sepenuhnya secara lokal di SQLite perangkat Anda. Tidak ada data penjualan yang dikirim keluar tanpa konfigurasi eksplisit pemilik toko.
- **Isolasi Proses Antarmuka (Context Isolation)**: Seluruh komunikasi antara antarmuka React dan sistem operasi dibatasi melalui IPC Whitelist yang diverifikasi ketat pada berkas preload Electron.
- **Keamanan Akun & Otorisasi Bertingkat**: Kata sandi dienkripsi dengan algoritma hash aman. Izin akses menu dibatasi berdasarkan peran (Owner, Admin, Supervisor, Kasir).
- **Proteksi Fitur Pengembang**: Menu teknis dan fitur eksperimental dinonaktifkan secara otomatis pada rilis produksi untuk mencegah akses tidak sah.

---

## 8. Lisensi & Pengembang

Proyek ini dirilis di bawah lisensi terbuka **MIT License**. Anda bebas menggunakan, memodifikasi, dan mendistribusikan aplikasi ini untuk kebutuhan usaha retail dan komersial Anda.

Pengembang: **WalZetass-Kar**  
- Profil GitHub: https://github.com/WalZetass-kar  
- Repositori Kode: https://github.com/WalZetass-kar/WariPOS  
- Rilis Resmi: https://github.com/WalZetass-kar/WariPOS/releases  

Hak Cipta (c) 2026 WalZetass-Kar. Hak cipta dilindungi undang-undang.
