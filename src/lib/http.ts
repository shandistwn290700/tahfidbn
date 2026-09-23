import type { Context } from "hono";

/**
 * Membaca bilangan bulat dari query string dengan batas aman.
 * Nilai yang bukan angka tidak lagi menjadi NaN yang lolos sampai ke SQLite.
 */
export function readInt(
  raw: string | undefined | null,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number {
  const parsed = parseInt(String(raw ?? ""), 10);
  let value = Number.isFinite(parsed) ? parsed : fallback;

  if (options.min !== undefined && value < options.min) value = options.min;
  if (options.max !== undefined && value > options.max) value = options.max;

  return value;
}

/** Sama seperti readInt, tetapi mengembalikan null bila tidak ada nilai yang sah. */
export function readOptionalInt(raw: string | undefined | null): number | null {
  const parsed = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Karakter wildcard LIKE harus dilepas agar pencarian "%" tidak mencocokkan semua baris. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function redirectWith(
  c: Context,
  path: string,
  kind: "success" | "error",
  message: string
) {
  const separator = path.includes("?") ? "&" : "?";
  return c.redirect(`${path}${separator}${kind}=${encodeURIComponent(message)}`);
}
