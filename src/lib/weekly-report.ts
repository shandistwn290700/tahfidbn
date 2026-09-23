import { existsSync, readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import { db } from "../db/connection.ts";
import { getPhotoDiskPath, isPdfCompatiblePhoto } from "./photos.ts";
import {
  getReportLogo,
  getReportSchoolName,
  getReportContact,
  getCurrentSemesterWeek,
} from "./settings.ts";

const COLOR_DARK = "#065f46"; // banner & footer — senada dengan primary-dark aplikasi
const COLOR_TEXT = "#1f2937";
const COLOR_MUTED = "#6b7280";

const PAGE_WIDTH = 595.28; // A4 dalam points
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

/** Total ayat yang ditambahkan siswa ini dalam 7 hari terakhir. */
export function getWeeklyAyahMemorized(studentId: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(ayah_to - ayah_from), 0) AS delta
       FROM progress_log
       WHERE student_id = ? AND logged_at >= datetime('now', '-7 days')`
    )
    .get(studentId) as { delta: number };
  return row.delta;
}

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function loadLogoBuffer(): Buffer | null {
  const dataUrl = getReportLogo();
  if (!dataUrl) return null;
  const base64 = dataUrl.split(",")[1];
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

function loadPhotoBuffer(photoPath: string | null): Buffer | null {
  if (!photoPath || !isPdfCompatiblePhoto(photoPath)) return null;
  const diskPath = getPhotoDiskPath(photoPath);
  if (!existsSync(diskPath)) return null;
  try {
    return readFileSync(diskPath);
  } catch {
    return null;
  }
}

function drawInitialsPlaceholder(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string
): void {
  doc.save();
  doc.roundedRect(x, y, w, h, 16).fill("#e5e7eb");
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]!.toUpperCase())
    .join("");
  doc
    .fillColor(COLOR_MUTED)
    .font("Helvetica-Bold")
    .fontSize(56)
    .text(initials, x, y + h / 2 - 32, { width: w, align: "center" });
  doc.restore();
}

/**
 * Aksen daun dekoratif ala desain aslinya — bentuk oval lancip digambar
 * dengan dua kurva bezier, murni vektor (tidak perlu berkas gambar
 * tambahan), lalu diputar & ditaruh di sudut halaman.
 */
function drawLeafAccent(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  size: number,
  angleDeg: number
): void {
  doc.save();
  doc.translate(cx, cy);
  doc.rotate(angleDeg);
  doc
    .path(
      `M 0 0 C ${size * 0.55} ${-size * 0.35}, ${size} ${-size * 0.1}, ${size} 0 ` +
        `C ${size} ${size * 0.1}, ${size * 0.55} ${size * 0.35}, 0 0 Z`
    )
    .fillOpacity(0.55)
    .fill("#059669");
  doc
    .moveTo(0, 0)
    .lineTo(size * 0.9, 0)
    .lineWidth(0.6)
    .strokeOpacity(0.5)
    .stroke("#047857");
  doc.restore();
}

/** Gambar foto siswa memenuhi kotak (crop-to-fill) dengan sudut membulat. */
function drawPhoto(
  doc: PDFKit.PDFDocument,
  buffer: Buffer,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  doc.save();
  doc.roundedRect(x, y, w, h, 16).clip();

  // openImage() dipakai (bukan opsi `cover` bawaan) supaya perhitungan
  // crop-to-fill-nya eksplisit dan tidak bergantung dukungan opsi tertentu
  // di versi pdfkit yang berbeda-beda.
  const img = doc.openImage(buffer);
  const scale = Math.max(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;
  doc.image(buffer, drawX, drawY, { width: drawW, height: drawH });

  doc.restore();
}

function buildNarrative(studentName: string, ayat: number, periodLabel: string = "pekan ini"): string {
  const namaDepan = studentName.split(" ")[0] || "Ananda";
  const periodCapital = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  if (ayat > 0) {
    return (
      `Alhamdulillah, ${periodLabel} ananda meraih capaian Al-Qur'an yang membahagiakan ` +
      `dengan menghafal ${ayat} ayat. Setiap ayat adalah jejak kesungguhan, kesabaran, ` +
      `dan keistiqamahan ananda dalam membersamai Kalamullah.\n\n` +
      `Terima kasih Ayah dan Bunda atas doa terbaik yang senantiasa mengiringi. Semoga ` +
      `setiap capaian ananda menjadi kebaikan, keberkahan, dan pahala jariyah untuk Ayah ` +
      `dan Bunda.`
    );
  }

  return (
    `${periodCapital} ${namaDepan} belum menambah hafalan baru. Tidak mengapa — setiap ` +
    `perjalanan menghafal Al-Qur'an punya masa yang lebih tenang, dan itu bagian ` +
    `wajar dari prosesnya.\n\n` +
    `Ayah dan Bunda, yuk luangkan waktu sejenak untuk mendampingi dan ` +
    `menyemangati ananda kembali membersamai Al-Qur'an. Dukungan dan kehadiran Ayah ` +
    `dan Bunda adalah motivasi terbesar bagi ananda untuk terus melangkah.`
  );
}

