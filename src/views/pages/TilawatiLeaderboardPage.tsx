import type { FC } from "hono/jsx";
import { PageShell, StatCard } from "../components/ui.tsx";
import { TilawatiTopThree } from "../components/TilawatiTopThree.tsx";
import { SearchFilter } from "../components/SearchFilter.tsx";
import { TilawatiTable } from "../components/TilawatiTable.tsx";
import type { User, ClassRoom, RankedTilawatiStudent } from "../../types.ts";

const SORT_OPTIONS = [
  { value: "jilid", label: "Urutkan: Jilid terbanyak" },
  { value: "nama", label: "Urutkan: Nama" },
  { value: "kelas", label: "Urutkan: Kelas" },
  { value: "tren", label: "Urutkan: Paling giat pekan ini" },
];

export const TilawatiLeaderboardPage: FC<{
  user: User;
  classes: ClassRoom[];
  stats: {
    totalStudents: number;
    totalClasses: number;
    totalJilid: number;
    totalPages: number;
    weeklyPages: number;
  };
  topThree: RankedTilawatiStudent[];
  showPodium: boolean;
  members: RankedTilawatiStudent[];
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
      currentPath="/leaderboard/tilawati"
      title="Papan Peringkat Tilawati"
      heading="Papan Peringkat Tilawati"
      subheading={
        namaKelas
          ? `Menampilkan capaian Tilawati siswa kelas ${namaKelas}.`
          : "Pantau capaian bacaan Tilawati seluruh siswa, rayakan setiap kemajuan."
      }
      wide
    >
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="groups" label="Siswa" value={String(stats.totalStudents)} />
        <StatCard icon="school" label="Kelas" value={String(stats.totalClasses)} />
        <StatCard
          icon="auto_stories"
          label="Jilid Selesai"
          value={String(stats.totalJilid)}
          hint={`${stats.totalPages.toLocaleString("id-ID")} halaman terkumpul`}
        />
        <StatCard
          icon="trending_up"
          label="Pekan Ini"
          value={`${stats.weeklyPages} halaman`}
          hint="tambahan 7 hari terakhir"
        />
      </div>

      {showPodium && <TilawatiTopThree topThree={topThree} />}

      <SearchFilter
        search={search}
        sort={sort}
        classId={classId}
        classes={classes}
        action="/leaderboard/tilawati"
        sortOptions={SORT_OPTIONS}
        defaultSort="jilid"
      />

      <TilawatiTable
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
