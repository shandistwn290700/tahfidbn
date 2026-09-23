import type { FC } from "hono/jsx";
import { PageShell } from "../components/ui.tsx";
import { RecapTopThree } from "../components/RecapTopThree.tsx";
import { SearchFilter } from "../components/SearchFilter.tsx";
import { RecapTable } from "../components/RecapTable.tsx";
import type { User, ClassRoom, RecapStudent } from "../../types.ts";

const SORT_OPTIONS = [
  { value: "persen", label: "Urutkan: Rekapitulasi tertinggi" },
  { value: "nama", label: "Urutkan: Nama" },
  { value: "kelas", label: "Urutkan: Kelas" },
];

export const RecapLeaderboardPage: FC<{
  user: User;
  classes: ClassRoom[];
  topThree: RecapStudent[];
  showPodium: boolean;
  members: RecapStudent[];
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
      currentPath="/leaderboard/rekap"
      title="Papan Peringkat Rekapitulasi"
      heading="Rekapitulasi"
      subheading={
        namaKelas
          ? `Rata-rata capaian Tahfid dan Tilawati siswa kelas ${namaKelas}.`
          : "Rata-rata persentase capaian Tahfid Al-Qur'an dan Tilawati setiap siswa."
      }
      wide
    >
      {showPodium && <RecapTopThree topThree={topThree} />}

      <SearchFilter
        search={search}
        sort={sort}
        classId={classId}
        classes={classes}
        action="/leaderboard/rekap"
        sortOptions={SORT_OPTIONS}
        defaultSort="persen"
      />

      <RecapTable
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
