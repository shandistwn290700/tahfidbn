import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import { getRankedStudents, getSummaryStats, normaliseSort } from "../lib/progress-calc.ts";
import {
  getPeriodRankedStudents,
  normalisePeriodSort,
  normalisePeriodJenis,
} from "../lib/period-report.ts";
import { getMidSemesterRange, getFullSemesterRange } from "../lib/settings.ts";
import { listClasses } from "../lib/access.ts";
import { readInt, readOptionalInt } from "../lib/http.ts";
import { LeaderboardPage } from "../views/pages/LeaderboardPage.tsx";
import { PeriodReportPage } from "../views/pages/PeriodReportPage.tsx";
import type { Env } from "../types.ts";

const leaderboard = new Hono<Env>();

leaderboard.use("*", authMiddleware);

const PER_PAGE = 20;

leaderboard.get("/", (c) => {
  const user = c.get("user");

  const search = (c.req.query("cari") || "").trim();
  const sort = normaliseSort(c.req.query("urut"));
  const classId = readOptionalInt(c.req.query("kelas"));
  const page = readInt(c.req.query("hal"), 1, { min: 1, max: 100_000 });

  // Tanpa penyaringan, tiga besar sudah tampil sebagai podium — tidak diulang
  // lagi di tabel supaya daftar tidak menampilkan nama yang sama dua kali.
  const unfiltered = !search && classId === null && sort === "juz";

  const result = getRankedStudents({
    search,
    classId,
    sort,
    page,
    perPage: PER_PAGE,
    excludeTopThree: unfiltered,
  });

  return c.html(
    <LeaderboardPage
      user={user}
      classes={listClasses()}
      stats={getSummaryStats()}
      topThree={result.topThree}
      showPodium={unfiltered}
      members={result.pageItems}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      perPage={PER_PAGE}
      search={search}
      sort={sort}
      classId={classId}
    />
  );
});

// Papan Tilawati dan Rekapitulasi sudah dihapus. Alamat lamanya bisa saja masih
// tersimpan di bookmark atau riwayat peramban guru, jadi diarahkan ke papan Tahfid
// alih-alih memunculkan halaman 404.
leaderboard.get("/tilawati", (c) => c.redirect("/leaderboard"));
leaderboard.get("/rekap", (c) => c.redirect("/leaderboard"));

leaderboard.get("/periode", (c) => {
  const user = c.get("user");

  const jenis = normalisePeriodJenis(c.req.query("jenis"));
  const search = (c.req.query("cari") || "").trim();
  const sort = normalisePeriodSort(c.req.query("urut"));
  const classId = readOptionalInt(c.req.query("kelas"));
  const page = readInt(c.req.query("hal"), 1, { min: 1, max: 100_000 });

  const range = jenis === "penuh" ? getFullSemesterRange() : getMidSemesterRange();

  const result = range
    ? getPeriodRankedStudents({ from: range.from, to: range.to, search, classId, sort, page, perPage: PER_PAGE })
    : { pageItems: [], total: 0, page: 1, totalPages: 1 };

  return c.html(
    <PeriodReportPage
      user={user}
      classes={listClasses()}
      jenis={jenis}
      range={range}
      members={result.pageItems}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      perPage={PER_PAGE}
      search={search}
      sort={sort}
      classId={classId}
    />
  );
});

export { leaderboard as leaderboardRoutes };
