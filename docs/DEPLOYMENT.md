# Panduan Penerapan di Server Produksi

Panduan ini untuk menjalankan aplikasi secara permanen di server sekolah (baik server lokal
di jaringan sekolah, maupun VPS), memakai [PM2](https://pm2.keymetrics.io/) sebagai
penjaga proses dan [Nginx](https://nginx.org) sebagai reverse proxy + HTTPS.

Untuk sekadar mencoba di komputer sendiri, cukup `bun run dev` — panduan ini khusus untuk
pemakaian jangka panjang oleh banyak guru sekaligus.

## Ringkasan arsitektur

```
Peramban guru/admin  →  Nginx (port 80/443, HTTPS)  →  Bun.serve() (port 3000, lokal)
```

Nginx menangani sertifikat HTTPS dan meneruskan permintaan ke aplikasi Bun yang berjalan di
`127.0.0.1:3000`. PM2 memastikan aplikasi otomatis berjalan lagi kalau server di-restart
atau proses tiba-tiba berhenti.

## Prasyarat server

- Linux (Ubuntu/Debian disarankan) atau Windows Server
- [Bun](https://bun.sh) terpasang
- Nginx terpasang (`sudo apt install nginx` di Ubuntu/Debian)
- Nama domain yang sudah diarahkan (DNS A record) ke IP server — untuk HTTPS lewat Let's
  Encrypt. Kalau hanya dipakai di jaringan lokal sekolah tanpa domain publik, lihat catatan
  di bagian [Tanpa domain publik](#tanpa-domain-publik-jaringan-lokal-saja) di bawah

## 1. Salin kode & pasang dependensi

```sh
git clone <url-repositori-anda> /var/www/ngaji
cd /var/www/ngaji
bun install
```

## 2. Siapkan `.env`

```sh
cp .env.example .env
nano .env    # atau editor lain
```

Isi minimal:

```env
APP_NAME=Tahfid <Nama Sekolah>
APP_URL=https://tahfid.namasekolah.sch.id
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<kata sandi kuat, bukan bawaan contoh>
```

**Jangan pakai kata sandi contoh dari `.env.example`** — akun admin pertama dibuat persis
dari nilai ini saat aplikasi pertama kali berjalan.

## 3. Bangun aset tampilan

```sh
bun run build:css
```

`public/app.css` sudah ikut disertakan di repositori, jadi langkah ini opsional kecuali
Anda mengubah kode tampilan (kelas Tailwind) setelah clone.

## 4. Jalankan lewat PM2

Pasang PM2 sekali saja di server (perlu Node.js/npm, atau lewat Bun: `bun add -g pm2`):

```sh
bun add -g pm2
pm2 start ecosystem.config.cjs
pm2 save            # supaya PM2 mengingat proses ini setelah server di-restart
pm2 startup         # ikuti instruksi yang muncul untuk mengaktifkan PM2 saat boot
```

Perintah berguna sehari-hari:

```sh
pm2 status           # lihat status proses
pm2 logs ngaji        # lihat log aplikasi secara langsung
pm2 restart ngaji     # restart aplikasi (mis. setelah update kode)
pm2 stop ngaji        # hentikan aplikasi
```

## 5. Pasang Nginx sebagai reverse proxy + HTTPS

1. Salin `nginx.conf.example` ke konfigurasi Nginx:
   ```sh
   sudo cp nginx.conf.example /etc/nginx/sites-available/ngaji
   sudo nano /etc/nginx/sites-available/ngaji
   ```
2. Ganti `your-domain.com` dengan domain Anda yang sebenarnya (dua tempat).
3. Aktifkan situsnya:
   ```sh
   sudo ln -s /etc/nginx/sites-available/ngaji /etc/nginx/sites-enabled/
   sudo nginx -t        # uji konfigurasi sebelum reload
   sudo systemctl reload nginx
   ```
4. Pasang sertifikat HTTPS gratis lewat [Certbot](https://certbot.eff.org/):
   ```sh
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d tahfid.namasekolah.sch.id
   ```
   Certbot akan otomatis mengisi baris `ssl_certificate`/`ssl_certificate_key` di
   konfigurasi Nginx dan mengatur perpanjangan otomatis.

## 6. Buka & uji

Buka `https://tahfid.namasekolah.sch.id`, masuk dengan akun admin dari `.env`, lalu **segera
ganti password lewat menu Akun**.

## Tanpa domain publik (jaringan lokal saja)

Kalau aplikasi hanya dipakai di jaringan lokal sekolah (tidak diakses dari internet luar),
Anda bisa melewati Nginx + HTTPS sepenuhnya:

```sh
pm2 start ecosystem.config.cjs
```

Guru/admin mengakses lewat IP lokal server, mis. `http://192.168.1.10:3000`. Pastikan
`PORT` di `.env` sesuai dan firewall server mengizinkan port itu diakses dari jaringan
lokal. Perlu diketahui: tanpa HTTPS, cookie sesi login dikirim tanpa enkripsi di jaringan
lokal — cukup aman untuk jaringan sekolah tertutup, tapi jangan diteruskan ke internet
publik tanpa HTTPS.

## Memperbarui aplikasi

```sh
cd /var/www/ngaji
git pull
bun install              # kalau ada dependensi baru
bun run build:css        # kalau ada perubahan kode tampilan
pm2 restart ngaji
```

Migrasi struktur basis data (bila ada) berjalan otomatis saat aplikasi menyala kembali,
termasuk cadangan otomatis sebelum migrasi dijalankan — lihat bagian
[Basis data & migrasi](../README.md#basis-data--migrasi) di README.

## Cadangan rutin

Selain fitur **Administrasi › Pengaturan › Cadangan & Pemulihan** di aplikasi, disarankan
menambahkan cadangan otomatis di level server, misalnya lewat cron harian:

```sh
# /etc/cron.d/ngaji-backup — jalan tiap hari jam 2 pagi
0 2 * * * root cp /var/www/ngaji/data/ngaji.db /path/backup/eksternal/ngaji-$(date +\%F).db
```

Simpan hasil cadangan di penyimpanan **terpisah** dari server aplikasi (mis. disk eksternal,
cloud storage, atau server lain) — cadangan yang tersimpan di server yang sama tidak
melindungi dari kerusakan hardware server itu sendiri.
