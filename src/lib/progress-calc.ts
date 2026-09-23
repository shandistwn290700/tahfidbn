import { db } from "../db/connection.ts";
import {
  TOTAL_AYAHS,
  JUZ_BOUNDARIES,
  getSurah,
  getJuzForPosition,
} from "../data/quran-meta.ts";
import { escapeLikePattern } from "./http.ts";
import type { ProgressEntry, RankedStudent } from "../types.ts";

interface ProgressMap {
  [surahNumber: number]: number;
}

function buildProgressMap(entries: ProgressEntry[]): ProgressMap {
  const map: ProgressMap = {};
  for (const e of entries) {
    map[e.surah_number] = e.last_ayah;
  }
  return map;
}

export function totalAyahsMemorized(entries: ProgressEntry[]): number {
  let total = 0;
  for (const e of entries) total += e.last_ayah;
  return total;
}

/**
 * Persentase terhadap 30 juz. Sengaja memakai satu angka desimal: seorang
 * santri yang hafal satu juz penuh setara 9% — dibulatkan ke bilangan bulat,
 * capaian sebagian besar santri akan tampil sebagai 0% dan papan peringkat
 * kehilangan fungsinya sebagai pemacu semangat.
 */
export function overallProgressPercent(entries: ProgressEntry[]): number {
  const memorized = totalAyahsMemorized(entries);
  if (memorized === 0) return 0;
  return Math.round((memorized / TOTAL_AYAHS) * 1000) / 10;
}

function isJuzComplete(juz: (typeof JUZ_BOUNDARIES)[0], progressMap: ProgressMap): boolean {
  for (let surahNum = juz.startSurah; surahNum <= juz.endSurah; surahNum++) {
    const surah = getSurah(surahNum);
    if (!surah) return false;

    const memorizedUpTo = progressMap[surahNum] || 0;
    const ayahEnd = surahNum === juz.endSurah ? juz.endAyah : surah.totalAyahs;

    if (memorizedUpTo < ayahEnd) return false;
  }
  return true;
}

export function juzCompletedCount(entries: ProgressEntry[]): number {
  if (entries.length === 0) return 0;

  const map = buildProgressMap(entries);
  let count = 0;
  for (const juz of JUZ_BOUNDARIES) {
    if (isJuzComplete(juz, map)) count++;
  }
  return count;
}

function getCurrentLocation(entries: ProgressEntry[]): {
  juz: number;
  surahName: string;
  surahNumber: number;
  ayah: number;
} {
  if (entries.length === 0) {
    return { juz: 0, surahName: "Belum dimulai", surahNumber: 0, ayah: 0 };
  }

  // Bandingkan langsung sebagai teks: format SQLite "YYYY-MM-DD HH:MM:SS"
  // sudah urut secara leksikografis, sekaligus menghindari jebakan new Date()
  // yang menafsirkan waktu UTC dari SQLite sebagai waktu lokal.
  let latest = entries[0]!;
  for (const entry of entries) {
    if (entry.updated_at > latest.updated_at) latest = entry;
  }

  const surah = getSurah(latest.surah_number);

  return {
    juz: getJuzForPosition(latest.surah_number, latest.last_ayah),
    surahName: surah?.name || "Tidak dikenal",
    surahNumber: latest.surah_number,
    ayah: latest.last_ayah,
  };
}

interface StudentRow {
  id: number;
  nis: string | null;
  name: string;
  photo_path: string | null;
  class_id: number | null;
  class_name: string | null;
}

/** Membaca seluruh hafalan sekali jalan, lalu dikelompokkan per siswa di memori. */
function loadAllEntries(): Map<number, ProgressEntry[]> {
  const rows = db
    .prepare("SELECT * FROM progress_entries ORDER BY student_id ASC, surah_number ASC")
    .all() as ProgressEntry[];

  const grouped = new Map<number, ProgressEntry[]>();
  for (const row of rows) {
    const list = grouped.get(row.student_id);
    if (list) list.push(row);
    else grouped.set(row.student_id, [row]);
  }
  return grouped;
}

