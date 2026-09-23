import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { db, dbPath, reconnectDatabase } from "../db/connection.ts";
import { initializeDatabase } from "../db/schema.ts";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");

/** Tabel minimal yang wajib ada agar berkas dianggap basis data aplikasi ini. */
const REQUIRED_TABLES = ["users", "students", "classes", "progress_entries"];

const SQLITE_HEADER = "SQLite format 3\0";

/** Berkas cadangan otomatis (dari migrasi) maupun manual berbagi pola nama ini. */
const BACKUP_FILENAME_PATTERN = /^ngaji\.(backup|cadangan)-.+\.db$/;

const MAX_RESTORE_BYTES = 200 * 1024 * 1024; // 200MB — jauh di atas ukuran wajar basis data metadata

export interface BackupFileInfo {
  filename: string;
  size: number;
  modifiedAt: string;
}

/** Presisi detik saja bisa bentrok bila diklik dua kali dengan cepat, jadi ditambah acakan singkat. */
function timestamp(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${suffix}`;
}

function isBackupFilename(name: string): boolean {
  return BACKUP_FILENAME_PATTERN.test(name);
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** Ukuran dan waktu perubahan terakhir berkas basis data yang sedang dipakai. */
export function getCurrentDatabaseInfo(): { size: number; modifiedAt: string } {
  const stat = statSync(dbPath);
  return { size: stat.size, modifiedAt: stat.mtime.toISOString() };
}

/** Seluruh cadangan yang ada di folder data/, baik otomatis (migrasi) maupun manual. */
export function listBackupFiles(): BackupFileInfo[] {
  if (!existsSync(DATA_DIR)) return [];

  return readdirSync(DATA_DIR)
    .filter(isBackupFilename)
    .map((filename) => {
      const stat = statSync(join(DATA_DIR, filename));
      return { filename, size: stat.size, modifiedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

/**
 * Membuat cadangan baru dari basis data yang sedang berjalan. VACUUM INTO
 * menghasilkan salinan yang konsisten meskipun mode WAL aktif dan basis data
 * sedang dipakai — cara yang sama dipakai migrate.ts sebelum mengubah struktur.
 */
export function createBackupSnapshot(label: string): BackupFileInfo {
  ensureDataDir();

  const filename = `ngaji.cadangan-${label}-${timestamp()}.db`;
  const target = join(DATA_DIR, filename);

  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  const stat = statSync(target);
  return { filename, size: stat.size, modifiedAt: stat.mtime.toISOString() };
}

/**
 * Path berkas cadangan yang aman untuk diunduh berdasarkan nama saja.
 * Menolak nama yang tidak mengikuti pola cadangan (mencegah pembacaan
 * berkas lain di luar folder data lewat nama yang direkayasa).
 */
export function resolveBackupPath(filename: string): string | null {
  if (!isBackupFilename(filename)) return null;
  const target = join(DATA_DIR, filename);
  if (!existsSync(target)) return null;
  return target;
}

/**
 * Memeriksa bahwa berkas yang diunggah benar-benar basis data SQLite dari
 * aplikasi ini dan tidak rusak, sebelum dipakai menimpa data yang berjalan.
 */
function validateDatabaseFile(buffer: Uint8Array): { ok: true } | { ok: false; error: string } {
  if (buffer.byteLength < 100) {
    return { ok: false, error: "Berkas terlalu kecil untuk menjadi basis data yang sah." };
  }

  const header = Buffer.from(buffer.slice(0, 16)).toString("latin1");
  if (header !== SQLITE_HEADER) {
    return { ok: false, error: "Berkas bukan basis data SQLite yang sah." };
  }

  ensureDataDir();
  const tempPath = join(DATA_DIR, `.validasi-pulihkan-${Date.now()}.db`);
  writeFileSync(tempPath, buffer);

  let check: Database | null = null;
  try {
    check = new Database(tempPath);

    const integrity = check.prepare("PRAGMA integrity_check").get() as
      | { integrity_check: string }
      | null;
    if (!integrity || integrity.integrity_check !== "ok") {
      return { ok: false, error: "Berkas basis data rusak (gagal pemeriksaan integritas)." };
    }

    const tables = new Set(
      (
        check.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string;
        }[]
      ).map((row) => row.name)
    );
    const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Berkas ini bukan basis data Tahfiz Community (tabel ${missing.join(", ")} tidak ditemukan).`,
      };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Berkas tidak dapat dibuka sebagai basis data.";
    return { ok: false, error: message };
  } finally {
    check?.close();
    try {
      unlinkSync(tempPath);
    } catch {
      /* abaikan — bukan hal fatal jika berkas sementara gagal terhapus */
    }
  }
}

/** Menghapus satu berkas cadangan dari folder data/. Mengembalikan false bila nama tidak sah/tidak ada. */
export function deleteBackupFile(filename: string): boolean {
  const path = resolveBackupPath(filename);
  if (!path) return false;
  unlinkSync(path);
  return true;
}

export type RestoreResult =
  | { ok: true; safetyBackup: string }
  | { ok: false; error: string };

/**
 * Menimpa basis data yang sedang berjalan dengan berkas yang diunggah.
 *
 * Urutan yang dijaga demi keamanan data:
 * 1. Validasi berkas (format SQLite sah, tidak rusak, tabel inti ada).
 * 2. Cadangkan basis data saat ini lebih dulu — bila ternyata berkas yang
 *    dipulihkan salah, data lama tetap bisa diambil kembali.
 * 3. Tutup koneksi, timpa berkas (termasuk sisa -wal/-shm agar tidak
 *    tercampur dengan isi lama), lalu sambungkan ulang dari berkas baru.
 * 4. Jalankan initializeDatabase() supaya migrasi/skema terbaru tetap
 *    diterapkan meski cadangan berasal dari versi aplikasi yang lebih lama.
 */
export function restoreFromUpload(buffer: Uint8Array): RestoreResult {
  if (buffer.byteLength > MAX_RESTORE_BYTES) {
    return { ok: false, error: "Ukuran berkas melebihi batas 200MB." };
  }

  const validation = validateDatabaseFile(buffer);
  if (!validation.ok) return validation;

  const safety = createBackupSnapshot("sebelum-pulihkan");

  db.close();

  for (const suffix of ["", "-wal", "-shm"]) {
    const path = dbPath + suffix;
    if (existsSync(path)) unlinkSync(path);
  }

  writeFileSync(dbPath, buffer);
  reconnectDatabase();
  initializeDatabase();

  return { ok: true, safetyBackup: safety.filename };
}
