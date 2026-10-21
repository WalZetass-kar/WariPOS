# packages/

Folder ini menyimpan tiga paket terpisah:

- `shared-lib` pustaka bersama untuk aplikasi Zetass Pos
- `zetass-pos-developer-panel` aplikasi panel developer mandiri
- `zetass-pos-user-panel` aplikasi POS untuk pengguna

Status: **arsip, tidak dibangun dari repositori ini.**

Aplikasi utama WariPOS ada di root repositori, pada folder `src/`. Kode di
folder ini tidak diimpor oleh aplikasi utama, tidak ikut build, tidak ikut
rilis, dan tidak ikut pengujian. Versinya masih 2.0.0 sementara aplikasi utama
sudah 1.0.3 dengan basis kode yang berbeda.

Konsekuensinya:

- `pnpm-workspace.yaml` tidak memuat `packages/*`, jadi satu lockfile di root
  cukup untuk membangun aplikasi utama.
- Perubahan di folder ini tidak memengaruhi rilis WariPOS. Kalau paket ini
  masih dipakai di proyek lain, pindahkan ke repositori terpisah supaya
  riwayatnya jelas.
