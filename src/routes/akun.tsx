import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import { verifyCredentials, updateUserPassword } from "../lib/session.ts";
import { redirectWith } from "../lib/http.ts";
import { AccountPage } from "../views/pages/AccountPage.tsx";
import type { Env } from "../types.ts";

const akun = new Hono<Env>();

akun.use("*", authMiddleware);

const BASE = "/akun";
const MIN_PASSWORD = 8;

akun.get("/", (c) => {
  return c.html(<AccountPage user={c.get("user")} />);
});

akun.post("/password", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const current = String(body.current_password || "");
  const next = String(body.new_password || "");
  const confirm = String(body.confirm_password || "");

  if (next.length < MIN_PASSWORD) {
    return redirectWith(c, BASE, "error", `Password baru minimal ${MIN_PASSWORD} karakter.`);
  }
  if (next !== confirm) {
    return redirectWith(c, BASE, "error", "Konfirmasi password tidak cocok.");
  }

  const valid = await verifyCredentials(user.username, current);
  if (!valid) {
    return redirectWith(c, BASE, "error", "Password lama tidak benar.");
  }

  // Seluruh sesi ikut dikeluarkan, termasuk sesi ini, jadi pengguna login ulang.
  await updateUserPassword(user.id, next);

  return c.redirect(
    "/login?success=" + encodeURIComponent("Password berhasil diganti. Silakan masuk kembali.")
  );
});

export { akun as akunRoutes };
