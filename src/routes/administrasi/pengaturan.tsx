import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.ts";
import { redirectWith } from "../../lib/http.ts";
import {
  getSiteName,
  setSiteName,
  getFaviconUrl,
  hasCustomFavicon,
  setFaviconFromFile,
  resetFavicon,
  getReportLogo,
  setReportLogoFromFile,
  resetReportLogo,
  getReportSchoolName,
  setReportSchoolName,
  getReportContact,
  setReportContact,
  getSemesterStart,
  setSemesterStart,
  resetSemesterStart,
  getSemesterEnd,
  setSemesterEnd,
  resetSemesterEnd,
  getSemesterMidpoint,
} from "../../lib/settings.ts";
import { generateWeeklyReportPdf } from "../../lib/weekly-report.ts";
import {
  getCurrentDatabaseInfo,
  listBackupFiles,
  createBackupSnapshot,
  resolveBackupPath,
  restoreFromUpload,
  deleteBackupFile,
} from "../../lib/backup.ts";
import {
  isCanvaConnected,
  buildAuthorizeUrl,
  generatePkcePair,
  exchangeCodeForToken,
  disconnectCanva,
  getBrandTemplateId,
  setBrandTemplateId,
  clearBrandTemplateId,
  getCanvaConfigStatus,
} from "../../lib/canva.ts";
import { kickReportWorker } from "../../lib/report-queue.ts";
import { SettingsPage } from "../../views/pages/SettingsPage.tsx";
import { ReportSettingsPage } from "../../views/pages/ReportSettingsPage.tsx";
import { BackupPage } from "../../views/pages/BackupPage.tsx";
import { RestoreDonePage } from "../../views/pages/RestoreDonePage.tsx";
import { CanvaSettingsPage } from "../../views/pages/CanvaSettingsPage.tsx";
import type { Env } from "../../types.ts";
import { publicMessage } from "../../lib/errors.ts";
import { audit } from "../../lib/logger.ts";

const pengaturan = new Hono<Env>();

pengaturan.use("*", authMiddleware, adminMiddleware);

const BASE = "/administrasi/pengaturan";

pengaturan.get("/", (c) => {
  const user = c.get("user");

  return c.html(
    <SettingsPage
      user={user}
      siteName={getSiteName()}
      faviconUrl={getFaviconUrl()}
      hasCustomFavicon={hasCustomFavicon()}
    />
  );
});

pengaturan.post("/nama", async (c) => {
  const body = await c.req.parseBody();
  const siteName = String(body.site_name || "");

  try {
    setSiteName(siteName);
  } catch (err) {
    const message = publicMessage(err, "Gagal menyimpan nama situs.");
    return redirectWith(c, BASE, "error", message);
  }

  return redirectWith(c, BASE, "success", "Nama situs berhasil diperbarui.");
});

pengaturan.post("/favicon", async (c) => {
  const body = await c.req.parseBody();
  const file = body.favicon;

  if (!(file instanceof File)) {
    return redirectWith(c, BASE, "error", "Pilih berkas favicon terlebih dahulu.");
  }

  try {
    await setFaviconFromFile(file);
  } catch (err) {
    const message = publicMessage(err, "Gagal mengunggah favicon.");
    return redirectWith(c, BASE, "error", message);
  }

  return redirectWith(c, BASE, "success", "Favicon berhasil diperbarui.");
});

pengaturan.post("/favicon/reset", (c) => {
  resetFavicon();
  return redirectWith(c, BASE, "success", "Favicon dikembalikan ke bawaan aplikasi.");
});

const LAPORAN_BASE = `${BASE}/laporan`;

pengaturan.get("/laporan", (c) => {
  const user = c.get("user");

  return c.html(
    <ReportSettingsPage
      user={user}
      reportLogo={getReportLogo()}
      reportSchoolName={getReportSchoolName()}
      contact={getReportContact()}
      semesterStart={getSemesterStart()}
      semesterEnd={getSemesterEnd()}
      semesterMidpoint={getSemesterMidpoint()}
    />
  );
});

pengaturan.post("/laporan/logo", async (c) => {
  const body = await c.req.parseBody();
  const file = body.logo;

  if (!(file instanceof File)) {
    return redirectWith(c, LAPORAN_BASE, "error", "Pilih berkas logo terlebih dahulu.");
  }

  try {
    await setReportLogoFromFile(file);
  } catch (err) {
    const message = publicMessage(err, "Gagal mengunggah logo laporan.");
    return redirectWith(c, LAPORAN_BASE, "error", message);
  }

  return redirectWith(c, LAPORAN_BASE, "success", "Logo laporan berhasil diperbarui.");
});

