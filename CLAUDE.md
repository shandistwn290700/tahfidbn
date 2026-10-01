# CLAUDE.md

Panduan untuk Claude Code (claude.ai/code) saat bekerja pada repositori ini.

## Perintah

```sh
bun run dev        # server dengan hot reload
bun run start      # server produksi
bun run build:css  # bangun ulang public/app.css — jalankan setiap kali kelas Tailwind berubah
bun run watch:css  # pantau perubahan kelas Tailwind selama menggarap tampilan
bun run seed       # isi data contoh (kelas, guru, siswa, hafalan)
bun test
```

Build CSS sengaja **tidak** digandeng ke `dev`/`start`: aplikasi harus tetap bisa dijalankan
walau perkakas Tailwind belum terpasang. `public/app.css` ikut disimpan di repositori, dan
`src/index.tsx` memberi peringatan bila berkas itu hilang.

## Konvensi Bun

- Pakai `bun <berkas>`, bukan `node` atau `ts-node`
- Pakai `bun:sqlite` (bukan `better-sqlite3`), `Bun.serve()` (bukan `express`)
- Bun memuat `.env` otomatis — tidak perlu `dotenv`
- Password di-hash dengan `Bun.password` (bcrypt bawaan)

## Variabel lingkungan

```
APP_NAME=Tahfiz Community
APP_URL=http://localhost:3000
PORT=3000
ADMIN_USERNAME=admin        # akun admin pertama, dibuat saat tabel users masih kosong
ADMIN_PASSWORD=...          # minimal 8 karakter
```

## Arsitektur

**Tumpukan:** Bun + Hono (JSX SSR) + SQLite (`bun:sqlite`) + TailwindCSS (dibuild ke berkas statis)

**Titik masuk:** `src/index.tsx` — menyiapkan basis data, menjalankan migrasi, memasang seluruh
rute, dan mengekspor `{ port, fetch }` untuk `Bun.serve()`.

### Model data — siswa bukan akun

Ini pembeda utama dari versi awal aplikasi. Yang bisa login hanya **admin** dan **guru**.
**Siswa adalah data**, dikelola admin, dan tidak memiliki akun.

| Tabel | Isi |
|---|---|
| `users` | akun yang bisa login; kolom `role` hanya `admin` atau `guru` |
| `classes` | daftar kelas (nama unik, keterangan opsional) |
| `students` | siswa, menunjuk ke satu `class_id` (boleh NULL = belum berkelas) |
| `class_teachers` | relasi guru ⇄ kelas ⇄ **jenis** (`subject`, kini hanya `tahfid`); menentukan hak input. Kunci `(class_id, user_id, subject)` — kolom jenis dipertahankan agar jenis baru bisa ditambah tanpa migrasi struktur |
| `progress_entries` | hafalan Tahfid per siswa per surah, di-upsert; kunci unik `(student_id, surah_number)` |
| `progress_log` | riwayat append-only Tahfid, menyimpan `recorded_by` (guru yang menginput) |
| `reading_bookmarks` | penanda baca Al-Qur'an, milik **pengguna** yang login, bukan siswa |

Fitur **Tilawati dan papan Rekapitulasi sudah dihapus** (Oktober 2026). Alamat lamanya
(`/leaderboard/tilawati`, `/leaderboard/rekap`, `/progress/tilawati`) hanya mengarahkan ulang
ke halaman Tahfid. Jangan menambahkan kembali rujukan ke tabel `tilawati_*` — tabel itu
dihapus oleh migrasi.

### Hak akses

- `authMiddleware` — wajib login, menaruh `User` di `c.get("user")`
- `adminMiddleware` — hanya admin; dipasang pada seluruh rute `/administrasi/*`
- `src/lib/access.ts` — `canTeachClass()` dan `canTeachStudent()` menentukan apakah seorang
  guru boleh menginput data, dengan parameter `subject: TeachingSubject` (kini hanya
  `"tahfid"`, juga default-nya). Admin selalu boleh. **Rute POST wajib memanggil
  pemeriksaan ini**, jangan bersandar pada tampilan yang menyembunyikan tombol. Penugasan
  kelas per guru diubah lewat `setTeacherClasses()` / `setClassTeachers()` — keduanya butuh
  argumen `subject` dan hanya menimpa baris milik jenis itu.

### Alur perhitungan hafalan

- `src/data/quran-meta.ts` — metadata statis Tahfid (114 surah, batas juz)
- `src/lib/progress-calc.ts` — perhitungan peringkat Tahfid. `getRankedStudents()` sengaja
  membaca **tiga query saja** (siswa, hafalan, tren) lalu menghitung di memori; jangan
  kembalikan pola satu query per siswa.
- `src/lib/period-report.ts` — Laporan Periode (tengah semester / semester penuh): ayat
  bertambah selama rentang tanggal, juz selesai, dan persentase Tahfid; pola query sama.
- Persentase memakai satu angka desimal. Dibulatkan ke bilangan bulat, capaian mayoritas
  santri akan tampil 0% dan papan peringkat kehilangan fungsinya.
- Peringkat Tahfid: juz selesai → jumlah ayat → nama.

### Migrasi

`src/db/migrate.ts` berjalan otomatis saat start, membuat cadangan basis data lebih dulu
lewat `VACUUM INTO` untuk setiap perubahan struktur. Migrasi bersifat idempoten. Yang
relevan:

- **Struktur lama** (`progress_entries.user_id`) — memindahkan setiap akun non-admin
  menjadi data siswa beserta hafalannya, dan melepas akun loginnya.
