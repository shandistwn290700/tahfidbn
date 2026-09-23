import { db } from "../db/connection.ts";
import { APP_NAME } from "../config.ts";

const DEFAULT_SITE_NAME = APP_NAME;

// Favicon bawaan (logo mushaf hijau) yang dipakai selama admin belum
// mengunggah favicon sendiri.
const DEFAULT_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#10b981" d="M42.4 44s-6.4-10.1-1.3-20C46.9 12.9 42.2 4 42.2 4H7s4.6 8.9-1 20c-5.1 9.9 1.3 20 1.3 20h35.1Z"/></svg>'
  );

const SITE_NAME_KEY = "site_name";
const FAVICON_KEY = "favicon";
const REPORT_LOGO_KEY = "report_logo";
const REPORT_SCHOOL_NAME_KEY = "report_school_name";
const REPORT_WEBSITE_KEY = "report_website";
const REPORT_WHATSAPP_KEY = "report_whatsapp";
const REPORT_INSTAGRAM_KEY = "report_instagram";
const REPORT_TIKTOK_KEY = "report_tiktok";
const SEMESTER_START_KEY = "semester_start_date";
const SEMESTER_END_KEY = "semester_end_date";

const ALLOWED_REPORT_LOGO_TYPES = ["image/png", "image/jpeg"];
const MAX_REPORT_LOGO_BYTES = 2 * 1024 * 1024; // 2MB — logo cetak butuh resolusi lebih tinggi dari favicon

const ALLOWED_FAVICON_TYPES = [
  "image/png",
  "image/jpeg",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/svg+xml",
];
const MAX_FAVICON_BYTES = 512 * 1024; // 512KB — cukup lega untuk sebuah ikon

function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value);
}

function clearSetting(key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function getSiteName(): string {
  return getSetting(SITE_NAME_KEY) || DEFAULT_SITE_NAME;
}

export function setSiteName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama situs tidak boleh kosong.");
  if (trimmed.length > 60) throw new Error("Nama situs maksimal 60 karakter.");
  setSetting(SITE_NAME_KEY, trimmed);
}

export function resetSiteName(): void {
  clearSetting(SITE_NAME_KEY);
}

export function getFaviconUrl(): string {
  return getSetting(FAVICON_KEY) || DEFAULT_FAVICON;
}

/** Tipe MIME favicon saat ini, dibaca dari data URL-nya, untuk atribut type pada <link>. */
export function getFaviconMimeType(): string {
  const url = getFaviconUrl();
  const match = /^data:([^;,]+)/.exec(url);
  return match?.[1] || "image/svg+xml";
}

export function hasCustomFavicon(): boolean {
  return getSetting(FAVICON_KEY) !== null;
}

export async function setFaviconFromFile(file: File): Promise<void> {
  if (!file || file.size === 0) {
    throw new Error("Pilih berkas favicon terlebih dahulu.");
  }
  if (!ALLOWED_FAVICON_TYPES.includes(file.type)) {
    throw new Error("Format favicon harus PNG, JPG, ICO, atau SVG.");
  }
  if (file.size > MAX_FAVICON_BYTES) {
    throw new Error("Ukuran favicon maksimal 512KB.");
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  setSetting(FAVICON_KEY, `data:${file.type};base64,${base64}`);
}

export function resetFavicon(): void {
  clearSetting(FAVICON_KEY);
}

/** Logo khusus laporan cetak (PNG/JPEG, resolusi lebih tinggi dari favicon). */
export function getReportLogo(): string | null {
  return getSetting(REPORT_LOGO_KEY);
}

export async function setReportLogoFromFile(file: File): Promise<void> {
  if (!file || file.size === 0) {
    throw new Error("Pilih berkas logo terlebih dahulu.");
  }
  if (!ALLOWED_REPORT_LOGO_TYPES.includes(file.type)) {
    throw new Error("Format logo laporan harus PNG atau JPEG (SVG tidak didukung untuk PDF).");
  }
  if (file.size > MAX_REPORT_LOGO_BYTES) {
    throw new Error("Ukuran logo laporan maksimal 2MB.");
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  setSetting(REPORT_LOGO_KEY, `data:${file.type};base64,${base64}`);
}

export function resetReportLogo(): void {
  clearSetting(REPORT_LOGO_KEY);
}

/** Nama sekolah yang tampil di laporan cetak — terpisah dari nama situs (judul tab peramban). */
export function getReportSchoolName(): string {
  return getSetting(REPORT_SCHOOL_NAME_KEY) || getSiteName();
}

export function setReportSchoolName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) {
    clearSetting(REPORT_SCHOOL_NAME_KEY);
    return;
  }
  if (trimmed.length > 80) throw new Error("Nama sekolah maksimal 80 karakter.");
  setSetting(REPORT_SCHOOL_NAME_KEY, trimmed);
}

