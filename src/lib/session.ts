import { db } from "../db/connection.ts";
import type { User, UserRole } from "../types.ts";

export function createSession(userId: number): string {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    id,
    userId,
    expiresAt
  );

  return id;
}

export function getSessionUser(sessionId: string): User | null {
  const row = db
    .prepare(
      `SELECT u.* FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > datetime('now')`
    )
    .get(sessionId) as User | null;

  return row;
}

export function deleteSession(sessionId: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/** Dipakai saat peran atau password berubah, supaya sesi lama tidak menyimpan hak akses lama. */
export function deleteSessionsForUser(userId: number) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// Bun menyediakan bcrypt bawaan, tidak perlu dependensi tambahan.
export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

function normaliseRole(role?: string): UserRole {
  return role === "admin" ? "admin" : "guru";
}

/**
 * Membuat akun admin atau guru. Tidak ada pendaftaran mandiri —
 * seluruh akun dibuat dari panel Administrasi oleh admin.
 */
export async function createUser(params: {
  username: string;
  password: string;
  name: string;
  email?: string | null;
  role?: string;
}): Promise<User> {
  const username = params.username.trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error(
      "Nama pengguna hanya boleh berisi huruf, angka, titik, garis bawah, atau strip (3–32 karakter)."
    );
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    throw new Error("Nama pengguna sudah dipakai.");
  }

  const passwordHash = await hashPassword(params.password);

  const result = db
    .prepare(
      "INSERT INTO users (username, password_hash, email, name, role) VALUES (?, ?, ?, ?, ?)"
    )
    .run(username, passwordHash, params.email || null, params.name, normaliseRole(params.role));

  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as User;
}

// Dihitung sekali saat dibutuhkan pertama kali (bukan string tetap yang rawan
// salah format/panjang) — dipakai untuk menyamakan lama respons saat username
// tidak ditemukan, supaya tidak membocorkan apakah nama pengguna terdaftar.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("kata-sandi-yang-tidak-akan-pernah-cocok");
  }
  return dummyHashPromise;
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<User | null> {
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username.trim().toLowerCase()) as User | null;

  if (!user) {
    // Tetap jalankan verifikasi palsu supaya lama respons tidak membocorkan
    // apakah nama pengguna terdaftar atau tidak.
    await verifyPassword(password, await getDummyHash());
    return null;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  return user;
}

export async function updateUserPassword(userId: number, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(passwordHash, userId);
  deleteSessionsForUser(userId);
}

export function countAdmins(): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as {
    c: number;
  };
  return row.c;
}

/**
 * Dijalankan sekali saat aplikasi start. Bila belum ada akun sama sekali,
 * akun admin pertama dibuat dari ADMIN_USERNAME / ADMIN_PASSWORD di berkas .env.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const count = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (count.c > 0) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn(
      "[start] Belum ada akun apa pun dan ADMIN_PASSWORD belum diisi di .env — " +
        "isi ADMIN_USERNAME dan ADMIN_PASSWORD lalu jalankan ulang untuk membuat akun admin pertama."
    );
    return;
  }

  await createUser({ username, password, name: "Administrator", role: "admin" });
  console.log(
    `[start] Akun admin awal "${username}" dibuat. Ganti passwordnya setelah login pertama.`
  );
}
