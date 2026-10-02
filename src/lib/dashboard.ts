import { db } from "../db/connection.ts";

/**
 * Data Dashboard admin: tambahan ayat & guru aktif per periode.
 *
 * Semua pengelompokan memakai tanggal WIB. `progress_log.logged_at` disimpan dalam UTC
 * (datetime('now')), jadi input pukul 00.00–07.00 WIB akan jatuh ke hari sebelumnya bila
 * dikelompokkan apa adanya.
 *
 * "Tambahan ayat" mengikuti rumus Laporan Periode: jumlah (ayah_to - ayah_from) per siswa
 * per periode, ditahan minimal 0 supaya koreksi data tidak membuat capaian minus.
 * "Guru aktif" = akun berperan guru yang menginput hafalan dalam periode itu.
 */

export type DashboardRange = "harian" | "pekanan" | "bulanan" | "semester";

export const DASHBOARD_RANGES: { value: DashboardRange; label: string; description: string }[] = [
  { value: "harian", label: "Harian", description: "30 hari terakhir" },
  { value: "pekanan", label: "Pekanan", description: "12 pekan terakhir" },
  { value: "bulanan", label: "Bulanan", description: "12 bulan terakhir" },
  { value: "semester", label: "Semester", description: "6 semester terakhir" },
];

export function parseRange(value: string | undefined): DashboardRange {
  return DASHBOARD_RANGES.some((r) => r.value === value) ? (value as DashboardRange) : "harian";
}

export interface Bucket {
  /** Kunci yang sama persis dengan hasil ekspresi SQL di BUCKET_SQL. */
  key: string;
  /** Label lengkap untuk tooltip & tabel, mis. "Rab, 1 Okt 2026". */
  label: string;
  /** Label ringkas untuk sumbu X, mis. "1 Okt"; boleh berisi "\n" untuk dua baris. */
  short: string;
  /** Tanggal WIB pertama periode (YYYY-MM-DD). */
  from: string;
  /** Periode yang sedang berjalan (belum selesai). */
  current: boolean;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Tanggal WIB hari ini sebagai Date UTC tengah malam (dipakai untuk aritmetika tanggal). */
function wibDate(now: Date): Date {
  const local = new Date(now.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function dayLabel(d: Date, withYear = true): string {
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
}

/** Senin pada atau sebelum tanggal d (pekan dimulai Senin). */
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getUTCDay() + 6) % 7));
}

/**
 * Semester akademik: Ganjil = Juli–Desember, Genap = Januari–Juni. Kunci "2026-1" berarti
 * Ganjil 2026/2027, "2026-2" berarti Genap 2026/2027 (Januari–Juni 2027).
 */
function semesterOf(d: Date): { startYear: number; part: 1 | 2 } {
  const month = d.getUTCMonth() + 1;
  return month >= 7
    ? { startYear: d.getUTCFullYear(), part: 1 }
    : { startYear: d.getUTCFullYear() - 1, part: 2 };
}

/** Daftar periode dari yang terlama sampai periode berjalan, termasuk periode tanpa data. */
export function buildBuckets(range: DashboardRange, now: Date = new Date()): Bucket[] {
  const today = wibDate(now);
  const buckets: Bucket[] = [];

  if (range === "harian") {
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      buckets.push({
        key: ymd(d),
        label: `${HARI[d.getUTCDay()]}, ${dayLabel(d)}`,
        short: dayLabel(d, false),
        from: ymd(d),
        current: i === 0,
      });
    }
  } else if (range === "pekanan") {
    const thisMonday = mondayOf(today);
    for (let i = 11; i >= 0; i--) {
      const start = addDays(thisMonday, -7 * i);
      const end = addDays(start, 6);
      buckets.push({
        key: ymd(start),
        label: `${dayLabel(start, start.getUTCFullYear() !== end.getUTCFullYear())} – ${dayLabel(end)}`,
        short: dayLabel(start, false),
        from: ymd(start),
        current: i === 0,
      });
    }
  } else if (range === "bulanan") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      buckets.push({
        key: `${d.getUTCFullYear()}-${month}`,
        label: `${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
        short: `${BULAN[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
        from: ymd(d),
        current: i === 0,
      });
    }
  } else {
    const now_ = semesterOf(today);
    // Urutan linear: setiap tahun ajaran punya 2 semester.
    const index = now_.startYear * 2 + (now_.part - 1);
    for (let i = 5; i >= 0; i--) {
      const n = index - i;
      const startYear = Math.floor(n / 2);
      const part = (n % 2) + 1;
      const from = part === 1 ? `${startYear}-07-01` : `${startYear + 1}-01-01`;
      const tahun = `${startYear}/${startYear + 1}`;
      buckets.push({
        key: `${startYear}-${part}`,
        label: `${part === 1 ? "Ganjil" : "Genap"} ${tahun}`,
        // Dua baris (\n) supaya 6 label muat di sumbu X layar HP
        short: `${part === 1 ? "Ganjil" : "Genap"}\n${String(startYear).slice(2)}/${String(startYear + 1).slice(2)}`,
        from,
        current: i === 0,
      });
    }
  }

  return buckets;
}