- **`class_teachers` tanpa kolom `subject`** — menambahkan kolom itu dan mengganti kunci
  primer menjadi `(class_id, user_id, subject)`. Setiap baris lama menjadi baris `tahfid`
  supaya guru yang sudah ditugaskan tidak kehilangan akses.
- **Sisa Tilawati** (`migrateRemoveTilawati`) — membuang tabel `tilawati_entries`,
  `tilawati_log`, dan baris `class_teachers` berjenis `tilawati`. Cadangan
  `ngaji.backup-pra-hapus-tilawati-*.db` wajib berhasil dibuat lebih dulu; kalau gagal,
  penghapusan ditunda ke start berikutnya.

### Berkas statis

Tailwind dan SweetAlert2 **dilayani dari `public/`**, bukan CDN — aplikasi dipakai di jaringan
lokal sekolah dan harus utuh saat internet mati. `public/app.css` adalah hasil build; jangan
disunting langsung, ubah `src/styles/input.css` atau `tailwind.config.js` lalu jalankan
`bun run build:css`.

Font ikon Material Symbols masih dari Google Fonts. Bila gagal dimuat, skrip di `Layout.tsx`
mengukur lebar ligatur dan menambahkan kelas `tanpa-ikon` pada `<html>` sehingga ikon
disembunyikan, bukan tampil sebagai tulisan mentah seperti "arrow_upward".

### Lapisan UX

`src/views/Layout.tsx` memuat tiga hal sekaligus:

1. **Loader perpindahan halaman** — muncul setelah 140 ms agar halaman cepat tidak berkedip
2. **Notifikasi SweetAlert2** — dibaca dari query `?success=` / `?error=`, lalu query
   dibersihkan dengan `history.replaceState` supaya tidak muncul lagi saat halaman disegarkan
3. **Dialog konfirmasi** — formulir dengan atribut `data-confirm` dicegat. Bila SweetAlert
   benar-benar tidak tersedia, jatuh ke `window.confirm`, **tidak pernah langsung mengirim**

Rute POST tidak merender halaman; semuanya redirect dengan pesan lewat `redirectWith()`
di `src/lib/http.ts`.

### Laporan

- **Laporan Pekanan hanya lewat Canva**, dan **selalu lewat antrean** `src/lib/report-queue.ts`.
  Jangan memanggil `generateWeeklyReportViaCanva()` langsung dari rute: request panjang
  diputus nginx (±60 dtk) dan service worker PWA (navigasi > 4 dtk), dan pemanggilan paralel
  melanggar batas Canva (ekspor 75 per 5 menit, 500 per hari per akun). Satu pekerja di
  proses server (`startReportWorker()` di `index.tsx`) memproses satu siswa per ≥5 detik,
  urut `report_jobs.id` lalu `position`. Aplikasi harus berjalan sebagai **satu proses**.
- Refresh token Canva **sekali pakai**. `getValidAccessToken()` membagi satu proses refresh
  ke semua pemanggil; jangan dihapus. Refresh yang ditolak (400/401) melepas token dan
  melempar `CanvaAuthError`, sehingga antrean berhenti tanpa menandai siswa gagal.
- Redirect URI OAuth: `CANVA_REDIRECT_URI`, atau diturunkan dari `APP_URL` bila kosong.
- **Laporan Periode** tetap PDF bawaan (`generateWeeklyReportPdf()` dengan `heading`/
  `periodLabel`); logo, nama sekolah, dan kontak di Pengaturan › Laporan & Semester hanya
  dipakai PDF ini.

## Lokasi berkas penting

| Keperluan | Berkas |
|---|---|
| Koneksi basis data | `src/db/connection.ts` |
| Skema | `src/db/schema.ts` |
| Migrasi struktur lama | `src/db/migrate.ts` |
| Sesi, hash password, akun | `src/lib/session.ts` |
| Hak akses guru/kelas | `src/lib/access.ts` |
| Perhitungan peringkat Tahfid | `src/lib/progress-calc.ts` |
| Laporan Periode (tengah semester / semester penuh) | `src/lib/period-report.ts`; PDF-nya `src/lib/weekly-report.ts` |
| Laporan Pekanan via Canva (OAuth, Autofill, ekspor) | `src/lib/canva.ts` |
| Antrean FIFO Laporan Pekanan & pekerjanya | `src/lib/report-queue.ts`, `src/routes/laporan.tsx` |
| Validasi masukan angka & redirect | `src/lib/http.ts` |
| Metadata Al-Qur'an | `src/data/quran-meta.ts` |
| Tipe bersama | `src/types.ts` |
| Tema Tailwind | `tailwind.config.js` |
| Komponen UI bersama | `src/views/components/ui.tsx` |

## Catatan JSX / TypeScript

- Berkas rute yang memakai JSX **wajib** berekstensi `.tsx`
- `tsconfig.json` memakai `"jsxImportSource": "hono/jsx"` — gunakan tipe `hono/jsx`
  (`FC`, `Child`), bukan React
- `db.prepare().get()` mengembalikan `unknown`; selalu beri cast eksplisit
- Kolom SQLite bertipe angka 0/1 (misalnya `completed`) **harus** dibungkus `Boolean()`
  sebelum dipakai sebagai kondisi JSX — `{entry.completed && <span/>}` akan mencetak `0`
- Parameter query angka dibaca lewat `readInt()`/`readOptionalInt()`, jangan `parseInt`
  langsung: `NaN` akan lolos sampai ke SQLite dan memicu galat 500
- Checkbox bernama sama dibaca dengan `c.req.parseBody({ all: true })`
