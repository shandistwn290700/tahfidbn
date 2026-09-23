import { existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "./connection.ts";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");

function tableExists(name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | null;
  return Boolean(row);
}

function columnNames(table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

/**
 * Menyimpan salinan basis data sebelum perubahan struktur dijalankan.
 * VACUUM INTO menghasilkan snapshot yang konsisten meskipun mode WAL aktif,
 * jadi lebih aman daripada menyalin berkas mentah.
 */
function backupDatabase(label: string): string | null {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const target = join(DATA_DIR, `ngaji.backup-${label}-${stamp}.db`);

  if (existsSync(target)) return target;

  try {
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    console.log(`[migrasi] Cadangan basis data dibuat: ${target}`);
    return target;
  } catch (err) {
    console.warn("[migrasi] Gagal membuat cadangan basis data:", err);
    return null;
  }
}

/**
 * Struktur lama menautkan hafalan ke akun pengguna (user_id). Pada struktur
 * baru hafalan milik siswa, dan siswa bukan akun yang bisa login. Setiap akun
 * lama berperan "member" karena itu dijadikan data siswa, hafalannya ikut
 * berpindah, lalu akun loginnya dilepas.
 */
function migrateProgressToStudents() {
  if (!tableExists("progress_entries")) return;
  if (!columnNames("progress_entries").includes("user_id")) return;

  console.log("[migrasi] Struktur lama terdeteksi — memindahkan hafalan dari akun ke siswa.");
  backupDatabase("pra-siswa");

  const legacyMembers = db
    .prepare("SELECT id, name FROM users WHERE role NOT IN ('admin') ORDER BY id ASC")
    .all() as { id: number; name: string }[];

  const userToStudent = new Map<number, number>();

  const insertStudent = db.prepare(
    "INSERT INTO students (name, class_id) VALUES (?, NULL)"
  );

  db.transaction(() => {
    for (const member of legacyMembers) {
      const result = insertStudent.run(member.name);
      userToStudent.set(member.id, Number(result.lastInsertRowid));
    }

    db.exec(`
      CREATE TABLE progress_entries_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        surah_number INTEGER NOT NULL,
        last_ayah    INTEGER NOT NULL,
        completed    INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(student_id, surah_number)
      );
    `);

    const oldEntries = db
      .prepare("SELECT * FROM progress_entries")
      .all() as {
      user_id: number;
      surah_number: number;
      last_ayah: number;
      completed: number;
      created_at: string;
      updated_at: string;
    }[];

    const insertEntry = db.prepare(
      `INSERT OR IGNORE INTO progress_entries_new
         (student_id, surah_number, last_ayah, completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (const entry of oldEntries) {
      const studentId = userToStudent.get(entry.user_id);
      if (!studentId) continue;
      insertEntry.run(
        studentId,
        entry.surah_number,
        entry.last_ayah,
        entry.completed,
        entry.created_at,
        entry.updated_at
      );
    }

    db.exec("DROP TABLE progress_entries");
    db.exec("ALTER TABLE progress_entries_new RENAME TO progress_entries");

    if (tableExists("progress_log")) {
      db.exec(`
        CREATE TABLE progress_log_new (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
          surah_number INTEGER NOT NULL,
          ayah_from    INTEGER NOT NULL,
          ayah_to      INTEGER NOT NULL,
          logged_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      const oldLogs = db.prepare("SELECT * FROM progress_log").all() as {
        user_id: number;
        surah_number: number;
        ayah_from: number;
        ayah_to: number;
        logged_at: string;
      }[];

      const insertLog = db.prepare(
        `INSERT INTO progress_log_new
           (student_id, recorded_by, surah_number, ayah_from, ayah_to, logged_at)
         VALUES (?, NULL, ?, ?, ?, ?)`
      );

      for (const log of oldLogs) {
        const studentId = userToStudent.get(log.user_id);
        if (!studentId) continue;
        insertLog.run(studentId, log.surah_number, log.ayah_from, log.ayah_to, log.logged_at);
      }

      db.exec("DROP TABLE progress_log");
      db.exec("ALTER TABLE progress_log_new RENAME TO progress_log");
    }

    // Akun lama yang kini menjadi siswa tidak lagi punya akses login.
    const removeUser = db.prepare("DELETE FROM users WHERE id = ?");
    for (const userId of userToStudent.keys()) {
      removeUser.run(userId);
    }
  })();

  console.log(
    `[migrasi] Selesai. ${userToStudent.size} akun lama dipindahkan menjadi data siswa.`
  );
}

/** Peran "member" tidak dipakai lagi; yang tersisa hanya "admin" dan "guru". */
function migrateUserRoles() {
  const stale = db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE role NOT IN ('admin', 'guru')")
    .get() as { c: number };

  if (stale.c === 0) return;

  db.prepare("UPDATE users SET role = 'guru' WHERE role NOT IN ('admin', 'guru')").run();
  console.log(`[migrasi] ${stale.c} akun disesuaikan ke peran "guru".`);
}

/**
 * Struktur lama: satu guru = satu akses per kelas (tanpa jenis). Struktur baru
 * membedakan akses per jenis (Tahfid/Tilawati) supaya guru bisa ditugaskan
 * terpisah. Guru yang sudah ada pada struktur lama otomatis mendapat akses
 * kedua jenis, supaya tidak ada yang kehilangan akses saat aplikasi diperbarui.
 */
function migrateClassTeachersSubject() {
  if (!tableExists("class_teachers")) return;
  if (columnNames("class_teachers").includes("subject")) return;

  console.log("[migrasi] Struktur lama terdeteksi — menambahkan jenis akses guru per kelas.");
  backupDatabase("pra-subjek-guru");

  let migratedCount = 0;

  db.transaction(() => {
    db.exec(`
      CREATE TABLE class_teachers_new (
        class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject    TEXT NOT NULL DEFAULT 'tahfid',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (class_id, user_id, subject)
      );
    `);

    const oldRows = db.prepare("SELECT * FROM class_teachers").all() as {
      class_id: number;
      user_id: number;
      created_at: string;
    }[];
    migratedCount = oldRows.length;

    const insert = db.prepare(
      `INSERT OR IGNORE INTO class_teachers_new (class_id, user_id, subject, created_at)
       VALUES (?, ?, ?, ?)`
    );

    for (const row of oldRows) {
      insert.run(row.class_id, row.user_id, "tahfid", row.created_at);
      insert.run(row.class_id, row.user_id, "tilawati", row.created_at);
    }

    db.exec("DROP TABLE class_teachers");
    db.exec("ALTER TABLE class_teachers_new RENAME TO class_teachers");
    db.exec("CREATE INDEX IF NOT EXISTS idx_class_teachers_user ON class_teachers(user_id);");
  })();

  console.log(
    `[migrasi] Selesai. ${migratedCount} penugasan guru lama kini mencakup Tahfid & Tilawati.`
  );
}

/** Kolom untuk menyimpan lokasi berkas foto siswa hasil unggah massal. */
function migrateStudentPhoto() {
  if (!tableExists("students")) return;
  if (columnNames("students").includes("photo_path")) return;

  db.exec("ALTER TABLE students ADD COLUMN photo_path TEXT");
  console.log('[migrasi] Kolom "photo_path" ditambahkan ke tabel students.');
}

export function runMigrations() {
  migrateProgressToStudents();
  migrateUserRoles();
  migrateStudentPhoto();
  migrateClassTeachersSubject();
}