/** Tambahan ayat sepekan terakhir untuk semua siswa, dalam satu query agregat. */
function loadAllTrends(): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT student_id, COALESCE(SUM(ayah_to - ayah_from), 0) AS delta
       FROM progress_log
       WHERE logged_at >= datetime('now', '-7 days')
       GROUP BY student_id`
    )
    .all() as { student_id: number; delta: number }[];

  const trends = new Map<number, number>();
  for (const row of rows) trends.set(row.student_id, row.delta);
  return trends;
}

function buildRanked(
  student: StudentRow,
  entries: ProgressEntry[],
  trend: number
): RankedStudent {
  const location = getCurrentLocation(entries);

  const inProgress = entries
    .filter((e) => !e.completed && e.last_ayah > 0)
    .map((e) => {
      const s = getSurah(e.surah_number);
      return {
        number: e.surah_number,
        name: s?.name || `Surah ${e.surah_number}`,
        last_ayah: e.last_ayah,
        total_ayahs: s?.totalAyahs || 0,
      };
    })
    .sort((a, b) => a.number - b.number);

  return {
    id: student.id,
    name: student.name,
    nis: student.nis,
    photo_path: student.photo_path,
    class_id: student.class_id,
    class_name: student.class_name,
    rank: 0,
    class_rank: 0,
    total_memorized: totalAyahsMemorized(entries),
    juz_completed: juzCompletedCount(entries),
    progress_percent: overallProgressPercent(entries),
    current_surah: location.surahName,
    current_surah_number: location.surahNumber,
    current_ayah: location.ayah,
    current_juz: location.juz,
    in_progress_surahs: inProgress,
    trend,
  };
}

export type LeaderboardSort = "juz" | "nama" | "kelas" | "tren";

export function normaliseSort(raw: string | undefined): LeaderboardSort {
  if (raw === "nama" || raw === "kelas" || raw === "tren") return raw;
  return "juz";
}

/**
 * Menyusun papan peringkat. Seluruh perhitungan dilakukan di memori dari tiga
 * query saja (siswa, hafalan, tren), bukan satu query per siswa.
 */
export function getRankedStudents(params: {
  search?: string;
  classId?: number | null;
  sort?: string;
  page?: number;
  perPage?: number;
  /** Tiga besar sudah tampil sebagai kartu podium, jadi tidak diulang di tabel. */
  excludeTopThree?: boolean;
}): {
  students: RankedStudent[];
  pageItems: RankedStudent[];
  total: number;
  totalPages: number;
  page: number;
  topThree: RankedStudent[];
} {
  const sort = normaliseSort(params.sort);
  const perPage = params.perPage ?? 20;

  const allStudents = db
    .prepare(
      `SELECT s.id, s.nis, s.name, s.photo_path, s.class_id, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id`
    )
    .all() as StudentRow[];

  const entriesByStudent = loadAllEntries();
  const trends = loadAllTrends();

  const ranked = allStudents.map((student) =>
    buildRanked(student, entriesByStudent.get(student.id) ?? [], trends.get(student.id) ?? 0)
  );

  // Peringkat sekolah: juz terbanyak dulu, lalu jumlah ayat, lalu nama.
  const byAchievement = (a: RankedStudent, b: RankedStudent) =>
    b.juz_completed - a.juz_completed ||
    b.total_memorized - a.total_memorized ||
    a.name.localeCompare(b.name, "id");

  const globalOrder = [...ranked].sort(byAchievement);
  globalOrder.forEach((s, i) => {
    s.rank = i + 1;
  });

  // Peringkat di dalam kelas masing-masing.
  const perClass = new Map<number, RankedStudent[]>();
  for (const student of globalOrder) {
    if (student.class_id === null) continue;
    const list = perClass.get(student.class_id);
    if (list) list.push(student);
    else perClass.set(student.class_id, [student]);
  }
  for (const list of perClass.values()) {
    list.forEach((s, i) => {
      s.class_rank = i + 1;
    });
  }

  const topThree = globalOrder.filter((s) => s.total_memorized > 0).slice(0, 3);

  // Penyaringan
  let visible = globalOrder;

  if (params.classId !== undefined && params.classId !== null) {
    visible = visible.filter((s) => s.class_id === params.classId);
  }

  const search = (params.search || "").trim();
  if (search) {
    const needle = search.toLowerCase();
    visible = visible.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.nis ? s.nis.toLowerCase().includes(needle) : false)
    );
  }

  if (params.excludeTopThree) {
    const podium = new Set(topThree.map((s) => s.id));
    visible = visible.filter((s) => !podium.has(s.id));
  }

  // Pengurutan tampilan
  const sorted = [...visible];
  if (sort === "nama") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } else if (sort === "kelas") {
    sorted.sort(
      (a, b) =>
        (a.class_name || "￿").localeCompare(b.class_name || "￿", "id") ||
        byAchievement(a, b)
    );
  } else if (sort === "tren") {
    sorted.sort((a, b) => b.trend - a.trend || byAchievement(a, b));
  }
  // sort === "juz" sudah sesuai urutan peringkat sekolah.

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(params.page ?? 1, 1), totalPages);
  const pageItems = sorted.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return { students: sorted, pageItems, total, totalPages, page, topThree };
}

export function getStudentProgress(studentId: number): {
  entries: ProgressEntry[];
  totalMemorized: number;
  progressPercent: number;
  juzCompleted: number;
  currentLocation: ReturnType<typeof getCurrentLocation>;
} {
  const entries = db
    .prepare("SELECT * FROM progress_entries WHERE student_id = ? ORDER BY surah_number ASC")
    .all(studentId) as ProgressEntry[];

  return {
    entries,
    totalMemorized: totalAyahsMemorized(entries),
    progressPercent: overallProgressPercent(entries),
    juzCompleted: juzCompletedCount(entries),
    currentLocation: getCurrentLocation(entries),
  };
}

/** Hafalan seluruh siswa pada satu kelas, untuk halaman input guru. */
export function getClassProgress(classId: number): {
  student: { id: number; nis: string | null; name: string; photo_path: string | null };
  entries: ProgressEntry[];
  totalMemorized: number;
  progressPercent: number;
  juzCompleted: number;
  currentLocation: ReturnType<typeof getCurrentLocation>;
}[] {
  const students = db
    .prepare(
      "SELECT id, nis, name, photo_path FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE ASC"
    )
    .all(classId) as { id: number; nis: string | null; name: string; photo_path: string | null }[];

  if (students.length === 0) return [];

  const placeholders = students.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT * FROM progress_entries WHERE student_id IN (${placeholders})
       ORDER BY surah_number ASC`
    )
    .all(...students.map((s) => s.id)) as ProgressEntry[];

  const grouped = new Map<number, ProgressEntry[]>();
  for (const row of rows) {
    const list = grouped.get(row.student_id);
    if (list) list.push(row);
    else grouped.set(row.student_id, [row]);
  }

  return students.map((student) => {
    const entries = grouped.get(student.id) ?? [];
    return {
      student,
      entries,
      totalMemorized: totalAyahsMemorized(entries),
      progressPercent: overallProgressPercent(entries),
      juzCompleted: juzCompletedCount(entries),
      currentLocation: getCurrentLocation(entries),
    };
  });
}

