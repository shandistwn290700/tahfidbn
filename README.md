# Tahfiz Community

Aplikasi pencatatan dan pemeringkatan hafalan Al-Qur'an (Tahfid) serta capaian bacaan
Tilawati untuk sekolah/TPQ. Dibangun dengan [Bun](https://bun.sh), [Hono](https://hono.dev),
dan SQLite — ringan, tanpa basis data terpisah yang perlu dipasang, dan dirancang untuk tetap
berjalan penuh di jaringan lokal sekolah walau internet mati.

Proyek ini dibagikan sebagai amal jariyah — bebas dipakai, diubah, dan disebarluaskan
kembali oleh sekolah atau TPQ mana pun yang membutuhkan (lihat [LICENSE](LICENSE), MIT).

## Daftar Isi

- [Fitur](#fitur)
- [Siapa memakai apa](#siapa-memakai-apa)
- [Prasyarat](#prasyarat)
- [Instalasi cepat](#instalasi-cepat)
- [Untuk penanggung jawab Tahfid (non-teknis)](#untuk-penanggung-jawab-tahfid-non-teknis)
- [Variabel lingkungan](#variabel-lingkungan)
- [Langkah awal penggunaan](#langkah-awal-penggunaan)
- [Perintah](#perintah)
- [Basis data & migrasi](#basis-data--migrasi)
- [Laporan Pekanan (PDF bawaan)](#laporan-pekanan-pdf-bawaan)
- [Integrasi Canva (opsional)](#integrasi-canva-opsional)
- [Backup & pemulihan](#backup--pemulihan)
- [Berjalan tanpa internet](#berjalan-tanpa-internet)
- [Aplikasi mobile (Android & iPhone)](#aplikasi-mobile-android--iphone)
- [Penerapan di server produksi](#penerapan-di-server-produksi)
- [Keamanan](#keamanan)
- [Struktur proyek](#struktur-proyek)
- [Lisensi & kredit](#lisensi--kredit)

## Fitur

- **Papan Peringkat Tahfid** — capaian hafalan seluruh siswa, podium tiga besar, peringkat
  per kelas, tren pekanan
- **Papan Peringkat Tilawati** — peringkat berdasarkan jilid selesai dan jumlah halaman
  terbanyak (standar 6 jilid, 247 halaman)
- **Rekapitulasi** — rata-rata persentase capaian Tahfid dan Tilawati tiap siswa dalam satu
  papan gabungan
- **Laporan Periode** — rekap capaian tengah semester dan semester penuh, berdasarkan
  tanggal semester yang diatur admin, dengan cetak PDF per siswa
- **Input Hafalan Qur'an & Capaian Tilawati** — guru mencatat posisi hafalan/bacaan tiap
  siswa di kelas yang ia ampu, dengan riwayat lengkap tersimpan
- **Laporan Pekanan** — PDF otomatis per siswa (dan ZIP sekelas), berisi foto, nama, dan
  capaian pekan berjalan; dibuat langsung oleh aplikasi (`pdfkit`), tanpa layanan luar
- **Integrasi Canva (opsional)** — cetak Laporan Pekanan lewat desain Brand Template Canva
  sendiri, diisi otomatis lewat Autofill API; lihat [panduan lengkap](docs/CANVA-SETUP.md)
- **Al-Qur'an digital** — teks lengkap 114 surah dengan penanda baca terakhir per pengguna
- **Administrasi** — kelola kelas, siswa (termasuk impor massal dari Excel dan unggah foto
  massal dari ZIP), dan akun guru/admin dengan penugasan kelas terpisah per jenis
- **Backup & pemulihan** — cadangkan dan pulihkan seluruh basis data langsung dari menu
  Pengaturan, termasuk cadangan otomatis sebelum migrasi struktur

## Siapa memakai apa

| Peran | Bisa melakukan |
|---|---|
| **Administrator** | Semua menu: mengelola kelas, siswa, akun pengguna, pengaturan aplikasi, serta menginput Tahfid maupun Tilawati seluruh kelas |
| **Guru** | Melihat seluruh papan peringkat dan membaca Al-Qur'an, tetapi hanya bisa menginput data pada kelas dan **jenis** (Tahfid dan/atau Tilawati) yang ia ampu |

Satu guru bisa ditugaskan berbeda per jenis — misalnya hanya mengampu Tilawati di kelas 6A
tanpa hak input Tahfid — karena penugasan kelas disimpan terpisah untuk tiap jenis.

**Siswa tidak memiliki akun.** Data siswa dikelola administrator melalui menu Administrasi,
dan capaiannya dicatatkan oleh guru. Ini pembeda penting dari kebanyakan aplikasi sejenis:
tidak perlu membuatkan (dan mengingat) akun untuk setiap siswa.

## Prasyarat

- [Bun](https://bun.sh) versi terbaru (menggantikan Node.js, npm, dan express sekaligus)
- Sistem operasi Windows, Linux, atau macOS
- Tidak perlu memasang database terpisah (SQLite sudah termasuk dalam Bun)

## Instalasi cepat

Bila perintah `bun` tidak dikenali, Bun belum terpasang atau belum masuk PATH.
Pasang lewat PowerShell di Windows:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

di Linux atau macOS:

```sh
curl -fsSL https://bun.sh/install | bash
```

**Tutup lalu buka kembali jendela terminal** setelah pemasangan, agar PATH ikut terbarui.
Periksa dengan `bun --version`.

Selanjutnya:

```sh
bun install
cp .env.example .env     # lalu isi ADMIN_USERNAME dan ADMIN_PASSWORD
bun run dev
```

Berkas `public/app.css` sudah ikut disertakan di repositori, jadi aplikasi langsung bisa
dijalankan meski perkakas Tailwind belum terpasang. Bangun ulang hanya bila kode tampilan
(kelas Tailwind) diubah:

```sh
bun run build:css
```

Buka `http://localhost:3000` dan masuk dengan akun admin dari `.env`. Akun itu dibuat
otomatis pada saat aplikasi pertama kali dijalankan, selama belum ada pengguna sama sekali
di basis data. **Ganti passwordnya lewat menu Akun setelah berhasil masuk pertama kali.**

Untuk mencoba dengan data contoh (opsional, berguna untuk latihan sebelum memakai data
sekolah sungguhan):

```sh
bun run seed     # 3 kelas, 2 guru, 10 siswa; password guru contoh: password123
```

## Untuk penanggung jawab Tahfid (non-teknis)

Bila yang menjalankan aplikasi sehari-hari bukan orang teknis (tidak terbiasa mengetik
perintah `bun run dev`), gunakan **`start-server.bat`** yang sudah disediakan di folder
utama aplikasi — cukup **klik dua kali**, mirip cara menyalakan Dapodik:

1. Klik dua kali `start-server.bat`.
2. Saat pertama kali dijalankan, aplikasi akan meminta Anda mengisi `.env` (nama pengguna
   dan kata sandi admin) lewat Notepad yang terbuka otomatis — isi, simpan, tutup Notepad,
   lalu jalankan `start-server.bat` sekali lagi.
3. Server akan berjalan di **jendela terpisah** berjudul
   *"Tahfid Community - SERVER (JANGAN DITUTUP)"*, dan peramban akan otomatis terbuka ke
   halaman masuk.
4. **Jendela server itu harus dibiarkan menyala** selama aplikasi masih dipakai guru/admin
   — menutupnya sama dengan mematikan aplikasi untuk semua orang. Jendela peluncur yang
   pertama boleh ditutup kapan saja.

Untuk mematikan aplikasi, cukup tutup jendela server tadi, atau matikan komputernya.

Ini berjalan lewat batch file biasa, bukan pemasang (installer) yang membuatkan ikon di
Start Menu atau berjalan otomatis saat komputer menyala — kalau sekolah butuh itu (server
menyala otomatis setiap kali komputer dinyalakan tanpa perlu klik apa pun), lihat opsi
menjalankannya sebagai layanan Windows di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Variabel lingkungan

Salin `.env.example` menjadi `.env`, lalu sesuaikan:

| Variabel | Wajib? | Keterangan |
|---|---|---|
| `APP_NAME` | Tidak | Nama aplikasi, tampil di judul tab peramban (bisa diubah lagi lewat menu Pengaturan setelah berjalan) |
| `APP_URL` | Tidak | URL dasar aplikasi, informatif saja |
| `PORT` | Tidak | Port server, bawaan `3000` |
| `ADMIN_USERNAME` | **Ya** | Nama pengguna akun admin pertama — hanya dipakai sekali saat tabel `users` masih kosong |
| `ADMIN_PASSWORD` | **Ya** | Kata sandi akun admin pertama — minimal 8 karakter. **Ganti lewat menu Akun setelah masuk pertama kali**, jangan biarkan nilai bawaan `.env.example` terpakai |
| `DB_PATH` | Tidak | Menimpa lokasi berkas basis data (bawaan `data/ngaji.db`) — berguna untuk pengujian dengan salinan basis data terpisah tanpa mengganggu yang sedang berjalan |
| `CANVA_CLIENT_ID` | Tidak | Hanya bila memakai [integrasi Canva](docs/CANVA-SETUP.md) |
| `CANVA_CLIENT_SECRET` | Tidak | idem |
| `CANVA_REDIRECT_URI` | Tidak | idem — harus persis sama dengan yang didaftarkan di dashboard Canva Developers |

Bun memuat `.env` secara otomatis — tidak perlu paket `dotenv`.

## Langkah awal penggunaan

1. Masuk sebagai admin dengan akun dari `.env`, lalu ganti passwordnya lewat menu **Akun**
2. **Administrasi › Kelas** — buat kelas, misalnya `1A`, `6B`
3. **Administrasi › Pengguna** — buat akun guru, centang kelas yang ia ampu, terpisah untuk
   Tahfid dan untuk Tilawati (guru bisa dicentang salah satu, keduanya, atau kelas berbeda
   untuk tiap jenis)
4. **Administrasi › Siswa** — tambahkan siswa. Untuk satu kelas penuh, tersedia tiga cara:
   satu per satu, tempel banyak nama sekaligus (`NIS,Nama` per baris), atau impor dari
   berkas Excel. Foto siswa bisa diunggah satu-satu atau massal lewat berkas ZIP
   (nama berkas foto di dalam ZIP harus berupa NIS siswa, mis. `2024001.jpg`)
5. **Administrasi › Pengaturan › Laporan Pekanan** — isi logo, nama sekolah, kontak
   (website/WA/Instagram/TikTok), dan **tanggal mulai semester** (dasar penghitungan
   "Laporan Pekanan ke-N" dan Laporan Periode)
6. Guru masuk, membuka **Input › Hafalan Qur'an** atau **Input › Capaian Tilawati** sesuai
   penugasannya, memilih kelas, lalu mencatat capaian tiap siswa secara berkala

## Perintah

```sh
bun run dev              # server dengan hot reload, untuk pengembangan
bun run start            # server produksi (tanpa hot reload)
bun run build:css        # bangun ulang public/app.css setelah kode tampilan (Tailwind) berubah
bun run watch:css        # pantau perubahan kelas Tailwind otomatis selama menggarap tampilan
bun run build:quran-data # bangun ulang metadata Al-Qur'an dari paket quran-json (jarang dipakai)
bun run seed             # isi data contoh untuk latihan
bun test                 # jalankan seluruh test
```

## Basis data & migrasi

SQLite pada `data/ngaji.db`, mode WAL, dengan foreign key aktif. Seluruh tabel dibuat
otomatis saat aplikasi pertama kali dijalankan — tidak perlu perintah migrasi manual.

Bila aplikasi mendeteksi basis data berstruktur lama, migrasi berjalan otomatis dan cadangan
disimpan lebih dulu lewat `VACUUM INTO` (aman dipakai walau mode WAL aktif, berbeda dari
menyalin berkas mentah):

- Versi ketika hafalan masih menempel pada akun pengguna → dicadangkan sebagai
  `data/ngaji.backup-pra-siswa-<waktu>.db`, lalu setiap akun non-admin diubah menjadi data
  siswa beserta seluruh hafalannya, dan akun loginnya dilepas
- Versi sebelum penugasan guru dibedakan per jenis (Tahfid/Tilawati) → dicadangkan sebagai
  `data/ngaji.backup-pra-subjek-guru-<waktu>.db`, lalu setiap penugasan guru lama otomatis
  mendapat akses kedua jenis, supaya tidak ada guru yang kehilangan akses

Tidak ada data hafalan atau capaian Tilawati yang hilang akibat migrasi ini. Migrasi
bersifat idempoten — aman dijalankan berulang kali (mis. saat menyalakan ulang server).

## Laporan Pekanan (PDF bawaan)

Laporan pekanan (PDF per siswa, dan ZIP untuk sekelas) dibuat langsung oleh aplikasi dengan
`pdfkit` — **tidak melalui Canva atau layanan luar mana pun**, supaya tetap bisa dipakai
tanpa internet sama sekali. Ini jalur utama yang selalu tersedia; integrasi Canva di bawah
murni tambahan opsional untuk sekolah yang ingin tampilan laporan lebih dikustomisasi.

Sebelum dipakai, admin perlu mengisi **Administrasi › Pengaturan › Laporan Pekanan**: logo
(PNG/JPEG, maksimal 2MB), nama sekolah untuk laporan, kontak, dan tanggal mulai semester.
Jumlah ayat pada laporan dihitung dari tambahan hafalan **7 hari terakhir** siswa tersebut
(jendela bergulir dari saat laporan dibuat, bukan batas kalender pekan tetap).

Laporan Periode (tengah semester & semester penuh) memakai jalur PDF yang sama, dengan
rentang tanggal dari **Administrasi › Pengaturan › Laporan Pekanan** (tanggal mulai dan
selesai semester) — bukan jendela 7 hari.

## Integrasi Canva (opsional)

Sekolah yang ingin laporan pekanan tampil dengan desain Canva sendiri (bukan templat bawaan
`pdfkit`) bisa menghubungkan akun Canva lewat **Administrasi › Pengaturan › Integrasi
Canva**. Setelah tersambung dan Brand Template diatur, tombol **"Cetak via Canva"** (satu
siswa maupun sekelas) akan muncul di halaman Input › Hafalan Qur'an.

Proses setupnya melibatkan beberapa langkah di sisi Canva sendiri (bukan cuma di aplikasi
ini) dan punya beberapa jebakan yang tidak kentara — **ikuti panduan lengkap di
[docs/CANVA-SETUP.md](docs/CANVA-SETUP.md)**, termasuk daftar solusi untuk kesalahan yang
paling sering ditemui.

Fitur ini sepenuhnya opsional. Tanpa dikonfigurasi sama sekali, aplikasi berjalan normal
dan hanya menampilkan opsi cetak PDF bawaan.

## Backup & pemulihan

**Administrasi › Pengaturan › Cadangan & Pemulihan** menyediakan:

- **Unduh Cadangan Sekarang** — snapshot basis data (`VACUUM INTO`, aman dari korupsi mode
  WAL), tersimpan di server dan bisa diunduh kapan saja
- **Pulihkan dari Cadangan** — menimpa basis data yang berjalan dengan berkas cadangan yang
  diunggah; basis data yang sedang berjalan otomatis dicadangkan dulu sebelum ditimpa, dan
  berkas yang diunggah divalidasi dulu (format SQLite sah, tidak rusak, tabel inti ada)
  sebelum dipakai
- Daftar seluruh cadangan tersimpan (otomatis dari migrasi maupun manual), dengan opsi
  unduh atau hapus satu per satu

**Disarankan mencadangkan `data/ngaji.db` secara berkala di luar aplikasi juga** (mis. rsync
harian ke penyimpanan lain) — seluruh data sekolah ada di berkas ini.

## Berjalan tanpa internet

Tailwind dan SweetAlert2 dilayani dari server aplikasi sendiri (`public/`), bukan dari CDN,
sehingga tampilan dan dialog konfirmasi tetap utuh ketika internet sekolah mati. Hanya font
ikon (Material Symbols) yang masih diambil dari Google Fonts; bila tidak terjangkau, ikon
disembunyikan otomatis dan seluruh teks tetap terbaca (tidak muncul tulisan mentah seperti
`arrow_upward`).

Fitur yang **butuh** internet: integrasi Canva (opsional, lihat di atas) dan pemuatan font
ikon di atas. Semua fitur inti — input hafalan, papan peringkat, cetak laporan PDF, backup —
berjalan penuh tanpa internet.

## Aplikasi mobile (Android & iPhone)

Selain diakses lewat browser di komputer, aplikasi ini juga bisa dipasang di HP guru/admin,
dengan syarat **HP harus terhubung ke WiFi yang sama dengan server** — kalau tidak, muncul
peringatan "Silakan hubungkan ke WiFi server" alih-alih layar kosong/galat.

- **Android** — tersedia sebagai APK (aplikasi pembungkus native, folder
  `mobile-android/`). Lihat **[docs/MOBILE-ANDROID.md](docs/MOBILE-ANDROID.md)** untuk cara
  membangun dan memasangnya.
- **iPhone** — dipasang lewat Safari sebagai Progressive Web App (Add to Home Screen), tanpa
  App Store dan tanpa akun Apple Developer. Lihat
  **[docs/MOBILE-IPHONE.md](docs/MOBILE-IPHONE.md)**.

## Penerapan di server produksi

Panduan langkah demi langkah (Nginx + PM2, sertifikat HTTPS, pembaruan aplikasi) ada di
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. Contoh berkas `nginx.conf.example` dan
`ecosystem.config.cjs` sudah disediakan sebagai titik awal.

## Keamanan

- Password di-hash dengan bcrypt bawaan Bun (`Bun.password`)
- Sesi berlaku 7 hari, disimpan sebagai cookie `httpOnly` + `sameSite: Lax` (`secure` aktif
  otomatis saat `NODE_ENV=production`), dan otomatis dicabut saat password atau peran akun
  berubah
- Percobaan login dibatasi (throttling) untuk memperlambat penebakan password, termasuk
  mitigasi timing-attack untuk nama pengguna yang tidak terdaftar
- Akun admin terakhir tidak dapat dihapus maupun diturunkan perannya, supaya sekolah tidak
  pernah kehilangan akses admin sepenuhnya
- Setiap rute yang mengubah data (POST) memeriksa hak akses guru/kelas/jenis di sisi
  server — tombol yang disembunyikan di tampilan bukan satu-satunya lapisan keamanan
- Halaman galat (500) tidak menampilkan detail teknis ke pengguna, hanya dicatat di log
  server
- **Jangan pernah menyertakan berkas `.env` saat membagikan, mengarsipkan, atau meng-commit
  kode ini** — isinya memuat kredensial admin dan (bila dipakai) Canva. Berkas ini sudah
  masuk `.gitignore`, begitu juga seluruh berkas basis data (`data/*.db*`) dan foto siswa
  (`data/photos/`)

## Struktur proyek

Ringkasan berkas-berkas penting — lihat juga `CLAUDE.md` untuk catatan arsitektur lebih
rinci (ditulis untuk asisten pengembangan berbasis AI, tapi berguna juga untuk pengembang
manusia yang ingin memahami struktur kode dengan cepat).

```
src/
  index.tsx              Titik masuk aplikasi, menyiapkan basis data & seluruh rute
  db/                     Koneksi, skema, dan migrasi basis data
  lib/                    Logika inti: sesi, hak akses, perhitungan peringkat, laporan, dll
  routes/                 Rute Hono, dikelompokkan per area (progress, tilawati, laporan, dll)
  views/                  Komponen JSX (hono/jsx) untuk seluruh tampilan
  data/                   Metadata statis Al-Qur'an dan Tilawati
data/
  ngaji.db                Basis data (dibuat otomatis, tidak ikut repositori)
  photos/                 Foto siswa (tidak ikut repositori)
  quran/                  Teks Al-Qur'an per surah (ikut repositori, data publik)
docs/
  CANVA-SETUP.md          Panduan lengkap integrasi Canva
  DEPLOYMENT.md           Panduan penerapan di server produksi
  MOBILE-ANDROID.md       Panduan membangun & memasang APK Android
  MOBILE-IPHONE.md        Panduan memasang PWA di iPhone
scripts/
  seed-dummy-data.ts      Pengisi data contoh
  build-quran-data.ts     Pembangun metadata Al-Qur'an
mobile-android/           Proyek Capacitor terpisah untuk APK Android (lihat MOBILE-ANDROID.md)
start-server.bat          Peluncur server untuk penanggung jawab Tahfid non-teknis (Windows)
```

## Lisensi & kredit

Dilisensikan di bawah [MIT License](LICENSE) — bebas dipakai, diubah, dan disebarluaskan
kembali oleh siapa pun, termasuk untuk keperluan komersial, selama notice hak cipta tetap
disertakan.

Dikembangkan oleh **Shandi Sutiawan** untuk sekolah dan TPQ yang membutuhkan.
