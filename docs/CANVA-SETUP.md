# Panduan Integrasi Canva

Panduan ini untuk admin sekolah. **Laporan Pekanan dibuat sepenuhnya lewat Canva**: aplikasi
mengisi Brand Template milik sekolah secara otomatis (Autofill API), lalu mengekspornya
sebagai PDF. Tanpa Canva yang terhubung, Laporan Pekanan tidak bisa dibuat. Laporan
Periode (tengah semester/semester penuh) tetap memakai PDF bawaan dan tidak butuh Canva.

Proses ini melibatkan dua sisi: pengaturan di **dashboard Canva Developers** (di luar
aplikasi ini) dan pengaturan di **menu Pengaturan aplikasi**. Ikuti urutannya — banyak
langkah di sini yang gagal kalau dilakukan tidak berurutan atau di tempat yang salah.

> **Sudah pernah berjalan di komputer lokal, lalu macet setelah pindah ke VPS?**
> Langsung ke [Pindah ke VPS](#pindah-ke-vps--daftar-periksa).

## Yang perlu disiapkan sebelum mulai

1. **Akun Canva yang menjadi anggota Canva Team berbayar** (Canva for Teams/Education/
   Nonprofit yang punya fitur Brand Kit). Akun Canva pribadi/gratis **tidak bisa** dipakai
   — fitur Brand Template dan Data Field hanya ada di paket Team.
2. **Peran akun itu di Team harus "Brand Designer" atau "Admin"** — bukan sekadar
   "Member"/anggota biasa. Ini dicek oleh Canva di level akun, terpisah dari siapa yang
   membuat App Developer-nya. Kalau tidak yakin, cek lewat **Team Settings → People** di
   Canva, atau minta Admin Team mengatur ulang peran akun Anda.

   > Kalau nanti opsi "Data field" tidak pernah muncul di editor Canva walau semua langkah
   > sudah diikuti persis, ini penyebab yang paling sering — cek ulang poin ini dulu.

## Langkah 1 — Buat App di Canva Developers

1. Buka [canva.com/developers](https://www.canva.com/developers/apps) → **Create an app**.
2. Pilih jenis **"Outside Canva"** / **Connect API** (bukan "Inside Canva" — itu untuk
   aplikasi yang berjalan di dalam editor Canva, beda kegunaan).
3. Masuk ke menu **"Authentication"** di sidebar kiri (**bukan** menu "Webhook" — keduanya
   sekilas terlihat mirip tapi fungsinya beda total; Webhook untuk notifikasi event ke
   server publik dan menolak alamat localhost, sedangkan Authentication yang menyimpan
   Redirect URL untuk login).
4. Di bagian **"Authorized redirects"**, tambahkan alamat callback untuk **setiap tempat
   aplikasi dijalankan**. Canva menerima lebih dari satu alamat:
   ```
   https://tahfid.namasekolah.sch.id/administrasi/pengaturan/canva/callback   ← server/VPS
   http://127.0.0.1:3000/administrasi/pengaturan/canva/callback              ← komputer lokal (opsional)
   ```
   Alamat ini **harus sama persis** (termasuk `http://` vs `https://`, nomor port, dan tanpa
   garis miring di akhir) dengan Redirect URI yang dipakai aplikasi. Bedanya satu karakter
   saja, Canva menolak dengan pesan "Redirect URI mismatch" atau serupa.

   > Canva tidak menerima `localhost` untuk redirect lokal — pakai `127.0.0.1`.
5. Masuk ke menu **"Scopes"**, aktifkan enam scope berikut:
   - `design:content:read`
   - `design:content:write`
   - `design:meta:read`
   - `asset:read`
   - `asset:write`
   - `brandtemplate:content:read`
6. Catat **Client ID** dan **Client Secret** yang tertera di halaman App — akan dipakai di
   langkah berikutnya.

## Langkah 2 — Isi `.env` aplikasi

**Di server/VPS** (cukup `APP_URL`, Redirect URI diturunkan otomatis darinya):

```env
APP_URL=https://tahfid.namasekolah.sch.id
CANVA_CLIENT_ID=<client id dari langkah 1>
CANVA_CLIENT_SECRET=<client secret dari langkah 1>
# CANVA_REDIRECT_URI tidak perlu diisi — otomatis:
# https://tahfid.namasekolah.sch.id/administrasi/pengaturan/canva/callback
```

**Di komputer lokal** (`APP_URL` biasanya `localhost`, yang ditolak Canva, jadi Redirect URI
diisi manual):

```env
CANVA_CLIENT_ID=<client id>
CANVA_CLIENT_SECRET=<client secret>
CANVA_REDIRECT_URI=http://127.0.0.1:3000/administrasi/pengaturan/canva/callback
```

Restart aplikasi supaya `.env` yang baru terbaca — Bun hanya memuat `.env` sekali saat
aplikasi mulai berjalan (`pm2 restart ngaji --update-env` di server, atau hentikan lalu
jalankan lagi `bun run dev` di lokal).

Setelah restart, buka **Administrasi → Pengaturan → Integrasi Canva**. Panel
**Pemeriksaan Konfigurasi Server** di bagian atas menampilkan apakah Client ID/Secret sudah
terbaca dan Redirect URI mana yang benar-benar dipakai. Kalau alamatnya tidak cocok dengan
domain yang sedang Anda buka, akan muncul peringatan merah.

## Langkah 3 — Desain & publish Brand Template

1. Buat desain laporan di Canva seperti biasa (ukuran, warna, tata letak bebas sesuai
   selera sekolah). Logo, nama sekolah, dan kontak cukup ditulis langsung di desain.
2. Setelah desainnya siap, publish jadi Brand Template: **File → Save as Brand Template**
   (atau **Share → More → Brand Template** tergantung versi Canva Anda), pilih folder, lalu
   **Publish**.

   Desain biasa yang **belum** dipublish sebagai Brand Template tidak akan pernah
   menampilkan opsi pemberian data field, walau role akun sudah benar.

## Langkah 4 — Beri nama field data lewat "Buat banyak" (Bulk Create)

Ini bagian yang paling sering salah arah, jadi diperhatikan baik-baik urutannya.

1. Buka **kembali** Brand Template itu lewat **Brand Kit → Brand Templates** di Canva
   (bukan dari "desain terakhir dibuka") → klik **Edit yang asli**.
2. Di sidebar kiri, klik **"Buat banyak"** (Bulk Create).
3. Klik **"Masukkan data secara manual"**.
4. Akan muncul tabel dengan kolom. **Satu kolom = satu field data** — buat enam kolom
   persis dengan nama berikut (klik header kolom untuk mengganti namanya, atau klik
   "Tambahkan teks"/"Tambahkan gambar" untuk kolom baru):

   | Nama kolom | Jenis | Dipakai untuk baris di desain |
   |---|---|---|
   | `nama` | Teks | Nama siswa |
   | `pekan` | Teks | Nomor pekan berjalan (`-` bila tanggal mulai semester belum diatur) |
   | `ayat` | Teks | Tambahan hafalan 7 hari terakhir, mis. `12 ayat.` |
   | `ayat_sebelum` | Teks | Total hafalan sebelum tambahan pekan ini |
   | `ayat_total` | Teks | Total hafalan keseluruhan setelah tambahan pekan ini |
   | `foto` | Gambar | Foto siswa (dilewati bila siswa belum punya foto) |

   **Nama kolom harus persis sama** (huruf kecil semua, pakai garis bawah, tanpa spasi) —
   ini yang dicocokkan langsung dengan kode aplikasi (`src/lib/canva.ts`). Kalau typo, field
   itu tidak akan pernah terisi otomatis.
5. Isi baris pertama dengan **contoh nilai bebas** (nama sembarang, angka sembarang, satu
   foto contoh) — nilai ini cuma dipakai Canva untuk pratinjau, aplikasi akan mengirim nilai
   asli lewat API nanti, bukan nilai contoh ini.
6. **Sambungkan tiap kolom ke elemen di kanvas** — tanpa langkah ini, kolom hanya
   "terdaftar" tapi tidak terhubung ke tampilan mana pun:
   - **Cara termudah:** klik-tahan nama kolom di panel data, lalu **drag** ke elemen
     tujuan di kanvas.
   - **Cara alternatif:** klik kanan elemen di kanvas → pilih **"Connect data"** → pilih
     kolom yang sesuai dari daftar.
   - Ulangi untuk keenam elemen (nama, pekan, ayat, ayat_sebelum, ayat_total, foto).
7. Cek satu per satu: elemen yang **belum tersambung** akan tetap menampilkan teks
   placeholder aslinya (mis. tanda `-` atau `Lorem ipsum`) walau datanya sudah dikirim dari
   aplikasi — kalau ada baris laporan yang selalu kosong/salah, ini penyebabnya, bukan bug
   di kode aplikasi.

## Langkah 5 — Ambil Brand Template ID

1. Buka **Brand Kit → Brand Templates**, klik Brand Template yang sudah dibuat.
2. Lihat URL-nya — ambil ID yang **berawalan `EA...`**.

   > **Jangan** memakai ID dari URL saat mengedit desain biasa (berawalan `DA...`) — itu ID
   > desain, bukan ID Brand Template, dan akan ditolak API dengan galat `not_found`.

## Langkah 6 — Hubungkan akun di aplikasi

1. Masuk sebagai admin **lewat alamat yang sama dengan Redirect URI** (di VPS: buka
   `https://domain-anda/...`, bukan alamat IP server), lalu buka **Administrasi → Pengaturan
   → Integrasi Canva**.
2. Pastikan panel **Pemeriksaan Konfigurasi Server** hijau semua.
3. Klik **"Hubungkan Akun Canva"** → login/pilih akun Canva yang **rolenya Brand Designer/
   Admin** di Team yang sama dengan Brand Template tadi → setujui izin yang diminta.
4. Setelah kembali dan status berubah jadi "Terhubung", isi kolom **ID Brand Template**
   dengan ID dari Langkah 5, klik **Simpan**.

## Langkah 7 — Uji coba

1. Buka **Input › Hafalan Qur'an**, pilih kelas, buka satu siswa, lalu klik
   **"Buat Laporan Pekanan (Canva)"**.
2. Anda dibawa ke **Input › Antrean Laporan**. Halaman ini memperbarui diri sendiri tiap
   5 detik. Satu laporan biasanya selesai dalam 15–60 detik, lalu tombol **Unduh PDF**
   muncul.
3. Kalau berhasil, coba **"Buat Laporan Pekanan Sekelas (Canva)"**. Hasilnya satu ZIP.

### Cara kerja antrean (FIFO)

- Setiap tombol hanya **memasukkan permintaan ke antrean** yang tersimpan di basis data.
  Satu pekerja di server memproses **satu siswa demi satu**, urut permintaan yang masuk
  lebih dulu, untuk semua guru sekaligus. Permintaan guru B menunggu sampai permintaan guru A
  yang masuk lebih dulu selesai.
- **Halaman boleh ditutup.** Prosesnya berjalan di server, bukan di peramban. Kalau server
  restart di tengah jalan, siswa yang sedang diproses dimasukkan lagi ke antrean.
- Jeda antar siswa sekitar 5 detik, mengikuti batas Canva: **75 ekspor per 5 menit** dan
  **500 ekspor per hari** per akun Canva. Kelas 30 siswa kira-kira selesai dalam 5–15 menit.
  Seluruh sekolah (±340 siswa) masih di bawah batas harian, tapi sebaiknya dicicil per kelas.
- Siswa yang gagal karena galat sesaat (jaringan, Canva sibuk) dicoba ulang otomatis
  hingga 3 kali. Yang tetap gagal tercantum di halaman antrean (dan di `RINGKASAN.txt` dalam
  ZIP), dan bisa diulang lewat tombol **Ulangi yang gagal**.
- Kalau koneksi Canva terputus, antrean **berhenti sementara** (siswa tidak ditandai gagal)
  dan otomatis lanjut setelah admin menghubungkan ulang.
- Kelas/siswa yang sudah ada di antrean tidak bisa dimasukkan dua kali.
- Hasil disimpan di `data/reports/` selama 7 hari, lalu dihapus otomatis.
- Setiap laporan membuat satu desain baru di akun Canva yang terhubung. Sesekali rapikan
  folder **Projects** di Canva bila terasa penuh.

## Pindah ke VPS — daftar periksa

Gejala khas: semuanya lancar di komputer lokal, tetapi di VPS tombol "Hubungkan" berakhir
di halaman galat, kembali ke `127.0.0.1`, atau koneksi Canva tiba-tiba putus sendiri.
Periksa berurutan:

1. **`.env` di VPS.** Berkas `.env` tidak ikut git, jadi harus dibuat sendiri di server:
   ```sh
   cd ~/apps/tahfidbn       # folder aplikasi di VPS
   nano .env
   ```
   Isi `APP_URL=https://domain-anda`, `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`. **Hapus**
   baris `CANVA_REDIRECT_URI` kalau masih berisi `127.0.0.1` hasil salin dari lokal.
   Lalu `pm2 restart ngaji --update-env`.
2. **Authorized redirects di Canva.** Tambahkan
   `https://domain-anda/administrasi/pengaturan/canva/callback` (Langkah 1 nomor 4). Alamat
   lokal boleh tetap ada.
3. **Buka aplikasi lewat domain https**, bukan IP server. Cookie login dan cookie OAuth
   hanya berlaku di alamat tempat Anda membukanya. Kalau Anda membuka lewat IP tetapi
   Canva mengembalikan ke domain, prosesnya gagal dengan pesan "koneksi ke Canva gagal
   atau kedaluwarsa".
4. **Hubungkan ulang di VPS.** Buka **Pengaturan → Integrasi Canva**, klik **Putuskan
   Koneksi** (bila tampil "Terhubung"), lalu **Hubungkan Akun Canva** lagi. ID Brand Template
   tidak hilang.

   Ini wajib bila basis data VPS dulu disalin dari komputer lokal. Token Canva ikut tersalin,
   dan **refresh token Canva hanya bisa dipakai sekali**. Begitu laptop dan VPS sama-sama
   memakainya, Canva mencabut koneksinya ("Refresh token used twice" / "Token lineage has
   been revoked").
5. **Jangan memakai Canva dari salinan basis data produksi.** Bila Anda menyalin `ngaji.db`
   dari VPS ke laptop untuk diuji, klik **Putuskan Koneksi** di laptop *sebelum* membuat
   laporan, atau jalankan:
   ```sh
   bun -e "import {Database} from 'bun:sqlite'; new Database('data/ngaji.db').exec(\"DELETE FROM settings WHERE key IN ('canva_access_token','canva_refresh_token','canva_token_expires_at')\")"
   ```
   Kalau tidak, laptop bisa "membakar" token dan VPS ikut terputus.
6. **Cek log** bila masih gagal: `pm2 logs ngaji --lines 100`. Baris berawalan
   `[antrean-laporan]` menjelaskan kenapa antrean berhenti atau siswa gagal.

## Masalah yang sering ditemui

| Gejala | Penyebab | Solusi |
|---|---|---|
| "tahfid-bn belum mengonfigurasi URI pengalihan" | Redirect URL diisi di halaman/App yang salah, atau belum diisi sama sekali | Cek App yang benar di canva.com/developers, isi di menu **Authentication** (bukan Webhook) |
| Setelah login Canva, peramban membuka `127.0.0.1` dan gagal | `CANVA_REDIRECT_URI` di `.env` VPS masih alamat lokal | Hapus baris itu dan pastikan `APP_URL` berisi domain https, lalu restart. Panel Pemeriksaan Konfigurasi akan menandainya merah |
| "Redirect URI mismatch" | Alamat di `.env` dan di Canva tidak sama persis (http/https, garis miring di akhir, www) | Samakan persis dengan yang tampil di panel Pemeriksaan Konfigurasi |
| "Proses koneksi ke Canva gagal atau kedaluwarsa" | Aplikasi dibuka lewat alamat berbeda dari Redirect URI (mis. IP vs domain), atau lebih dari 10 menit di halaman login Canva | Buka aplikasi lewat domain yang sama dengan Redirect URI, lalu ulangi |
| Galat "The URL cannot be any form of localhost" | Redirect URL diisi di kolom **Webhook** (Notifications endpoint), bukan Authentication | Pindah ke menu Authentication → Authorized redirects |
| `not_found`, "Brand template with id '...' not found" | ID yang dipakai adalah ID desain (`DA...`), bukan ID Brand Template (`EA...`) | Ambil ID dari halaman Brand Kit → Brand Templates, bukan dari URL edit desain |
| Opsi "Data field"/"Connect data" tidak pernah muncul di elemen mana pun | Role akun Canva bukan Brand Designer/Admin di Team tsb, atau desainnya belum dipublish sebagai Brand Template | Minta Admin Team menaikkan role akun (Team Settings → People), dan pastikan Langkah 3 (publish Brand Template) sudah dilakukan |
| Satu baris di laporan selalu menampilkan `-` atau teks placeholder | Elemen itu belum disambungkan ("Connect data") ke kolom data-nya | Buka lagi Bulk Create, drag/connect kolom yang benar ke elemen tsb |
| Status Canva tiba-tiba "belum terhubung" dan antrean berhenti | Refresh token ditolak Canva — biasanya karena token dipakai dari dua tempat (laptop & VPS) | Lihat [Pindah ke VPS](#pindah-ke-vps--daftar-periksa) nomor 4–5, lalu hubungkan ulang. Antrean lanjut sendiri |
| "The socket connection was closed unexpectedly" | Galat jaringan sesaat ke server Canva | Dicoba ulang otomatis. Kalau tetap gagal, klik **Ulangi yang gagal** |
| Antrean lama sekali | Normal — satu siswa per ±5–30 detik supaya tidak melanggar batas Canva | Halaman boleh ditutup; buka lagi Input › Antrean Laporan nanti |
