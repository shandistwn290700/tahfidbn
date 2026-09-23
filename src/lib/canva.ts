import { existsSync, readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import { db } from "../db/connection.ts";
import { getPhotoDiskPath } from "./photos.ts";
import { getStudentProgress } from "./progress-calc.ts";

const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const API_BASE = "https://api.canva.com/rest/v1";
const TOKEN_URL = `${API_BASE}/oauth/token`;

const ACCESS_TOKEN_KEY = "canva_access_token";
const REFRESH_TOKEN_KEY = "canva_refresh_token";
const EXPIRES_AT_KEY = "canva_token_expires_at";
const BRAND_TEMPLATE_ID_KEY = "canva_brand_template_id";

/**
 * Scope yang diminta harus berupa subset dari scope yang diaktifkan di
 * dashboard Canva Developers untuk app ini — meminta lebih dari itu akan
 * ditolak saat proses otorisasi.
 */
const SCOPES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "asset:write",
  "brandtemplate:content:read",
].join(" ");

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabel lingkungan ${name} belum diisi di .env.`);
  return value;
}

function getCanvaClientId(): string {
  return requireEnv("CANVA_CLIENT_ID");
}

function getCanvaClientSecret(): string {
  return requireEnv("CANVA_CLIENT_SECRET");
}

function getCanvaRedirectUri(): string {
  return requireEnv("CANVA_REDIRECT_URI");
}

function base64Url(input: ArrayBuffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64Url(digest);
}

/** Canva mewajibkan PKCE — verifier disimpan sementara (cookie) selama roundtrip OAuth. */
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getCanvaClientId(),
    redirect_uri: getCanvaRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const credentials = Buffer.from(`${getCanvaClientId()}:${getCanvaClientSecret()}`).toString(
    "base64"
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gagal menghubungi Canva (${response.status}): ${text}`);
  }

  return (await response.json()) as TokenResponse;
}

function storeTokens(tokens: TokenResponse): void {
  setSetting(ACCESS_TOKEN_KEY, tokens.access_token);
  if (tokens.refresh_token) setSetting(REFRESH_TOKEN_KEY, tokens.refresh_token);
  setSetting(EXPIRES_AT_KEY, String(Date.now() + tokens.expires_in * 1000));
}

export async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<void> {
  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: getCanvaRedirectUri(),
    })
  );
  storeTokens(tokens);
}

async function refreshTokens(refreshToken: string): Promise<void> {
  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
  storeTokens(tokens);
}

export function isCanvaConnected(): boolean {
  return getSetting(ACCESS_TOKEN_KEY) !== null;
}

export function disconnectCanva(): void {
  clearSetting(ACCESS_TOKEN_KEY);
  clearSetting(REFRESH_TOKEN_KEY);
  clearSetting(EXPIRES_AT_KEY);
}

/** Token akses yang masih berlaku, memperbarui otomatis lewat refresh token bila sudah kedaluwarsa. */
export async function getValidAccessToken(): Promise<string> {
  const accessToken = getSetting(ACCESS_TOKEN_KEY);
  const refreshToken = getSetting(REFRESH_TOKEN_KEY);
  const expiresAt = Number(getSetting(EXPIRES_AT_KEY) || 0);

  if (!accessToken || !refreshToken) {
    throw new Error("Akun Canva belum terhubung.");
  }

  // Diperbarui 60 detik lebih awal untuk menghindari kedaluwarsa di tengah permintaan.
  if (Date.now() > expiresAt - 60_000) {
    await refreshTokens(refreshToken);
    return getSetting(ACCESS_TOKEN_KEY)!;
  }

  return accessToken;
}

export function getBrandTemplateId(): string | null {
  return getSetting(BRAND_TEMPLATE_ID_KEY);
}

export function setBrandTemplateId(id: string): void {
  setSetting(BRAND_TEMPLATE_ID_KEY, id.trim());
}

export function clearBrandTemplateId(): void {
  clearSetting(BRAND_TEMPLATE_ID_KEY);
}

async function canvaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export interface AutofillField {
  type: "text" | "image";
  value: string;
}

