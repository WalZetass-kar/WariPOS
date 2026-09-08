# Wari POS

> **Aplikasi Point of Sale Multi-Platform (Desktop, Mobile Android, & Web Online)** yang dibangun dengan Electron, React, Capacitor, dan Supabase Cloud.

**Developer:** [WalZetass-Kar](https://github.com/WalZetass-kar)  
**Platform:** Windows · Linux · macOS · Android · Web Browser  
**Versi:** 2.1.0

---

## Screenshot

| Login | Dashboard | POS / Kasir |
|-------|-----------|-------------|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) | ![POS](docs/screenshots/pos.png) |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18, TypeScript, TailwindCSS |
| Desktop | Electron 31, Vite 5 |
| Mobile | Capacitor 8 (Android & iOS) |
| Web / Cloud | Supabase Edge Functions & PostgreSQL |
| Database Lokal | SQLite (better-sqlite3), Drizzle ORM |
| Build & Deploy | Vite, electron-builder, Gradle, Supabase CLI |

---

## Opsi Instalasi Aplikasi

Anda dapat menggunakan aplikasi ini dengan **dua cara**:
1. **Opsi 1: Menggunakan Installer Siap Pakai (Tanpa Coding / Tanpa Node.js)** — Cocok untuk pemilik toko / kasir.
2. **Opsi 2: Menjalankan dari Source Code (Mode Developer)** — Cocok untuk programmer / kustomisasi fitur.

---

## Opsi 1: Menggunakan Installer Siap Pakai

Jika Anda hanya ingin langsung memakai aplikasi di toko tanpa perlu instal Node.js/tools developer:

* **Windows:** Unduh dan jalankan file installer `.exe` di folder `release/Zetass Pos-2.1.0-x64.exe`.
* **Linux:** Instal file `.deb` dengan perintah `sudo dpkg -i release/zetass-pos_2.1.0_amd64.deb` atau jalankan file `.AppImage`.
* **Android:** Unduh dan pasang file `release/ZetassPOS.apk` di HP atau tablet Android Anda.

---

## Opsi 2: Menjalankan dari Source Code (Desktop Electron)

Panduan berikut diperuntukkan bagi pengguna baru atau developer yang ingin menjalankan aplikasi dari kode sumber.

### 1. Instalasi Software yang Diperlukan di Laptop

Sebelum menjalankan kode, pastikan software berikut sudah terpasang di laptop Anda:

