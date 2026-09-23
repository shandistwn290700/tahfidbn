import { db } from "../db/connection.ts";
import { overallProgressPercent, juzCompletedCount } from "./progress-calc.ts";
import { overallTilawatiPercent, jilidCompletedCount } from "./tilawati-calc.ts";
import type { ProgressEntry, TilawatiEntry } from "../types.ts";

export type PeriodJenis = "tengah" | "penuh";

export function normalisePeriodJenis(raw: string | undefined): PeriodJenis {
  return raw === "penuh" ? "penuh" : "tengah";
}

interface StudentRow {
  id: number;
  nis: string | null;
  name: string;
  photo_path: string | null;
  class_id: number | null;
  class_name: string | null;
}

function groupByStudent<T extends { student_id: number }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.student_id);
    if (list) list.push(row);
    else grouped.set(row.student_id, [row]);
  }
  return grouped;
}

/** Total ayat yang ditambahkan seorang siswa dalam rentang tanggal tertentu (inklusif). */
export function getPeriodAyahMemorized(studentId: number, from: string, to: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(ayah_to - ayah_from), 0) AS delta FROM progress_log
       WHERE student_id = ? AND date(logged_at) >= date(?) AND date(logged_at) <= date(?)`
    )
    .get(studentId, from, to) as { delta: number };
  return row.delta;
}

/** Total halaman Tilawati yang ditambahkan seorang siswa dalam rentang tanggal tertentu. */
export function getPeriodPageRead(studentId: number, from: string, to: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(page_to - page_from), 0) AS delta FROM tilawati_log
       WHERE student_id = ? AND date(logged_at) >= date(?) AND date(logged_at) <= date(?)`
    )
    .get(studentId, from, to) as { delta: number };
  return row.delta;
}

function sumDeltaInRange(
  table: "progress_log" | "tilawati_log",
  fromCol: string,
  toCol: string,
  from: string,
  to: string
): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT student_id, COALESCE(SUM(${toCol} - ${fromCol}), 0) AS delta
       FROM ${table}
       WHERE date(logged_at) >= date(?) AND date(logged_at) <= date(?)
       GROUP BY student_id`
    )
    .all(from, to) as { student_id: number; delta: number }[];

  const map = new Map<number, number>();
  for (const row of rows) map.set(row.student_id, row.delta);
  return map;
}

export type PeriodSort = "ayat" | "persen" | "nama" | "kelas";

export function normalisePeriodSort(raw: string | undefined): PeriodSort {
  if (raw === "persen" || raw === "nama" || raw === "kelas") return raw;
  return "ayat";
}

/** Satu baris pada tabel Laporan Periode (tengah semester / semester penuh). */
export interface PeriodStudent {
  id: number;
  name: string;
  nis: string | null;
  photo_path: string | null;
  class_id: number | null;
  class_name: string | null;
  rank: number;
  class_rank: number;
  ayat_periode: number;
  halaman_periode: number;
  juz_completed: number;
  jilid_completed: number;
  tahfid_percent: number;
  tilawati_percent: number;
  recap_percent: number;
}

/**
 * Rekap capaian seluruh siswa dalam satu rentang tanggal — dipakai untuk
 * Laporan Tengah Semester dan Laporan Semester. Pola query sama seperti
 * getRankedStudents()/getRecapRankedStudents(): sedikit query lalu dihitung
 * di memori, bukan satu query per siswa.
 */
export function getPeriodRankedStudents(params: {
  from: string;
  to: string;
  search?: string;
  classId?: number | null;
  sort?: string;
  page?: number;
  perPage?: number;
}): {
  students: PeriodStudent[];
  pageItems: PeriodStudent[];
  total: number;
  totalPages: number;
  page: number;
} {
  const sort = normalisePeriodSort(params.sort);
  const perPage = params.perPage ?? 20;

  const allStudents = db
    .prepare(
      `SELECT s.id, s.nis, s.name, s.photo_path, s.class_id, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id`
    )
    .all() as StudentRow[];

  const ayatDelta = sumDeltaInRange("progress_log", "ayah_from", "ayah_to", params.from, params.to);
  const halamanDelta = sumDeltaInRange("tilawati_log", "page_from", "page_to", params.from, params.to);

  const tahfidByStudent = groupByStudent(
    db.prepare("SELECT * FROM progress_entries").all() as ProgressEntry[]
  );
  const tilawatiByStudent = groupByStudent(
    db.prepare("SELECT * FROM tilawati_entries").all() as TilawatiEntry[]
  );

  const ranked: PeriodStudent[] = allStudents.map((student) => {
    const tahfid = tahfidByStudent.get(student.id) ?? [];
    const tilawati = tilawatiByStudent.get(student.id) ?? [];
    const tahfidPercent = overallProgressPercent(tahfid);
    const tilawatiPercent = overallTilawatiPercent(tilawati);

    return {
      id: student.id,
      name: student.name,
      nis: student.nis,
      photo_path: student.photo_path,
      class_id: student.class_id,
      class_name: student.class_name,
      rank: 0,
      class_rank: 0,
      ayat_periode: ayatDelta.get(student.id) ?? 0,
      halaman_periode: halamanDelta.get(student.id) ?? 0,
      juz_completed: juzCompletedCount(tahfid),
      jilid_completed: jilidCompletedCount(tilawati),
      tahfid_percent: tahfidPercent,
      tilawati_percent: tilawatiPercent,
      recap_percent: Math.round(((tahfidPercent + tilawatiPercent) / 2) * 10) / 10,
    };
  });

  // Peringkat: aktivitas selama periode (ayat + halaman bertambah) dulu, lalu nama.
  const byAchievement = (a: PeriodStudent, b: PeriodStudent) =>
    b.ayat_periode + b.halaman_periode - (a.ayat_periode + a.halaman_periode) ||
    a.name.localeCompare(b.name, "id");

  const globalOrder = [...ranked].sort(byAchievement);
  globalOrder.forEach((s, i) => {
    s.rank = i + 1;
  });

  const perClass = new Map<number, PeriodStudent[]>();
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

  const sorted = [...visible];
  if (sort === "nama") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } else if (sort === "kelas") {
    sorted.sort(
      (a, b) =>
        (a.class_name || "￿").localeCompare(b.class_name || "￿", "id") ||
        byAchievement(a, b)
    );
  } else if (sort === "persen") {
    sorted.sort((a, b) => b.recap_percent - a.recap_percent || byAchievement(a, b));
  }
  // sort === "ayat" sudah sesuai urutan byAchievement.

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(params.page ?? 1, 1), totalPages);
  const pageItems = sorted.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return { students: sorted, pageItems, total, totalPages, page };
}
