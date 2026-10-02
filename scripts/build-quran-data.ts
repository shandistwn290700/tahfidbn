/**
 * Membangun data Al-Qur'an dari API Al-Quran v2.0 equran.id (teks & terjemahan Kemenag):
 *
 * - src/data/surah-list.ts    — daftar 114 surah: nama latin, nama Arab, arti, tempat turun,
 *                               jumlah ayat (dipakai lewat SURAHS di quran-meta.ts)
 * - data/quran/surah-NNN.json — per ayat: teks Arab, latin, dan terjemahan Indonesia
 *
 * Dijalankan manual: `bun run build:quran-data`. Aplikasi tidak memanggil API saat berjalan,
 * jadi halaman Al-Qur'an tetap cepat dan utuh tanpa internet. Bila respons API tidak lengkap
 * atau jumlah ayatnya janggal, skrip berhenti sebelum menimpa berkas apa pun.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const API = "https://equran.id/api/v2";
const TOTAL_AYAHS = 6236;

type ApiSurah = {
  nomor: number;
  nama: string;
  namaLatin: string;
  jumlahAyat: number;
  tempatTurun: string;
  arti: string;
};

type ApiAyah = {
  nomorAyat: number;
  teksArab: string;
  teksLatin: string;
  teksIndonesia: string;
};

async function getJson<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(`${API}${path}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = (await resp.json()) as { code: number; data: T };
      if (body.code !== 200) throw new Error(`kode ${body.code}`);
      return body.data;
    } catch (err) {
      lastError = err;
      await Bun.sleep(1000 * attempt);
    }
  }
  throw new Error(`Gagal mengambil ${API}${path}: ${lastError}`);
}

/** Buang tag HTML (mis. <i>) dan rapikan spasi. */
function clean(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function buildQuranData() {
  const rootDir = join(import.meta.dir, "..");

  const surahs = await getJson<ApiSurah[]>("/surat");
  const total = surahs.reduce((sum, s) => sum + s.jumlahAyat, 0);
  if (surahs.length !== 114 || total !== TOTAL_AYAHS) {
    throw new Error(`Daftar surah janggal: ${surahs.length} surah, ${total} ayat.`);
  }

  // Ambil semua surah dulu; berkas baru ditulis setelah semuanya lolos pemeriksaan.
  const files: { path: string; content: string }[] = [];
  for (const surah of surahs) {
    console.log(`Mengambil surah ${surah.nomor}: ${surah.namaLatin}...`);
    const detail = await getJson<{ ayat: ApiAyah[] }>(`/surat/${surah.nomor}`);
    const ayat = detail.ayat;

    if (ayat.length !== surah.jumlahAyat || ayat.some((a, i) => a.nomorAyat !== i + 1)) {
      throw new Error(`Ayat surah ${surah.nomor} tidak lengkap/berurutan (${ayat.length}/${surah.jumlahAyat}).`);
    }

    const ayahs = ayat.map((a) => ({
      number: a.nomorAyat,
      text: a.teksArab.trim(),
      latin: clean(a.teksLatin),
      translation: clean(a.teksIndonesia),
    }));
    if (ayahs.some((a) => !a.text || !a.latin || !a.translation)) {
      throw new Error(`Ada ayat kosong di surah ${surah.nomor}.`);
    }

    const padded = surah.nomor.toString().padStart(3, "0");
    files.push({
      path: join(rootDir, "data", "quran", `surah-${padded}.json`),
      content: JSON.stringify({ surahNumber: surah.nomor, ayahs }),
    });

    await Bun.sleep(100); // jangan membanjiri API
  }

  const list = surahs
    .map(
      (s) =>
        `  { number: ${s.nomor}, name: ${JSON.stringify(s.namaLatin)}, nameArabic: ${JSON.stringify(s.nama)}, ` +
        `meaning: ${JSON.stringify(clean(s.arti))}, revelation: ${JSON.stringify(s.tempatTurun)}, totalAyahs: ${s.jumlahAyat} },`
    )
    .join("\n");
  files.push({
    path: join(rootDir, "src", "data", "surah-list.ts"),
    content:
      `// Dibuat otomatis oleh scripts/build-quran-data.ts dari API Al-Quran v2.0 equran.id.\n` +
      `// Jangan disunting manual; jalankan \`bun run build:quran-data\`.\n` +
      `import type { SurahMeta } from "./quran-meta.ts";\n\n` +
      `export const SURAH_LIST: SurahMeta[] = [\n${list}\n];\n`,
  });

  await mkdir(join(rootDir, "data", "quran"), { recursive: true });
  for (const file of files) await writeFile(file.path, file.content, "utf-8");

  console.log(`Selesai: ${surahs.length} surah, ${total} ayat, ${files.length} berkas ditulis.`);
}

await buildQuranData();
