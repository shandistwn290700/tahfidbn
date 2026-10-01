import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import { canTeachClass, canTeachStudent } from "../lib/access.ts";
import { db } from "../db/connection.ts";
import { readInt, readOptionalInt, redirectWith } from "../lib/http.ts";
import { generateWeeklyReportPdf, type ReportStudent } from "../lib/weekly-report.ts";
import { getBrandTemplateId, isCanvaConnected } from "../lib/canva.ts";
import {
  enqueueClassReport,
  enqueueStudentReport,
  getReportJob,
  canAccessReportJob,
  listReportJobs,
  listFailedItems,
  cancelReportJob,
  retryFailedItems,
  buildReportDownload,
  safeFilePart,
} from "../lib/report-queue.ts";
import { getPeriodAyahMemorized, normalisePeriodJenis } from "../lib/period-report.ts";
import { getMidSemesterRange, getFullSemesterRange } from "../lib/settings.ts";
import { ReportQueuePage } from "../views/pages/ReportQueuePage.tsx";
import type { Env, User } from "../types.ts";

const laporan = new Hono<Env>();

laporan.use("*", authMiddleware);

const ANTREAN = "/laporan/antrean";

function canvaReady(): boolean {
  return isCanvaConnected() && Boolean(getBrandTemplateId());
}

const CANVA_NOT_READY =
  "Laporan Pekanan dibuat lewat Canva, tetapi Canva belum terhubung atau ID Brand Template " +
  "belum diisi. Minta admin mengaturnya di Administrasi › Pengaturan › Integrasi Canva.";

/** Halaman tujuan setelah memasukkan antrean: kembali ke kelas di halaman input bila diketahui. */
function backToProgress(classId: number | null): string {
  return classId ? `/progress?kelas=${classId}` : "/progress";
}

/** Masukkan Laporan Pekanan seluruh siswa satu kelas ke antrean Canva. */
laporan.post("/kelas/:classId/antrean", (c) => {
  const user = c.get("user");
  const classId = readInt(c.req.param("classId"), 0, { min: 0 });
  const back = backToProgress(classId);

  if (!canTeachClass(user, classId, "tahfid")) {
    return redirectWith(c, back, "error", "Anda tidak berhak membuat laporan kelas ini.");
  }
  if (!canvaReady()) return redirectWith(c, back, "error", CANVA_NOT_READY);

  const result = enqueueClassReport(user, classId);
  if ("error" in result) return redirectWith(c, back, "error", result.error);

  return redirectWith(
    c,
    ANTREAN,
    "success",
    result.existing
      ? "Laporan kelas ini sudah ada di antrean — tidak dimasukkan dua kali."
      : "Laporan sekelas masuk antrean. Halaman ini diperbarui otomatis; unduh ZIP-nya setelah selesai."
  );
});

/** Masukkan Laporan Pekanan satu siswa ke antrean Canva. */
laporan.post("/siswa/:id/antrean", async (c) => {
  const user = c.get("user");
  const studentId = readInt(c.req.param("id"), 0, { min: 0 });
  const body = await c.req.parseBody();
  const back = backToProgress(readOptionalInt(body.return_kelas as string));

  if (!canTeachStudent(user, studentId, "tahfid")) {
    return redirectWith(c, back, "error", "Anda tidak berhak membuat laporan siswa ini.");
  }
  if (!canvaReady()) return redirectWith(c, back, "error", CANVA_NOT_READY);

  const result = enqueueStudentReport(user, studentId);
  if ("error" in result) return redirectWith(c, back, "error", result.error);

  return redirectWith(
    c,
    ANTREAN,
    "success",
    result.existing
      ? "Laporan siswa ini sudah ada di antrean — tidak dimasukkan dua kali."
      : "Laporan masuk antrean. Halaman ini diperbarui otomatis; unduh PDF-nya setelah selesai."
  );
});

laporan.get("/antrean", (c) => {
  const user = c.get("user");
  const jobs = listReportJobs(user);

  const failedByJob: Record<number, { student_name: string; error: string | null }[]> = {};
  for (const job of jobs) {
    if (job.failed_count > 0) failedByJob[job.id] = listFailedItems(job.id);
  }

  return c.html(
    <ReportQueuePage user={user} jobs={jobs} failedByJob={failedByJob} canvaReady={canvaReady()} />
  );
});

/** Ambil job milik pengguna ini; null bila tidak ada atau bukan haknya. */
function accessibleJob(user: User, rawId: string) {
  const job = getReportJob(readInt(rawId, 0, { min: 0 }));
  return job && canAccessReportJob(user, job) ? job : null;
}

laporan.get("/antrean/:id/unduh", async (c) => {
  const job = accessibleJob(c.get("user"), c.req.param("id"));
  if (!job) return redirectWith(c, ANTREAN, "error", "Laporan tidak ditemukan.");

  const download = await buildReportDownload(job);
  if (!download) {
    return redirectWith(c, ANTREAN, "error", "Belum ada laporan yang selesai dibuat untuk diunduh.");
  }

  c.header("Content-Type", download.contentType);
  c.header("Content-Disposition", `attachment; filename="${download.fileName}"`);
  return c.body(new Uint8Array(download.data));
});

laporan.post("/antrean/:id/batal", (c) => {
  const job = accessibleJob(c.get("user"), c.req.param("id"));
  if (!job) return redirectWith(c, ANTREAN, "error", "Laporan tidak ditemukan.");

  cancelReportJob(job.id);
  return redirectWith(c, ANTREAN, "success", `Antrean ${job.label} dibatalkan.`);
});

laporan.post("/antrean/:id/ulang", (c) => {
  const job = accessibleJob(c.get("user"), c.req.param("id"));
  if (!job) return redirectWith(c, ANTREAN, "error", "Laporan tidak ditemukan.");
  if (!canvaReady()) return redirectWith(c, ANTREAN, "error", CANVA_NOT_READY);

  const count = retryFailedItems(job.id);
  return redirectWith(
    c,
    ANTREAN,
    count > 0 ? "success" : "error",
    count > 0 ? `${count} laporan yang gagal dimasukkan lagi ke antrean.` : "Tidak ada laporan yang gagal."
  );
});

/** Unduh laporan tengah semester atau semester penuh untuk satu siswa (PDF bawaan). */
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
      "Tanggal mulai dan selesai semester belum diatur lengkap di Administrasi › Pengaturan › Laporan & Semester.",
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
  return c.body(new Uint8Array(pdf));
});

export { laporan as laporanRoutes };
