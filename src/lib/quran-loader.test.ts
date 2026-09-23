import { describe, expect, test } from "bun:test";
import { getSurahAyahs } from "./quran-loader.ts";

describe("getSurahAyahs", () => {
  test("memuat ayat dari berkas surah lokal", () => {
    const ayahs = getSurahAyahs(1);

    expect(ayahs).toHaveLength(7);
    expect(ayahs[0]!.number).toBe(1);

    // Dinormalisasi lebih dulu: urutan harakat pada berkas data dan pada
    // literal di berkas uji ini berbeda meskipun tulisannya sama persis.
    expect(ayahs[0]!.text.normalize("NFC")).toBe(
      "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ".normalize("NFC")
    );
    expect(typeof ayahs[0]!.translation).toBe("string");
  });

  test("menolak nomor surah yang tidak sah", () => {
    expect(() => getSurahAyahs(115)).toThrow("Nomor surah tidak sah.");
  });
});
