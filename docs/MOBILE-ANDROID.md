# Aplikasi Android (APK)

Aplikasi Android ini adalah **pembungkus native** (dibangun dengan
[Capacitor](https://capacitorjs.com)) yang menampilkan aplikasi web Tahfid Community di
dalam WebView, dengan satu tambahan penting: **HP wajib terhubung ke jaringan WiFi yang
sama dengan server** sebelum bisa memakai aplikasi. Kalau tidak, muncul layar "Silakan
hubungkan ke WiFi server" alih-alih layar kosong/galat.

Kode proyeknya ada di folder **`mobile-android/`** di repositori ini — terpisah dari
aplikasi web utama (`src/`), karena punya `package.json` dan proyek Android sendiri.

## Cara kerjanya

1. Saat aplikasi dibuka, layar pertama mencoba menghubungi alamat server yang tersimpan
   (disimpan di HP, bukan di kode aplikasi — supaya tidak perlu membangun ulang APK kalau
   alamat server berubah).
2. **Berhasil terhubung** → otomatis pindah ke aplikasi web sungguhan di alamat itu.
3. **Gagal terhubung** (HP belum pindah ke WiFi sekolah, atau server sedang mati) → tampil
   layar "Silakan hubungkan ke WiFi server" dengan tombol **Coba Lagi** dan **Ubah Alamat
   Server**.
4. Saat pertama kali dipasang, belum ada alamat tersimpan → langsung diarahkan ke layar
   pengisian alamat server.

## Membangun APK-nya

### Prasyarat

- [Node.js](https://nodejs.org) (untuk `npm`)
- **JDK 17** — unduh dari [Eclipse Temurin](https://adoptium.net/temurin/releases/?version=17)
- **Android SDK** command-line tools — dari
  [developer.android.com/studio#command-tools](https://developer.android.com/studio#command-tools),
  atau pasang lewat Android Studio penuh bila lebih terbiasa dengan GUI.
  Perlu komponen: `platform-tools`, `platforms;android-34`, `build-tools;34.0.0`.

Atur variabel lingkungan sebelum build (sesuaikan lokasi pemasangan):

```powershell
$env:JAVA_HOME = "<lokasi JDK 17>"
$env:ANDROID_HOME = "<lokasi Android SDK>"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

### Build

```sh
cd mobile-android
npm install
npx cap sync android
cd android
.\gradlew.bat assembleDebug     # Windows
./gradlew assembleDebug         # Linux/macOS
```

Hasilnya ada di:

```
mobile-android/android/app/build/outputs/apk/debug/app-debug.apk
```

Berkas `.apk` ini yang dibagikan/dipasang ke HP guru/admin. Build **debug** ini sudah cukup
untuk pemakaian internal satu sekolah (tidak perlu Google Play, tidak perlu akun developer
apa pun) — batasannya cuma HP harus mengizinkan **"Pasang dari sumber tidak dikenal"** saat
memasang APK yang bukan dari Play Store, yang memang wajar untuk aplikasi internal seperti
ini.

## Memasang di HP guru/admin

1. Salin berkas `app-debug.apk` ke HP (lewat kabel USB, WhatsApp, Google Drive, dll).
2. Buka berkas itu di HP. Android akan meminta izin "Pasang dari sumber tidak dikenal" —
   izinkan.
3. Buka aplikasi "Tahfid Community" yang baru terpasang.
4. Isi alamat server, contoh: `192.168.1.10:3000` (tanyakan penanggung jawab Tahfid alamat
   IP server sekolah — lihat [DEPLOYMENT.md](DEPLOYMENT.md)).
5. Selesai — aplikasi akan otomatis menyambung setiap kali dibuka, selama HP terhubung ke
   WiFi yang sama dengan server.

## Kenapa hanya HTTP (bukan HTTPS)?

Server sekolah pada pemakaian umum berjalan di jaringan lokal tanpa domain publik/sertifikat
HTTPS (lihat opsi "Tanpa domain publik" di [DEPLOYMENT.md](DEPLOYMENT.md)). Karena itu,
`AndroidManifest.xml` proyek ini sengaja mengizinkan **cleartext traffic**
(`android:usesCleartextTraffic="true"`) — tanpa ini, Android 9 ke atas akan memblokir semua
koneksi HTTP secara default. Ini aman selama server memang hanya diakses dari jaringan lokal
sekolah yang tertutup.

## Mengubah alamat server tanpa memasang ulang APK

Alamat server tersimpan di penyimpanan lokal HP, bukan di dalam APK. Untuk mengubahnya
(misalnya server dipindah ke IP lain): buka aplikasi, tunggu sampai muncul layar gagal
terhubung (atau kalau masih terhubung ke server lama, hapus data aplikasi lewat Pengaturan
Android), lalu pilih **"Ubah Alamat Server"**.

## Kenapa perlu `allowNavigation` di `capacitor.config.json`

Bawaan Capacitor: WebView aplikasi menolak berpindah ke alamat di luar aplikasi (dianggap
tautan eksternal) dan malah membukanya di browser sistem — bukan di dalam aplikasi. Karena
alamat server di aplikasi ini memang dinamis (diisi pengguna saat pertama kali dipakai,
bukan ditentukan saat build), `mobile-android/capacitor.config.json` sengaja diisi:

```json
"server": { "allowNavigation": ["*"] }
```

Ini membuat seluruh menu aplikasi (papan peringkat, input hafalan, dst.) tetap terbuka **di
dalam** aplikasi, bukan berpindah ke browser. Kalau perubahan pada berkas ini pernah
terhapus (mis. tertimpa `npx cap add android` ulang dari awal), jalankan `npx cap sync
android` lagi setelah mengembalikannya, lalu build ulang APK.

## Kustomisasi ikon/nama aplikasi

- Nama aplikasi: `mobile-android/android/app/src/main/res/values/strings.xml`
  (`app_name` dan `title_activity_main`)
- Ikon: berkas PNG di `mobile-android/android/app/src/main/res/mipmap-*/` — sudah diisi
  dengan logo daun hijau bawaan aplikasi, ganti sesuai kebutuhan sekolah lalu build ulang

## iPhone

APK tidak berlaku untuk iPhone — Apple mewajibkan Mac + Xcode + akun Apple Developer untuk
membangun aplikasi native iOS, sesuatu yang tidak bisa dilakukan dari Windows sama sekali.
Untuk iPhone, lihat **[MOBILE-IPHONE.md](MOBILE-IPHONE.md)** — aplikasi web ini sudah bisa
"dipasang" ke layar utama iPhone lewat Safari (PWA), dengan pengalaman yang mirip aplikasi
asli, termasuk peringatan WiFi yang sama.
