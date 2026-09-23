import { db } from "../db/connection.ts";
import { TOTAL_TILAWATI_PAGES, TOTAL_JILID, JILID_LIST, getJilid } from "../data/tilawati-meta.ts";
import { escapeLikePattern } from "./http.ts";
import type { TilawatiEntry, RankedTilawatiStudent } from "../types.ts";

interface PageMap {
  [jilidNumber: number]: number;
}

function buildPageMap(entries: TilawatiEntry[]): PageMap {
  const map: PageMap = {};
  for (const e of entries) map[e.jilid_number] = e.last_page;
  return map;
}

export function totalPagesRead(entries: TilawatiEntry[]): number {
  let total = 0;
  for (const e of entries) total += e.last_page;
  return total;
}

/** Persentase terhadap 247 halaman (6 jilid), satu angka desimal — sama seperti Tahfid. */
export function overallTilawatiPercent(entries: TilawatiEntry[]): number {
  const read = totalPagesRead(entries);
  if (read === 0) return 0;
  return Math.round((read / TOTAL_TILAWATI_PAGES) * 1000) / 10;
}

export function jilidCompletedCount(entries: TilawatiEntry[]): number {
  if (entries.length === 0) return 0;
  const map = buildPageMap(entries);
  let count = 0;
  for (const jilid of JILID_LIST) {
    if ((map[jilid.number] || 0) >= jilid.totalPages) count++;
  }
  return count;
}

function getCurrentLocation(entries: TilawatiEntry[]): { jilid: number; page: number } {
  if (entries.length === 0) return { jilid: 0, page: 0 };

  let latest = entries[0]!;
  for (const entry of entries) {
    if (entry.updated_at > latest.updated_at) latest = entry;
  }

  return { jilid: latest.jilid_number, page: latest.last_page };
}

interface StudentRow {
  id: number;
  nis: string | null;
  name: string;
  photo_path: string | null;
  class_id: number | null;
  class_name: string | null;
}

function loadAllEntries(): Map<number, TilawatiEntry[]> {
  const rows = db
    .prepare("SELECT * FROM tilawati_entries ORDER BY student_id ASC, jilid_number ASC")
    .all() as TilawatiEntry[];

  const grouped = new Map<number, TilawatiEntry[]>();
  for (const row of rows) {
    const list = grouped.get(row.student_id);
    if (list) list.push(row);
    else grouped.set(row.student_id, [row]);
  }
  return grouped;
}

function loadAllTrends(): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT student_id, COALESCE(SUM(page_to - page_from), 0) AS delta
       FROM tilawati_log
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
  entries: TilawatiEntry[],
  trend: number
): RankedTilawatiStudent {
  const location = getCurrentLocation(entries);

  const inProgress = entries
    .filter((e) => !e.completed && e.last_page > 0)
    .map((e) => {
      const j = getJilid(e.jilid_number);
      return {
        number: e.jilid_number,
        last_page: e.last_page,
        total_pages: j?.totalPages || 0,
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
    total_pages: totalPagesRead(entries),
    jilid_completed: jilidCompletedCount(entries),
    progress_percent: overallTilawatiPercent(entries),
    current_jilid: location.jilid,
    current_page: location.page,
    in_progress_jilid: inProgress,
    trend,
  };
}

export type TilawatiSort = "jilid" | "nama" | "kelas" | "tren";

export function normaliseTilawatiSort(raw: string | undefined): TilawatiSort {
  if (raw === "nama" || raw === "kelas" || raw === "tren") return raw;
  return "jilid";
}

/** Menyusun papan peringkat Tilawati — sama pola dengan getRankedStudents() Tahfid. */
export function getRankedTilawatiStudents(params: {
  search?: string;
  classId?: number | null;
  sort?: string;
  page?: number;
  perPage?: number;
  excludeTopThree?: boolean;
}): {
  students: RankedTilawatiStudent[];
  pageItems: RankedTilawatiStudent[];
  total: number;
  totalPages: number;
  page: number;
  topThree: RankedTilawatiStudent[];
} {
  const sort = normaliseTilawatiSort(params.sort);
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

  // Peringkat sekolah: jilid selesai dulu, lalu jumlah halaman, lalu nama.
  const byAchievement = (a: RankedTilawatiStudent, b: RankedTilawatiStudent) =>
    b.jilid_completed - a.jilid_completed ||
    b.total_pages - a.total_pages ||
    a.name.localeCompare(b.name, "id");

  const globalOrder = [...ranked].sort(byAchievement);
  globalOrder.forEach((s, i) => {
    s.rank = i + 1;
  });

  const perClass = new Map<number, RankedTilawatiStudent[]>();
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

  const topThree = globalOrder.filter((s) => s.total_pages > 0).slice(0, 3);

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
  } else if (sort === "tren") {
    sorted.sort((a, b) => b.trend - a.trend || byAchievement(a, b));
  }

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(params.page ?? 1, 1), totalPages);
  const pageItems = sorted.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return { students: sorted, pageItems, total, totalPages, page, topThree };
}

export function getStudentTilawati(studentId: number): {
  entries: TilawatiEntry[];
  totalPages: number;
  progressPercent: number;
  jilidCompleted: number;
  currentLocation: ReturnType<typeof getCurrentLocation>;
} {
  const entries = db
    .prepare("SELECT * FROM tilawati_entries WHERE student_id = ? ORDER BY jilid_number ASC")
    .all(studentId) as TilawatiEntry[];

  return {
    entries,
    totalPages: totalPagesRead(entries),
    progressPercent: overallTilawatiPercent(entries),
    jilidCompleted: jilidCompletedCount(entries),
    currentLocation: getCurrentLocation(entries),
  };
}

/** Capaian Tilawati seluruh siswa pada satu kelas, untuk halaman input guru. */
export function getClassTilawati(classId: number): {
  student: { id: number; nis: string | null; name: string; photo_path: string | null };
  entries: TilawatiEntry[];
  totalPages: number;
  progressPercent: number;
  jilidCompleted: number;
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
      `SELECT * FROM tilawati_entries WHERE student_id IN (${placeholders})
       ORDER BY jilid_number ASC`
    )
    .all(...students.map((s) => s.id)) as TilawatiEntry[];

  const grouped = new Map<number, TilawatiEntry[]>();
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
      totalPages: totalPagesRead(entries),
      progressPercent: overallTilawatiPercent(entries),
      jilidCompleted: jilidCompletedCount(entries),
      currentLocation: getCurrentLocation(entries),
    };
  });
}

export function getTilawatiSummaryStats(): {
  totalStudents: number;
  totalClasses: number;
  totalJilid: number;
  totalPages: number;
  weeklyPages: number;
} {
  const students = db.prepare("SELECT COUNT(*) AS c FROM students").get() as { c: number };
  const classes = db.prepare("SELECT COUNT(*) AS c FROM classes").get() as { c: number };
  const weekly = db
    .prepare(
      `SELECT COALESCE(SUM(page_to - page_from), 0) AS delta FROM tilawati_log
       WHERE logged_at >= datetime('now', '-7 days')`
    )
    .get() as { delta: number };

  const entriesByStudent = loadAllEntries();
  let totalJilid = 0;
  let totalPages = 0;
  for (const entries of entriesByStudent.values()) {
    totalJilid += jilidCompletedCount(entries);
    totalPages += totalPagesRead(entries);
  }

  return {
    totalStudents: students.c,
    totalClasses: classes.c,
    totalJilid,
    totalPages,
    weeklyPages: weekly.delta,
  };
}

export function searchStudents(term: string): string {
  return `%${escapeLikePattern(term)}%`;
}

export { TOTAL_JILID };
