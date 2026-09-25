// Peluncur desktop Tahfid Community -- ini aplikasi CLIENT, bukan server.
//
// Aplikasi ini menampilkan DUA jendela:
//   1. "main"        -- jendela utama, layar penuh tanpa bingkai (mode kios).
//                        Isinya (dist/index.html) mengurus semua logika di sisi
//                        JavaScript: menyimpan alamat server, memverifikasi
//                        server bisa dijangkau, lalu mengarahkan jendela ke
//                        sana -- persis pola yang sama dipakai di aplikasi
//                        Android (mobile-android/www/index.html).
//   2. "tombol_keluar" -- jendela kecil bulat melayang di pojok kanan bawah,
//                        SELALU memuat konten kita sendiri (dist/exit-button.html),
//                        bukan konten dari server. Ini sengaja dipisah dari
//                        jendela utama supaya bisa memanggil perintah native
//                        (keluar aplikasi) dengan aman -- konten dari server
//                        (yang alamatnya diisi bebas oleh pengguna) tidak
//                        pernah diberi akses itu.
//
// Server sungguhan (basis data, logika bisnis, dll) berjalan terpisah --
// lihat README.md/docs/DEPLOYMENT.md di root proyek. Aplikasi ini tidak
// pernah menjalankan atau menyimpan data apa pun sendiri.
//
// Karena jendela utama tidak punya tombol X (mode kios), ada dua cara keluar:
// kombinasi tombol Ctrl+Alt+Shift+Q (untuk yang hafal), atau tombol bulat
// merah melayang di pojok kanan bawah (untuk yang tidak hafal kombinasi tombol).
//
// Tombol itu TIDAK memakai window.confirm() bawaan browser -- di jendela sekecil
// ini, dialog bawaan itu dianchor melebihi batas jendela dan bisa terpotong di
// luar tepi layar (tombol OK/Batal-nya jadi tidak terklik sama sekali kalau
// tombol keluar diposisikan mepet ke pojok layar). Sebagai gantinya,
// exit-button.html menampilkan panel konfirmasi buatan sendiri, dan jendelanya
// diperbesar sementara (lewat perbesar_tombol_keluar/perkecil_tombol_keluar)
// supaya panel itu selalu muat penuh di dalam layar.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Windows memaksa lebar jendela minimum (SM_CXMIN, baku 136px di 96 DPI) walau
// decorations/resizable dimatikan. Kalau TOMBOL_UKURAN dibuat lebih kecil dari itu,
// Windows tetap melebarkan jendelanya jadi 136px tapi tingginya tidak ikut berubah --
// hasilnya bentuk lonjong, bukan bulat, dan bisa keluar dari tepi layar karena posisi
// dihitung memakai ukuran yang diminta, bukan ukuran sungguhan. Maka ukurannya dibuat
// persis 136 (persegi) supaya Windows tidak mengubahnya lagi.
const TOMBOL_UKURAN: f64 = 136.0;
const TOMBOL_MARGIN: f64 = 24.0;
const DIALOG_LEBAR: f64 = 320.0;
const DIALOG_TINGGI: f64 = 176.0;

fn posisi_kanan_bawah(app: &tauri::AppHandle, lebar: f64, tinggi: f64) -> tauri::Result<(f64, f64)> {
    let monitor = app
        .primary_monitor()?
        .expect("tidak menemukan monitor utama");
    let scale = monitor.scale_factor();
    let ukuran_layar = monitor.size().to_logical::<f64>(scale);

    let x = (ukuran_layar.width - lebar - TOMBOL_MARGIN).max(0.0);
    let y = (ukuran_layar.height - tinggi - TOMBOL_MARGIN).max(0.0);
    Ok((x, y))
}

#[tauri::command]
fn keluar_aplikasi(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn perbesar_tombol_keluar(app: tauri::AppHandle) -> tauri::Result<()> {
    let Some(jendela) = app.get_webview_window("tombol_keluar") else {
        return Ok(());
    };
    let (x, y) = posisi_kanan_bawah(&app, DIALOG_LEBAR, DIALOG_TINGGI)?;
    jendela.set_position(LogicalPosition::new(x, y))?;
    jendela.set_size(LogicalSize::new(DIALOG_LEBAR, DIALOG_TINGGI))?;
    Ok(())
}

#[tauri::command]
fn perkecil_tombol_keluar(app: tauri::AppHandle) -> tauri::Result<()> {
    let Some(jendela) = app.get_webview_window("tombol_keluar") else {
        return Ok(());
    };
    let (x, y) = posisi_kanan_bawah(&app, TOMBOL_UKURAN, TOMBOL_UKURAN)?;
    jendela.set_size(LogicalSize::new(TOMBOL_UKURAN, TOMBOL_UKURAN))?;
    jendela.set_position(LogicalPosition::new(x, y))?;
    Ok(())
}

fn buat_tombol_keluar(app: &tauri::AppHandle) -> tauri::Result<()> {
    let (x, y) = posisi_kanan_bawah(app, TOMBOL_UKURAN, TOMBOL_UKURAN)?;

    WebviewWindowBuilder::new(app, "tombol_keluar", WebviewUrl::App("exit-button.html".into()))
        .title("")
        .inner_size(TOMBOL_UKURAN, TOMBOL_UKURAN)
        .position(x, y)
        .always_on_top(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .build()?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            keluar_aplikasi,
            perbesar_tombol_keluar,
            perkecil_tombol_keluar
        ])
        .setup(|app| {
            let shortcut_keluar = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                Code::KeyQ,
            );

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app_handle, shortcut, event| {
                        if shortcut == &shortcut_keluar && event.state() == ShortcutState::Pressed
                        {
                            app_handle.exit(0);
                        }
                    })
                    .build(),
            )?;

            app.global_shortcut().register(shortcut_keluar)?;

            buat_tombol_keluar(&app.handle())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("galat saat menjalankan aplikasi Tahfid Community");
}
