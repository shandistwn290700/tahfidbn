import { Hono } from "hono";
import { db } from "../../db/connection.ts";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.ts";
import {
  createUser,
  updateUserPassword,
  countAdmins,
  deleteSessionsForUser,
} from "../../lib/session.ts";
import { listClasses, setTeacherClasses } from "../../lib/access.ts";
import { readInt, redirectWith } from "../../lib/http.ts";
import { UsersPage } from "../../views/pages/UsersPage.tsx";
import type { Env, TeachingSubject, User } from "../../types.ts";

const pengguna = new Hono<Env>();

pengguna.use("*", authMiddleware, adminMiddleware);

const BASE = "/administrasi/pengguna";
const MIN_PASSWORD = 8;

function toIdArray(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return raw.map((v) => parseInt(String(v), 10)).filter((v) => Number.isFinite(v));
}

/** Simpan penugasan kelas seorang guru untuk kedua jenis sekaligus, dari body form. */
function saveTeacherAssignments(userId: number, body: Record<string, unknown>) {
  setTeacherClasses(userId, toIdArray(body.class_ids_tahfid), "tahfid");
  setTeacherClasses(userId, toIdArray(body.class_ids_tilawati), "tilawati");
}

pengguna.get("/", (c) => {
  const user = c.get("user");

  const users = db
    .prepare("SELECT * FROM users ORDER BY role ASC, name COLLATE NOCASE ASC")
    .all() as User[];

  const rows = db
    .prepare("SELECT user_id, class_id, subject FROM class_teachers")
    .all() as { user_id: number; class_id: number; subject: TeachingSubject }[];

  const assignmentsTahfid: Record<number, number[]> = {};
  const assignmentsTilawati: Record<number, number[]> = {};
  for (const row of rows) {
    const target = row.subject === "tilawati" ? assignmentsTilawati : assignmentsTahfid;
    (target[row.user_id] ||= []).push(row.class_id);
  }

  return c.html(
    <UsersPage
      user={user}
      users={users}
      classes={listClasses()}
      assignmentsTahfid={assignmentsTahfid}
      assignmentsTilawati={assignmentsTilawati}
      adminCount={countAdmins()}
    />
  );
});

pengguna.post("/", async (c) => {
  const body = await c.req.parseBody({ all: true });
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const role = body.role === "admin" ? "admin" : "guru";

  if (!username || !password || !name) {
    return redirectWith(c, BASE, "error", "Nama, nama pengguna, dan password wajib diisi.");
  }
  if (password.length < MIN_PASSWORD) {
    return redirectWith(c, BASE, "error", `Password minimal ${MIN_PASSWORD} karakter.`);
  }

  try {
    const created = await createUser({ username, password, name, email: email || null, role });
    saveTeacherAssignments(created.id, body);
    return redirectWith(c, BASE, "success", `Akun untuk ${name} berhasil dibuat.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Akun gagal dibuat.";
    return redirectWith(c, BASE, "error", message);
  }
});

pengguna.post("/:id", async (c) => {
  const currentUser = c.get("user");
  const userId = readInt(c.req.param("id"), 0, { min: 0 });
  const body = await c.req.parseBody({ all: true });

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as User | null;
  if (!target) {
    return redirectWith(c, BASE, "error", "Pengguna tidak ditemukan.");
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const role = body.role === "admin" ? "admin" : "guru";

  if (!name) {
    return redirectWith(c, BASE, "error", "Nama wajib diisi.");
  }

  // Jangan sampai tidak tersisa satu pun admin yang bisa masuk.
  if (target.role === "admin" && role !== "admin" && countAdmins() <= 1) {
    return redirectWith(
      c,
      BASE,
      "error",
      "Peran tidak diubah: ini satu-satunya akun admin yang tersisa."
    );
  }

  db.prepare(
    "UPDATE users SET name = ?, email = ?, role = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, email || null, role, userId);

  saveTeacherAssignments(userId, body);

  // Perubahan peran harus langsung berlaku, bukan menunggu sesi lama kedaluwarsa.
  if (target.role !== role && userId !== currentUser.id) {
    deleteSessionsForUser(userId);
  }

  return redirectWith(c, BASE, "success", `Data ${name} berhasil diperbarui.`);
});

pengguna.post("/:id/password", async (c) => {
  const userId = readInt(c.req.param("id"), 0, { min: 0 });
  const body = await c.req.parseBody();
  const newPassword = String(body.password || "");

  const target = db.prepare("SELECT name FROM users WHERE id = ?").get(userId) as
    | { name: string }
    | null;

  if (!target) {
    return redirectWith(c, BASE, "error", "Pengguna tidak ditemukan.");
  }
  if (newPassword.length < MIN_PASSWORD) {
    return redirectWith(c, BASE, "error", `Password minimal ${MIN_PASSWORD} karakter.`);
  }

  await updateUserPassword(userId, newPassword);

  return redirectWith(
    c,
    BASE,
    "success",
    `Password ${target.name} berhasil diganti. Sesi lamanya otomatis keluar.`
  );
});

pengguna.post("/:id/hapus", (c) => {
  const currentUser = c.get("user");
  const userId = readInt(c.req.param("id"), 0, { min: 0 });

  if (userId === currentUser.id) {
    return redirectWith(c, BASE, "error", "Anda tidak dapat menghapus akun sendiri.");
  }

  const target = db.prepare("SELECT name, role FROM users WHERE id = ?").get(userId) as
    | { name: string; role: string }
    | null;

  if (!target) {
    return redirectWith(c, BASE, "error", "Pengguna tidak ditemukan.");
  }
  if (target.role === "admin" && countAdmins() <= 1) {
    return redirectWith(c, BASE, "error", "Ini satu-satunya akun admin, tidak bisa dihapus.");
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  return redirectWith(c, BASE, "success", `Akun ${target.name} telah dihapus.`);
});

export { pengguna as penggunaRoutes };
