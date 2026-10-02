import { describe, expect, test } from "bun:test";
import { getSurahAyahs } from "./quran-loader.ts";
import { getSurah, SURAHS, TOTAL_AYAHS } from "../data/quran-meta.ts";

describe("getSurahAyahs", () => {
  test("memuat ayat dari berkas surah lokal (data equran.id / Kemenag)", () => {
    const ayahs = getSurahAyahs(1);

    expect(ayahs).toHaveLength(7);
    expect(ayahs[0]!.number).toBe(1);

    // Dinormalisasi lebih dulu: urutan harakat pada berkas data dan pada
    // literal di berkas uji ini bisa berbeda meskipun tulisannya sama persis.
    expect(ayahs[0]!.text.normalize("NFC")).toBe(
      "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ".normalize("NFC")
    );
    expect(ayahs[0]!.latin).toBe("Bismillāhir-raḥmānir-raḥīm(i).");
    expect(ayahs[0]!.translation).toBe("Dengan nama Allah Yang Maha Pengasih lagi Maha Penyayang.");
  });

  test("daftar surah memakai ejaan Kemenag dan lengkap 6.236 ayat", () => {
    expect(SURAHS).toHaveLength(114);
    expect(TOTAL_AYAHS).toBe(6236);
    expect(getSurah(36)).toMatchObject({ name: "Yasin", meaning: "Yasin", revelation: "Mekah", totalAyahs: 83 });
    expect(getSurah(1)).toMatchObject({ name: "Al-Fatihah", meaning: "Pembukaan" });
  });

  test("menolak nomor surah yang tidak sah", () => {
    expect(() => getSurahAyahs(115)).toThrow("Nomor surah tidak sah.");
  });
});
