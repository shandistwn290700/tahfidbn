import { existsSync, readFileSync } from "node:fs";
import { db } from "../db/connection.ts";
import { getPhotoDiskPath } from "./photos.ts";
import { getStudentProgress } from "./progress-calc.ts";
import { PublicError } from "./errors.ts";
import { log } from "./logger.ts";

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

/**
 * Koneksi Canva tidak bisa dipakai lagi tanpa campur tangan admin (token dicabut,
 * refresh token ditolak, akun belum terhubung). Antrean laporan berhenti
 * sementara saat menerima galat ini, alih-alih menggagalkan siswa satu per satu.
 */
export class CanvaAuthError extends PublicError {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new PublicError(`Variabel lingkungan ${name} belum diisi di .env.`);
  return value;
}

function getCanvaClientId(): string {
  return requireEnv("CANVA_CLIENT_ID");
}

function getCanvaClientSecret(): string {
  return requireEnv("CANVA_CLIENT_SECRET");
}

const CALLBACK_PATH = "/administrasi/pengaturan/canva/callback";

/**
 * CANVA_REDIRECT_URI bila diisi; kalau tidak, diturunkan dari APP_URL. Dengan
 * begitu server produksi cukup mengisi APP_URL=https://domain-sekolah dan tidak
 * mewarisi alamat 127.0.0.1 dari .env laptop pengembang.
 */
export function getCanvaRedirectUri(): string | null {
  const explicit = process.env.CANVA_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return appUrl ? `${appUrl}${CALLBACK_PATH}` : null;
}

function requireRedirectUri(): string {
  const uri = getCanvaRedirectUri();
  if (!uri) throw new PublicError("CANVA_REDIRECT_URI (atau APP_URL) belum diisi di .env.");
  return uri;
}

/** Ringkasan konfigurasi .env untuk halaman Pengaturan › Integrasi Canva. */
export function getCanvaConfigStatus(): {
  hasClientId: boolean;
  hasClientSecret: boolean;
  redirectUri: string | null;
  redirectFromAppUrl: boolean;
} {
  return {
    hasClientId: Boolean(process.env.CANVA_CLIENT_ID),
    hasClientSecret: Boolean(process.env.CANVA_CLIENT_SECRET),
    redirectUri: getCanvaRedirectUri(),
    redirectFromAppUrl: !process.env.CANVA_REDIRECT_URI?.trim(),
  };
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
    redirect_uri: requireRedirectUri(),
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
    // 400/401 dari endpoint token berarti kode/refresh token ditolak secara
    // permanen (mis. "Refresh token used twice"); 5xx/jaringan masih bisa dicoba lagi.
    // Isi respons Canva hanya masuk log server, tidak ikut ke pesan di layar.
    if (response.status === 400 || response.status === 401) {
      const ref = log.error("canva.token_ditolak", new Error(text), { status: response.status });
      throw new CanvaAuthError(
        `Canva menolak permintaan token (${response.status}). Periksa CANVA_CLIENT_ID dan ` +
          `CANVA_CLIENT_SECRET di .env, lalu hubungkan ulang. (kode galat: ${ref})`
      );
    }
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
      redirect_uri: requireRedirectUri(),
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

/**
 * Refresh token Canva hanya boleh dipakai SEKALI. Bila dua permintaan memperbarui
 * token bersamaan, yang kedua memakai token yang sudah hangus dan Canva mencabut
 * seluruh koneksi ("Refresh token used twice"). Karena itu pembaruan yang sedang
 * berjalan dibagi ke semua pemanggil, bukan dijalankan ulang.
 */
let refreshInFlight: Promise<void> | null = null;

/** Token akses yang masih berlaku, memperbarui otomatis lewat refresh token bila sudah kedaluwarsa. */
export async function getValidAccessToken(): Promise<string> {
  const accessToken = getSetting(ACCESS_TOKEN_KEY);
  const refreshToken = getSetting(REFRESH_TOKEN_KEY);
  const expiresAt = Number(getSetting(EXPIRES_AT_KEY) || 0);

  if (!accessToken || !refreshToken) {
    throw new CanvaAuthError("Akun Canva belum terhubung.");
  }

  // Diperbarui 60 detik lebih awal untuk menghindari kedaluwarsa di tengah permintaan.
  if (Date.now() > expiresAt - 60_000) {
    refreshInFlight ??= refreshTokens(refreshToken).finally(() => {
      refreshInFlight = null;
    });
    try {
      await refreshInFlight;
    } catch (err) {
      if (err instanceof CanvaAuthError) {
        // Token yang tersimpan sudah tidak bisa dipakai lagi — dilepas supaya
        // halaman Pengaturan menampilkan "belum terhubung" dan admin menghubungkan ulang.
        disconnectCanva();
        log.warn("canva.koneksi_dilepas", { message: "Refresh token ditolak; token Canva dilepas." });
        throw new CanvaAuthError(
          "Koneksi Canva terputus dan perlu dihubungkan ulang di Administrasi › Pengaturan › " +
            "Integrasi Canva."
        );
      }
      throw err;
    }
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

const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * Permintaan ke API Canva. Jawaban 429 (batas kecepatan) ditunggu sesuai
 * Retry-After lalu diulang, supaya satu lonjakan tidak langsung menggagalkan laporan.
 */
async function canvaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = await getValidAccessToken();
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return response;

    const retryAfter = Number(response.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 10_000 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 60_000)));
  }
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

  throw new PublicError("Batas waktu menunggu unggahan aset ke Canva terlampaui.");
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

  throw new PublicError("Batas waktu menunggu ekspor Canva terlampaui.");
}

export interface CanvaReportStudent {
  id: number;
  name: string;
  photo_path: string | null;
}

/**
 * Menghasilkan Laporan Pekanan lewat Autofill Brand Template Canva — satu-satunya
 * jalur Laporan Pekanan (PDF bawaan pdfkit kini hanya untuk Laporan Periode).
 * Jangan dipanggil langsung dari rute: lewati antrean di report-queue.ts supaya
 * batas kecepatan API Canva terjaga. Field yang diisi: nama, pekan, ayat, ayat_sebelum,
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
    throw new PublicError("ID Brand Template Canva belum diatur di Administrasi › Pengaturan › Integrasi Canva.");
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