pengaturan.post("/laporan/logo/reset", (c) => {
  resetReportLogo();
  return redirectWith(c, LAPORAN_BASE, "success", "Logo laporan dihapus.");
});

pengaturan.post("/laporan/identitas", async (c) => {
  const body = await c.req.parseBody();

  try {
    setReportSchoolName(String(body.report_school_name || ""));
    setReportContact({
      website: String(body.website || ""),
      whatsapp: String(body.whatsapp || ""),
      instagram: String(body.instagram || ""),
      tiktok: String(body.tiktok || ""),
    });
  } catch (err) {
    const message = publicMessage(err, "Gagal menyimpan identitas laporan.");
    return redirectWith(c, LAPORAN_BASE, "error", message);
  }

  return redirectWith(c, LAPORAN_BASE, "success", "Identitas laporan berhasil disimpan.");
});

pengaturan.post("/laporan/semester", async (c) => {
  const body = await c.req.parseBody();
  const tanggal = String(body.semester_start || "");

  try {
    setSemesterStart(tanggal);
  } catch (err) {
    const message = publicMessage(err, "Tanggal tidak valid.");
    return redirectWith(c, LAPORAN_BASE, "error", message);
  }

  return redirectWith(c, LAPORAN_BASE, "success", "Tanggal mulai semester disimpan.");
});

pengaturan.post("/laporan/semester/reset", (c) => {
  resetSemesterStart();
  return redirectWith(c, LAPORAN_BASE, "success", "Tanggal mulai semester dihapus.");
});

pengaturan.post("/laporan/semester-selesai", async (c) => {
  const body = await c.req.parseBody();
  const tanggal = String(body.semester_end || "");

  try {
    setSemesterEnd(tanggal);
  } catch (err) {
    const message = publicMessage(err, "Tanggal tidak valid.");
    return redirectWith(c, LAPORAN_BASE, "error", message);
  }

  return redirectWith(c, LAPORAN_BASE, "success", "Tanggal selesai semester disimpan.");
});

pengaturan.post("/laporan/semester-selesai/reset", (c) => {
  resetSemesterEnd();
  return redirectWith(c, LAPORAN_BASE, "success", "Tanggal selesai semester dihapus.");
});

/**
 * Contoh PDF Laporan Periode dengan data fiktif, supaya admin bisa cek logo, nama
 * sekolah, dan kontak tanpa siswa asli. (Laporan Pekanan kini lewat Canva.)
 */
pengaturan.get("/laporan/pratinjau", async (c) => {
  const pdf = await generateWeeklyReportPdf(
    { id: 0, name: "Ahmad Fauzan (Contoh)", photo_path: null },
    null,
    { sampleAyat: 120, heading: "Laporan Tengah Semester", periodLabel: "selama tengah semester ini" }
  );

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", 'inline; filename="Contoh_Laporan_Periode.pdf"');
  return c.body(new Uint8Array(pdf));
});

const BACKUP_BASE = `${BASE}/backup`;

pengaturan.get("/backup", (c) => {
  const user = c.get("user");

  return c.html(
    <BackupPage user={user} database={getCurrentDatabaseInfo()} backups={listBackupFiles()} />
  );
});

/** Cadangan baru dibuat sesaat sebelum diunduh, supaya isinya selalu terbaru. */
pengaturan.get("/backup/unduh", (c) => {
  const snapshot = createBackupSnapshot("manual");
  const path = resolveBackupPath(snapshot.filename);

  if (!path) {
    return redirectWith(c, BACKUP_BASE, "error", "Gagal membuat berkas cadangan.");
  }

  const data = readFileSync(path);
  audit(c, "cadangan.diunduh", { file: snapshot.filename });
  c.header("Content-Type", "application/octet-stream");
  c.header("Content-Disposition", `attachment; filename="${snapshot.filename}"`);
  return c.body(data);
});

/** Mengunduh cadangan yang sudah ada (otomatis dari migrasi, atau manual sebelumnya). */
pengaturan.get("/backup/unduh/:filename", (c) => {
  const filename = c.req.param("filename");
  const path = resolveBackupPath(filename);

  if (!path) {
    return redirectWith(c, BACKUP_BASE, "error", "Berkas cadangan tidak ditemukan.");
  }

  const data = readFileSync(path);
  audit(c, "cadangan.diunduh", { file: filename });
  c.header("Content-Type", "application/octet-stream");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(data);
});

pengaturan.post("/backup/hapus", async (c) => {
  const body = await c.req.parseBody();
  const filename = String(body.filename || "");

  const deleted = deleteBackupFile(filename);

  if (!deleted) {
    return redirectWith(c, BACKUP_BASE, "error", "Berkas cadangan tidak ditemukan.");
  }

  audit(c, "cadangan.dihapus", { file: filename }, "warn");
  return redirectWith(c, BACKUP_BASE, "success", `Cadangan "${filename}" telah dihapus.`);
});

