import { db } from "./connection.ts";
import { runMigrations } from "./migrate.ts";

/**
 * Tabel-tabel yang tidak bergantung pada migrasi. Dibuat lebih dulu supaya
 * proses migrasi punya tempat untuk memindahkan data lama.
 */
function createBaseTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email         TEXT,
      name          TEXT NOT NULL,
      avatar_url    TEXT,
      role          TEXT NOT NULL DEFAULT 'guru',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS classes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nis        TEXT,
      name       TEXT NOT NULL,
      gender     TEXT,
      class_id   INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nis
      ON students(nis) WHERE nis IS NOT NULL AND nis <> '';

    CREATE TABLE IF NOT EXISTS class_teachers (
      class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject    TEXT NOT NULL DEFAULT 'tahfid',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (class_id, user_id, subject)
    );

    CREATE INDEX IF NOT EXISTS idx_class_teachers_user ON class_teachers(user_id);

    CREATE TABLE IF NOT EXISTS reading_bookmarks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      surah_number INTEGER NOT NULL,
      ayah_number  INTEGER NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reading_bookmarks_user ON reading_bookmarks(user_id);

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Tabel hafalan versi baru — terikat ke siswa, bukan ke akun pengguna. */
function createProgressTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      surah_number INTEGER NOT NULL,
      last_ayah    INTEGER NOT NULL,
      completed    INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, surah_number)
    );

    CREATE INDEX IF NOT EXISTS idx_progress_student ON progress_entries(student_id);

    CREATE TABLE IF NOT EXISTS progress_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      surah_number INTEGER NOT NULL,
      ayah_from    INTEGER NOT NULL,
      ayah_to      INTEGER NOT NULL,
      logged_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_progress_log_student ON progress_log(student_id);
    CREATE INDEX IF NOT EXISTS idx_progress_log_time ON progress_log(logged_at);

    CREATE TABLE IF NOT EXISTS tilawati_entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      jilid_number INTEGER NOT NULL,
      last_page    INTEGER NOT NULL,
      completed    INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, jilid_number)
    );

    CREATE INDEX IF NOT EXISTS idx_tilawati_student ON tilawati_entries(student_id);

    CREATE TABLE IF NOT EXISTS tilawati_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      jilid_number INTEGER NOT NULL,
      page_from    INTEGER NOT NULL,
      page_to      INTEGER NOT NULL,
      logged_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tilawati_log_student ON tilawati_log(student_id);
    CREATE INDEX IF NOT EXISTS idx_tilawati_log_time ON tilawati_log(logged_at);
  `);
}

export function initializeDatabase() {
  createBaseTables();
  runMigrations();
  createProgressTables();
}
