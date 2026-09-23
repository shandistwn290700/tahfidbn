# Memasang di iPhone (PWA)

Aplikasi ini tidak tersedia sebagai APK/IPA untuk iPhone — Apple mewajibkan Mac dan Xcode
untuk membangun aplikasi native iOS. Sebagai gantinya, aplikasi web ini sudah bisa
**dipasang ke layar utama iPhone lewat Safari**, dengan ikon sendiri dan tampilan layar
penuh (tanpa bar alamat browser) — pengalamannya sangat mirip aplikasi asli.

Aplikasi ini juga tetap mensyaratkan iPhone terhubung ke **WiFi yang sama dengan server**
sekolah. Kalau tidak, akan tampil halaman "Silakan hubungkan ke WiFi server".

## Langkah pemasangan (dilakukan sekali oleh tiap guru/admin)

1. Pastikan iPhone terhubung ke WiFi sekolah yang sama dengan server.
2. Buka **Safari** (harus Safari, browser lain di iPhone tidak mendukung fitur ini).
3. Ketik alamat server di bar alamat, contoh: `http://192.168.1.10:3000` (tanyakan
   penanggung jawab Tahfid alamat IP server sekolah).
4. Setelah halaman masuk (login) terbuka, ketuk ikon **Bagikan** (kotak dengan panah ke
   atas) di bagian bawah Safari.
5. Gulir ke bawah, ketuk **"Add to Home Screen"** (Tambah ke Layar Utama).
6. Ketuk **"Add"** (Tambah) di pojok kanan atas.
7. Ikon "Tahfid" akan muncul di layar utama iPhone, seperti aplikasi biasa.

Selanjutnya, cukup ketuk ikon itu — aplikasi terbuka layar penuh tanpa tampilan Safari.

## Kalau muncul "Silakan hubungkan ke WiFi server"

Ini artinya iPhone sedang **tidak** terhubung ke WiFi yang sama dengan server (mis. memakai
data seluler, atau WiFi lain). Pindahkan sambungan WiFi ke jaringan sekolah yang benar, lalu
ketuk **"Coba Lagi"**.

## Kalau alamat server berubah

Alamat yang tersimpan di ikon layar utama mengikuti alamat yang diketik saat pemasangan
(Langkah 3). Kalau server sekolah pindah ke alamat IP lain:

1. Hapus ikon lama dari layar utama (tekan lama ikonnya → Remove App / Hapus Aplikasi).
2. Ulangi Langkah 1–7 di atas dengan alamat server yang baru.

## Untuk admin: mengapa ini bisa berjalan tanpa App Store

Ini disebut **Progressive Web App (PWA)** — fitur bawaan Safari/iOS sejak beberapa tahun
terakhir, bukan trik pihak ketiga. Aplikasi web ini sudah dilengkapi berkas
`manifest.json`, ikon, dan *service worker* yang membuat Safari menganggapnya layak
"dipasang". Tidak ada proses tambahan yang perlu dijalankan di sisi server — begitu server
dinyalakan (lihat README utama), fitur ini otomatis aktif.
