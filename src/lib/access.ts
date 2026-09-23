import { db } from "../db/connection.ts";
import type { ClassRoom, User, TeachingSubject } from "../types.ts";

export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

/** Seluruh kelas yang terdaftar, diurutkan secara alami (6A sebelum 10A). */
export function listClasses(): ClassRoom[] {
  return db
    .prepare("SELECT * FROM classes ORDER BY name COLLATE NOCASE ASC")
    .all() as ClassRoom[];
}

export function getClass(classId: number): ClassRoom | null {
  return db.prepare("SELECT * FROM classes WHERE id = ?").get(classId) as ClassRoom | null;
}

/** Kelas yang diampu seorang guru untuk jenis tertentu. Admin dianggap mengampu semua kelas. */
export function listTeachableClasses(user: User, subject: TeachingSubject = "tahfid"): ClassRoom[] {
  if (isAdmin(user)) return listClasses();

  return db
    .prepare(
      `SELECT c.* FROM classes c
       JOIN class_teachers ct ON ct.class_id = c.id
       WHERE ct.user_id = ? AND ct.subject = ?
       ORDER BY c.name COLLATE NOCASE ASC`
    )
    .all(user.id, subject) as ClassRoom[];
}

/** Apakah pengguna ini boleh menginput data (jenis tertentu) untuk kelas tersebut. */
export function canTeachClass(
  user: User,
  classId: number,
  subject: TeachingSubject = "tahfid"
): boolean {
  if (isAdmin(user)) return true;

  const row = db
    .prepare(
      "SELECT 1 AS ok FROM class_teachers WHERE user_id = ? AND class_id = ? AND subject = ?"
    )
    .get(user.id, classId, subject) as { ok: number } | null;

  return Boolean(row);
}

/** Apakah pengguna boleh menginput data (jenis tertentu) untuk siswa tertentu. */
export function canTeachStudent(
  user: User,
  studentId: number,
  subject: TeachingSubject = "tahfid"
): boolean {
  if (isAdmin(user)) return true;

  const row = db
    .prepare(
      `SELECT 1 AS ok FROM students s
       JOIN class_teachers ct ON ct.class_id = s.class_id
       WHERE s.id = ? AND ct.user_id = ? AND ct.subject = ?`
    )
    .get(studentId, user.id, subject) as { ok: number } | null;

  return Boolean(row);
}

export function listTeachers(): User[] {
  return db
    .prepare("SELECT * FROM users ORDER BY role ASC, name COLLATE NOCASE ASC")
    .all() as User[];
}

/** Guru pengampu sebuah kelas. Tanpa `subject`, mengembalikan pengampu jenis apa pun. */
export function listTeachersForClass(classId: number, subject?: TeachingSubject): User[] {
  if (subject) {
    return db
      .prepare(
        `SELECT DISTINCT u.* FROM users u
         JOIN class_teachers ct ON ct.user_id = u.id
         WHERE ct.class_id = ? AND ct.subject = ?
         ORDER BY u.name COLLATE NOCASE ASC`
      )
      .all(classId, subject) as User[];
  }

  return db
    .prepare(
      `SELECT DISTINCT u.* FROM users u
       JOIN class_teachers ct ON ct.user_id = u.id
       WHERE ct.class_id = ?
       ORDER BY u.name COLLATE NOCASE ASC`
    )
    .all(classId) as User[];
}

export function assignTeacher(classId: number, userId: number, subject: TeachingSubject) {
  db.prepare(
    "INSERT OR IGNORE INTO class_teachers (class_id, user_id, subject) VALUES (?, ?, ?)"
  ).run(classId, userId, subject);
}

export function unassignTeacher(classId: number, userId: number, subject: TeachingSubject) {
  db.prepare(
    "DELETE FROM class_teachers WHERE class_id = ? AND user_id = ? AND subject = ?"
  ).run(classId, userId, subject);
}

/** Mengganti seluruh daftar pengampu sebuah kelas (untuk satu jenis) dalam satu transaksi. */
export function setClassTeachers(classId: number, userIds: number[], subject: TeachingSubject) {
  db.transaction(() => {
    db.prepare("DELETE FROM class_teachers WHERE class_id = ? AND subject = ?").run(
      classId,
      subject
    );
    const insert = db.prepare(
      "INSERT OR IGNORE INTO class_teachers (class_id, user_id, subject) VALUES (?, ?, ?)"
    );
    for (const userId of userIds) insert.run(classId, userId, subject);
  })();
}

/** Mengganti seluruh daftar kelas ampuan seorang guru (untuk satu jenis) dalam satu transaksi. */
export function setTeacherClasses(userId: number, classIds: number[], subject: TeachingSubject) {
  db.transaction(() => {
    db.prepare("DELETE FROM class_teachers WHERE user_id = ? AND subject = ?").run(
      userId,
      subject
    );
    const insert = db.prepare(
      "INSERT OR IGNORE INTO class_teachers (class_id, user_id, subject) VALUES (?, ?, ?)"
    );
    for (const classId of classIds) insert.run(classId, userId, subject);
  })();
}
