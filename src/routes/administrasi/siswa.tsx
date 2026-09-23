import { Hono } from "hono";
import JSZip from "jszip";
import { db } from "../../db/connection.ts";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.ts";
import { listClasses } from "../../lib/access.ts";
import { readInt, readOptionalInt, escapeLikePattern, redirectWith } from "../../lib/http.ts";
import { parseStudentWorkbook, buildStudentTemplateWorkbook } from "../../lib/excel-import.ts";
import { isAllowedPhotoExt, savePhotoForStudent, deletePhotoForStudent } from "../../lib/photos.ts";
import { StudentsPage } from "../../views/pages/StudentsPage.tsx";
import { ImportResultPage, type ImportIssue } from "../../views/pages/ImportResultPage.tsx";
import type { Env, StudentWithClass } from "../../types.ts";

const siswa = new Hono<Env>();

siswa.use("*", authMiddleware, adminMiddleware);

const BASE = "/administrasi/siswa";

function normaliseGender(raw: unknown): "L" | "P" | null {
  const value = String(raw || "").toUpperCase();
  return value === "L" || value === "P" ? value : null;
}

/** NIS kosong disimpan sebagai NULL agar indeks unik tidak menolak banyak string kosong. */
function normaliseNis(raw: unknown): string | null {
  const value = String(raw || "").trim();
  return value.length > 0 ? value : null;
}

function nisTaken(nis: string, exceptId?: number): boolean {
  const row = exceptId
    ? db.prepare("SELECT id FROM students WHERE nis = ? AND id <> ?").get(nis, exceptId)
    : db.prepare("SELECT id FROM students WHERE nis = ?").get(nis);
  return Boolean(row);
}

function resolveClassId(raw: unknown): number | null {
  const value = String(raw || "");
  if (value === "" || value === "0") return null;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const exists = db.prepare("SELECT id FROM classes WHERE id = ?").get(parsed);
  return exists ? parsed : null;
}

function buildQuery(filter: { kelas?: string; cari?: string }): string {
  const params = new URLSearchParams();
  if (filter.kelas) params.set("kelas", filter.kelas);
  if (filter.cari) params.set("cari", filter.cari);
  const query = params.toString();
  return query ? `${BASE}?${query}` : BASE;
}

