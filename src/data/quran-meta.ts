import { SURAH_LIST } from "./surah-list.ts";

export interface SurahMeta {
  number: number;
  /** Nama latin ejaan Indonesia (Kemenag), mis. "Yasin", "Al-Insyirah". */
  name: string;
  nameArabic: string;
  /** Arti nama surah, mis. "Pembukaan". */
  meaning: string;
  /** Tempat turun: "Mekah" atau "Madinah". */
  revelation: string;
  totalAyahs: number;
}

export interface JuzMeta {
  juzNumber: number;
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
}

// Daftar surah dari API Al-Quran v2.0 equran.id, dibuat ulang lewat
// `bun run build:quran-data` (lihat src/data/surah-list.ts).
export const SURAHS: SurahMeta[] = SURAH_LIST;

// Total ayahs in the entire Quran
export const TOTAL_AYAHS = SURAHS.reduce((sum, s) => sum + s.totalAyahs, 0); // 6236

// Juz boundaries (standard Uthmani mushaf)
export const JUZ_BOUNDARIES: JuzMeta[] = [
  { juzNumber: 1, startSurah: 1, startAyah: 1, endSurah: 2, endAyah: 141 },
  { juzNumber: 2, startSurah: 2, startAyah: 142, endSurah: 2, endAyah: 252 },
  { juzNumber: 3, startSurah: 2, startAyah: 253, endSurah: 3, endAyah: 92 },
  { juzNumber: 4, startSurah: 3, startAyah: 93, endSurah: 4, endAyah: 23 },
  { juzNumber: 5, startSurah: 4, startAyah: 24, endSurah: 4, endAyah: 147 },
  { juzNumber: 6, startSurah: 4, startAyah: 148, endSurah: 5, endAyah: 81 },
  { juzNumber: 7, startSurah: 5, startAyah: 82, endSurah: 6, endAyah: 110 },
  { juzNumber: 8, startSurah: 6, startAyah: 111, endSurah: 7, endAyah: 87 },
  { juzNumber: 9, startSurah: 7, startAyah: 88, endSurah: 8, endAyah: 40 },
  { juzNumber: 10, startSurah: 8, startAyah: 41, endSurah: 9, endAyah: 92 },
  { juzNumber: 11, startSurah: 9, startAyah: 93, endSurah: 11, endAyah: 5 },
  { juzNumber: 12, startSurah: 11, startAyah: 6, endSurah: 12, endAyah: 52 },
  { juzNumber: 13, startSurah: 12, startAyah: 53, endSurah: 14, endAyah: 52 },
  { juzNumber: 14, startSurah: 15, startAyah: 1, endSurah: 16, endAyah: 128 },
  { juzNumber: 15, startSurah: 17, startAyah: 1, endSurah: 18, endAyah: 74 },
  { juzNumber: 16, startSurah: 18, startAyah: 75, endSurah: 20, endAyah: 135 },
  { juzNumber: 17, startSurah: 21, startAyah: 1, endSurah: 22, endAyah: 78 },
  { juzNumber: 18, startSurah: 23, startAyah: 1, endSurah: 25, endAyah: 20 },
  { juzNumber: 19, startSurah: 25, startAyah: 21, endSurah: 27, endAyah: 55 },
  { juzNumber: 20, startSurah: 27, startAyah: 56, endSurah: 29, endAyah: 45 },
  { juzNumber: 21, startSurah: 29, startAyah: 46, endSurah: 33, endAyah: 30 },
  { juzNumber: 22, startSurah: 33, startAyah: 31, endSurah: 36, endAyah: 27 },
  { juzNumber: 23, startSurah: 36, startAyah: 28, endSurah: 39, endAyah: 31 },
  { juzNumber: 24, startSurah: 39, startAyah: 32, endSurah: 41, endAyah: 46 },
  { juzNumber: 25, startSurah: 41, startAyah: 47, endSurah: 45, endAyah: 37 },
  { juzNumber: 26, startSurah: 46, startAyah: 1, endSurah: 51, endAyah: 30 },
  { juzNumber: 27, startSurah: 51, startAyah: 31, endSurah: 57, endAyah: 29 },
  { juzNumber: 28, startSurah: 58, startAyah: 1, endSurah: 66, endAyah: 12 },
  { juzNumber: 29, startSurah: 67, startAyah: 1, endSurah: 77, endAyah: 50 },
  { juzNumber: 30, startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6 },
];

// Helper: get surah by number
export function getSurah(number: number): SurahMeta | undefined {
  return SURAHS[number - 1];
}

// Helper: get which Juz a given surah:ayah position is in
export function getJuzForPosition(surahNumber: number, ayahNumber: number): number {
  for (const juz of JUZ_BOUNDARIES) {
    const afterStart =
      surahNumber > juz.startSurah ||
      (surahNumber === juz.startSurah && ayahNumber >= juz.startAyah);
    const beforeEnd =
      surahNumber < juz.endSurah ||
      (surahNumber === juz.endSurah && ayahNumber <= juz.endAyah);
    if (afterStart && beforeEnd) return juz.juzNumber;
  }
  return 1;
}