// Ekspresi pengelompokan untuk kolom `lt` (logged_at dalam WIB). Hanya dipilih dari peta
// ini, tidak pernah dari masukan pengguna, jadi aman disisipkan ke teks SQL.
const BUCKET_SQL: Record<DashboardRange, string> = {
  harian: "date(lt)",
  pekanan: "date(lt, '-6 days', 'weekday 1')",
  bulanan: "strftime('%Y-%m', lt)",
  semester:
    "CASE WHEN CAST(strftime('%m', lt) AS INTEGER) >= 7 THEN strftime('%Y', lt) || '-1' " +
    "ELSE (CAST(strftime('%Y', lt) AS INTEGER) - 1) || '-2' END",
};

export interface SeriesPoint extends Bucket {
  ayat: number;
  siswa: number;
  guru: number;
}

/** Tambahan ayat, jumlah siswa yang bertambah hafalannya, dan guru aktif per periode. */
export function getProgressSeries(range: DashboardRange, now: Date = new Date()): SeriesPoint[] {
  const buckets = buildBuckets(range, now);
  // Batas bawah dalam UTC: tengah malam WIB tanggal pertama = 17.00 UTC hari sebelumnya.
  const sinceUtc = `${buckets[0]!.from} 00:00:00`;
  const bucketExpr = BUCKET_SQL[range];

  const ayatRows = db
    .prepare(
      `SELECT bucket, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS ayat,
              SUM(CASE WHEN delta > 0 THEN 1 ELSE 0 END) AS siswa
       FROM (
         SELECT ${bucketExpr} AS bucket, student_id, SUM(ayah_to - ayah_from) AS delta
         FROM (SELECT student_id, ayah_from, ayah_to, datetime(logged_at, '+7 hours') AS lt
               FROM progress_log WHERE logged_at >= datetime(?, '-7 hours'))
         GROUP BY bucket, student_id
       )
       GROUP BY bucket`
    )
    .all(sinceUtc) as { bucket: string; ayat: number; siswa: number }[];

  const guruRows = db
    .prepare(
      `SELECT ${bucketExpr} AS bucket, COUNT(DISTINCT recorded_by) AS guru
       FROM (SELECT pl.recorded_by, datetime(pl.logged_at, '+7 hours') AS lt
             FROM progress_log pl
             JOIN users u ON u.id = pl.recorded_by AND u.role = 'guru'
             WHERE pl.logged_at >= datetime(?, '-7 hours'))
       GROUP BY bucket`
    )
    .all(sinceUtc) as { bucket: string; guru: number }[];

  const ayatMap = new Map(ayatRows.map((r) => [r.bucket, r]));
  const guruMap = new Map(guruRows.map((r) => [r.bucket, r.guru]));

  return buckets.map((b) => ({
    ...b,
    ayat: ayatMap.get(b.key)?.ayat ?? 0,
    siswa: ayatMap.get(b.key)?.siswa ?? 0,
    guru: guruMap.get(b.key) ?? 0,
  }));
}

