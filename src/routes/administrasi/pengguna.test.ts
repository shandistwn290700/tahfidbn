import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Basis data di memori dan folder log sementara, harus diatur sebelum modul dimuat.
process.env.DB_PATH = ":memory:";
process.env.LOG_DIR = mkdtempSync(join(tmpdir(), "ngaji-log-pengguna-"));
const { db } = await import("../../db/connection.ts");
const { initializeDatabase } = await import("../../db/schema.ts");
const { createSession, verifyCredentials } = await import("../../lib/session.ts");
const { penggunaRoutes } = await import("./pengguna.tsx");

initializeDatabase();

function insertUser(id: number, username: string, role: string, superadmin = 0) {
  db.prepare(
    `INSERT INTO users (id, username, password_hash, name, role, is_superadmin)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, username, Bun.password.hashSync("password-lama", { algorithm: "bcrypt", cost: 4 }), username, role, superadmin);
}

function post(sessionUserId: number, path: string, fields: Record<string, string> = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return penggunaRoutes.request(path, {
    method: "POST",
    body,
    headers: { cookie: `session=${createSession(sessionUserId)}` },
  });
}

function userRow(id: number) {
  return db.prepare("SELECT name, role, is_superadmin FROM users WHERE id = ?").get(id) as
    | { name: string; role: string; is_superadmin: number }
    | null;
}

const SUPER = 1;
const ADMIN = 2;
const GURU = 3;

beforeEach(() => {
  db.exec("DELETE FROM sessions; DELETE FROM users;");
  insertUser(SUPER, "admin", "admin", 1);
  insertUser(ADMIN, "admin2", "admin");
  insertUser(GURU, "guru1", "guru");
});

describe("superadmin dilindungi dari admin lain", () => {
  test("admin tidak bisa menghapus superadmin", async () => {
    const res = await post(ADMIN, `/${SUPER}/hapus`);
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get("location")!)).toContain("tidak dapat dihapus");
    expect(userRow(SUPER)).not.toBeNull();
  });

  test("admin tidak bisa menurunkan peran atau mengubah data superadmin", async () => {
    await post(ADMIN, `/${SUPER}`, { name: "Diganti", role: "guru" });
    expect(userRow(SUPER)).toMatchObject({ name: "admin", role: "admin", is_superadmin: 1 });
  });

  test("admin tidak bisa mereset password superadmin", async () => {
    await post(ADMIN, `/${SUPER}/password`, { password: "password-baru-123" });
    expect(await verifyCredentials("admin", "password-baru-123")).toBeNull();
    expect(await verifyCredentials("admin", "password-lama")).not.toBeNull();
  });

  test("superadmin mengubah datanya sendiri, tetapi perannya tetap admin", async () => {
    await post(SUPER, `/${SUPER}`, { name: "Pemilik", role: "guru" });
    expect(userRow(SUPER)).toMatchObject({ name: "Pemilik", role: "admin", is_superadmin: 1 });
  });

  test("superadmin tetap bisa menghapus admin biasa", async () => {
    await post(SUPER, `/${ADMIN}/hapus`);
    expect(userRow(ADMIN)).toBeNull();
  });

  test("admin biasa tetap bisa mengelola guru seperti sebelumnya", async () => {
    await post(ADMIN, `/${GURU}`, { name: "Guru Baru", role: "guru" });
    expect(userRow(GURU)).toMatchObject({ name: "Guru Baru" });
    await post(ADMIN, `/${GURU}/hapus`);
    expect(userRow(GURU)).toBeNull();
  });
});