export interface ReportStudent {
  id: number;
  name: string;
  photo_path: string | null;
}

/** Membuat satu PDF laporan pekanan untuk satu siswa. */
export async function generateWeeklyReportPdf(
  student: ReportStudent,
  weekNumber: number | null,
  options: { sampleAyat?: number; heading?: string; periodLabel?: string } = {}
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const bufferPromise = pdfToBuffer(doc);

  // Latar gradien lembut, putih ke hijau muda — senada dengan tema aplikasi.
  const gradient = doc.linearGradient(0, 0, 0, PAGE_HEIGHT);
  gradient.stop(0, "#ffffff").stop(1, "#ecfdf5");
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(gradient);

  // Aksen daun di sudut-sudut halaman, meniru elemen dekoratif desain aslinya.
  drawLeafAccent(doc, PAGE_WIDTH - 70, 50, 60, 35);
  drawLeafAccent(doc, 50, PAGE_HEIGHT / 2 + 60, 50, -150);
  drawLeafAccent(doc, PAGE_WIDTH - 60, PAGE_HEIGHT - 130, 45, 210);

  let cursorY = MARGIN;

  // Logo & nama sekolah
  const logoBuffer = loadLogoBuffer();
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, PAGE_WIDTH / 2 - 32, cursorY, { fit: [64, 64], align: "center" });
      cursorY += 74;
    } catch {
      /* logo gagal dibaca — lanjut tanpa logo, jangan gagalkan seluruh laporan */
    }
  }

  doc
    .fillColor(COLOR_DARK)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(getReportSchoolName().toUpperCase(), MARGIN, cursorY, {
      width: contentWidth,
      align: "center",
    });
  cursorY += 34;

  // Foto siswa
  const photoW = 220;
  const photoH = 260;
  const photoX = PAGE_WIDTH / 2 - photoW / 2;
  const photoBuffer = loadPhotoBuffer(student.photo_path);
  if (photoBuffer) {
    drawPhoto(doc, photoBuffer, photoX, cursorY, photoW, photoH);
  } else {
    drawInitialsPlaceholder(doc, photoX, cursorY, photoW, photoH, student.name);
  }
  cursorY += photoH + 24;

  // Banner nama siswa
  const bannerH = 42;
  doc.roundedRect(MARGIN + 20, cursorY, contentWidth - 40, bannerH, 10).fill(COLOR_DARK);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(17)
    .text(student.name, MARGIN + 20, cursorY + 12, {
      width: contentWidth - 40,
      align: "center",
    });
  cursorY += bannerH + 24;

  // Kartu isi laporan
  const ayat = options.sampleAyat ?? getWeeklyAyahMemorized(student.id);
  const narasi = buildNarrative(student.name, ayat, options.periodLabel);
  const cardX = MARGIN;
  const cardW = contentWidth;
  const cardPad = 24;
  const heading =
    options.heading ?? (weekNumber ? `Laporan Pekanan ke-${weekNumber}` : "Laporan Pekanan");

  doc.font("Helvetica").fontSize(11);
  const narasiHeight = doc.heightOfString(narasi, { width: cardW - cardPad * 2, lineGap: 3 });
  const cardH = 40 + narasiHeight + cardPad;

  doc.roundedRect(cardX, cursorY, cardW, cardH, 14).fill("#ffffff");
  doc
    .fillColor(COLOR_TEXT)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(heading, cardX + cardPad, cursorY + cardPad - 4, { width: cardW - cardPad * 2 });
  doc
    .fillColor(COLOR_TEXT)
    .font("Helvetica")
    .fontSize(11)
    .text(narasi, cardX + cardPad, cursorY + cardPad + 24, {
      width: cardW - cardPad * 2,
      lineGap: 3,
      align: "justify",
    });

  // Footer kontak — sekolah, cetak sebagai pil hijau di dasar halaman.
  const contact = getReportContact();
  const parts = [
    contact.website,
    contact.whatsapp && `WA ${contact.whatsapp}`,
    contact.instagram && `IG @${contact.instagram.replace(/^@/, "")}`,
    contact.tiktok && `TikTok @${contact.tiktok.replace(/^@/, "")}`,
  ].filter(Boolean) as string[];

  if (parts.length > 0) {
    const footerY = PAGE_HEIGHT - MARGIN - 34;
    doc.roundedRect(MARGIN, footerY, contentWidth, 34, 17).fill(COLOR_DARK);
    doc
      .fillColor("#ffffff")
      .font("Helvetica")
      .fontSize(9.5)
      .text(parts.join("   •   "), MARGIN, footerY + 12, {
        width: contentWidth,
        align: "center",
      });
  }

  doc.end();
  return bufferPromise;
}

/** Nomor pekan berjalan untuk ditampilkan di laporan, atau null bila belum diatur di Pengaturan. */
export function getReportWeekNumber(): number | null {
  return getCurrentSemesterWeek();
}
