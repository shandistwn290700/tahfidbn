# Pengerasan VPS produksi

Tindak lanjut Nessus *Basic Network Scan* ke `tahfid.bahteranuhapp.tech` (76.13.16.24),
13 Oktober 2026. Hasilnya: 0 Critical, 0 High, 2 Medium, 38 Info. Kedua temuan Medium
berasal dari server DNS di VPS, bukan dari aplikasi.

Langkah di bawah dijalankan **manual oleh admin server**. Kerjakan urut, satu bagian
selesai dan terverifikasi baru lanjut ke bagian berikutnya.

> **Sebelum mulai:** buka konsol darurat dari panel penyedia VPS (terminal browser/VNC) di
> tab lain. Kalau salah mengatur SSH atau firewall, hanya konsol itu yang masih bisa masuk.

| Bagian | Menutup temuan Nessus |
|---|---|
| 1. Inventaris | — (memastikan kondisi awal) |
| 2. DNS | **35450** DNS amplification DDoS, **10539** recursive query / cache poisoning |
| 3. Firewall | 11219 port terbuka, menutup port 3000 dan 53 |
| 4. SSH | 149334 login password, 153588 HMAC SHA-1, banner versi |
| 5. nginx & TLS | 42823 HSTS non-compliant, 10107/106375 versi nginx, cipher TLS |
| 6. Pemeliharaan | 117886 status patch OS, 25220 TCP timestamps |

---

## 1. Inventaris

```sh
sudo ss -tulpn                     # semua port terbuka beserta prosesnya
sudo ss -ltnp | grep 3000          # harus 127.0.0.1:3000, BUKAN 0.0.0.0:3000 / *:3000
dig NS bahteranuhapp.tech +short   # apakah VPS ini nameserver domain?
sudo nginx -T | grep -nEi 'strict-transport|server_tokens|ssl_|listen|add_header|include'
```

Kalau port 3000 terikat ke `0.0.0.0` atau `*`, tambahkan `HOST=127.0.0.1` di `.env`
aplikasi (`~/apps/tahfidbn/.env`), lalu jalankan `pm2 restart ngaji --update-env`.

## 2. DNS — temuan Medium 35450 dan 10539

VPS saat ini menjawab query DNS rekursif dari siapa saja di internet. Akibatnya VPS bisa
dipakai sebagai pemantul serangan DDoS ke pihak lain. Penyedia VPS bisa menangguhkan server
karena itu, dan IP bisa masuk daftar hitam. Aplikasi sama sekali tidak membutuhkan server DNS.

**Kalau `dig NS` di langkah 1 tidak menunjuk ke 76.13.16.24** (kasus paling mungkin),
matikan layanan DNS-nya:

```sh
sudo ss -tulpn | grep ':53 '       # kenali prosesnya: named / dnsmasq / unbound / pdns
sudo systemctl disable --now named bind9 dnsmasq unbound 2>/dev/null
```

Jangan matikan `systemd-resolved`. Layanan itu hanya mendengar di 127.0.0.53, tidak
terlihat dari luar, dan dipakai VPS sendiri untuk resolusi nama.

**Kalau VPS memang nameserver domain**, jangan dimatikan karena domain akan ikut mati.
Matikan rekursinya saja, misalnya di `/etc/bind/named.conf.options`:

```
options {
    recursion no;
    allow-recursion { none; };
    allow-query-cache { none; };
    rate-limit { responses-per-second 10; };
};
```

```sh
sudo named-checkconf && sudo systemctl reload named
```

**Verifikasi dari komputer lain** (bukan dari VPS):

```sh
dig @76.13.16.24 example.com       # harus timeout atau status REFUSED, tanpa jawaban
```

## 3. Firewall

Izinkan SSH **sebelum** mengaktifkan firewall:

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Port 53 dan 3000 otomatis tertutup dari luar. Kalau panel VPS juga punya firewall,
samakan aturannya di sana. Docker (bila terpasang) melewati aturan ufw.

## 4. SSH — temuan 149334 dan 153588

Deploy GitHub Actions (`.github/workflows/deploy.yml`) sudah login memakai **kunci**, bukan
password. Mematikan login password tidak memutus deploy, asalkan kunci publik pasangan
secret `SSH_PRIVATE_KEY` ada di `~/.ssh/authorized_keys` milik pengguna deploy.

1. Pastikan kunci admin dan kunci deploy sudah ada di `authorized_keys`.
2. Dari **terminal baru**, uji login dengan kunci. Biarkan sesi lama tetap terbuka.
   ```sh
   ssh -o PreferredAuthentications=publickey -o PasswordAuthentication=no <user>@76.13.16.24
   ```
   Jangan lanjut kalau langkah ini gagal.
