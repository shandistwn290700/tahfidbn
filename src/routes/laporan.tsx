import { Readable } from "node:stream";
import { Hono } from "hono";
import JSZip from "jszip";
import { authMiddleware } from "../middleware/auth.ts";
import { canTeachClass, canTeachStudent } from "../lib/access.ts";
import { db } from "../db/connection.ts";
import { readInt } from "../lib/http.ts";
import {
  generateWeeklyReportPdf,
  getReportWeekNumber,
  getWeeklyAyahMemorized,
  type ReportStudent,
} from "../lib/weekly-report.ts";
import { generateWeeklyReportViaCanva, buildCanvaFailureNotePdf } from "../lib/canva.ts";
import { getPeriodAyahMemorized, normalisePeriodJenis } from "../lib/period-report.ts";
import {
  getMidSemesterRange,
  getFullSemesterRange,
} from "../lib/settings.ts";
import type { Env } from "../types.ts";

const laporan = new Hono<Env>();

laporan.use("*", authMiddleware);

function safeFilePart(text: string): string {
  return text.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_") || "siswa";
}

/** Unduh laporan pekanan satu siswa sebagai PDF. */
laporan.get("/siswa/:id", async (c) => {
  const user = c.get("user");
  const studentId = readInt(c.req.param("id"), 0, { min: 0 });

  if (!canTeachStudent(user, studentId, "tahfid")) {
    return c.text("Anda tidak berhak mengunduh laporan siswa ini.", 403);
  }

  const student = db
    .prepare("SELECT id, name, photo_path FROM students WHERE id = ?")
    .get(studentId) as ReportStudent | null;

  if (!student) return c.text("Siswa tidak ditemukan.", 404);

  const pdf = await generateWeeklyReportPdf(student, getReportWeekNumber());

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="Laporan_${safeFilePart(student.name)}.pdf"`);
  return c.body(pdf);
});

/** Sama seperti /siswa/:id, tapi dibuat lewat Autofill Brand Template Canva alih-alih pdfkit. */
laporan.get("/siswa/:id/canva", async (c) => {
  const user = c.get("user");
  const studentId = readInt(c.req.param("id"), 0, { min: 0 });

  if (!canTeachStudent(user, studentId, "tahfid")) {
    return c.text("Anda tidak berhak mengunduh laporan siswa ini.", 403);
  }

  const student = db
    .prepare("SELECT id, name, photo_path FROM students WHERE id = ?")
    .get(studentId) as ReportStudent | null;

  if (!student) return c.text("Siswa tidak ditemukan.", 404);

  const ayat = getWeeklyAyahMemorized(student.id);

  try {
    const pdf = await generateWeeklyReportViaCanva(student, getReportWeekNumber(), ayat);
    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="Laporan_Canva_${safeFilePart(student.name)}.pdf"`
    );
    return c.body(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat laporan via Canva.";
    return c.text(message, 502);
  }
});

