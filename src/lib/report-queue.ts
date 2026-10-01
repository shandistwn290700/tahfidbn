import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { db } from "../db/connection.ts";
import {
  CanvaAuthError,
  generateWeeklyReportViaCanva,
  getBrandTemplateId,
  isCanvaConnected,
} from "./canva.ts";
import { getReportWeekNumber, getWeeklyAyahMemorized } from "./weekly-report.ts";
import type { User } from "../types.ts";

/**
 * Antrean FIFO Laporan Pekanan via Canva.
 *
 * Guru tidak lagi menunggu satu request panjang (yang diputus nginx setelah ±60 detik,
 * diputus service worker PWA setelah 4 detik, dan gagal total bila halaman ditutup).
 * Tombol cetak cukup memasukkan permintaan ke tabel report_jobs/report_job_items,
 * lalu SATU pekerja di proses server ini memproses siswa satu per satu, urut job
 * yang masuk lebih dulu, untuk semua guru sekaligus. Hasilnya disimpan di
 * data/reports/ dan diunduh dari halaman Antrean Laporan.
 *
 * Asumsi: aplikasi berjalan sebagai satu proses (pm2 satu instance). Dua proses
 * akan memproses antrean yang sama dua kali.
 */

export const REPORTS_DIR = join(import.meta.dir, "..", "..", "data", "reports");

// Ekspor Canva dibatasi 75 per 5 menit per pengguna (= 15 per menit) dan 500 per hari.
// Jeda 5 detik antar siswa menjaga laju di bawah batas itu dengan sedikit ruang.
const MIN_GAP_MS = 5_000;
const IDLE_POLL_MS = 15_000;
const RETRY_DELAY_MS = 20_000;
const MAX_ATTEMPTS = 3;
const KEEP_DAYS = 7;

export type ReportJobKind = "kelas" | "siswa";
export type ReportJobStatus = "queued" | "running" | "done" | "canceled";

