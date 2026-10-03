import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { verifyCredentials, createSession, deleteSession, getSessionUser } from "../lib/session.ts";
import { homePath } from "../lib/http.ts";
import { db } from "../db/connection.ts";
import { audit, clientIp } from "../lib/logger.ts";

const auth = new Hono();

/**
 * Pembatas percobaan masuk di memori, dua lapis yang saling melengkapi:
 *  - per nama pengguna: melindungi satu akun dari tebakan beruntun.
 *  - per alamat IP: memperlambat bot yang menyapu banyak nama pengguna dari
 *    satu sumber. Sengaja JAUH lebih longgar karena beberapa guru sah bisa
 *    berbagi satu IP — WiFi sekolah, atau CGNAT operator seluler (data
 *    pribadi) — jadi batasnya tidak boleh mengunci pengguna yang sejaringan.
 *
 * Penyimpanan per proses; cukup untuk satu instance. Bila kelak diskalakan ke
 * banyak proses, pindahkan ke store bersama (mis. Redis).
 */
type Bucket = { count: number; until: number };

const byUsername = new Map<string, Bucket>();
const byIp = new Map<string, Bucket>();

const USER_MAX = 8;
const USER_LOCK_MS = 5 * 60 * 1000; // 5 menit

const IP_MAX = 30; // longgar: menampung beberapa guru di balik satu IP (NAT/CGNAT)
const IP_LOCK_MS = 10 * 60 * 1000; // 10 menit

/** Sisa detik penguncian untuk sebuah kunci; 0 bila belum terkunci atau sudah lewat. */
function lockedFor(store: Map<string, Bucket>, key: string, max: number): number {
  const record = store.get(key);
  if (!record) return 0;
  if (Date.now() > record.until) {
    store.delete(key);
    return 0;
  }
  return record.count >= max ? Math.ceil((record.until - Date.now()) / 1000) : 0;
}

/** Mencatat satu kegagalan; jendela penguncian diperpanjang setiap kegagalan baru. */
function recordFailure(store: Map<string, Bucket>, key: string, lockMs: number) {
  const record = store.get(key);
  if (record && Date.now() <= record.until) {
    record.count += 1;
    record.until = Date.now() + lockMs;
  } else {
    store.set(key, { count: 1, until: Date.now() + lockMs });
  }
}

/**
 * Nama pengguna yang dicatat untuk login gagal. Nama yang tidak terdaftar tidak ditulis
 * apa adanya — orang kadang tak sengaja mengetik password di kolom nama pengguna.
 */
function loggedUsername(key: string): string {
  const known = db.prepare("SELECT 1 FROM users WHERE username = ?").get(key);
  return known ? key : "(tidak terdaftar)";
}

function gagal(pesan: string) {
  return `/login?error=${encodeURIComponent(pesan)}`;
}

auth.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return c.redirect(gagal("Nama pengguna dan password wajib diisi."));
  }

  const key = username.toLowerCase();
  const ip = clientIp(c);

  // Terkunci bila SALAH SATU lapis melewati batasnya; pakai sisa waktu terlama.
  const sisaUser = lockedFor(byUsername, key, USER_MAX);
  const sisaIp = ip ? lockedFor(byIp, ip, IP_MAX) : 0;
  const sisaDetik = Math.max(sisaUser, sisaIp);
  if (sisaDetik > 0) {
    audit(
      c,
      "auth.login_diblokir",
      { username: loggedUsername(key), lapis: sisaIp > sisaUser ? "ip" : "username" },
      "warn"
    );
    return c.redirect(
      gagal(
        `Terlalu banyak percobaan masuk. Silakan coba lagi dalam ${Math.ceil(sisaDetik / 60)} menit.`
      )
    );
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    recordFailure(byUsername, key, USER_LOCK_MS);
    if (ip) recordFailure(byIp, ip, IP_LOCK_MS);
    audit(c, "auth.login_gagal", { username: loggedUsername(key) }, "warn");
    return c.redirect(gagal("Nama pengguna atau password salah."));
  }

  // Login berhasil: bersihkan hitungan akun ini. Hitungan per-IP sengaja TIDAK
  // dihapus, supaya bot tak bisa mereset limitnya dengan menyelipkan satu login sah.
  byUsername.delete(key);
  const sessionId = createSession(user.id);
  audit(c, "auth.login_berhasil", { userId: user.id, username: user.username });

  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict: cookie sesi tidak ikut terkirim pada navigasi lintas-situs,
    // menutup celah CSRF sebagai pertahanan berlapis (login diproses lewat
    // form satu-situs, jadi tidak ada dampak UX). Konsekuensi kecil: membuka
    // aplikasi lewat tautan dari situs/email lain akan tampil belum masuk
    // sampai navigasi berikutnya di dalam aplikasi.
    sameSite: "Strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.redirect(homePath(user.role));
});

auth.post("/logout", (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    const user = getSessionUser(sessionId);
    if (user) audit(c, "auth.logout", { userId: user.id, username: user.username });
    deleteSession(sessionId);
  }
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/login?success=" + encodeURIComponent("Anda telah keluar dari aplikasi."));
});

export { auth as authRoutes };
