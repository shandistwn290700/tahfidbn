import { log } from "./logger.ts";

/**
 * Galat yang pesannya memang ditujukan untuk pengguna (validasi, data tidak ditemukan,
 * konfigurasi yang perlu dibenahi admin). Hanya galat jenis ini yang pesannya boleh
 * tampil di layar; galat lain bisa membawa isi respons API, jalur berkas, atau SQL.
 */
export class PublicError extends Error {}

/**
 * Pesan yang aman ditampilkan untuk sebuah galat. PublicError diteruskan apa adanya;
 * galat lain dicatat lengkap di log server dan pengguna hanya menerima `fallback`
 * beserta kode galat untuk dicari admin di log.
 */
export function publicMessage(err: unknown, fallback: string, event = "galat.tertangani"): string {
  if (err instanceof PublicError) return err.message;
  const ref = log.error(event, err);
  return `${fallback} (kode galat: ${ref})`;
}
