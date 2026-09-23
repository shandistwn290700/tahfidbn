# Panduan Integrasi Canva

Panduan ini untuk admin sekolah yang ingin laporan pekanan dicetak lewat desain Canva
sendiri, bukan templat PDF bawaan aplikasi. **Fitur ini sepenuhnya opsional** — tanpa
diatur sama sekali, aplikasi tetap berjalan normal dengan laporan PDF bawaan (`pdfkit`).

Proses ini melibatkan dua sisi: pengaturan di **dashboard Canva Developers** (di luar
aplikasi ini) dan pengaturan di **menu Pengaturan aplikasi**. Ikuti urutannya — banyak
langkah di sini yang gagal kalau dilakukan tidak berurutan atau di tempat yang salah.

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
4. Di bagian **"Authorized redirects"**, tambahkan persis:
   ```
   http://127.0.0.1:3000/administrasi/pengaturan/canva/callback
   ```
   Ganti `127.0.0.1:3000` sesuai domain/port aplikasi Anda yang sebenarnya bila berjalan di
   server produksi. **Alamat ini harus sama persis** (termasuk `http://` vs `https://` dan
   nomor port) dengan `CANVA_REDIRECT_URI` di `.env` aplikasi — kalau beda satu karakter
   pun, Canva akan menolak dengan pesan "Redirect URI mismatch" atau serupa.

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

```env
CANVA_CLIENT_ID=<client id dari langkah 1>
CANVA_CLIENT_SECRET=<client secret dari langkah 1>
CANVA_REDIRECT_URI=http://127.0.0.1:3000/administrasi/pengaturan/canva/callback
```

Restart server (`bun run dev` / `bun run start`) supaya `.env` yang baru terbaca — Bun
hanya memuat `.env` sekali saat aplikasi mulai berjalan.

## Langkah 3 — Desain & publish Brand Template

1. Buat desain laporan di Canva seperti biasa (ukuran, warna, tata letak bebas sesuai
   selera sekolah).
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
   | `pekan` | Teks | Nomor pekan berjalan |
   | `ayat` | Teks | Tambahan hafalan pekan ini |
   | `ayat_sebelum` | Teks | Total hafalan sebelum tambahan pekan ini |
   | `ayat_total` | Teks | Total hafalan keseluruhan setelah tambahan pekan ini |
   | `foto` | Gambar | Foto siswa |

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

1. Masuk sebagai admin, buka **Administrasi → Pengaturan → Integrasi Canva**.
2. Klik **"Hubungkan Akun Canva"** → login/pilih akun Canva yang **rolenya Brand Designer/
   Admin** di Team yang sama dengan Brand Template tadi → setujui izin yang diminta.
3. Setelah kembali dan status berubah jadi "Terhubung", isi kolom **ID Brand Template**
   dengan ID dari Langkah 5, klik **Simpan**.

## Langkah 7 — Uji coba

Buka **Input › Hafalan Qur'an**, pilih satu siswa, klik **"Cetak via Canva"** dulu (satu
siswa) sebelum mencoba **"Cetak via Canva Sekelas (ZIP)"**. Proses satu laporan lewat Canva
memakan waktu **15 detik sampai beberapa menit** (normal — aplikasi mengisi desain lewat
Autofill API lalu mengekspornya sebagai PDF, ini proses jaringan ke server Canva, bukan
proses lokal). Untuk kelas besar, ZIP diproses **satu siswa per satu** (bukan bersamaan)
supaya tidak melanggar batas kecepatan API Canva — makin banyak siswa, makin lama totalnya
(perkirakan 1–3 menit per siswa untuk kelas besar).

## Masalah yang sering ditemui

| Gejala | Penyebab | Solusi |
|---|---|---|
| "tahfid-bn belum mengonfigurasi URI pengalihan" | Redirect URL diisi di halaman/App yang salah, atau belum diisi sama sekali | Cek App yang benar di canva.com/developers, isi di menu **Authentication** (bukan Webhook) |
| Galat "The URL cannot be any form of localhost" | Redirect URL diisi di kolom **Webhook** (Notifications endpoint), bukan Authentication | Pindah ke menu Authentication → Authorized redirects |
| `not_found`, "Brand template with id '...' not found" | ID yang dipakai adalah ID desain (`DA...`), bukan ID Brand Template (`EA...`) | Ambil ID dari halaman Brand Kit → Brand Templates, bukan dari URL edit desain |
| Opsi "Data field"/"Connect data" tidak pernah muncul di elemen mana pun | Role akun Canva bukan Brand Designer/Admin di Team tsb, atau desainnya belum dipublish sebagai Brand Template | Minta Admin Team menaikkan role akun (Team Settings → People), dan pastikan Langkah 3 (publish Brand Template) sudah dilakukan |
| Satu baris di laporan selalu menampilkan `-` atau teks placeholder | Elemen itu belum disambungkan ("Connect data") ke kolom data-nya | Buka lagi Bulk Create, drag/connect kolom yang benar ke elemen tsb |
| "Refresh token used twice" / "Token lineage has been revoked" | Koneksi OAuth Canva rusak (biasa terjadi kalau token dipakai dari dua tempat berbeda, mis. server pengujian terpisah) | **Administrasi → Pengaturan → Integrasi Canva** → Putuskan Koneksi → Hubungkan Akun Canva lagi. ID Brand Template yang sudah tersimpan tidak akan hilang |
| "The socket connection was closed unexpectedly" | Galat jaringan sesaat ke server Canva | Coba cetak ulang. Kalau berulang terus-menerus, cek koneksi internet sekolah |
| Proses ZIP sekelas lama sekali / tampak macet | Normal untuk kelas besar — diproses satu per satu, bukan bug | Tunggu sampai selesai (bisa beberapa menit); jangan tutup halaman sebelum unduhan mulai |
