@echo off
setlocal enabledelayedexpansion
title Tahfid Community - Peluncur
cd /d "%~dp0"

where bun >nul 2>nul
if errorlevel 1 (
  echo [*] Bun belum terpasang di komputer ini - memasang otomatis...
  echo     ^(Perlu koneksi internet untuk langkah ini saja. Mohon tunggu.^)
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"
  if errorlevel 1 (
    echo.
    echo [X] Pemasangan Bun gagal. Cek koneksi internet, lalu jalankan ulang start-server.bat.
    pause
    exit /b 1
  )
  echo.
  echo [OK] Bun berhasil dipasang.
  echo.
)

REM Bun baru saja terpasang mungkin belum terdeteksi di sesi ini (PATH sistem
REM baru diperbarui setelah jendela baru dibuka) - tambahkan lokasi bawaannya
REM secara langsung supaya tidak perlu menutup dan membuka ulang jendela ini.
set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
where bun >nul 2>nul
if errorlevel 1 (
  echo [X] Bun tidak terdeteksi meski proses pemasangan sudah dijalankan.
  echo     Tutup jendela ini, lalu jalankan ulang start-server.bat.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [!] Berkas .env belum ada, menyalin dari .env.example...
  copy /y ".env.example" ".env" >nul
  echo.
  echo [!] Notepad akan terbuka. Isi ADMIN_USERNAME dan ADMIN_PASSWORD,
  echo     simpan ^(Ctrl+S^), lalu tutup Notepad.
  echo.
  pause
  notepad ".env"
  echo.
  echo [!] Selesai mengisi .env. Jalankan ulang start-server.bat untuk menyalakan server.
  echo.
  pause
  exit /b 0
)

if not exist "node_modules" (
  echo [*] Pertama kali dijalankan - memasang dependensi ^(bisa beberapa menit^)...
  call bun install
  if errorlevel 1 (
    echo [X] Pemasangan dependensi gagal. Cek koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
)

set PORT=3000
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if /i "%%A"=="PORT" if not "%%B"=="" set PORT=%%B
)

echo [*] Memeriksa apakah server sudah berjalan di port !PORT!...
set SUDAH_JALAN=
for /f %%R in ('powershell -NoProfile -Command "(Test-NetConnection -ComputerName 127.0.0.1 -Port !PORT! -WarningAction SilentlyContinue -InformationLevel Quiet)"') do set SUDAH_JALAN=%%R

if /i "!SUDAH_JALAN!"=="True" (
  echo [*] Server sudah berjalan di port !PORT! ^(mungkin dinyalakan sebelumnya^) - langsung membuka browser.
  start "" "http://127.0.0.1:!PORT!"
) else (
  echo [*] Menjalankan server Tahfid Community di port !PORT!...
  start "Tahfid Community - SERVER (JANGAN DITUTUP)" cmd /k "bun run start"
  timeout /t 3 /nobreak >nul
  start "" "http://127.0.0.1:!PORT!"
)

echo.
echo ============================================================
echo Assalamu'alaikum, selamat datang di Tahfid Community!
echo  Server berjalan di JENDELA TERPISAH berjudul:
echo  "Tahfid Community - SERVER (JANGAN DITUTUP)"
echo.
echo  - JANGAN TUTUP jendela server itu selama aplikasi masih
echo    ingin dipakai guru/admin di sekolah.
echo  - Menutup jendela server = mematikan aplikasi untuk semua orang.
echo  - Jendela peluncur ini ^(yang sedang Anda lihat^) boleh ditutup.
echo ============================================================
echo.
pause