siswa.get("/", (c) => {
  const user = c.get("user");
  const kelasFilter = c.req.query("kelas") || "";
  const cari = (c.req.query("cari") || "").trim();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (kelasFilter === "belum") {
    conditions.push("s.class_id IS NULL");
  } else if (kelasFilter) {
    const classId = readOptionalInt(kelasFilter);
    if (classId !== null) {
      conditions.push("s.class_id = ?");
      params.push(classId);
    }
  }

  if (cari) {
    conditions.push("(s.name LIKE ? ESCAPE '\\' OR IFNULL(s.nis, '') LIKE ? ESCAPE '\\')");
    const pattern = `%${escapeLikePattern(cari)}%`;
    params.push(pattern, pattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const students = db
    .prepare(
      `SELECT s.*, c.name AS class_name,
              (SELECT COALESCE(SUM(pe.last_ayah), 0)
                 FROM progress_entries pe WHERE pe.student_id = s.id) AS total_ayah
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       ${where}
       ORDER BY c.name COLLATE NOCASE ASC, s.name COLLATE NOCASE ASC`
    )
    .all(...params) as (StudentWithClass & { total_ayah: number })[];

  const totals = db.prepare("SELECT COUNT(*) AS c FROM students").get() as { c: number };
  const unassigned = db
    .prepare("SELECT COUNT(*) AS c FROM students WHERE class_id IS NULL")
    .get() as { c: number };

  return c.html(
    <StudentsPage
      user={user}
      students={students}
      classes={listClasses()}
      kelasFilter={kelasFilter}
      cari={cari}
      totalStudents={totals.c}
      unassignedCount={unassigned.c}
    />
  );
});

siswa.post("/", async (c) => {
  const body = await c.req.parseBody();
  const name = String(body.name || "").trim();
  const nis = normaliseNis(body.nis);
  const classId = resolveClassId(body.class_id);
  const gender = normaliseGender(body.gender);
  const back = buildQuery({ kelas: String(body.return_kelas || "") });

  if (!name) {
    return redirectWith(c, back, "error", "Nama siswa wajib diisi.");
  }
  if (nis && nisTaken(nis)) {
    return redirectWith(c, back, "error", `NIS ${nis} sudah dipakai siswa lain.`);
  }

  db.prepare(
    "INSERT INTO students (name, nis, gender, class_id) VALUES (?, ?, ?, ?)"
  ).run(name, nis, gender, classId);

  return redirectWith(c, back, "success", `Siswa "${name}" berhasil ditambahkan.`);
});

siswa.post("/massal", async (c) => {
  const body = await c.req.parseBody();
  const raw = String(body.daftar || "");
  const classId = resolveClassId(body.class_id);
  const back = buildQuery({ kelas: String(body.return_kelas || "") });

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return redirectWith(c, back, "error", "Daftar siswa masih kosong.");
  }
  if (lines.length > 500) {
    return redirectWith(c, back, "error", "Maksimal 500 baris sekali unggah.");
  }

  const insert = db.prepare(
    "INSERT INTO students (name, nis, gender, class_id) VALUES (?, ?, ?, ?)"
  );

  let added = 0;
  const skipped: string[] = [];

  db.transaction(() => {
    for (const line of lines) {
      // Format yang diterima: "Nama" atau "NIS,Nama"
      const commaIndex = line.indexOf(",");
      let nis: string | null = null;
      let name = line;

      if (commaIndex > -1) {
        nis = normaliseNis(line.slice(0, commaIndex));
        name = line.slice(commaIndex + 1).trim();
      }

      if (!name) {
        skipped.push(line);
        continue;
      }
      if (nis && nisTaken(nis)) {
        skipped.push(`${line} (NIS ganda)`);
        continue;
      }

      insert.run(name, nis, null, classId);
      added++;
    }
  })();

  const message =
    skipped.length === 0
      ? `${added} siswa berhasil ditambahkan.`
      : `${added} siswa ditambahkan, ${skipped.length} baris dilewati (${skipped
          .slice(0, 3)
          .join("; ")}${skipped.length > 3 ? "; …" : ""}).`;

  return redirectWith(c, back, skipped.length === 0 ? "success" : "error", message);
});

siswa.get("/impor/template", (c) => {
  const classNames = listClasses().map((kelas) => kelas.name);
  const buffer = buildStudentTemplateWorkbook(classNames);

  c.header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  c.header("Content-Disposition", 'attachment; filename="template-siswa.xlsx"');
  return c.body(buffer as ArrayBuffer);
});

siswa.post("/impor", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  const back = buildQuery({ kelas: String(body.return_kelas || "") });

  if (!(file instanceof File) || file.size === 0) {
    return redirectWith(c, back, "error", "Pilih berkas Excel (.xlsx) terlebih dahulu.");
  }

  let rows;
  try {
    const buffer = await file.arrayBuffer();
    rows = parseStudentWorkbook(buffer);
  } catch (err) {
    return redirectWith(
      c,
      back,
      "error",
      "Berkas tidak dapat dibaca. Pastikan formatnya .xlsx dan tidak rusak."
    );
  }

  if (rows.length === 0) {
    return redirectWith(c, back, "error", "Tidak ada baris data yang terbaca dari berkas.");
  }
  if (rows.length > 2000) {
    return redirectWith(c, back, "error", "Maksimal 2000 baris sekali impor.");
  }

  const classByName = new Map<string, number>();
  for (const kelas of listClasses()) classByName.set(kelas.name.trim().toLowerCase(), kelas.id);

  const findByNis = db.prepare("SELECT id FROM students WHERE nis = ?");
  const insertStudent = db.prepare("INSERT INTO students (name, nis, class_id) VALUES (?, ?, ?)");
  const updateStudent = db.prepare(
    "UPDATE students SET name = ?, class_id = ?, updated_at = datetime('now') WHERE nis = ?"
  );

  let added = 0;
  let updated = 0;
  const skipped: ImportIssue[] = [];

  db.transaction(() => {
    for (const row of rows) {
      if (!row.name) {
        skipped.push({ label: `Baris ${row.rowNumber}`, reason: "Nama lengkap kosong" });
        continue;
      }

      let classId: number | null = null;
      if (row.className) {
        const found = classByName.get(row.className.trim().toLowerCase());
        if (!found) {
          skipped.push({
            label: `Baris ${row.rowNumber}`,
            reason: `Kelas "${row.className}" tidak ditemukan`,
          });
          continue;
        }
        classId = found;
      }

      if (row.nis) {
        const existing = findByNis.get(row.nis) as { id: number } | null;
        if (existing) {
          updateStudent.run(row.name, classId, row.nis);
          updated++;
          continue;
        }
      }

      insertStudent.run(row.name, row.nis, classId);
      added++;
    }
  })();

  return c.html(
    <ImportResultPage
      user={c.get("user")}
      currentPath="/administrasi/siswa"
      backHref={back}
      backLabel="Kembali ke Daftar Siswa"
      title="Hasil Impor Siswa"
      summary={`${added} siswa baru ditambahkan, ${updated} siswa diperbarui${
        skipped.length > 0 ? `, ${skipped.length} baris dilewati` : ""
      }.`}
      counts={[
        { label: "Ditambahkan", value: added, tone: "success" },
        { label: "Diperbarui", value: updated, tone: "info" },
        { label: "Dilewati", value: skipped.length, tone: skipped.length > 0 ? "warn" : "muted" },
      ]}
      issues={skipped}
    />
  );
});

