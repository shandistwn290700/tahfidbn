type ResolveReadingBookmarkInputParams = {
  rawSurahNumber?: string;
  rawAyahNumber?: string;
  surahTotalAyahs: number;
  surahName: string;
};

type ReadingBookmarkInputError = {
  ok: false;
  error: string;
};

type ReadingBookmarkInputSuccess = {
  ok: true;
  surahNumber: number;
  ayahNumber: number;
};

export function resolveReadingBookmarkInput(
  params: ResolveReadingBookmarkInputParams
): ReadingBookmarkInputError | ReadingBookmarkInputSuccess {
  const { rawSurahNumber, rawAyahNumber, surahTotalAyahs, surahName } = params;
  const surahNumber = parseInt(rawSurahNumber || "", 10);
  const ayahNumber = parseInt(rawAyahNumber || "", 10);

  if (isNaN(surahNumber) || isNaN(ayahNumber)) {
    return {
      ok: false,
      error: "Masukan tidak sah. Mohon isi dengan angka yang benar.",
    };
  }

  if (ayahNumber < 1 || ayahNumber > surahTotalAyahs) {
    return {
      ok: false,
      error: `Ayat untuk ${surahName} harus antara 1 sampai ${surahTotalAyahs}.`,
    };
  }

  return {
    ok: true,
    surahNumber,
    ayahNumber,
  };
}