pengaturan.post("/backup/pulihkan", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File) || file.size === 0) {
    return redirectWith(c, BACKUP_BASE, "error", "Pilih berkas cadangan (.db) terlebih dahulu.");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = restoreFromUpload(buffer);

  if (!result.ok) {
    audit(c, "cadangan.pemulihan_ditolak", { file: file.name, alasan: result.error }, "warn");
    return redirectWith(c, BACKUP_BASE, "error", result.error);
  }

  audit(c, "cadangan.dipulihkan", { file: file.name, safetyBackup: result.safetyBackup }, "warn");

  // Dirender langsung, bukan redirect: sesi yang sedang berjalan mungkin
  // sudah tidak ada lagi pada basis data yang baru dipulihkan, sehingga
  // authMiddleware pada permintaan berikutnya bisa saja langsung
  // mengarahkan ke /login sebelum pesan sukses sempat tampil.
  return c.html(<RestoreDonePage safetyBackup={result.safetyBackup} />);
});

const CANVA_BASE = `${BASE}/canva`;
const OAUTH_STATE_COOKIE = "canva_oauth_state";
const OAUTH_VERIFIER_COOKIE = "canva_oauth_verifier";

pengaturan.get("/canva", (c) => {
  const user = c.get("user");

  return c.html(
    <CanvaSettingsPage
      user={user}
      connected={isCanvaConnected()}
      brandTemplateId={getBrandTemplateId()}
      config={getCanvaConfigStatus()}
      // Host yang sedang dibuka admin (nginx meneruskan header Host), untuk
      // mendeteksi Redirect URI yang masih menunjuk ke 127.0.0.1/laptop lain.
      currentHost={c.req.header("host") ?? null}
    />
  );
});

/** Mulai alur OAuth PKCE ke Canva. Verifier & state disimpan sesaat lewat cookie httpOnly. */
pengaturan.get("/canva/connect", async (c) => {
  // Konfigurasi .env yang belum lengkap ditampilkan sebagai pesan, bukan halaman galat 500.
  const config = getCanvaConfigStatus();
  if (!config.hasClientId || !config.hasClientSecret || !config.redirectUri) {
    return redirectWith(
      c,
      CANVA_BASE,
      "error",
      "CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, dan CANVA_REDIRECT_URI (atau APP_URL) wajib diisi di .env server, lalu aplikasi di-restart."
    );
  }

  const { verifier, challenge } = await generatePkcePair();
  const state = crypto.randomUUID();

  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });
  setCookie(c, OAUTH_VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  return c.redirect(buildAuthorizeUrl(state, challenge));
});

pengaturan.get("/canva/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const savedState = getCookie(c, OAUTH_STATE_COOKIE);
  const verifier = getCookie(c, OAUTH_VERIFIER_COOKIE);

  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
  deleteCookie(c, OAUTH_VERIFIER_COOKIE, { path: "/" });

  if (!code || !state || !verifier || state !== savedState) {
    audit(c, "canva.callback_ditolak", { message: "state OAuth tidak cocok atau kedaluwarsa" }, "warn");
    return redirectWith(
      c,
      CANVA_BASE,
      "error",
      "Proses koneksi ke Canva gagal atau kedaluwarsa. Silakan coba lagi."
    );
  }

  try {
    await exchangeCodeForToken(code, verifier);
  } catch (err) {
    const message = publicMessage(err, "Gagal menghubungkan akun Canva.");
    return redirectWith(c, CANVA_BASE, "error", message);
  }

  audit(c, "canva.terhubung");
  // Antrean laporan yang berhenti karena koneksi terputus langsung berlanjut.
  kickReportWorker();
  return redirectWith(c, CANVA_BASE, "success", "Akun Canva berhasil terhubung.");
});

pengaturan.post("/canva/disconnect", (c) => {
  disconnectCanva();
  audit(c, "canva.diputus");
  return redirectWith(c, CANVA_BASE, "success", "Akun Canva telah diputuskan.");
});

pengaturan.post("/canva/template", async (c) => {
  const body = await c.req.parseBody();
  const id = String(body.brand_template_id || "").trim();

  if (!id) {
    clearBrandTemplateId();
    return redirectWith(c, CANVA_BASE, "success", "ID Brand Template dikosongkan.");
  }

  setBrandTemplateId(id);
  kickReportWorker();
  return redirectWith(c, CANVA_BASE, "success", "ID Brand Template disimpan.");
});

export { pengaturan as pengaturanRoutes };