/** Angka ringkas untuk kartu di atas papan peringkat. */
export function getSummaryStats(): {
  totalStudents: number;
  totalClasses: number;
  totalJuz: number;
  totalAyahs: number;
  weeklyAyahs: number;
} {
  const students = db.prepare("SELECT COUNT(*) AS c FROM students").get() as { c: number };
  const classes = db.prepare("SELECT COUNT(*) AS c FROM classes").get() as { c: number };
  const weekly = db
    .prepare(
      `SELECT COALESCE(SUM(ayah_to - ayah_from), 0) AS delta FROM progress_log
       WHERE logged_at >= datetime('now', '-7 days')`
    )
    .get() as { delta: number };

  const entriesByStudent = loadAllEntries();
  let totalJuz = 0;
  let totalAyahs = 0;
  for (const entries of entriesByStudent.values()) {
    totalJuz += juzCompletedCount(entries);
    totalAyahs += totalAyahsMemorized(entries);
  }

  return {
    totalStudents: students.c,
    totalClasses: classes.c,
    totalJuz,
    totalAyahs,
    weeklyAyahs: weekly.delta,
  };
}

/** Pencarian siswa untuk kotak telusur di panel administrasi. */
export function searchStudents(term: string): string {
  return `%${escapeLikePattern(term)}%`;
}
