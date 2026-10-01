import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { getSessionUser } from "../lib/session.ts";
import type { Env } from "../types.ts";
import { audit } from "../lib/logger.ts";

/** Wajib login. Menaruh objek pengguna pada konteks permintaan. */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const sessionId = getCookie(c, "session");
  if (!sessionId) {
    return c.redirect("/login");
  }

  const user = getSessionUser(sessionId);
  if (!user) {
    return c.redirect("/login");
  }

  c.set("user", user);
  await next();
});

/** Hanya admin. Guru dialihkan kembali ke papan peringkat. */
export const adminMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get("user");
  if (user.role !== "admin") {
    audit(c, "akses.ditolak", { path: c.req.path, method: c.req.method }, "warn");
    return c.redirect("/leaderboard?error=" + encodeURIComponent("Halaman ini khusus admin."));
  }
  await next();
});
