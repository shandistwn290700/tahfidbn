import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export const PHOTOS_DIR = join(import.meta.dir, "..", "..", "data", "photos");

if (!existsSync(PHOTOS_DIR)) {
  mkdirSync(PHOTOS_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB per foto

export function isAllowedPhotoExt(ext: string): boolean {
  return ALLOWED_EXTENSIONS.has(ext.toLowerCase());
}

/** Menghapus semua kemungkinan berkas foto lama siswa ini, apa pun ekstensinya. */
function removeExistingPhotoFiles(studentId: number): void {
  for (const ext of ALLOWED_EXTENSIONS) {
    const path = join(PHOTOS_DIR, `${studentId}.${ext}`);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        /* abaikan — bukan hal fatal jika berkas lama gagal terhapus */
      }
    }
  }
}

/** Menyimpan foto ke disk dan mengembalikan URL publiknya untuk disimpan di kolom photo_path. */
export function savePhotoForStudent(studentId: number, ext: string, data: Uint8Array): string {
  const cleanExt = ext.toLowerCase();
  if (!isAllowedPhotoExt(cleanExt)) {
    throw new Error("Format foto harus JPG, JPEG, PNG, atau WEBP.");
  }
  if (data.byteLength > MAX_PHOTO_BYTES) {
    throw new Error("Ukuran foto melebihi 3MB.");
  }

  removeExistingPhotoFiles(studentId);

  const filename = `${studentId}.${cleanExt}`;
  writeFileSync(join(PHOTOS_DIR, filename), data);

  return `/siswa-foto/${filename}`;
}

export function deletePhotoForStudent(studentId: number): void {
  removeExistingPhotoFiles(studentId);
}

/**
 * Path berkas foto di disk dari URL publiknya (kolom photo_path, mis.
 * "/siswa-foto/12.jpg"). Dipakai saat foto perlu dibaca langsung sebagai
 * berkas, misalnya untuk disisipkan ke PDF laporan.
 */
export function getPhotoDiskPath(photoPath: string): string {
  const filename = photoPath.split("/").pop() || "";
  return join(PHOTOS_DIR, filename);
}

/** pdfkit hanya mendukung JPEG dan PNG — WEBP tidak bisa disisipkan ke PDF. */
export function isPdfCompatiblePhoto(photoPath: string): boolean {
  const ext = (photoPath.split(".").pop() || "").toLowerCase();
  return ext === "jpg" || ext === "jpeg" || ext === "png";
}