siswa.post("/foto", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  const back = buildQuery({ kelas: String(body.return_kelas || "") });

  if (!(file instanceof File) || file.size === 0) {
    return redirectWith(c, back, "error", "Pilih berkas ZIP terlebih dahulu.");
  }

  let zip: JSZip;
  try {
    const buffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    return redirectWith(c, back, "error", "Berkas ZIP tidak dapat dibaca atau rusak.");
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  if (entries.length === 0) {
    return redirectWith(c, back, "error", "Berkas ZIP tidak berisi berkas apa pun.");
  }
  if (entries.length > 1000) {
    return redirectWith(c, back, "error", "Maksimal 1000 foto sekali unggah.");
  }

  const studentsWithNis = db
    .prepare("SELECT id, nis FROM students WHERE nis IS NOT NULL AND nis <> ''")
    .all() as { id: number; nis: string }[];

  const studentByNis = new Map<string, number>();
  for (const student of studentsWithNis) {
    studentByNis.set(student.nis.trim().toLowerCase(), student.id);
  }

  const updatePhoto = db.prepare(
    "UPDATE students SET photo_path = ?, updated_at = datetime('now') WHERE id = ?"
  );

  let updated = 0;
  const skipped: ImportIssue[] = [];

  for (const entry of entries) {
    // Ambil nama berkas saja, buang folder di dalam ZIP (mis. "foto/1234.jpg" -> "1234.jpg").
    const baseName = (entry.name.split("/").pop() || entry.name).trim();

    if (!baseName || baseName.startsWith(".")) continue; // metadata sistem, mis. .DS_Store

    const dotIndex = baseName.lastIndexOf(".");
    if (dotIndex === -1) {
      skipped.push({ label: baseName, reason: "Nama berkas tidak berekstensi gambar" });
      continue;
    }

    const nis = baseName.slice(0, dotIndex).trim();
    const ext = baseName.slice(dotIndex + 1).trim().toLowerCase();

    if (!isAllowedPhotoExt(ext)) {
      skipped.push({ label: baseName, reason: "Format harus JPG, JPEG, PNG, atau WEBP" });
      continue;
    }

    const studentId = studentByNis.get(nis.toLowerCase());
    if (!studentId) {
      skipped.push({ label: baseName, reason: `NIS "${nis}" tidak ditemukan pada data siswa` });
      continue;
    }

    let data: Uint8Array;
    try {
      data = await entry.async("uint8array");
    } catch (err) {
      skipped.push({ label: baseName, reason: "Gagal membaca isi berkas" });
      continue;
    }

    try {
      const photoPath = savePhotoForStudent(studentId, ext, data);
      updatePhoto.run(photoPath, studentId);
      updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan foto";
      skipped.push({ label: baseName, reason: message });
    }
  }

  return c.html(
    <ImportResultPage
      user={c.get("user")}
      currentPath="/administrasi/siswa"
      backHref={back}
      backLabel="Kembali ke Daftar Siswa"
      title="Hasil Unggah Foto Siswa"
      summary={`${updated} foto berhasil disimpan${
        skipped.length > 0 ? `, ${skipped.length} berkas dilewati` : ""
      }.`}
      counts={[
        { label: "Berhasil", value: updated, tone: "success" },
        { label: "Dilewati", value: skipped.length, tone: skipped.length > 0 ? "warn" : "muted" },
      ]}
      issues={skipped}
    />
  );
});

siswa.post("/:id", async (c) => {
  const studentId = readInt(c.req.param("id"), 0, { min: 0 });
  const body = await c.req.parseBody();
  const name = String(body.name || "").trim();
  const nis = normaliseNis(body.nis);
  const classId = resolveClassId(body.class_id);
  const gender = normaliseGender(body.gender);
  const back = buildQuery({ kelas: String(body.return_kelas || "") });

  const existing = db.prepare("SELECT id FROM students WHERE id = ?").get(studentId);
  if (!existing) {
    return redirectWith(c, back, "error", "Siswa tidak ditemukan.");
  }
  if (!name) {
    return redirectWith(c, back, "error", "Nama siswa wajib diisi.");
  }
  if (nis && nisTaken(nis, studentId)) {
    return redirectWith(c, back, "error", `NIS ${nis} sudah dipakai siswa lain.`);
  }

  db.prepare(
    `UPDATE students SET name = ?, nis = ?, gender = ?, class_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(name, nis, gender, classId, studentId);

  return redirectWith(c, back, "success", `Data "${name}" berhasil diperbarui.`);
});

siswa.post("/:id/hapus", async (c) => {
  const studentId = readInt(c.req.param("id"), 0, { min: 0 });
  const body = await c.req.parseBody();
  const back = buildQuery({ kelas: String(body.return_kelas || "") });

  const target = db.prepare("SELECT name FROM students WHERE id = ?").get(studentId) as
    | { name: string }
    | null;

  if (!target) {
    return redirectWith(c, back, "error", "Siswa tidak ditemukan.");
  }

  // Riwayat hafalan ikut terhapus lewat ON DELETE CASCADE.
  db.prepare("DELETE FROM students WHERE id = ?").run(studentId);
  deletePhotoForStudent(studentId);

  return redirectWith(
    c,
    back,
    "success",
    `Siswa "${target.name}" beserta catatan hafalannya telah dihapus.`
  );
});

export { siswa as siswaRoutes };
