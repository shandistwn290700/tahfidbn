---
description: Jalankan alur persiapan rilis lengkap dengan seluruh tim agen
---

Jalankan alur persiapan rilis berikut secara berurutan. Catatan dari pengguna (jika ada): $ARGUMENTS

1. **Kesiapan kode** — delegasikan ke subagent `backend-developer` dan `frontend-developer` untuk menjalankan daftar cek siap produksi masing-masing. Perbaiki masalah yang mereka temukan sebelum lanjut.
2. **Pengujian** — delegasikan ke `qa-engineer`. Jika statusnya GAGAL, berhenti dan tampilkan daftar bug.
3. **Keamanan** — delegasikan ke `security-engineer`. Jika statusnya DIBLOKIR, berhenti dan tampilkan temuan pemblokirnya.
4. **Pipeline & infrastruktur** — minta `devops-engineer` memastikan pipeline dan skrip deploy siap untuk perubahan ini (misalnya ada migration atau variabel `.env` baru). Jika ada perubahan kebutuhan server, minta `sysadmin-cloud` menyiapkan konfigurasi dan runbook-nya.
5. **Keputusan** — serahkan semua laporan ke `release-manager` untuk keputusan GO / NO-GO.

Di akhir, tampilkan ringkasan singkat: status tiap tahap, keputusan rilis, dan langkah yang harus dijalankan manusia. Jangan melakukan push, membuat tag, atau deploy.
