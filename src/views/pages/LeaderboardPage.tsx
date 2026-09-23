import type { FC } from "hono/jsx";
import { PageShell, StatCard } from "../components/ui.tsx";
import { TopThreeCards } from "../components/TopThreeCards.tsx";
import { SearchFilter } from "../components/SearchFilter.tsx";
import { LeaderboardTable } from "../components/LeaderboardTable.tsx";
import type { User, ClassRoom, RankedStudent } from "../../types.ts";

export const LeaderboardPage: FC<{
  user: User;
  classes: ClassRoom[];
  stats: {
    totalStudents: number;
    totalClasses: number;
    totalJuz: number;
    totalAyahs: number;
    weeklyAyahs: number;
  };
  topThree: RankedStudent[];
  showPodium: boolean;
  members: RankedStudent[];
  total: number;
  page: number;
  totalPages: number;
  perPage: number;
  search: string;
  sort: string;
  classId: number | null;
}> = ({
  user,
  classes,
  stats,
  topThree,
  showPodium,
  members,
  total,
  page,
  totalPages,
  perPage,
  search,
  sort,
  classId,
}) => {
  const namaKelas = classId !== null ? classes.find((k) => k.id === classId)?.name : null;

  return (
    <PageShell
      user={user}
      currentPath="/leaderboard"
      title="Papan Peringkat"
      heading="Papan Peringkat"
      subheading={
        namaKelas
          ? `Menampilkan capaian hafalan siswa kelas ${namaKelas}.`
          : "Pantau capaian hafalan seluruh siswa, rayakan setiap kemajuan, dan tumbuhkan semangat berlomba dalam kebaikan."
      }
      wide
    >
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="groups" label="Siswa" value={String(stats.totalStudents)} />
        <StatCard icon="school" label="Kelas" value={String(stats.totalClasses)} />
        <StatCard
          icon="auto_stories"
          label="Juz Terhafal"
          value={String(stats.totalJuz)}
          hint={`${stats.totalAyahs.toLocaleString("id-ID")} ayat terkumpul`}
        />
        <StatCard
          icon="trending_up"
          label="Pekan Ini"
          value={`${stats.weeklyAyahs} ayat`}
          hint="tambahan 7 hari terakhir"
        />
      </div>

      {showPodium && <TopThreeCards topThree={topThree} />}

      <SearchFilter search={search} sort={sort} classId={classId} classes={classes} />

      <LeaderboardTable
        members={members}
        total={total}
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        search={search}
        sort={sort}
        classId={classId}
        podiumHidden={showPodium && topThree.length > 0}
      />
    </PageShell>
  );
};
