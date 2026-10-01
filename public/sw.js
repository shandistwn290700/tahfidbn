// Service worker untuk mode PWA (Add to Home Screen di Android/iPhone).
//
// Sengaja TIDAK mencegat permintaan apa pun. Versi sebelumnya menampilkan halaman
// "Silakan hubungkan ke WiFi server" bila perpindahan halaman lebih dari 4 detik —
// berguna saat aplikasi hanya jalan di WiFi sekolah, tetapi di server publik justru
// memotong proses yang wajar lama (unggah foto massal, impor Excel) dan menampilkan
// galat palsu. Kini setiap permintaan langsung ditangani peramban seperti biasa.
//
// Berkas ini tetap ada supaya PWA yang sudah terpasang mendapat versi baru ini,
// dan supaya aplikasi tetap bisa dipasang ke layar utama.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Buang cache halaman offline milik versi lama.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