/** Unduh laporan tengah semester atau semester penuh untuk satu siswa. */
laporan.get("/siswa/:id/periode", async (c) => {
  const user = c.get("user");
  const studentId = readInt(c.req.param("id"), 0, { min: 0 });
  const jenis = normalisePeriodJenis(c.req.query("jenis"));

  if (!canTeachStudent(user, studentId, "tahfid")) {
    return c.text("Anda tidak berhak mengunduh laporan siswa ini.", 403);
  }

  const range = jenis === "penuh" ? getFullSemesterRange() : getMidSemesterRange();
  if (!range) {
    return c.text(
      "Tanggal mulai dan selesai semester belum diatur lengkap di Administrasi › Pengaturan › Laporan Pekanan.",
      400
    );
  }

  const student = db
    .prepare("SELECT id, name, photo_path FROM students WHERE id = ?")
    .get(studentId) as ReportStudent | null;

  if (!student) return c.text("Siswa tidak ditemukan.", 404);

  const ayat = getPeriodAyahMemorized(student.id, range.from, range.to);
  const heading = jenis === "penuh" ? "Laporan Semester" : "Laporan Tengah Semester";
  const periodLabel = jenis === "penuh" ? "selama semester ini" : "selama tengah semester ini";

  const pdf = await generateWeeklyReportPdf(student, null, {
    sampleAyat: ayat,
    heading,
    periodLabel,
  });

  c.header("Content-Type", "application/pdf");
  c.header(
    "Content-Disposition",
    `attachment; filename="${jenis === "penuh" ? "Laporan_Semester" : "Laporan_Tengah_Semester"}_${safeFilePart(student.name)}.pdf"`
  );
  return c.body(pdf);
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sama seperti /kelas/:classId, tapi tiap laporan dibuat lewat Autofill Canva.
 *
 * Diproses satu siswa per satu (bukan paralel) dengan jeda kecil di antaranya,
 * supaya tidak membombardir rate limit API Canva — diatur lewat rantai Promise
 * manual (`chain`), bukan `for...await` biasa, karena isi tiap berkas ZIP di
 * bawah didaftarkan sebagai Promise yang baru "dikerjakan" saat gilirannya tiba.
 *
 * ZIP-nya di-stream ke klien (bukan dikumpulkan penuh dulu di memori/menunggu
 * semua siswa selesai) supaya koneksi tetap "hidup" — setiap siswa yang selesai
 * langsung mengalirkan byte ke klien, mereset idle timeout server. Ini yang
 * membuat proses satu kelas besar (bisa berdurasi beberapa menit) tidak
 * terputus ERR_EMPTY_RESPONSE seperti bila ditunggu utuh sekaligus.
 *
 * Siswa yang gagal tidak menggagalkan seluruh ZIP — berkas PDF-nya diganti
 * catatan kegagalan (lihat buildCanvaFailureNotePdf), jadi tetap ada satu PDF
 * per siswa di ZIP akhir.
 */
laporan.get("/kelas/:classId/canva", async (c) => {
  const user = c.get("user");
  const classId = readInt(c.req.param("classId"), 0, { min: 0 });

  if (!canTeachClass(user, classId, "tahfid")) {
    return c.text("Anda tidak berhak mengunduh laporan kelas ini.", 403);
  }

  const kelas = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as
    | { name: string }
    | null;
  if (!kelas) return c.text("Kelas tidak ditemukan.", 404);

  const students = db
    .prepare(
      "SELECT id, name, photo_path FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(classId) as ReportStudent[];

  if (students.length === 0) {
    return c.text("Belum ada siswa di kelas ini.", 404);
  }

  const week = getReportWeekNumber();
  const zip = new JSZip();
  const gagal: string[] = [];

  let chain: Promise<unknown> = Promise.resolve();
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const isLast = i === students.length - 1;

    const entryPromise: Promise<Buffer> = chain.then(async () => {
      try {
        const ayat = getWeeklyAyahMemorized(student.id);
        return await generateWeeklyReportViaCanva(student, week, ayat);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui.";
        gagal.push(`${student.name}: ${message}`);
        return buildCanvaFailureNotePdf(student.name, message);
      }
    });

    zip.file(`${safeFilePart(student.name)}.pdf`, entryPromise);

    // Jeda antar siswa (setelah giliran siswa ini selesai) supaya tidak
    // membombardir rate limit API Canva.
    chain = isLast ? entryPromise : entryPromise.then(() => delay(600));
  }

  const summaryPromise = chain.then(() =>
    Buffer.from(
      gagal.length > 0
        ? `Sebagian laporan gagal dibuat via Canva — PDF-nya diganti catatan kegagalan ini:\n\n${gagal.join("\n")}\n`
        : "Seluruh laporan berhasil dibuat via Canva.\n"
    )
  );
  zip.file("RINGKASAN.txt", summaryPromise);

  const nodeStream = zip.generateNodeStream({ type: "nodebuffer", streamFiles: true });
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Laporan_Canva_${safeFilePart(kelas.name)}.zip"`,
    },
  });
});

/** Unduh laporan pekanan seluruh siswa di satu kelas sekaligus, dikemas dalam satu ZIP. */
laporan.get("/kelas/:classId", async (c) => {
  const user = c.get("user");
  const classId = readInt(c.req.param("classId"), 0, { min: 0 });

  if (!canTeachClass(user, classId, "tahfid")) {
    return c.text("Anda tidak berhak mengunduh laporan kelas ini.", 403);
  }

  const kelas = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as
    | { name: string }
    | null;
  if (!kelas) return c.text("Kelas tidak ditemukan.", 404);

  const students = db
    .prepare(
      "SELECT id, name, photo_path FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(classId) as ReportStudent[];

  if (students.length === 0) {
    return c.text("Belum ada siswa di kelas ini.", 404);
  }

  const week = getReportWeekNumber();
  const zip = new JSZip();
  for (const student of students) {
    const pdf = await generateWeeklyReportPdf(student, week);
    zip.file(`${safeFilePart(student.name)}.pdf`, pdf);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  c.header("Content-Type", "application/zip");
  c.header("Content-Disposition", `attachment; filename="Laporan_${safeFilePart(kelas.name)}.zip"`);
  return c.body(zipBuffer);
});

export { laporan as laporanRoutes };
