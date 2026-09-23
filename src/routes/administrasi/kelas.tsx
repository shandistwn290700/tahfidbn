import { Hono } from "hono";
import { db } from "../../db/connection.ts";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.ts";
import { listTeachers, setClassTeachers } from "../../lib/access.ts";
import { readInt, redirectWith } from "../../lib/http.ts";
import { ClassesPage } from "../../views/pages/ClassesPage.tsx";
import type { Env, ClassRoomSummary, TeachingSubject } from "../../types.ts";

const kelas = new Hono<Env>();

kelas.use("*", authMiddleware, adminMiddleware);

const BASE = "/administrasi/kelas";

/** Checkbox dengan nama sama dapat mengirim satu nilai atau banyak nilai. */
function toIdArray(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return raw
    .map((v) => parseInt(String(v), 10))
    .filter((v) => Number.isFinite(v));
}

// Seorang guru bisa punya dua baris class_teachers untuk kelas yang sama (satu per
// jenis, Tahfid dan Tilawati) — DISTINCT di sini mencegah guru itu terhitung/tertulis
// dua kali pada ringkasan jumlah dan nama pengampu.
function loadClasses(): ClassRoomSummary[] {
  return db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM (
                SELECT DISTINCT user_id FROM class_teachers ct WHERE ct.class_id = c.id
              )) AS teacher_count,
              COALESCE((
                SELECT GROUP_CONCAT(u.name, ', ')
                FROM (
                  SELECT DISTINCT ct.user_id
                  FROM class_teachers ct
                  WHERE ct.class_id = c.id
                ) du
                JOIN users u ON u.id = du.user_id
              ), '') AS teacher_names
       FROM classes c
       ORDER BY c.name COLLATE NOCASE ASC`
    )
    .all() as ClassRoomSummary[];
}

kelas.get("/", (c) => {
  const user = c.get("user");

  const teacherAssignments = db
    .prepare("SELECT class_id, user_id, subject FROM class_teachers")
    .all() as { class_id: number; user_id: number; subject: TeachingSubject }[];

  const assignmentsTahfid: Record<number, number[]> = {};
  const assignmentsTilawati: Record<number, number[]> = {};
  for (const row of teacherAssignments) {
    const target = row.subject === "tilawati" ? assignmentsTilawati : assignmentsTahfid;
    (target[row.class_id] ||= []).push(row.user_id);
  }

  return c.html(
    <ClassesPage
      user={user}
      classes={loadClasses()}
      teachers={listTeachers()}
      assignmentsTahfid={assignmentsTahfid}
      assignmentsTilawati={assignmentsTilawati}
    />
  );
});

kelas.post("/", async (c) => {
  const body = await c.req.parseBody({ all: true });
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();

  if (!name) {
    return redirectWith(c, BASE, "error", "Nama kelas wajib diisi.");
  }
  if (name.length > 60) {
    return redirectWith(c, BASE, "error", "Nama kelas maksimal 60 karakter.");
  }

  const duplicate = db
    .prepare("SELECT id FROM classes WHERE name = ? COLLATE NOCASE")
    .get(name);
  if (duplicate) {
    return redirectWith(c, BASE, "error", `Kelas "${name}" sudah ada.`);
  }

  const result = db
    .prepare("INSERT INTO classes (name, description) VALUES (?, ?)")
    .run(name, description || null);

  const newClassId = Number(result.lastInsertRowid);
  setClassTeachers(newClassId, toIdArray(body.teacher_ids_tahfid), "tahfid");
  setClassTeachers(newClassId, toIdArray(body.teacher_ids_tilawati), "tilawati");

  return redirectWith(c, BASE, "success", `Kelas "${name}" berhasil ditambahkan.`);
});

kelas.post("/:id", async (c) => {
  const classId = readInt(c.req.param("id"), 0, { min: 0 });
  const body = await c.req.parseBody({ all: true });
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();

  const existing = db.prepare("SELECT id FROM classes WHERE id = ?").get(classId);
  if (!existing) {
    return redirectWith(c, BASE, "error", "Kelas tidak ditemukan.");
  }
  if (!name) {
    return redirectWith(c, BASE, "error", "Nama kelas wajib diisi.");
  }

  const duplicate = db
    .prepare("SELECT id FROM classes WHERE name = ? COLLATE NOCASE AND id <> ?")
    .get(name, classId);
  if (duplicate) {
    return redirectWith(c, BASE, "error", `Kelas "${name}" sudah ada.`);
  }

  db.prepare(
    "UPDATE classes SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, description || null, classId);

  setClassTeachers(classId, toIdArray(body.teacher_ids_tahfid), "tahfid");
  setClassTeachers(classId, toIdArray(body.teacher_ids_tilawati), "tilawati");

  return redirectWith(c, BASE, "success", `Kelas "${name}" berhasil diperbarui.`);
});

kelas.post("/:id/hapus", (c) => {
  const classId = readInt(c.req.param("id"), 0, { min: 0 });

  const target = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as
    | { name: string }
    | null;

  if (!target) {
    return redirectWith(c, BASE, "error", "Kelas tidak ditemukan.");
  }

  // Siswa tidak ikut terhapus — class_id mereka dikosongkan oleh ON DELETE SET NULL.
  db.prepare("DELETE FROM classes WHERE id = ?").run(classId);

  return redirectWith(
    c,
    BASE,
    "success",
    `Kelas "${target.name}" dihapus. Siswanya kini berstatus belum berkelas.`
  );
});

export { kelas as kelasRoutes };
