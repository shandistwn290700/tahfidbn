import { appendFileSync, chmodSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

/**
 * Log server — hanya untuk admin server, tidak pernah dikirim ke peramban.
 *
 * Dua saluran, masing-masing satu berkas JSON Lines per hari di LOG_DIR:
 * - `app-YYYY-MM-DD.log`   galat dan kejadian sistem (stack trace, respons API Canva, migrasi)
 * - `audit-YYYY-MM-DD.log` jejak keamanan: login, perubahan akun, cadangan, koneksi Canva
 *
 * Pengguna hanya melihat pesan aman (lihat `src/lib/errors.ts`) beserta kode galat
 * yang bisa dicari di berkas ini, mis. `grep 3f9a1c2e logs/app-*.log`.
 */

/** Dibaca setiap kali dipakai, bukan saat modul dimuat, supaya LOG_DIR dari .env/tes selalu berlaku. */
export function logDir(): string {
  return process.env.LOG_DIR || join(import.meta.dir, "..", "..", "logs");
}

function retentionDays(): number {
  return Math.max(1, parseInt(process.env.LOG_RETENTION_DAYS || "90", 10) || 90);
}

type Level = "info" | "warn" | "error";
type Channel = "app" | "audit";
type Fields = Record<string, unknown>;

// Nama kolom yang nilainya tidak boleh pernah tertulis ke log, sekalipun di server.
const SENSITIVE_KEY = /pass|secret|token|authorization|cookie|verifier|^code$|session/i;
const SENSITIVE_TEXT = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g;
const HIDDEN = "[disembunyikan]";

let readyDir: string | null = null;
let brokenDir: string | null = null;

/** Membuat folder log (mode 700) sekali, lalu mengembalikan jalurnya; null bila gagal. */
function ensureDir(): string | null {
  const dir = logDir();
  if (readyDir === dir) return dir;
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    readyDir = dir;
    return dir;
  } catch (err) {
    if (brokenDir !== dir) {
      brokenDir = dir;
      console.error(`[log] Folder log ${dir} tidak dapat dibuat — log hanya tampil di konsol.`, err);
    }
    return null;
  }
}

function scrubText(text: string): string {
  return text.replace(SENSITIVE_TEXT, `$1 ${HIDDEN}`);
}

/** Menyalin nilai untuk log sambil menyembunyikan kolom rahasia. Galat diubah jadi objek biasa. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[terlalu dalam]";
  if (typeof value === "string") return scrubText(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubText(value.message),
      stack: value.stack ? scrubText(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Fields = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? HIDDEN : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

function write(channel: Channel, level: Level, event: string, fields: Fields): void {
  const now = new Date();
  const entry = { time: now.toISOString(), level, event, ...(redact(fields) as Fields) };
  const line = JSON.stringify(entry);

  const dir = ensureDir();
  if (dir) {
    const file = join(dir, `${channel}-${now.toISOString().slice(0, 10)}.log`);
    try {
      appendFileSync(file, line + "\n", { mode: 0o600 });
    } catch (err) {
      console.error(`[log] Gagal menulis ${file}:`, err);
    }
  }

  // Konsol (pm2 logs) hanya menerima ringkasan satu baris; detail lengkap ada di berkas.
  const summary = typeof fields.message === "string" ? ` ${scrubText(fields.message)}` : "";
  const ref = typeof fields.ref === "string" ? ` [kode ${fields.ref}]` : "";
  const text = `[${channel}] ${event}${summary}${ref}`;
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

/** Kode pendek untuk menautkan pesan galat di layar dengan baris di log server. */
export function newRef(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export const log = {
  info(event: string, fields: Fields = {}): void {
    write("app", "info", event, fields);
  },
  warn(event: string, fields: Fields = {}): void {
    write("app", "warn", event, fields);
  },
  /** Mencatat galat lengkap (beserta stack) dan mengembalikan kode rujukannya. */
  error(event: string, err: unknown, fields: Fields = {}): string {
    const ref = newRef();
    const message = err instanceof Error ? err.message : String(err);
    write("app", "error", event, { ref, message, error: err, ...fields });
    return ref;
  },
};

/**
 * IP klien. Header X-Real-IP / X-Forwarded-For hanya dipercaya bila koneksi datang dari
 * mesin ini sendiri (nginx); dari luar, header itu bisa dipalsukan siapa saja.
 */
export function clientIp(c: Context): string | null {
  let remote: string | undefined;
  try {
    remote = getConnInfo(c).remote.address;
  } catch {
    remote = undefined;
  }

  const fromProxy = !remote || remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  if (fromProxy) {
    const forwarded =
      c.req.header("x-real-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return remote ?? null;
}

/** Jejak keamanan: siapa melakukan apa, dari mana. Tidak pernah berisi password atau token. */
export function audit(c: Context | null, event: string, fields: Fields = {}, level: Level = "info"): void {
  const context: Fields = {};
  if (c) {
    const user = c.get("user") as { id: number; username: string } | undefined;
    if (user) context.actor = { id: user.id, username: user.username };
    context.ip = clientIp(c);
    context.ua = c.req.header("user-agent")?.slice(0, 200);
  }
  write("audit", level, event, { ...context, ...fields });
}

/** Menghapus berkas log yang lebih tua dari LOG_RETENTION_DAYS (bawaan 90 hari). */
export function pruneOldLogs(): void {
  const dir = ensureDir();
  if (!dir) return;
  const cutoff = new Date(Date.now() - retentionDays() * 86_400_000).toISOString().slice(0, 10);
  let removed = 0;

  for (const name of readdirSync(dir)) {
    const match = /^(?:app|audit)-(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
    if (match && match[1]! < cutoff) {
      try {
        unlinkSync(join(dir, name));
        removed++;
      } catch {
        /* abaikan — dicoba lagi pada pembersihan berikutnya */
      }
    }
  }
  if (removed > 0) log.info("log.dibersihkan", { message: `${removed} berkas log lama dihapus.` });
}

/** Dipanggil sekali saat server mulai: bersihkan sekarang, lalu setiap hari. */
export function startLogMaintenance(): void {
  pruneOldLogs();
  setInterval(pruneOldLogs, 86_400_000).unref?.();
}
