# Tahfiz Community

Aplikasi pencatatan dan pemeringkatan hafalan Al-Qur'an (Tahfid) untuk sekolah/TPQ.
Dibangun dengan [Bun](https://bun.sh), [Hono](https://hono.dev),
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
- [Laporan Pekanan (via Canva)](#laporan-pekanan-via-canva)
- [Laporan Periode (PDF bawaan)](#laporan-periode-pdf-bawaan)
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
- **Laporan Periode** — rekap capaian hafalan tengah semester dan semester penuh, berdasarkan
  tanggal semester yang diatur admin, dengan cetak PDF per siswa
- **Input Hafalan Qur'an** — guru mencatat posisi hafalan tiap siswa di kelas yang ia ampu,
  dengan riwayat lengkap tersimpan
- **Laporan Pekanan via Canva** — desain Brand Template Canva milik sekolah diisi otomatis
  (nama, foto, capaian pekan berjalan) lewat Autofill API, per siswa atau sekelas (ZIP),
  diproses lewat antrean FIFO di server; lihat [panduan lengkap](docs/CANVA-SETUP.md)
- **Al-Qur'an digital** — teks lengkap 114 surah dengan penanda baca terakhir per pengguna
- **Administrasi** — kelola kelas, siswa (termasuk impor massal dari Excel dan unggah foto
  massal dari ZIP), dan akun guru/admin beserta kelas ampuannya
- **Backup & pemulihan** — cadangkan dan pulihkan seluruh basis data langsung dari menu
  Pengaturan, termasuk cadangan otomatis sebelum migrasi struktur

## Siapa memakai apa

| Peran | Bisa melakukan |
|---|---|
| **Administrator** | Semua menu: mengelola kelas, siswa, akun pengguna, pengaturan aplikasi, serta menginput hafalan seluruh kelas |
| **Guru** | Melihat seluruh papan peringkat dan membaca Al-Qur'an, tetapi hanya bisa menginput hafalan pada kelas yang ia ampu |

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

Ada juga **aplikasi desktop client** dengan installer resmi (ikon Start Menu, satu jendela
aplikasi) untuk guru/admin yang ingin mengakses server dari komputer masing-masing tanpa
membuka browser — mirip aplikasi Android/iPhone, cuma untuk Windows. Server tetap cuma satu
(dijalankan lewat `start-server.bat` di atas), aplikasi ini hanya klien yang menyambung ke
sana. Lihat **[docs/DESKTOP-APP.md](docs/DESKTOP-APP.md)**.

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
| `CANVA_CLIENT_ID` | Untuk Laporan Pekanan | Dari App di canva.com/developers — lihat [panduan Canva](docs/CANVA-SETUP.md) |
| `CANVA_CLIENT_SECRET` | Untuk Laporan Pekanan | idem |
| `CANVA_REDIRECT_URI` | Tidak | Bawaan `APP_URL` + `/administrasi/pengaturan/canva/callback`. Isi hanya di komputer lokal (`http://127.0.0.1:3000/...`, karena Canva menolak `localhost`). Harus persis sama dengan yang didaftarkan di Canva |

Bun memuat `.env` secara otomatis — tidak perlu paket `dotenv`.

## Langkah awal penggunaan

1. Masuk sebagai admin dengan akun dari `.env`, lalu ganti passwordnya lewat menu **Akun**
2. **Administrasi › Kelas** — buat kelas, misalnya `1A`, `6B`
3. **Administrasi › Pengguna** — buat akun guru, lalu centang kelas yang ia ampu
4. **Administrasi › Siswa** — tambahkan siswa. Untuk satu kelas penuh, tersedia tiga cara:
   satu per satu, tempel banyak nama sekaligus (`NIS,Nama` per baris), atau impor dari
   berkas Excel. Foto siswa bisa diunggah satu-satu atau massal lewat berkas ZIP
   (nama berkas foto di dalam ZIP harus berupa NIS siswa, mis. `2024001.jpg`)
5. **Administrasi › Pengaturan › Laporan & Semester** — isi **tanggal mulai dan selesai
   semester** (dasar nomor pekan dan Laporan Periode), serta logo, nama sekolah, dan kontak
   untuk PDF Laporan Periode
6. **Administrasi › Pengaturan › Integrasi Canva** — hubungkan Canva dan isi ID Brand
   Template supaya Laporan Pekanan bisa dibuat ([panduan](docs/CANVA-SETUP.md))
7. Guru masuk, membuka **Input › Hafalan Qur'an**, memilih kelas, lalu mencatat capaian
   tiap siswa secara berkala

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
- Versi sebelum penugasan guru menyimpan jenis → dicadangkan sebagai
  `data/ngaji.backup-pra-subjek-guru-<waktu>.db`, lalu setiap penugasan guru lama otomatis
  mendapat akses Tahfid, supaya tidak ada guru yang kehilangan akses
- Versi yang masih memuat fitur Tilawati → dicadangkan sebagai
  `data/ngaji.backup-pra-hapus-tilawati-<waktu>.db`, lalu tabel capaian dan riwayat Tilawati
  serta penugasan guru Tilawati dihapus. Bila cadangan gagal dibuat, penghapusan ditunda
  sampai start berikutnya. Data Tilawati lama hanya bisa diambil kembali dari cadangan ini

Migrasi tidak menyentuh data hafalan Tahfid, dan bersifat idempoten — aman dijalankan
berulang kali (mis. saat menyalakan ulang server).

## Laporan Pekanan (via Canva)

Laporan Pekanan dibuat **lewat Canva**: aplikasi mengisi Brand Template desain sekolah secara
otomatis (Autofill API), mengekspornya sebagai PDF, lalu menyimpannya untuk diunduh. Guru
menekan **Buat Laporan Pekanan (Canva)** per siswa atau **sekelas** di Input › Hafalan Qur'an.
Setiap permintaan masuk **antrean FIFO**: satu pekerja di server memproses satu siswa demi
satu, urut permintaan yang masuk lebih dulu, untuk semua guru sekaligus. Progres dan tombol
unduh (PDF untuk satu siswa, ZIP untuk sekelas) ada di **Input › Antrean Laporan**. Halaman
boleh ditutup selama proses berjalan, dan hasil disimpan 7 hari di `data/reports/`.

Jumlah ayat pada laporan dihitung dari tambahan hafalan **7 hari terakhir** siswa tersebut
(jendela bergulir saat laporan diproses, bukan batas kalender pekan tetap). Nomor pekan
diambil dari tanggal mulai semester di **Administrasi › Pengaturan › Laporan & Semester**.

Setup Canva melibatkan beberapa langkah di sisi Canva sendiri dan punya beberapa jebakan,
terutama saat dipindah ke VPS. **Ikuti panduan lengkap di
[docs/CANVA-SETUP.md](docs/CANVA-SETUP.md)**, termasuk daftar periksa khusus VPS.

## Laporan Periode (PDF bawaan)

Laporan Tengah Semester dan Laporan Semester tetap dibuat langsung oleh aplikasi dengan
`pdfkit`, tanpa Canva atau layanan luar. Rentang tanggalnya diambil dari tanggal mulai dan
selesai semester di **Administrasi › Pengaturan › Laporan & Semester**. Di halaman yang sama
admin mengisi logo (PNG/JPEG, maksimal 2MB), nama sekolah, dan kontak yang tampil di PDF ini,
dan bisa melihat pratinjaunya.

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

Fitur yang **butuh** internet: Laporan Pekanan (lewat Canva) dan pemuatan font ikon di atas.
Laporan Pekanan yang gagal karena internet mati tercatat di Antrean Laporan dan bisa diulang
lewat tombol **Ulangi yang gagal** setelah koneksi kembali. Fitur inti lainnya — input hafalan, papan peringkat, PDF
Laporan Periode, backup — berjalan penuh tanpa internet.

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
  routes/                 Rute Hono, dikelompokkan per area (progress, laporan, dll)
  views/                  Komponen JSX (hono/jsx) untuk seluruh tampilan
  data/                   Metadata statis Al-Qur'an
data/
  ngaji.db                Basis data (dibuat otomatis, tidak ikut repositori)
  photos/                 Foto siswa (tidak ikut repositori)
  quran/                  Teks Al-Qur'an per surah (ikut repositori, data publik)
docs/
  CANVA-SETUP.md          Panduan lengkap integrasi Canva
  DEPLOYMENT.md           Panduan penerapan di server produksi
  MOBILE-ANDROID.md       Panduan membangun & memasang APK Android
  MOBILE-IPHONE.md        Panduan memasang PWA di iPhone
  DESKTOP-APP.md          Panduan membangun aplikasi desktop Windows (Tauri)
scripts/
  seed-dummy-data.ts      Pengisi data contoh
  build-quran-data.ts     Pembangun metadata Al-Qur'an
mobile-android/           Proyek Capacitor terpisah untuk APK Android (lihat MOBILE-ANDROID.md)
desktop-app/              Proyek Tauri terpisah untuk aplikasi client desktop Windows (lihat DESKTOP-APP.md)
start-server.bat          Peluncur server untuk penanggung jawab Tahfid non-teknis (Windows)
```

## Lisensi & kredit

Dilisensikan di bawah [MIT License](LICENSE) — bebas dipakai, diubah, dan disebarluaskan
kembali oleh siapa pun, termasuk untuk keperluan komersial, selama notice hak cipta tetap
disertakan.

Dikembangkan oleh **Shandi Sutiawan** untuk sekolah dan TPQ yang membutuhkan.