3. Buat `/etc/ssh/sshd_config.d/00-hardening.conf`. Awalan `00-` penting: OpenSSH memakai
   nilai pertama yang dibaca, jadi berkas ini mengalahkan `50-cloud-init.conf` yang sering
   berisi `PasswordAuthentication yes`.
   ```
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PubkeyAuthentication yes
   PermitRootLogin prohibit-password
   MaxAuthTries 3
   LoginGraceTime 30
   X11Forwarding no
   DebianBanner no
   MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com
   ```
   - `PermitRootLogin no` hanya boleh dipakai bila deploy **tidak** login sebagai root.
   - `DebianBanner` hanya dikenal di Debian/Ubuntu; hapus baris itu di distro lain.
4. Uji, lalu muat ulang:
   ```sh
   sudo sshd -t && sudo systemctl reload ssh
   sudo sshd -T | grep -Ei 'passwordauth|kbdinteractive|permitroot|^macs'
   ```
5. Dari terminal **ketiga**: login dengan kunci harus berhasil, dan login dengan password
   harus ditolak:
   ```sh
   ssh -o PubkeyAuthentication=no <user>@76.13.16.24     # harus "Permission denied"
   ```
6. Di GitHub › Actions, jalankan ulang job deploy terakhir dan pastikan berhasil. Baru
   setelah itu tutup sesi lama.
7. Pasang fail2ban untuk memblokir percobaan login berulang:
   ```sh
   sudo apt install fail2ban       # jail sshd aktif secara bawaan di Debian/Ubuntu
   ```
8. Opsional (melindungi deploy dari MITM): ambil sidik jari host key, lalu simpan sebagai
   secret repositori `VPS_HOST_FINGERPRINT` (GitHub › Settings › Secrets › Actions).
   ```sh
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub   # salin bagian SHA256:...
   ```

## 5. nginx & TLS — temuan 42823, 10107, 106375

`nginx.conf.example` di repositori sudah diperbarui. Samakan konfigurasi situs di VPS
(`/etc/nginx/sites-available/...`) dengan contoh itu:

- Tambahkan `server_tokens off;` di blok `http {}` pada `/etc/nginx/nginx.conf`.
- **Hapus semua `add_header`** keamanan dari blok situs, termasuk
  `Strict-Transport-Security` bila ada. Aplikasi sudah mengirim header itu sendiri, dan
  header ganda dengan nilai berbeda termasuk penyebab HSTS ditandai "non-compliant".
- Ganti `ssl_ciphers` dengan daftar di contoh. Kalau blok situs sudah memuat
  `include /etc/letsencrypt/options-ssl-nginx.conf;`, jangan tulis ulang direktif `ssl_*`
  yang sama, karena `nginx -t` akan gagal dengan pesan "duplicate".
- Tambahkan server `default_server` yang menolak akses lewat IP atau Host asing.

```sh
sudo nginx -t && sudo systemctl reload nginx
```

Rilis aplikasi yang memuat perubahan pengamanan ini menaikkan HSTS menjadi 1 tahun. Setelah
rilis itu ter-deploy, verifikasi:

```sh
curl -sI https://tahfid.bahteranuhapp.tech/login | grep -ci strict-transport   # harus 1
curl -sI https://tahfid.bahteranuhapp.tech/login | grep -i strict-transport    # max-age=31536000
curl -sI http://tahfid.bahteranuhapp.tech/login                                   # 301, tanpa Strict-Transport-Security
curl -sI https://tahfid.bahteranuhapp.tech/login | grep -i '^server'              # "nginx" tanpa nomor versi
curl -sI https://tahfid.bahteranuhapp.tech/siswa-foto/1.jpg                        # 302 ke /login, bukan 200
```

## 6. Pemeliharaan

```sh
sudo apt update && sudo apt upgrade
sudo apt install unattended-upgrades       # patch keamanan otomatis
```

Opsional, untuk temuan 25220 (yang hanya membocorkan perkiraan uptime):

```sh
echo 'net.ipv4.tcp_timestamps=0' | sudo tee /etc/sysctl.d/90-tcp-ts.conf
sudo sysctl --system
```

## 7. Pindai ulang

Jalankan Nessus lagi setelah semua bagian selesai. Temuan 35450 dan 10539 harus hilang,
begitu pula 149334 dan 153588. Agar status patch OS ikut dinilai (temuan 117886), jalankan
scan **dengan kredensial SSH**: pakai pengguna khusus scan yang login dengan kunci.

Temuan Info yang wajar tetap muncul, seperti deteksi SSH/nginx/TLS dan *Harvest Now
Decrypt Later*. Yang terakhir baru bisa ditutup setelah OpenSSL di VPS ≥ 3.5, dengan
menambahkan `ssl_ecdh_curve X25519MLKEM768:X25519:prime256v1;`.
