// Peluncur desktop Tahfid Community -- ini aplikasi CLIENT, bukan server.
//
// Aplikasi ini cuma menampilkan satu jendela WebView. Isinya (dist/index.html)
// yang mengurus semua logikanya di sisi JavaScript: menyimpan alamat server
// yang diisi pengguna, memverifikasi server itu bisa dijangkau, lalu
// mengarahkan jendela ke alamat tersebut -- persis pola yang sama dipakai di
// aplikasi Android (mobile-android/www/index.html).
//
// Server sungguhan (basis data, logika bisnis, dll) berjalan terpisah --
// lihat README.md/docs/DEPLOYMENT.md di root proyek. Aplikasi ini tidak
// pernah menjalankan atau menyimpan data apa pun sendiri.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("galat saat menjalankan aplikasi Tahfid Community");
}
