import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import { getClassProgress } from "../lib/progress-calc.ts";
import { getSurah } from "../data/quran-meta.ts";
import { resolveProgressUpdateInput } from "../lib/progress-input.ts";
import { listTeachableClasses, canTeachStudent } from "../lib/access.ts";
import { readInt, readOptionalInt, redirectWith } from "../lib/http.ts";
import { db } from "../db/connection.ts";
import { isCanvaConnected, getBrandTemplateId } from "../lib/canva.ts";
import { ProgressPage } from "../views/pages/ProgressPage.tsx";
import type { Env } from "../types.ts";

const progress = new Hono<Env>();

progress.use("*", authMiddleware);

const BASE = "/progress";

progress.get("/", (c) => {
  const user = c.get("user");
  const teachable = listTeachableClasses(user, "tahfid");

  const requested = readOptionalInt(c.req.query("kelas"));
  const selected =
    teachable.find((k) => k.id === requested) ?? teachable[0] ?? null;

  const rows = selected ? getClassProgress(selected.id) : [];

  return c.html(
    <ProgressPage
      user={user}
      classes={teachable}
      selectedClass={selected}
      rows={rows}
      canvaReady={isCanvaConnected() && Boolean(getBrandTemplateId())}
    />
  );
});

progress.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const studentId = readInt(body.student_id as string, 0, { min: 0 });
  const surahNumber = readInt(body.surah_number as string, 0, { min: 0 });
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

  // Guru hanya boleh menginput siswa pada kelas yang dia ampu.
  if (!canTeachStudent(user, studentId, "tahfid")) {
    return redirectWith(
      c,
      back,
      "error",
      `Anda tidak berhak menginput hafalan ${student.name}.`
    );
  }

  const surah = getSurah(surahNumber);
  if (!surah) {
    return redirectWith(c, back, "error", "Surah yang dipilih tidak sah.");
  }

  const existing = db
    .prepare("SELECT last_ayah FROM progress_entries WHERE student_id = ? AND surah_number = ?")
    .get(studentId, surahNumber) as { last_ayah: number } | null;

  const previousAyah = existing?.last_ayah || 0;

  const resolved = resolveProgressUpdateInput({
    mode,
    rawLastAyah: body.last_ayah as string | undefined,
    rawIncrement: body.ayah_increment as string | undefined,
    existingLastAyah: previousAyah,
    hasExistingEntry: Boolean(existing),
    surahName: surah.name,
    surahTotalAyahs: surah.totalAyahs,
  });

  if (!resolved.ok) {
    return redirectWith(c, back, "error", resolved.error);
  }

  const lastAyah = resolved.lastAyah;
  const completed = lastAyah === surah.totalAyahs ? 1 : 0;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO progress_entries (student_id, surah_number, last_ayah, completed)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, surah_number)
       DO UPDATE SET last_ayah = ?, completed = ?, updated_at = datetime('now')`
    ).run(studentId, surahNumber, lastAyah, completed, lastAyah, completed);

    if (lastAyah !== previousAyah) {
      db.prepare(
        `INSERT INTO progress_log (student_id, recorded_by, surah_number, ayah_from, ayah_to)
         VALUES (?, ?, ?, ?, ?)`
      ).run(studentId, user.id, surahNumber, previousAyah, lastAyah);
    }
  })();

  const selisih = lastAyah - previousAyah;
  const tambahan = selisih > 0 ? ` (+${selisih} ayat)` : selisih < 0 ? " (dikoreksi turun)" : "";
  const penanda = completed ? " — surah selesai!" : "";

  return redirectWith(
    c,
    back,
    "success",
    `${student.name}: ${surah.name} ayat ${lastAyah}/${surah.totalAyahs}${tambahan}${penanda}`
  );
});

progress.post("/hapus", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const studentId = readInt(body.student_id as string, 0, { min: 0 });
  const surahNumber = readInt(body.surah_number as string, 0, { min: 0 });
  const returnTo = readOptionalInt(body.return_kelas as string);
  const back = returnTo ? `${BASE}?kelas=${returnTo}` : BASE;

  if (!canTeachStudent(user, studentId, "tahfid")) {
    return redirectWith(c, back, "error", "Anda tidak berhak mengubah data siswa ini.");
  }

  const surah = getSurah(surahNumber);
  const student = db.prepare("SELECT name FROM students WHERE id = ?").get(studentId) as
    | { name: string }
    | null;

  if (!surah || !student) {
    return redirectWith(c, back, "error", "Data tidak ditemukan.");
  }

  const existing = db
    .prepare("SELECT last_ayah FROM progress_entries WHERE student_id = ? AND surah_number = ?")
    .get(studentId, surahNumber) as { last_ayah: number } | null;

  if (!existing) {
    return redirectWith(c, back, "error", "Catatan surah tersebut tidak ada.");
  }

  db.transaction(() => {
    db.prepare("DELETE FROM progress_entries WHERE student_id = ? AND surah_number = ?").run(
      studentId,
      surahNumber
    );
    db.prepare(
      `INSERT INTO progress_log (student_id, recorded_by, surah_number, ayah_from, ayah_to)
       VALUES (?, ?, ?, ?, 0)`
    ).run(studentId, user.id, surahNumber, existing.last_ayah);
  })();

  return redirectWith(
    c,
    back,
    "success",
    `Catatan ${surah.name} untuk ${student.name} telah dihapus.`
  );
});

export { progress as progressRoutes };
