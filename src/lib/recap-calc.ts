import { db } from "../db/connection.ts";
import { overallProgressPercent } from "./progress-calc.ts";
import { overallTilawatiPercent } from "./tilawati-calc.ts";
import { escapeLikePattern } from "./http.ts";
import type { ProgressEntry, TilawatiEntry, RecapStudent } from "../types.ts";

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

export type RecapSort = "persen" | "nama" | "kelas";

export function normaliseRecapSort(raw: string | undefined): RecapSort {
  if (raw === "nama" || raw === "kelas") return raw;
  return "persen";
}

/**
 * Papan peringkat Rekapitulasi: rata-rata persentase Tahfid & Tilawati per
 * siswa. Siswa yang belum punya catatan pada salah satu jenis tetap masuk
 * daftar dengan persentase jenis itu dihitung 0%.
 */
export function getRecapRankedStudents(params: {
  search?: string;
  classId?: number | null;
  sort?: string;
  page?: number;
  perPage?: number;
  excludeTopThree?: boolean;
}): {
  students: RecapStudent[];
  pageItems: RecapStudent[];
  total: number;
  totalPages: number;
  page: number;
  topThree: RecapStudent[];
} {
  const sort = normaliseRecapSort(params.sort);
  const perPage = params.perPage ?? 20;

  const allStudents = db
    .prepare(
      `SELECT s.id, s.nis, s.name, s.photo_path, s.class_id, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id`
    )
    .all() as StudentRow[];

  const tahfidByStudent = groupByStudent(
    db.prepare("SELECT * FROM progress_entries").all() as ProgressEntry[]
  );
  const tilawatiByStudent = groupByStudent(
    db.prepare("SELECT * FROM tilawati_entries").all() as TilawatiEntry[]
  );

  const ranked: RecapStudent[] = allStudents.map((student) => {
    const tahfidPercent = overallProgressPercent(tahfidByStudent.get(student.id) ?? []);
    const tilawatiPercent = overallTilawatiPercent(tilawatiByStudent.get(student.id) ?? []);
    const recapPercent = Math.round(((tahfidPercent + tilawatiPercent) / 2) * 10) / 10;

    return {
      id: student.id,
      name: student.name,
      nis: student.nis,
      photo_path: student.photo_path,
      class_id: student.class_id,
      class_name: student.class_name,
      rank: 0,
      class_rank: 0,
      tahfid_percent: tahfidPercent,
      tilawati_percent: tilawatiPercent,
      recap_percent: recapPercent,
    };
  });

  const byAchievement = (a: RecapStudent, b: RecapStudent) =>
    b.recap_percent - a.recap_percent || a.name.localeCompare(b.name, "id");

  const globalOrder = [...ranked].sort(byAchievement);
  globalOrder.forEach((s, i) => {
    s.rank = i + 1;
  });

  const perClass = new Map<number, RecapStudent[]>();
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

  const topThree = globalOrder.filter((s) => s.recap_percent > 0).slice(0, 3);

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

  const sorted = [...visible];
  if (sort === "nama") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } else if (sort === "kelas") {
    sorted.sort(
      (a, b) =>
        (a.class_name || "￿").localeCompare(b.class_name || "￿", "id") ||
        byAchievement(a, b)
    );
  }

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(params.page ?? 1, 1), totalPages);
  const pageItems = sorted.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return { students: sorted, pageItems, total, totalPages, page, topThree };
}

export function searchStudents(term: string): string {
  return `%${escapeLikePattern(term)}%`;
}
