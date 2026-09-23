export type ProgressInputMode = "set" | "increment" | "advance" | "complete";

type ResolveProgressUpdateInputParams = {
  mode?: string;
  rawLastAyah?: string;
  rawIncrement?: string;
  existingLastAyah: number;
  hasExistingEntry: boolean;
  surahName: string;
  surahTotalAyahs: number;
  /** Kata benda satuan pada pesan galat, default "Surah" (dipakai juga untuk "Jilid"). */
  itemWord?: string;
  /** Kata benda posisi pada pesan galat, default "ayat" (dipakai juga untuk "halaman"). */
  positionWord?: string;
};

type ProgressInputError = {
  ok: false;
  error: string;
};

type ProgressInputSuccess = {
  ok: true;
  lastAyah: number;
  usedMode: ProgressInputMode;
  appliedIncrement: number;
};

export function resolveProgressUpdateInput(
  params: ResolveProgressUpdateInputParams
): ProgressInputError | ProgressInputSuccess {
  const {
    mode,
    rawLastAyah,
    rawIncrement,
    existingLastAyah,
    hasExistingEntry,
    surahName,
    surahTotalAyahs,
    itemWord = "Surah",
    positionWord = "ayat",
  } = params;

  if (mode === "increment") {
    if (!hasExistingEntry) {
      return {
        ok: false,
        error: `${itemWord} ini belum tercatat. Isi dulu ${positionWord} terakhirnya.`,
      };
    }

    if (existingLastAyah >= surahTotalAyahs) {
      return {
        ok: false,
        error: `${surahName} sudah tercatat selesai seluruhnya.`,
      };
    }

    const increment = parseInt(rawIncrement || "", 10);

    if (isNaN(increment)) {
      return {
        ok: false,
        error: "Masukan tidak sah. Mohon isi dengan angka yang benar.",
      };
    }

    if (increment < 1) {
      return {
        ok: false,
        error: `Penambahan ${positionWord} minimal 1.`,
      };
    }

    const nextAyah = Math.min(existingLastAyah + increment, surahTotalAyahs);

    return {
      ok: true,
      lastAyah: nextAyah,
      usedMode: "increment",
      appliedIncrement: nextAyah - existingLastAyah,
    };
  }

  if (mode === "advance") {
    if (!hasExistingEntry) {
      return {
        ok: false,
        error: `${itemWord} ini belum tercatat. Isi dulu ${positionWord} terakhirnya.`,
      };
    }

    const lastAyah = parseInt(rawLastAyah || "", 10);

    if (isNaN(lastAyah)) {
      return {
        ok: false,
        error: "Masukan tidak sah. Mohon isi dengan angka yang benar.",
      };
    }

    if (lastAyah < existingLastAyah) {
      return {
        ok: false,
        error: `${positionWord[0]!.toUpperCase()}${positionWord.slice(1)} untuk ${surahName} minimal ${existingLastAyah}.`,
      };
    }

    if (lastAyah > surahTotalAyahs) {
      return {
        ok: false,
        error: `${positionWord[0]!.toUpperCase()}${positionWord.slice(1)} untuk ${surahName} harus antara 1 sampai ${surahTotalAyahs}.`,
      };
    }

    return {
      ok: true,
      lastAyah,
      usedMode: "advance",
      appliedIncrement: lastAyah - existingLastAyah,
    };
  }

  if (mode === "complete") {
    if (!hasExistingEntry) {
      return {
        ok: false,
        error: `${itemWord} ini belum tercatat. Isi dulu ${positionWord} terakhirnya.`,
      };
    }

    if (existingLastAyah >= surahTotalAyahs) {
      return {
        ok: false,
        error: `${surahName} sudah tercatat selesai seluruhnya.`,
      };
    }

    return {
      ok: true,
      lastAyah: surahTotalAyahs,
      usedMode: "complete",
      appliedIncrement: surahTotalAyahs - existingLastAyah,
    };
  }

  const lastAyah = parseInt(rawLastAyah || "", 10);

  if (isNaN(lastAyah)) {
    return {
      ok: false,
      error: "Masukan tidak sah. Mohon isi dengan angka yang benar.",
    };
  }

  if (lastAyah < 1 || lastAyah > surahTotalAyahs) {
    return {
      ok: false,
      error: `${positionWord[0]!.toUpperCase()}${positionWord.slice(1)} untuk ${surahName} harus antara 1 sampai ${surahTotalAyahs}.`,
    };
  }

  return {
    ok: true,
    lastAyah,
    usedMode: "set",
    appliedIncrement: 0,
  };
}
