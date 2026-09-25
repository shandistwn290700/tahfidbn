# Aplikasi Desktop Windows (client)

Ini adalah **aplikasi client** untuk Windows — satu jendela aplikasi dengan ikon Start
Menu/Desktop dan installer resmi ([Tauri](https://tauri.app) + WebView2 bawaan Windows), yang
menyambung ke **server Tahfid Community yang sudah berjalan di tempat lain** (lihat README
utama / [DEPLOYMENT.md](DEPLOYMENT.md) untuk cara menjalankan server itu).

**Penting:** aplikasi ini **tidak** menjalankan server atau menyimpan basis data sendiri —
sifatnya persis seperti aplikasi Android ([MOBILE-ANDROID.md](MOBILE-ANDROID.md)), cuma untuk
Windows. Satu-satunya sumber data yang sah adalah server yang di-deploy terpisah; aplikasi
desktop dan mobile cuma jendela untuk mengaksesnya.

Kode proyeknya ada di folder **`desktop-app/`**, terpisah dari aplikasi web utama (`src/`).

## Cara kerjanya

1. Saat aplikasi dibuka pertama kali, muncul layar isi **alamat server** (mis.
   `192.168.1.10:3000`) — tanyakan penanggung jawab Tahfid kalau belum tahu.
2. Aplikasi memverifikasi server itu bisa dijangkau. Kalau berhasil, jendela otomatis
   menampilkan aplikasi sungguhan dari server tersebut.
3. Kalau gagal (komputer belum terhubung ke jaringan yang sama dengan server, atau servernya
   sedang mati), muncul pesan jelas dengan tombol **Coba Lagi** atau **Ubah Alamat Server**.
4. Alamat server yang sudah diisi **disimpan otomatis** — dibuka lagi lain kali langsung
   mencoba menyambung ke alamat yang sama, tidak perlu diisi ulang setiap kali.

## Mode kios (layar penuh tanpa bingkai)

Jendela aplikasi ini sengaja dibuat **layar penuh tanpa bingkai/title bar** — tidak ada
tombol minimize, maximize, atau X seperti jendela Windows biasa. Ini supaya tampilannya
rapi seperti aplikasi kios, dan tidak sembarangan bisa ditutup/di-minimize oleh siswa saat
dipakai untuk sesi hafalan.

Ada **dua cara** keluar dari aplikasi, keduanya murni menutup aplikasi — **berbeda dari
logout** (logout tetap lewat menu Akun di dalam aplikasi seperti biasa, dan hanya
mengeluarkan sesi login, bukan menutup programnya):

1. **Tombol bulat merah melayang** di pojok kanan bawah layar — selalu tampil di atas
   jendela utama. Diklik sekali akan membesar menjadi panel konfirmasi ("Apakah Anda yakin
   mau keluar dari aplikasi?") dengan tombol **Batal** dan **Ya, Keluar**. Ini cara yang
   dianjurkan untuk guru, karena tidak perlu menghafal kombinasi tombol apa pun.
2. **Kombinasi tombol `Ctrl + Alt + Shift + Q`** — bekerja kapan saja selama aplikasi
   terbuka (tidak perlu sedang fokus di jendela tertentu), langsung menutup aplikasi tanpa
   konfirmasi. Cara ini tetap dipertahankan untuk admin/teknisi yang terbiasa memakainya.

> Tombol melayang dan kombinasi tombol ini didefinisikan di
> `desktop-app/src-tauri/src/main.rs` (dan tampilan panelnya di
> `desktop-app/dist/exit-button.html`). Keduanya dibangun terpisah dari kode server/aplikasi
> web utama, jadi tidak memengaruhi `src/` sama sekali. Ganti nilai `Modifiers`/`Code` di
> sana kalau ingin memakai kombinasi tombol lain, lalu build ulang.
>
> Panel konfirmasi memakai tampilan buatan sendiri, bukan `window.confirm()` bawaan
> browser — jendela tombol ini kecil dan mepet ke pojok layar, sehingga dialog bawaan
> browser bisa terpotong di luar tepi layar dan tombolnya jadi tidak terklik.

## Membangun installer-nya

### Prasyarat

- [Node.js](https://nodejs.org)
- [Rust](https://rustup.rs) — pasang lewat `rustup`, target `x86_64-pc-windows-msvc`
- **Visual Studio Build Tools** dengan workload **"Desktop development with C++"** — Rust di
  Windows butuh linker MSVC ini:
  ```powershell
  vs_buildtools.exe --quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools
  ```

Tidak perlu Bun maupun kode aplikasi web sama sekali untuk membangun ini — aplikasi client
ini sepenuhnya berdiri sendiri dari sisi build.

### Build

```sh
cd desktop-app
npm install
npx tauri build
```

Hasil installernya ada di:

```
desktop-app/src-tauri/target/release/bundle/nsis/Tahfid Community_1.0.0_x64-setup.exe
```

Berkas `.exe` ini yang dibagikan ke guru/admin — sekali klik, aplikasi terpasang lengkap
dengan ikon dan uninstaller.

## Mengubah alamat server tanpa memasang ulang

Alamat server tersimpan di penyimpanan lokal aplikasi (bukan di dalam installer). Untuk
mengubahnya: buka aplikasi, tunggu sampai muncul layar gagal terhubung (atau langsung, kalau
sudah tahu perlu diganti), pilih **"Ubah Alamat Server"**.

## Kustomisasi ikon/nama aplikasi

- Nama: `productName` di `desktop-app/src-tauri/tauri.conf.json`
- Ikon: ganti `desktop-app/src-tauri/icon-source.png` (disarankan 1024×1024), lalu jalankan
  `npx tauri icon src-tauri/icon-source.png` dari dalam folder `desktop-app/` untuk membuat
  ulang seluruh ukuran ikon sebelum build ulang.

## Kenapa bukan `start-server.bat`?

`start-server.bat` **adalah** server-nya — dijalankan sekali di komputer sekolah yang
bertindak sebagai server. Aplikasi desktop di halaman ini **bukan** pengganti itu, melainkan
cara bagi guru/admin **lain** untuk mengakses server itu dari komputer masing-masing dengan
pengalaman seperti aplikasi biasa (ikon, satu jendela), bukan lewat browser biasa. Satu
sekolah biasanya cuma butuh **satu** server (`start-server.bat` atau layanan Windows di
[DEPLOYMENT.md](DEPLOYMENT.md)), tapi bisa punya **banyak** client (aplikasi desktop ini di
beberapa komputer, aplikasi Android/iPhone di HP masing-masing guru) yang semuanya
menyambung ke server yang sama.
