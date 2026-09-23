import { existsSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { serveStatic } from "hono/bun";
import { initializeDatabase } from "./db/schema.ts";
import { getSessionUser, cleanExpiredSessions, ensureDefaultAdmin } from "./lib/session.ts";
import { authRoutes } from "./routes/auth.ts";
import { leaderboardRoutes } from "./routes/leaderboard.tsx";
import { progressRoutes } from "./routes/progress.tsx";
import { tilawatiRoutes } from "./routes/tilawati.tsx";
import { laporanRoutes } from "./routes/laporan.tsx";
import { quranRoutes } from "./routes/quran.tsx";
import { akunRoutes } from "./routes/akun.tsx";
import { kelasRoutes } from "./routes/administrasi/kelas.tsx";
import { siswaRoutes } from "./routes/administrasi/siswa.tsx";
import { penggunaRoutes } from "./routes/administrasi/pengguna.tsx";
import { pengaturanRoutes } from "./routes/administrasi/pengaturan.tsx";
import "./lib/photos.ts";
import { LoginPage } from "./views/pages/LoginPage.tsx";
import { Layout } from "./views/Layout.tsx";
import type { Env } from "./types.ts";
import { getSiteName } from "./lib/settings.ts";

// Berkas gaya hasil build wajib ada, kalau tidak seluruh tampilan tampil polos.
if (!existsSync(join(import.meta.dir, "..", "public", "app.css"))) {
  console.warn(
    "[start] public/app.css belum ada — tampilan akan tampil tanpa gaya. " +
      "Jalankan: bun run build:css"
  );
}

// Menyiapkan tabel, menjalankan migrasi, lalu merapikan sesi kedaluwarsa.
initializeDatabase();
cleanExpiredSessions();
await ensureDefaultAdmin();

const app = new Hono<Env>();

// Berkas statis (Tailwind hasil build dan SweetAlert2) dilayani dari server ini
// sendiri agar aplikasi tetap utuh tanpa koneksi internet.
app.use(
  "/static/*",
  serveStatic({
    root: "./public",
    rewriteRequestPath: (path) => path.replace(/^\/static/, ""),
  })
);

// Foto siswa hasil unggah massal disimpan di data/photos dan dilayani dari sini.
app.use(
  "/siswa-foto/*",
  serveStatic({
    root: "./data/photos",
    rewriteRequestPath: (path) => path.replace(/^\/siswa-foto/, ""),
  })
);

// Service worker (mode PWA) wajib dilayani dari root, bukan /static/, supaya
// cakupannya (scope) mencakup seluruh aplikasi — service worker tidak bisa
// mengendalikan halaman di luar direktori tempat skripnya sendiri disajikan.
app.get("/sw.js", serveStatic({ path: "./public/sw.js" }));

app.get("/", (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId && getSessionUser(sessionId)) {
    return c.redirect("/leaderboard");
  }
  return c.redirect("/login");
});

app.get("/login", (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId && getSessionUser(sessionId)) {
    return c.redirect("/leaderboard");
  }
  return c.html(<LoginPage error={c.req.query("error")} success={c.req.query("success")} />);
});

app.route("/auth", authRoutes);
app.route("/leaderboard", leaderboardRoutes);
app.route("/progress", progressRoutes);
app.route("/progress/tilawati", tilawatiRoutes);
app.route("/laporan", laporanRoutes);
app.route("/quran", quranRoutes);
app.route("/akun", akunRoutes);
app.route("/administrasi/kelas", kelasRoutes);
app.route("/administrasi/siswa", siswaRoutes);
app.route("/administrasi/pengguna", penggunaRoutes);
app.route("/administrasi/pengaturan", pengaturanRoutes);

// Membuka /administrasi langsung diarahkan ke submenu pertama.
app.get("/administrasi", (c) => c.redirect("/administrasi/kelas"));

app.notFound((c) =>
  c.html(
    <Layout title={`Halaman Tidak Ditemukan - ${getSiteName()}`}>
      <div class="flex-1 flex items-center justify-center px-6">
        <div class="text-center">
          <h1 class="text-6xl font-black text-text-secondary mb-4">404</h1>
          <p class="text-text-secondary mb-2 text-lg font-semibold">Halaman tidak ditemukan</p>
          <p class="text-text-secondary mb-6 text-sm">
            Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan.
          </p>
          <a href="/" class="text-primary font-bold hover:underline">
            Kembali ke Beranda
          </a>
        </div>
      </div>
    </Layout>,
    404
  )
);

app.onError((err, c) => {
  console.error("[galat]", err);
  return c.html(
    <Layout title={`Terjadi Kesalahan - ${getSiteName()}`}>
      <div class="flex-1 flex items-center justify-center px-6">
        <div class="text-center">
          <h1 class="text-6xl font-black text-text-secondary mb-4">500</h1>
          <p class="text-text-secondary mb-2 text-lg font-semibold">Terjadi kesalahan</p>
          <p class="text-text-secondary mb-6 text-sm">
            Sistem gagal memproses permintaan Anda. Silakan coba lagi beberapa saat lagi.
          </p>
          <a href="/" class="text-primary font-bold hover:underline">
            Kembali ke Beranda
          </a>
        </div>
      </div>
    </Layout>,
    500
  );
});

const port = parseInt(process.env.PORT || "3000", 10);
console.log(`${getSiteName()} berjalan di http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  // Default Bun.serve() memutus koneksi yang idle terlalu singkat untuk proses
  // yang menunggu API eksternal lama (mis. autofill + export Canva bisa
  // memakan puluhan detik tanpa ada data terkirim ke klien selama itu).
  // 255 adalah nilai maksimum yang diterima Bun untuk idleTimeout — dipakai
  // penuh karena /laporan/kelas/:classId/canva memproses satu kelas siswa
  // secara berurutan lewat Canva dan bisa mendekati batas ini untuk kelas besar.
  idleTimeout: 255,
};