/** Tambahan ayat & jumlah siswa yang bertambah hafalannya sejak tanggal WIB `from`. */
function sumSince(from: string, until?: string): { ayat: number; siswa: number } {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS ayat,
              COALESCE(SUM(CASE WHEN delta > 0 THEN 1 ELSE 0 END), 0) AS siswa
       FROM (SELECT student_id, SUM(ayah_to - ayah_from) AS delta FROM progress_log
             WHERE logged_at >= datetime(?, '-7 hours')
               AND (? IS NULL OR logged_at < datetime(?, '-7 hours'))
             GROUP BY student_id)`
    )
    .get(`${from} 00:00:00`, until ?? null, until ? `${until} 00:00:00` : null) as {
    ayat: number;
    siswa: number;
  };
  return row;
}

export type TeacherStatus = "aktif" | "jarang" | "tidak-aktif";

export interface TeacherActivity {
  id: number;
  name: string;
  username: string;
  classes: string | null;
  lastInput: string | null;
  inputs30: number;
  ayat30: number;
  status: TeacherStatus;
}

export interface DashboardSummary {
  ayatPekanIni: number;
  ayatPekanLalu: number;
  ayatBulanIni: number;
  siswaSetorPekanIni: number;
  totalSiswa: number;
  guruAktif: number;
  totalGuru: number;
}

/** Aktivitas setiap akun guru: aktif (input ≤ 7 hari), jarang (≤ 30 hari), tidak aktif. */
export function getTeacherActivity(now: Date = new Date()): TeacherActivity[] {
  const nowUtc = now.toISOString().replace("T", " ").slice(0, 19);
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.username,
              (SELECT group_concat(c.name, ', ') FROM class_teachers ct
               JOIN classes c ON c.id = ct.class_id
               WHERE ct.user_id = u.id AND ct.subject = 'tahfid') AS classes,
              MAX(pl.logged_at) AS last_input,
              SUM(CASE WHEN pl.logged_at >= datetime(?1, '-30 days') THEN 1 ELSE 0 END) AS inputs30,
              SUM(CASE WHEN pl.logged_at >= datetime(?1, '-30 days') AND pl.ayah_to > pl.ayah_from
                       THEN pl.ayah_to - pl.ayah_from ELSE 0 END) AS ayat30,
              MAX(CASE WHEN pl.logged_at >= datetime(?1, '-7 days') THEN 1 ELSE 0 END) AS aktif7,
              MAX(CASE WHEN pl.logged_at >= datetime(?1, '-30 days') THEN 1 ELSE 0 END) AS aktif30
       FROM users u
       LEFT JOIN progress_log pl ON pl.recorded_by = u.id
       WHERE u.role = 'guru'
       GROUP BY u.id
       ORDER BY last_input IS NULL, last_input DESC, u.name COLLATE NOCASE`
    )
    .all(nowUtc) as {
    id: number;
    name: string;
    username: string;
    classes: string | null;
    last_input: string | null;
    inputs30: number | null;
    ayat30: number | null;
    aktif7: number | null;
    aktif30: number | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    classes: r.classes,
    lastInput: r.last_input,
    inputs30: r.inputs30 ?? 0,
    ayat30: r.ayat30 ?? 0,
    status: r.aktif7 ? "aktif" : r.aktif30 ? "jarang" : "tidak-aktif",
  }));
}

export function getDashboardSummary(teachers: TeacherActivity[], now: Date = new Date()): DashboardSummary {
  const today = wibDate(now);
  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const pekanIni = sumSince(ymd(thisMonday));
  const pekanLalu = sumSince(ymd(lastMonday), ymd(thisMonday));
  const bulanIni = sumSince(ymd(firstOfMonth));
  const totalSiswa = (db.prepare("SELECT COUNT(*) AS n FROM students").get() as { n: number }).n;

  return {
    ayatPekanIni: pekanIni.ayat,
    ayatPekanLalu: pekanLalu.ayat,
    ayatBulanIni: bulanIni.ayat,
    siswaSetorPekanIni: pekanIni.siswa,
    totalSiswa,
    guruAktif: teachers.filter((t) => t.status === "aktif").length,
    totalGuru: teachers.length,
  };
}
