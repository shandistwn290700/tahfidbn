import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { verifyCredentials, createSession, deleteSession } from "../lib/session.ts";

const auth = new Hono();

/**
 * Pembatas percobaan masuk sederhana per nama pengguna, disimpan di memori.
 * Cukup untuk memperlambat percobaan menebak password di jaringan sekolah.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 5 * 60 * 1000;

function checkThrottle(key: string): number {
  const record = attempts.get(key);
  if (!record) return 0;
  if (Date.now() > record.until) {
    attempts.delete(key);
    return 0;
  }
  return record.count >= MAX_ATTEMPTS ? Math.ceil((record.until - Date.now()) / 1000) : 0;
}

function recordFailure(key: string) {
  const record = attempts.get(key);
  if (record && Date.now() <= record.until) {
    record.count += 1;
    record.until = Date.now() + LOCK_MS;
  } else {
    attempts.set(key, { count: 1, until: Date.now() + LOCK_MS });
  }
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
  const sisaDetik = checkThrottle(key);
  if (sisaDetik > 0) {
    return c.redirect(
      gagal(
        `Terlalu banyak percobaan masuk. Silakan coba lagi dalam ${Math.ceil(sisaDetik / 60)} menit.`
      )
    );
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    recordFailure(key);
    return c.redirect(gagal("Nama pengguna atau password salah."));
  }

  attempts.delete(key);
  const sessionId = createSession(user.id);

  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.redirect("/leaderboard");
});

auth.post("/logout", (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) deleteSession(sessionId);
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/login?success=" + encodeURIComponent("Anda telah keluar dari aplikasi."));
});

export { auth as authRoutes };