export interface ReportJob {
  id: number;
  kind: ReportJobKind;
  class_id: number | null;
  label: string;
  week_number: number | null;
  created_by: number | null;
  status: ReportJobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/** Satu baris di halaman Antrean Laporan. */
export interface ReportJobSummary extends ReportJob {
  creator_name: string | null;
  total: number;
  done_count: number;
  failed_count: number;
  pending_count: number;
  /** Jumlah siswa milik job lain yang masih di depan job ini dalam antrean. */
  ahead: number;
}

interface QueueItem {
  id: number;
  job_id: number;
  student_id: number | null;
  student_name: string;
  position: number;
  attempts: number;
  week_number: number | null;
}

export function safeFilePart(text: string): string {
  return text.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_") || "siswa";
}

function jobDir(jobId: number): string {
  return join(REPORTS_DIR, `job-${jobId}`);
}

// ---------------------------------------------------------------------------
// Memasukkan permintaan ke antrean
// ---------------------------------------------------------------------------

function createJob(
  user: User,
  kind: ReportJobKind,
  classId: number | null,
  label: string,
  students: { id: number; name: string }[]
): number {
  let jobId = 0;
  db.transaction(() => {
    jobId = Number(
      db
        .prepare(
          `INSERT INTO report_jobs (kind, class_id, label, week_number, created_by)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(kind, classId, label, getReportWeekNumber(), user.id).lastInsertRowid
    );
    const insertItem = db.prepare(
      `INSERT INTO report_job_items (job_id, student_id, student_name, position)
       VALUES (?, ?, ?, ?)`
    );
    students.forEach((s, i) => insertItem.run(jobId, s.id, s.name, i));
  })();
  kickReportWorker();
  return jobId;
}

/**
 * Laporan sekelas. Kelas yang sudah menunggu/diproses tidak dimasukkan dua kali —
 * job yang sudah ada dikembalikan dengan `existing: true`.
 */
export function enqueueClassReport(
  user: User,
  classId: number
): { jobId: number; existing: boolean } | { error: string } {
  const kelas = db.prepare("SELECT name FROM classes WHERE id = ?").get(classId) as
    | { name: string }
    | null;
  if (!kelas) return { error: "Kelas tidak ditemukan." };

  const active = db
    .prepare(
      `SELECT id FROM report_jobs
       WHERE kind = 'kelas' AND class_id = ? AND status IN ('queued', 'running')
       ORDER BY id LIMIT 1`
    )
    .get(classId) as { id: number } | null;
  if (active) return { jobId: active.id, existing: true };

  const students = db
    .prepare("SELECT id, name FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE ASC")
    .all(classId) as { id: number; name: string }[];
  if (students.length === 0) return { error: `Belum ada siswa di kelas ${kelas.name}.` };

  return { jobId: createJob(user, "kelas", classId, `Kelas ${kelas.name}`, students), existing: false };
}

export function enqueueStudentReport(
  user: User,
  studentId: number
): { jobId: number; existing: boolean } | { error: string } {
  const student = db
    .prepare("SELECT id, name, class_id FROM students WHERE id = ?")
    .get(studentId) as { id: number; name: string; class_id: number | null } | null;
  if (!student) return { error: "Siswa tidak ditemukan." };

  const active = db
    .prepare(
      `SELECT j.id FROM report_jobs j
       JOIN report_job_items i ON i.job_id = j.id
       WHERE j.kind = 'siswa' AND i.student_id = ? AND j.status IN ('queued', 'running')
       ORDER BY j.id LIMIT 1`
    )
    .get(studentId) as { id: number } | null;
  if (active) return { jobId: active.id, existing: true };

  return {
    jobId: createJob(user, "siswa", student.class_id, student.name, [student]),
    existing: false,
  };
}

// ---------------------------------------------------------------------------
// Membaca & mengelola job
// ---------------------------------------------------------------------------

export function getReportJob(jobId: number): ReportJob | null {
  return db.prepare("SELECT * FROM report_jobs WHERE id = ?").get(jobId) as ReportJob | null;
}

/** Admin melihat semua job; guru hanya job yang ia buat sendiri. */
export function canAccessReportJob(user: User, job: ReportJob): boolean {
  return user.role === "admin" || job.created_by === user.id;
}

export function listReportJobs(user: User, limit = 30): ReportJobSummary[] {
  const onlyMine = user.role !== "admin";
  return db
    .prepare(
      `SELECT j.*, u.name AS creator_name,
              (SELECT COUNT(*) FROM report_job_items i WHERE i.job_id = j.id) AS total,
              (SELECT COUNT(*) FROM report_job_items i WHERE i.job_id = j.id AND i.status = 'done') AS done_count,
              (SELECT COUNT(*) FROM report_job_items i WHERE i.job_id = j.id AND i.status = 'failed') AS failed_count,
              (SELECT COUNT(*) FROM report_job_items i
                 WHERE i.job_id = j.id AND i.status IN ('pending', 'running')) AS pending_count,
              (SELECT COUNT(*) FROM report_job_items i2
                 JOIN report_jobs j2 ON j2.id = i2.job_id
                 WHERE j2.id < j.id AND j2.status IN ('queued', 'running')
                   AND i2.status IN ('pending', 'running')) AS ahead
       FROM report_jobs j
       LEFT JOIN users u ON u.id = j.created_by
       ${onlyMine ? "WHERE j.created_by = ?" : ""}
       ORDER BY j.id DESC
       LIMIT ?`
    )
    .all(...(onlyMine ? [user.id, limit] : [limit])) as ReportJobSummary[];
}

/** Daftar siswa yang gagal pada sebuah job, untuk ditampilkan di halaman antrean. */
export function listFailedItems(jobId: number): { student_name: string; error: string | null }[] {
  return db
    .prepare(
      `SELECT student_name, error FROM report_job_items
       WHERE job_id = ? AND status = 'failed' ORDER BY position`
    )
    .all(jobId) as { student_name: string; error: string | null }[];
}

export function cancelReportJob(jobId: number): void {
  db.transaction(() => {
    db.prepare(
      "UPDATE report_job_items SET status = 'canceled' WHERE job_id = ? AND status = 'pending'"
    ).run(jobId);
    db.prepare(
      `UPDATE report_jobs SET status = 'canceled', finished_at = datetime('now')
       WHERE id = ? AND status IN ('queued', 'running')`
    ).run(jobId);
  })();
  // Siswa yang sedang diproses saat dibatalkan tetap diselesaikan pekerja; hasilnya
  // ikut tersimpan dan bisa diunduh.
}

/** Siswa yang gagal dimasukkan lagi ke antrean, di posisi job ini (bukan paling belakang). */
export function retryFailedItems(jobId: number): number {
  let count = 0;
  db.transaction(() => {
    count = db
      .prepare(
        `UPDATE report_job_items SET status = 'pending', attempts = 0, error = NULL, finished_at = NULL
         WHERE job_id = ? AND status = 'failed'`
      )
      .run(jobId).changes;
    if (count > 0) {
      db.prepare(
        "UPDATE report_jobs SET status = 'queued', finished_at = NULL WHERE id = ?"
      ).run(jobId);
    }
  })();
  if (count > 0) kickReportWorker();
  return count;
}

/**
 * Berkas unduhan sebuah job: PDF tunggal untuk job satu siswa, ZIP untuk job sekelas.
 * ZIP disusun saat diunduh dari PDF yang sudah tersimpan (cepat, tanpa memanggil Canva).
 */
export async function buildReportDownload(
  job: ReportJob
): Promise<{ fileName: string; contentType: string; data: Buffer } | null> {
  const items = db
    .prepare(
      `SELECT student_name, status, error, file_name FROM report_job_items
       WHERE job_id = ? ORDER BY position`
    )
    .all(job.id) as {
    student_name: string;
    status: string;
    error: string | null;
    file_name: string | null;
  }[];

  const ready = items.filter(
    (i) => i.status === "done" && i.file_name && existsSync(join(jobDir(job.id), i.file_name))
  );
  if (ready.length === 0) return null;

  const pekan = job.week_number ? `_Pekan-${job.week_number}` : "";

  if (job.kind === "siswa") {
    return {
      fileName: `Laporan_Pekanan_${safeFilePart(ready[0]!.student_name)}${pekan}.pdf`,
      contentType: "application/pdf",
      data: readFileSync(join(jobDir(job.id), ready[0]!.file_name!)),
    };
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const item of ready) {
    // Dua siswa sekelas bisa bernama sama — diberi akhiran supaya tidak saling timpa di ZIP.
    let name = `${safeFilePart(item.student_name)}.pdf`;
    for (let n = 2; usedNames.has(name); n++) name = `${safeFilePart(item.student_name)}_${n}.pdf`;
    usedNames.add(name);
    zip.file(name, readFileSync(join(jobDir(job.id), item.file_name!)));
  }

  const missing = items.filter((i) => !ready.includes(i));
  if (missing.length > 0) {
    const lines = missing.map((i) => {
      const reason =
        i.status === "failed"
          ? i.error || "gagal"
          : i.status === "canceled"
            ? "dibatalkan"
            : "belum selesai diproses";
      return `- ${i.student_name}: ${reason}`;
    });
    zip.file(
      "RINGKASAN.txt",
      `${ready.length} dari ${items.length} laporan ada di ZIP ini.\n` +
        `Siswa berikut belum punya laporan:\n\n${lines.join("\n")}\n`
    );
  }

  return {
    fileName: `Laporan_Pekanan_${safeFilePart(job.label)}${pekan}.zip`,
    contentType: "application/zip",
    data: await zip.generateAsync({ type: "nodebuffer" }),
  };
}

// ---------------------------------------------------------------------------
// Pekerja antrean
// ---------------------------------------------------------------------------

let started = false;
let busy = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastStartAt = 0;

/** Siswa terdepan dalam antrean: job paling lama dulu, lalu urutan siswa di dalamnya. */
function nextItem(): QueueItem | null {
  return db
    .prepare(
      `SELECT i.id, i.job_id, i.student_id, i.student_name, i.position, i.attempts, j.week_number
       FROM report_job_items i
       JOIN report_jobs j ON j.id = i.job_id
       WHERE i.status = 'pending' AND j.status IN ('queued', 'running')
       ORDER BY j.id ASC, i.position ASC
       LIMIT 1`
    )
    .get() as QueueItem | null;
}

function finalizeJobIfComplete(jobId: number): void {
  const open = db
    .prepare(
      "SELECT COUNT(*) AS c FROM report_job_items WHERE job_id = ? AND status IN ('pending', 'running')"
    )
    .get(jobId) as { c: number };
  if (open.c > 0) return;

  db.prepare(
    `UPDATE report_jobs
     SET status = CASE WHEN status = 'canceled' THEN 'canceled' ELSE 'done' END,
         finished_at = COALESCE(finished_at, datetime('now'))
     WHERE id = ?`
  ).run(jobId);
}

function markItem(itemId: number, status: "done" | "failed" | "pending", fields: {
  error?: string | null;
  fileName?: string | null;
} = {}): void {
  db.prepare(
    `UPDATE report_job_items
     SET status = ?, error = ?, file_name = COALESCE(?, file_name),
         finished_at = CASE WHEN ? = 'pending' THEN NULL ELSE datetime('now') END
     WHERE id = ?`
  ).run(status, fields.error ?? null, fields.fileName ?? null, status, itemId);
}

/** Memproses satu siswa. Mengembalikan jeda (ms) sebelum giliran berikutnya. */
async function processItem(item: QueueItem): Promise<number> {
  db.prepare(
    "UPDATE report_job_items SET status = 'running', attempts = attempts + 1 WHERE id = ?"
  ).run(item.id);
  db.prepare(
    `UPDATE report_jobs SET status = 'running', started_at = COALESCE(started_at, datetime('now'))
     WHERE id = ? AND status = 'queued'`
  ).run(item.job_id);

  const student = item.student_id
    ? (db.prepare("SELECT id, name, photo_path FROM students WHERE id = ?").get(item.student_id) as {
        id: number;
        name: string;
        photo_path: string | null;
      } | null)
    : null;

  if (!student) {
    markItem(item.id, "failed", { error: "Data siswa sudah dihapus." });
    finalizeJobIfComplete(item.job_id);
    return 0;
  }

  try {
    const pdf = await generateWeeklyReportViaCanva(
      student,
      item.week_number,
      getWeeklyAyahMemorized(student.id)
    );
    const dir = jobDir(item.job_id);
    mkdirSync(dir, { recursive: true });
    const fileName = `item-${item.id}.pdf`;
    writeFileSync(join(dir, fileName), pdf);
    markItem(item.id, "done", { fileName });
    finalizeJobIfComplete(item.job_id);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui.";

    if (err instanceof CanvaAuthError) {
      // Bukan salah siswa ini — kembalikan ke antrean tanpa menghabiskan jatah percobaan.
      // Pekerja otomatis berhenti karena Canva kini tercatat belum terhubung.
      db.prepare(
        "UPDATE report_job_items SET status = 'pending', attempts = attempts - 1, error = ? WHERE id = ?"
      ).run(message, item.id);
      console.warn(`[antrean-laporan] Berhenti sementara: ${message}`);
      return IDLE_POLL_MS;
    }

    if (item.attempts + 1 >= MAX_ATTEMPTS) {
      markItem(item.id, "failed", { error: message });
      finalizeJobIfComplete(item.job_id);
      console.warn(`[antrean-laporan] ${student.name} gagal setelah ${MAX_ATTEMPTS} percobaan: ${message}`);
      return 0;
    }

    // Galat sesaat (jaringan, Canva sibuk): siswa ini tetap di depan antrean dan dicoba
    // lagi setelah jeda, supaya urutan FIFO tidak berubah.
    markItem(item.id, "pending", { error: message });
    return RETRY_DELAY_MS;
  }
}

function schedule(ms: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void tick(), Math.max(0, ms));
}

async function tick(): Promise<void> {
  if (busy) return;
  busy = true;
  let next = IDLE_POLL_MS;

  try {
    const item = nextItem();
    if (!item) return;

    // Belum siap: biarkan antrean menunggu sampai admin menghubungkan Canva.
    if (!isCanvaConnected() || !getBrandTemplateId()) return;

    const wait = lastStartAt + MIN_GAP_MS - Date.now();
    if (wait > 0) {
      next = wait;
      return;
    }

    lastStartAt = Date.now();
    next = await processItem(item);
  } catch (err) {
    console.error("[antrean-laporan] Galat tak terduga:", err);
  } finally {
    busy = false;
    schedule(next);
  }
}

/** Membangunkan pekerja segera (mis. setelah job baru masuk), bukan menunggu jadwal berikutnya. */
export function kickReportWorker(): void {
  if (started && !busy) schedule(0);
}

/** Menghapus job yang sudah selesai lebih dari KEEP_DAYS hari, beserta berkas PDF-nya. */
function cleanupOldJobs(): void {
  const old = db
    .prepare(
      `SELECT id FROM report_jobs
       WHERE status IN ('done', 'canceled') AND finished_at < datetime('now', ?)`
    )
    .all(`-${KEEP_DAYS} days`) as { id: number }[];

  for (const { id } of old) {
    rmSync(jobDir(id), { recursive: true, force: true });
    db.prepare("DELETE FROM report_jobs WHERE id = ?").run(id);
  }
  if (old.length > 0) console.log(`[antrean-laporan] ${old.length} job lama dibersihkan.`);
}

/** Dipanggil sekali saat server mulai. */
export function startReportWorker(): void {
  if (started) return;
  started = true;

  // Siswa yang sedang diproses saat server mati/restart dikembalikan ke antrean.
  const recovered = db
    .prepare("UPDATE report_job_items SET status = 'pending' WHERE status = 'running'")
    .run().changes;
  if (recovered > 0) {
    console.log(`[antrean-laporan] ${recovered} laporan yang terputus dimasukkan lagi ke antrean.`);
  }

  cleanupOldJobs();
  setInterval(cleanupOldJobs, 6 * 60 * 60 * 1000);
  schedule(0);
}