export interface ReportContact {
  website: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
}

export function getReportContact(): ReportContact {
  return {
    website: getSetting(REPORT_WEBSITE_KEY) || "",
    whatsapp: getSetting(REPORT_WHATSAPP_KEY) || "",
    instagram: getSetting(REPORT_INSTAGRAM_KEY) || "",
    tiktok: getSetting(REPORT_TIKTOK_KEY) || "",
  };
}

export function setReportContact(contact: ReportContact): void {
  const set = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) setSetting(key, trimmed);
    else clearSetting(key);
  };
  set(REPORT_WEBSITE_KEY, contact.website);
  set(REPORT_WHATSAPP_KEY, contact.whatsapp);
  set(REPORT_INSTAGRAM_KEY, contact.instagram);
  set(REPORT_TIKTOK_KEY, contact.tiktok);
}

/**
 * Tanggal mulai semester/tahun ajaran berjalan, dasar penghitungan
 * "pekan ke-N" pada laporan mingguan. Disimpan sebagai teks "YYYY-MM-DD".
 */
export function getSemesterStart(): string | null {
  return getSetting(SEMESTER_START_KEY);
}

export function setSemesterStart(dateStr: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("Format tanggal tidak valid.");
  }
  setSetting(SEMESTER_START_KEY, dateStr);
}

export function resetSemesterStart(): void {
  clearSetting(SEMESTER_START_KEY);
}

/**
 * Pekan ke berapa hari ini, dihitung dari tanggal mulai semester. Null bila
 * admin belum mengatur tanggal mulai semester di Pengaturan.
 */
export function getCurrentSemesterWeek(): number | null {
  const start = getSemesterStart();
  if (!start) return null;

  const startDate = new Date(`${start}T00:00:00`);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;

  return Math.floor(diffDays / 7) + 1;
}

/**
 * Tanggal selesai semester/tahun ajaran berjalan — dasar penghitungan
 * "tengah semester" dan cakupan Laporan Semester. Disimpan sebagai teks
 * "YYYY-MM-DD", terpisah dari tanggal mulai supaya keduanya bisa diubah
 * sendiri-sendiri.
 */
export function getSemesterEnd(): string | null {
  return getSetting(SEMESTER_END_KEY);
}

export function setSemesterEnd(dateStr: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("Format tanggal tidak valid.");
  }
  setSetting(SEMESTER_END_KEY, dateStr);
}

export function resetSemesterEnd(): void {
  clearSetting(SEMESTER_END_KEY);
}

/**
 * Tanggal tengah semester — titik tengah antara tanggal mulai dan selesai.
 * Null bila salah satu dari keduanya belum diatur.
 */
export function getSemesterMidpoint(): string | null {
  const start = getSemesterStart();
  const end = getSemesterEnd();
  if (!start || !end) return null;

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (endDate <= startDate) return null;

  const midTime = startDate.getTime() + Math.floor((endDate.getTime() - startDate.getTime()) / 2);
  return new Date(midTime).toISOString().slice(0, 10);
}

/** Rentang tanggal Laporan Tengah Semester: dari awal semester sampai titik tengah. */
export function getMidSemesterRange(): { from: string; to: string } | null {
  const start = getSemesterStart();
  const mid = getSemesterMidpoint();
  if (!start || !mid) return null;
  return { from: start, to: mid };
}

/**
 * Rentang tanggal Laporan Semester: dari awal semester sampai tanggal
 * selesai, atau sampai hari ini bila tanggal selesai belum terlewati.
 */
export function getFullSemesterRange(): { from: string; to: string } | null {
  const start = getSemesterStart();
  const end = getSemesterEnd();
  if (!start || !end) return null;

  const today = new Date().toISOString().slice(0, 10);
  return { from: start, to: end < today ? end : today };
}
