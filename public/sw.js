// Service worker untuk mode PWA (Add to Home Screen di Android/iPhone).
//
// Tujuannya cuma satu: kalau HP tidak bisa menjangkau server (biasanya karena
// belum terhubung ke WiFi sekolah yang sama), tampilkan halaman "Silakan
// hubungkan ke wifi server" alih-alih halaman galat bawaan peramban.
// Tidak ada caching penuh ala aplikasi offline — aplikasi ini memang perlu
// selalu bicara ke server (data hafalan live), jadi service worker ini
// sengaja dibuat seminimal mungkin.

const CACHE_NAME = "tahfid-offline-v1";
const OFFLINE_URL = "/static/offline.html";
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener("fetch", (event) => {
  // Hanya jaga navigasi halaman (mis. membuka/menyegarkan aplikasi) — permintaan
  // lain (gambar, skrip, dll) dibiarkan lewat jalur normal supaya tidak ikut
  // menyembunyikan galat yang sebenarnya relevan untuk aplikasi berjalan.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    withTimeout(fetch(event.request), NETWORK_TIMEOUT_MS).catch(() =>
      caches.match(OFFLINE_URL)
    )
  );
});
