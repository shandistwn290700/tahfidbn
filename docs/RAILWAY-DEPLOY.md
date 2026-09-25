# Deploy ke Railway (untuk demo)

Panduan ini untuk menjalankan aplikasi di [Railway](https://railway.app) supaya bisa
ditunjukkan/diakses dari mana saja lewat internet — cocok untuk **demo ke sekolah lain**.

**Bukan untuk data sekolah sungguhan yang permanen** kalau tidak diatur dengan baik — baca
bagian [Penyimpanan permanen (Volume)](#penyimpanan-permanen-volume) di bawah, ini langkah
yang **wajib**, bukan opsional, kalau tidak ingin data hilang setiap kali aplikasi
di-restart.

Berkas konfigurasi (`Dockerfile`, `.dockerignore`, `railway.toml`) sudah disiapkan di
repositori ini — Railway akan mendeteksi dan memakainya otomatis begitu terhubung.

## Langkah 1 — Buat akun & project Railway

1. Buka [railway.app](https://railway.app), daftar/masuk (bisa pakai akun GitHub langsung).
2. Klik **New Project** → **Deploy from GitHub repo**.
3. Pilih repositori ini (`tahfidbn`, atau nama repo GitHub Anda).
4. Railway otomatis mendeteksi `Dockerfile` dan mulai build. Ini akan **gagal dulu** di
   percobaan pertama karena variabel lingkungan wajib belum diisi — itu wajar, lanjut ke
   Langkah 2.

## Langkah 2 — Isi variabel lingkungan

Di halaman service yang baru dibuat, buka tab **Variables**, tambahkan:

| Variabel | Nilai |
|---|---|
| `ADMIN_USERNAME` | mis. `admin` |
| `ADMIN_PASSWORD` | kata sandi kuat, minimal 8 karakter — **jangan** pakai contoh dari `.env.example` |
| `DB_PATH` | `/app/data/ngaji.db` |

`PORT` **tidak perlu diisi manual** — Railway mengisinya sendiri secara otomatis, dan
aplikasi ini sudah membaca `process.env.PORT` bawaan Railway.

## Langkah 3 — Penyimpanan permanen (Volume)

**Wajib**, supaya data (basis data + foto siswa) tidak hilang setiap kali Railway
me-restart atau men-deploy ulang container (yang bisa terjadi kapan saja secara otomatis):

1. Di halaman service, buka tab **Settings** → cari bagian **Volumes**.
2. Klik **New Volume**.
3. Isi **Mount Path** dengan persis: `/app/data`
4. Simpan, lalu **redeploy** service (Railway biasanya melakukan ini otomatis setelah
   Volume ditambahkan; kalau tidak, klik **Deploy** manual sekali).

Tanpa langkah ini, aplikasi tetap bisa dijalankan untuk demo sekali duduk, tapi **seluruh
data akan kembali kosong** setiap kali Railway memulai ulang container-nya.

## Langkah 4 — Buat alamat publik

1. Di tab **Settings** service, cari bagian **Networking** → **Public Networking**.
2. Klik **Generate Domain**.
3. Railway memberi alamat seperti `https://tahfidbn-production.up.railway.app` — inilah
   yang dibagikan ke sekolah lain untuk melihat demo.

## Langkah 5 (opsional) — Isi data contoh untuk demo

Supaya tampilannya tidak kosong saat ditunjukkan, isi data contoh sekali lewat
[Railway CLI](https://docs.railway.com/guides/cli):

```sh
npm install -g @railway/cli
railway login
railway link          # pilih project ini
railway run bun run seed
```

Ini mengisi 3 kelas, 2 guru, dan 10 siswa contoh (lihat README utama).

## Biaya

Railway memberi kredit gratis $5 sekali (tanpa kartu kredit), berlaku 30 hari sejak akun
dibuat, dipakai otomatis untuk biaya berjalannya service ini. Aplikasi seringan ini biasanya
memakai jauh di bawah itu per bulan — tapi kreditnya tetap **kedaluwarsa di hari ke-30**
terlepas dari sisa saldo. Setelah itu, perlu menambahkan kartu untuk tetap menyala (biaya
kecil, hitungan dolar per bulan untuk pemakaian seringan ini).

## Memperbarui deployment

Push perubahan ke branch yang terhubung (biasanya `main`) di GitHub — Railway otomatis
mendeteksi dan men-deploy ulang. Tidak perlu langkah manual tambahan.

## Integrasi Canva di Railway (opsional)

Kalau ingin demo juga menunjukkan fitur Canva, tambahkan variabel `CANVA_CLIENT_ID`,
`CANVA_CLIENT_SECRET`, dan `CANVA_REDIRECT_URI` (pakai alamat publik Railway dari Langkah 4,
bukan `127.0.0.1`) — lihat [CANVA-SETUP.md](CANVA-SETUP.md) untuk detail lengkapnya. Perlu
mendaftarkan ulang Redirect URI itu juga di dashboard Canva Developers.