#### A. Instal Node.js & npm
1. Kunjungi situs resmi Node.js: **[https://nodejs.org](https://nodejs.org/)**
2. Unduh versi **LTS (Disarankan Node.js v20 atau v22)**.
3. Jalankan file installer:
   * **Pengguna Windows:** Saat proses instalasi, centang opsi *"Automatically install the necessary tools"* (agar Python dan C++ Build Tools terpasang otomatis untuk modul database SQLite).
   * **Pengguna Linux (Ubuntu/Debian):**
     ```bash
     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
     sudo apt-get install -y nodejs build-essential
     ```
4. Verifikasi instalasi di Terminal / CMD:
   ```bash
   node --version
   npm --version
   ```

#### B. Instal Git
1. Unduh Git dari **[https://git-scm.com](https://git-scm.com/)**.
2. Instal dengan pengaturan default hingga selesai.
3. Cek versi:
   ```bash
   git --version
   ```

#### C. Instal pnpm (Package Manager Cepat)
Buka Terminal / Command Prompt lalu jalankan:
```bash
npm install -g pnpm
```

---

### 2. Langkah Menjalankan Aplikasi Desktop

Setelah semua software di atas terinstal:

#### Langkah 1: Clone Repository
```bash
git clone https://github.com/WalZetass-kar/WariPOS.git
cd WariPOS
```

#### Langkah 2: Instal Dependencies Proyek
```bash
pnpm install
```
*(Atau gunakan `npm install` jika tidak menggunakan pnpm)*

#### Langkah 3: Jalankan Aplikasi
```bash
npm run dev
```

Jendela aplikasi Desktop Electron akan terbuka secara otomatis.

> **Catatan Penggunaan Pertama Kali:**
> Saat pertama kali dijalankan, sistem akan membuka halaman **Setup Akun Admin**. Masukkan nama pengguna dan kata sandi untuk membuat akun toko pertama Anda.

##  Cara Menjalankan — Android

Ada **3 cara** untuk menjalankan di Android:

---

### Cara 1: Android Studio + Emulator (Tanpa HP Fisik)

#### Langkah 1 — Buat Emulator di Android Studio
1. Buka **Android Studio**
2. Klik **Device Manager** (ikon HP di toolbar kanan)
3. Klik **Create Device**
4. Pilih device: **Pixel 7** atau **Galaxy Nexus**
5. Pilih System Image: **API 33 (Android 13)** atau lebih tinggi — unduh jika belum ada
6. Klik **Finish** → emulator siap

#### Langkah 2 — Build & Sync ke Android
```bash
# Build web frontend dulu
npm run build:vite

# Sync hasil build ke folder android/
npm run android:sync
```

#### Langkah 3 — Buka di Android Studio
```bash
npm run android:open
```
> Android Studio akan terbuka secara otomatis mengarah ke folder `android/`

#### Langkah 4 — Jalankan dari Android Studio
1. Tunggu proses **Gradle Sync** selesai (lihat indikator progress di bagian bawah)
2. Pilih **emulator** dari dropdown device di toolbar atas
3. Klik tombol  **Run 'app'**
4. Tunggu proses build & install (~1–3 menit pertama kali)

---

### Cara 2: HP Fisik via USB (Paling Cepat & Direkomendasikan)

#### Langkah 1 — Aktifkan Developer Mode di HP Android
1. Buka **Pengaturan** → **Tentang Ponsel**
2. Ketuk **Nomor Build** sebanyak **7 kali** hingga muncul notif "Anda sekarang adalah developer"
3. Kembali ke **Pengaturan** → **Opsi Pengembang**
4. Aktifkan **USB Debugging** 

#### Langkah 2 — Sambungkan HP ke Laptop
1. Hubungkan HP dengan kabel USB ke laptop
2. Di HP, pilih **"Transfer File"** (MTP) saat muncul dialog USB
3. Di HP, ketuk **"Izinkan"** saat muncul dialog **USB Debugging**
4. Verifikasi HP terdeteksi:
   ```bash
   adb devices
   ```
   Harus muncul nomor serial HP.

#### Langkah 3 — Build & Jalankan
```bash
# Build web frontend
npm run build:vite

# Sync ke android
npm run android:sync

# Buka Android Studio
npm run android:open
```

Di Android Studio:
1. Tunggu Gradle sync selesai
2. Pilih **nama HP kamu** dari dropdown device (bukan emulator)
3. Klik  **Run** → aplikasi akan terinstal langsung di HP

---

### Cara 3: Live Dev Mode (Hot Reload)

Mode ini cocok untuk development — perubahan kode langsung terlihat di HP tanpa perlu build ulang.

#### Terminal 1 — Jalankan Dev Server
```bash
npm run dev:mobile
```
> Server berjalan di `http://localhost:5173`

#### Terminal 2 — Buka Android Studio
```bash
npm run android:open
```

---

##  Preview di Browser (Mobile View)

Cara termudah dan tercepat untuk melihat tampilan mobile tanpa HP/emulator:

```bash
npm run dev:mobile
```

Lalu buka browser → tekan **F12** → klik ikon ** Toggle Device Toolbar** → pilih perangkat seperti `Pixel 7`, `Galaxy S20`, dll.

---

##  Build untuk Distribusi

### Build Windows (.exe Installer)
```bash
npm run build:desktop:windows
```
Output: `release/Zetass Pos-2.0.1-x64.exe`

### Build Linux (.deb / .AppImage)
```bash
npm run build:desktop:linux
```
Output: `release/zetass-pos_2.0.1_amd64.deb`

### Build Android Debug APK
```bash
npm run android:debug
```
Output: `release/ZetassPOS-debug.apk`

### Build Android Release APK
```bash
npm run android:release
```
Output: `release/ZetassPOS.apk`

---

##  Login Pertama Kali

Saat database **kosong / baru**, aplikasi akan menampilkan halaman **Setup Akun**.

Isi form berikut:
- **Username:** bebas (misal: `admin`)
- **Nama Lengkap:** nama Anda
- **Email:** opsional
- **Password:** minimal 8 karakter

Setelah setup, gunakan username & password tersebut untuk login.

---

##  Struktur Proyek

```
WariPOS/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   ├── renderer/          # React frontend (UI)
│   │   ├── pages/         # Halaman-halaman aplikasi
│   │   ├── components/    # Komponen reusable
│   │   ├── contexts/      # React Context (Auth, Theme, dll)
│   │   └── utils/         # Utilities & API wrapper
│   ├── backend/           # Business logic & controllers
│   └── database/          # Schema & koneksi SQLite
├── android/               # Capacitor Android project
├── ios/                   # Capacitor iOS project
├── scripts/               # Build & utility scripts
├── tests/                 # Unit tests (Vitest)
├── .github/workflows/     # CI/CD GitHub Actions
├── capacitor.config.ts    # Konfigurasi Capacitor
├── vite.config.ts         # Konfigurasi Vite
└── package.json
```

---

##  Daftar Script

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Jalankan aplikasi Desktop (Electron) |
| `npm run dev:mobile` | Jalankan dev server untuk Mobile |
| `npm run android:open` | Buka project Android di Android Studio |
| `npm run android:sync` | Sync web build ke Android |
| `npm run android:debug` | Build APK debug |
| `npm run android:release` | Build APK release |
| `npm run build:desktop:windows` | Build installer Windows |
| `npm run build:desktop:linux` | Build installer Linux |
| `npm run typecheck` | Cek TypeScript |
| `npm run test` | Jalankan unit tests |

---

##  Troubleshooting

### Error: `pnpm: command not found`
```bash
npm install -g pnpm
```

### Error: `Gradle sync failed` di Android Studio
- Pastikan JDK 17+ terinstal: `java --version`
- Di Android Studio: **File → Project Structure → SDK Location** → cek JDK path
- Klik **Sync Project with Gradle Files** di toolbar

### HP tidak terdeteksi di Android Studio
- Pastikan **USB Debugging** aktif di HP
- Coba cabut dan pasang ulang kabel USB
- Ganti mode USB ke **"Transfer File (MTP)"**
- Jalankan: `adb devices` untuk cek koneksi

### Error: `INSTALL_FAILED_OLDER_SDK`
- HP Android minimum **Android 8.0 (API 26)**

### Aplikasi tidak bisa login / database error
- Hapus file `sistem_pos.db` di root folder proyek
- Restart aplikasi → akan muncul Setup Akun baru

---

##  Keamanan

- File `.env` dan `.keys/` tidak di-commit ke Git
- Database SQLite tersimpan lokal di perangkat pengguna
- Semua IPC channel Electron divalidasi via whitelist di `preload.cjs`
- Context isolation aktif di Electron

---

##  Lisensi

MIT License © 2026 [WalZetass-Kar](https://github.com/WalZetass-kar)

---

##  Developer

**WalZetass-Kar**
- GitHub: [@WalZetass-kar](https://github.com/WalZetass-kar)
- Repository: [WariPOS](https://github.com/WalZetass-kar/WariPOS)