/**
 * Mengisi Brand Template dengan data (Autofill API). Mengembalikan job id
 * yang perlu dipoll lewat pollAutofillJob() sampai statusnya selesai.
 */
export async function startAutofillJob(
  brandTemplateId: string,
  data: Record<string, AutofillField>
): Promise<string> {
  const payload: Record<string, { type: string; text?: string; asset_id?: string }> = {};
  for (const [key, field] of Object.entries(data)) {
    payload[key] =
      field.type === "image"
        ? { type: "image", asset_id: field.value }
        : { type: "text", text: field.value };
  }

  const response = await canvaFetch("/autofills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand_template_id: brandTemplateId, data: payload }),
  });

  if (!response.ok) {
    throw new Error(`Gagal memulai autofill Canva (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { job: { id: string } };
  return body.job.id;
}

export interface AutofillResult {
  status: "in_progress" | "success" | "failed";
  designId?: string;
  error?: string;
}

export async function pollAutofillJob(jobId: string): Promise<AutofillResult> {
  const response = await canvaFetch(`/autofills/${jobId}`);
  if (!response.ok) {
    throw new Error(`Gagal memeriksa status autofill (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as {
    job: {
      status: "in_progress" | "success" | "failed";
      result?: { design: { id: string } };
      error?: { message: string };
    };
  };

  return {
    status: body.job.status,
    designId: body.job.result?.design.id,
    error: body.job.error?.message,
  };
}

/** Mengunggah satu berkas (mis. foto siswa) sebagai asset Canva, dipakai untuk field bertipe gambar. */
export async function uploadAsset(fileName: string, data: Uint8Array): Promise<string> {
  const response = await canvaFetch("/asset-uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: Buffer.from(fileName).toString("base64") }),
    },
    body: data,
  });

  if (!response.ok) {
    throw new Error(`Gagal mengunggah aset ke Canva (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { job: { id: string } };
  const jobId = body.job.id;

  // Job unggahan biasanya selesai dalam hitungan detik — dipoll singkat di sini
  // supaya pemanggil cukup mendapat asset_id secara langsung.
  for (let attempt = 0; attempt < 20; attempt++) {
    const statusResponse = await canvaFetch(`/asset-uploads/${jobId}`);
    if (!statusResponse.ok) {
      throw new Error(`Gagal memeriksa status unggahan aset (${statusResponse.status}).`);
    }
    const statusBody = (await statusResponse.json()) as {
      job: { status: "in_progress" | "success" | "failed"; asset?: { id: string }; error?: { message: string } };
    };
    if (statusBody.job.status === "success" && statusBody.job.asset) {
      return statusBody.job.asset.id;
    }
    if (statusBody.job.status === "failed") {
      throw new Error(statusBody.job.error?.message || "Gagal mengunggah aset ke Canva.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Batas waktu menunggu unggahan aset ke Canva terlampaui.");
}

/** Mengekspor desain hasil autofill sebagai PDF, mengembalikan URL unduhan sementara. */
export async function exportDesignAsPdf(designId: string): Promise<string> {
  const response = await canvaFetch("/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ design_id: designId, format: { type: "pdf" } }),
  });

  if (!response.ok) {
    throw new Error(`Gagal memulai ekspor Canva (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { job: { id: string } };
  const jobId = body.job.id;

  for (let attempt = 0; attempt < 40; attempt++) {
    const statusResponse = await canvaFetch(`/exports/${jobId}`);
    if (!statusResponse.ok) {
      throw new Error(`Gagal memeriksa status ekspor (${statusResponse.status}).`);
    }
    const statusBody = (await statusResponse.json()) as {
      job: {
        status: "in_progress" | "success" | "failed";
        urls?: string[];
        error?: { message: string };
      };
    };
    if (statusBody.job.status === "success" && statusBody.job.urls?.[0]) {
      return statusBody.job.urls[0];
    }
    if (statusBody.job.status === "failed") {
      throw new Error(statusBody.job.error?.message || "Gagal mengekspor desain Canva.");
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  throw new Error("Batas waktu menunggu ekspor Canva terlampaui.");
}

export interface CanvaReportStudent {
  id: number;
  name: string;
  photo_path: string | null;
}

/**
 * Menghasilkan laporan pekanan lewat Autofill Brand Template Canva —
 * padanan generateWeeklyReportPdf() di weekly-report.ts, tapi lewat Canva
 * alih-alih pdfkit. Field yang diisi: nama, pekan, ayat, ayat_sebelum,
 * ayat_total, foto (opsional). `ayat_sebelum` = total hafalan saat ini
 * (getStudentProgress) dikurangi tambahan pekan ini, supaya konsisten
 * secara matematis: sebelum + ayat = total. Untuk siswa yang seluruh
 * riwayatnya baru tercatat dalam 7 hari terakhir (mis. baru pertama kali
 * diinput), `ayat_sebelum` wajar bernilai 0 karena memang belum ada apa-apa
 * sebelum jendela pekan berjalan ini — itu bukan galat hitung.
 */
export async function generateWeeklyReportViaCanva(
  student: CanvaReportStudent,
  weekNumber: number | null,
  ayat: number
): Promise<Buffer> {
  const brandTemplateId = getBrandTemplateId();
  if (!brandTemplateId) {
    throw new Error("ID Brand Template Canva belum diatur di Administrasi › Pengaturan › Integrasi Canva.");
  }

  const totalKeseluruhan = getStudentProgress(student.id).totalMemorized;
  const totalSebelum = Math.max(0, totalKeseluruhan - ayat);

  const fields: Record<string, AutofillField> = {
    nama: { type: "text", value: student.name },
    pekan: { type: "text", value: weekNumber ? String(weekNumber) : "-" },
    ayat: { type: "text", value: `${ayat} ayat.` },
    ayat_sebelum: { type: "text", value: `${totalSebelum} ayat` },
    ayat_total: { type: "text", value: `${totalKeseluruhan} ayat` },
  };

  // Foto opsional — bila siswa belum punya foto, field ini dilewati dan
  // Canva mempertahankan gambar bawaan template (bukan kegagalan).
  if (student.photo_path) {
    const diskPath = getPhotoDiskPath(student.photo_path);
    if (existsSync(diskPath)) {
      const data = new Uint8Array(readFileSync(diskPath));
      const fileName = student.photo_path.split("/").pop() || `foto-${student.id}`;
      const assetId = await uploadAsset(fileName, data);
      fields.foto = { type: "image", value: assetId };
    }
  }

  const jobId = await startAutofillJob(brandTemplateId, fields);

  let result: AutofillResult = { status: "in_progress" };
  for (let attempt = 0; attempt < 40; attempt++) {
    result = await pollAutofillJob(jobId);
    if (result.status !== "in_progress") break;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  if (result.status !== "success" || !result.designId) {
    throw new Error(result.error || "Gagal mengisi Brand Template Canva (autofill tidak selesai).");
  }

  const downloadUrl = await exportDesignAsPdf(result.designId);
  const pdfResponse = await fetch(downloadUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Gagal mengunduh hasil ekspor Canva (${pdfResponse.status}).`);
  }

  return Buffer.from(await pdfResponse.arrayBuffer());
}

/**
 * Dipakai sebagai pengganti satu berkas PDF ketika laporan Canva gagal dibuat
 * di tengah proses ZIP sekelas — supaya siswa itu tetap punya berkas .pdf yang
 * valid (berisi pesan kegagalan) alih-alih berkas kosong atau ZIP yang gagal total.
 */
export async function buildCanvaFailureNotePdf(studentName: string, message: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 60 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#b91c1c").text("Laporan Canva Gagal Dibuat");
  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1f2937").text(studentName);
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#374151")
    .text(
      "Laporan pekanan via Canva untuk siswa ini tidak berhasil dibuat saat ZIP sekelas " +
        "diproses. Silakan coba cetak ulang satu per satu dari halaman Hafalan Qur'an.",
      { lineGap: 3 }
    );
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#b91c1c").text("Pesan kesalahan:");
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(message, { lineGap: 2 });

  doc.end();
  return done;
}
