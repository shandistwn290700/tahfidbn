import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import { getClassTilawati } from "../lib/tilawati-calc.ts";
import { getJilid } from "../data/tilawati-meta.ts";
import { resolveProgressUpdateInput } from "../lib/progress-input.ts";
import { listTeachableClasses, canTeachStudent } from "../lib/access.ts";
import { readInt, readOptionalInt, redirectWith } from "../lib/http.ts";
import { db } from "../db/connection.ts";
import { TilawatiPage } from "../views/pages/TilawatiPage.tsx";
import type { Env } from "../types.ts";

const tilawati = new Hono<Env>();

tilawati.use("*", authMiddleware);

const BASE = "/progress/tilawati";

tilawati.get("/", (c) => {
  const user = c.get("user");
  const teachable = listTeachableClasses(user, "tilawati");

  const requested = readOptionalInt(c.req.query("kelas"));
  const selected = teachable.find((k) => k.id === requested) ?? teachable[0] ?? null;

  const rows = selected ? getClassTilawati(selected.id) : [];

  return c.html(
    <TilawatiPage user={user} classes={teachable} selectedClass={selected} rows={rows} />
  );
});

tilawati.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const studentId = readInt(body.student_id as string, 0, { min: 0 });
  const jilidNumber = readInt(body.jilid_number as string, 0, { min: 0 });
  const returnTo = readOptionalInt(body.return_kelas as string);
  const back = returnTo ? `${BASE}?kelas=${returnTo}` : BASE;

  const mode =
    body.mode === "increment" || body.mode === "advance" || body.mode === "complete"
      ? (body.mode as string)
      : "set";

  const student = db
    .prepare("SELECT id, name FROM students WHERE id = ?")
    .get(studentId) as { id: number; name: string } | null;

  if (!student) {
    return redirectWith(c, back, "error", "Siswa tidak ditemukan.");
  }

  // Guru hanya boleh menginput siswa pada kelas yang dia ampu untuk Tilawati.
  if (!canTeachStudent(user, studentId, "tilawati")) {
    return redirectWith(
      c,
      back,
      "error",
      `Anda tidak berhak menginput capaian Tilawati ${student.name}.`
    );
  }

  const jilid = getJilid(jilidNumber);
  if (!jilid) {
    return redirectWith(c, back, "error", "Jilid yang dipilih tidak sah.");
  }

  const existing = db
    .prepare("SELECT last_page FROM tilawati_entries WHERE student_id = ? AND jilid_number = ?")
    .get(studentId, jilidNumber) as { last_page: number } | null;

  const previousPage = existing?.last_page || 0;

  const resolved = resolveProgressUpdateInput({
    mode,
    rawLastAyah: body.last_page as string | undefined,
    rawIncrement: body.page_increment as string | undefined,
    existingLastAyah: previousPage,
    hasExistingEntry: Boolean(existing),
    surahName: `Jilid ${jilid.number}`,
    surahTotalAyahs: jilid.totalPages,
    itemWord: "Jilid",
    positionWord: "halaman",
  });

  if (!resolved.ok) {
    return redirectWith(c, back, "error", resolved.error);
  }

  const lastPage = resolved.lastAyah;
  const completed = lastPage === jilid.totalPages ? 1 : 0;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO tilawati_entries (student_id, jilid_number, last_page, completed)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, jilid_number)
       DO UPDATE SET last_page = ?, completed = ?, updated_at = datetime('now')`
    ).run(studentId, jilidNumber, lastPage, completed, lastPage, completed);

    if (lastPage !== previousPage) {
      db.prepare(
        `INSERT INTO tilawati_log (student_id, recorded_by, jilid_number, page_from, page_to)
         VALUES (?, ?, ?, ?, ?)`
      ).run(studentId, user.id, jilidNumber, previousPage, lastPage);
    }
  })();

  const selisih = lastPage - previousPage;
  const tambahan = selisih > 0 ? ` (+${selisih} halaman)` : selisih < 0 ? " (dikoreksi turun)" : "";
  const penanda = completed ? " — jilid selesai!" : "";

  return redirectWith(
    c,
    back,
    "success",
    `${student.name}: Jilid ${jilid.number} halaman ${lastPage}/${jilid.totalPages}${tambahan}${penanda}`
  );
});

tilawati.post("/hapus", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const studentId = readInt(body.student_id as string, 0, { min: 0 });
  const jilidNumber = readInt(body.jilid_number as string, 0, { min: 0 });
  const returnTo = readOptionalInt(body.return_kelas as string);
  const back = returnTo ? `${BASE}?kelas=${returnTo}` : BASE;

  if (!canTeachStudent(user, studentId, "tilawati")) {
    return redirectWith(c, back, "error", "Anda tidak berhak mengubah data siswa ini.");
  }

  const jilid = getJilid(jilidNumber);
  const student = db.prepare("SELECT name FROM students WHERE id = ?").get(studentId) as
    | { name: string }
    | null;

  if (!jilid || !student) {
    return redirectWith(c, back, "error", "Data tidak ditemukan.");
  }

  const existing = db
    .prepare("SELECT last_page FROM tilawati_entries WHERE student_id = ? AND jilid_number = ?")
    .get(studentId, jilidNumber) as { last_page: number } | null;

  if (!existing) {
    return redirectWith(c, back, "error", "Catatan jilid tersebut tidak ada.");
  }

  db.transaction(() => {
    db.prepare("DELETE FROM tilawati_entries WHERE student_id = ? AND jilid_number = ?").run(
      studentId,
      jilidNumber
    );
    db.prepare(
      `INSERT INTO tilawati_log (student_id, recorded_by, jilid_number, page_from, page_to)
       VALUES (?, ?, ?, ?, 0)`
    ).run(studentId, user.id, jilidNumber, existing.last_page);
  })();

  return redirectWith(
    c,
    back,
    "success",
    `Catatan Jilid ${jilid.number} untuk ${student.name} telah dihapus.`
  );
});

export { tilawati as tilawatiRoutes };
