import { beforeAll, describe, expect, test } from "bun:test";

// Basis data di memori, harus diatur sebelum modul koneksi dimuat.
process.env.DB_PATH = ":memory:";
const { db } = await import("../db/connection.ts");
const { initializeDatabase } = await import("../db/schema.ts");
const { buildBuckets, getProgressSeries, getTeacherActivity, getDashboardSummary } = await import(
  "./dashboard.ts"
);

// Jumat, 2 Oktober 2026 pukul 01.30 WIB (= Kamis 1 Oktober 18.30 UTC)
const NOW = new Date("2026-10-01T18:30:00Z");

describe("buildBuckets", () => {
  test("harian: 30 hari, hari ini menurut WIB, bukan UTC", () => {
    const b = buildBuckets("harian", NOW);
    expect(b).toHaveLength(30);
    expect(b.at(-1)).toMatchObject({ key: "2026-10-02", current: true, label: "Jum, 2 Okt 2026" });
    expect(b[0]!.key).toBe("2026-09-03");
  });

  test("pekanan: dimulai Senin", () => {
    const b = buildBuckets("pekanan", NOW);
    expect(b).toHaveLength(12);
    expect(b.at(-1)).toMatchObject({ key: "2026-09-28", label: "28 Sep – 4 Okt 2026" });
    expect(b.at(-2)!.key).toBe("2026-09-21");
  });

  test("bulanan: 12 bulan melintasi tahun", () => {
    const b = buildBuckets("bulanan", NOW);
    expect(b.map((x) => x.key)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
  });

  test("semester: Ganjil Juli–Desember, Genap Januari–Juni", () => {
    const b = buildBuckets("semester", NOW);
    expect(b.map((x) => x.key)).toEqual(["2023-2", "2024-1", "2024-2", "2025-1", "2025-2", "2026-1"]);
    expect(b.at(-1)).toMatchObject({ label: "Ganjil 2026/2027", from: "2026-07-01" });
    expect(b.at(-2)).toMatchObject({ label: "Genap 2025/2026", from: "2026-01-01" });
  });
});

describe("getProgressSeries (kunci SQL harus sama dengan buildBuckets)", () => {
  beforeAll(() => {
    initializeDatabase();
    db.exec(`
      INSERT INTO users (id, username, password_hash, name, role) VALUES
        (1, 'admin', 'x', 'Admin', 'admin'),
        (2, 'guru1', 'x', 'Guru Satu', 'guru'),
        (3, 'guru2', 'x', 'Guru Dua', 'guru'),
        (4, 'guru3', 'x', 'Guru Tiga', 'guru');
      INSERT INTO students (id, name) VALUES (1, 'Siswa A'), (2, 'Siswa B');
      INSERT INTO progress_log (student_id, recorded_by, surah_number, ayah_from, ayah_to, logged_at) VALUES
        -- 2 Okt 01.00 WIB, tersimpan sebagai 1 Okt UTC
        (1, 2, 78, 0, 10, '2026-10-01 18:00:00'),
        -- koreksi turun di hari yang sama: siswa A bersih +6
        (1, 2, 78, 10, 6, '2026-10-01 18:10:00'),
        -- koreksi turun saja: siswa B tidak boleh minus
        (2, 1, 78, 20, 15, '2026-10-01 18:20:00'),
        -- Minggu 27 Sep 23.59 WIB: masih pekan 21 Sep
        (2, 3, 1, 0, 7, '2026-09-27 16:59:00'),
        -- 1 Jul 2026 01.00 WIB: sudah semester Ganjil 2026/2027
        (1, 3, 2, 0, 5, '2026-06-30 18:00:00');
    `);
  });

  test("harian: tambahan ayat per hari WIB, koreksi ditahan di 0", () => {
    const s = getProgressSeries("harian", NOW);
    expect(s.at(-1)).toMatchObject({ key: "2026-10-02", ayat: 6, siswa: 1, guru: 1 });
    expect(s.find((p) => p.key === "2026-09-27")).toMatchObject({ ayat: 7, guru: 1 });
    expect(s.find((p) => p.key === "2026-10-01")!.ayat).toBe(0);
  });

  test("pekanan: Minggu malam masuk pekan sebelumnya", () => {
    const s = getProgressSeries("pekanan", NOW);
    expect(s.at(-1)).toMatchObject({ key: "2026-09-28", ayat: 6 });
    expect(s.at(-2)).toMatchObject({ key: "2026-09-21", ayat: 7, guru: 1 });
  });

  test("semester: 1 Juli WIB masuk Ganjil, admin tidak dihitung sebagai guru aktif", () => {
    const s = getProgressSeries("semester", NOW);
    // Ditahan per siswa untuk seluruh periode: A = 10 - 4 + 5 = 11, B = -5 + 7 = 2
    expect(s.at(-1)).toMatchObject({ key: "2026-1", ayat: 13, siswa: 2, guru: 2 });
  });

  test("ringkasan & aktivitas guru", () => {
    const teachers = getTeacherActivity(NOW);
    expect(teachers.map((t) => t.username)).toEqual(["guru1", "guru2", "guru3"]);
    expect(teachers.find((t) => t.username === "guru3")).toMatchObject({ status: "tidak-aktif", inputs30: 0 });

    const summary = getDashboardSummary(teachers, NOW);
    expect(summary).toMatchObject({ ayatPekanIni: 6, ayatPekanLalu: 7, siswaSetorPekanIni: 1, totalSiswa: 2, totalGuru: 3 });
  });
});
