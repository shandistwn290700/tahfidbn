import type { FC } from "hono/jsx";
import { PageShell, EmptyState, CARD } from "../components/ui.tsx";
import { SearchFilter } from "../components/SearchFilter.tsx";
import { PeriodTable } from "../components/PeriodTable.tsx";
import type { User, ClassRoom } from "../../types.ts";
import type { PeriodStudent, PeriodJenis } from "../../lib/period-report.ts";

const SORT_OPTIONS = [
  { value: "ayat", label: "Urutkan: Paling aktif periode ini" },
  { value: "persen", label: "Urutkan: Rekapitulasi tertinggi" },
  { value: "nama", label: "Urutkan: Nama" },
  { value: "kelas", label: "Urutkan: Kelas" },
];

function formatTanggal(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const PeriodReportPage: FC<{
  user: User;
  classes: ClassRoom[];
  jenis: PeriodJenis;
  range: { from: string; to: string } | null;
  members: PeriodStudent[];
  total: number;
  page: number;
  totalPages: number;
  perPage: number;
  search: string;
  sort: string;
  classId: number | null;
}> = ({ user, classes, jenis, range, members, total, page, totalPages, perPage, search, sort, classId }) => {
  const buildJenisHref = (j: PeriodJenis) => `/leaderboard/periode?jenis=${j}`;

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
      active
        ? "bg-primary text-white shadow-sm"
        : "bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-800"
    }`;

  return (
    <PageShell
      user={user}
      currentPath="/leaderboard/periode"
      title="Laporan Periode"
      heading="Laporan Periode"
      subheading="Rekap capaian Tahfid & Tilawati siswa selama tengah semester atau satu semester penuh, berdasarkan tanggal semester yang diatur di Pengaturan."
      wide
    >
      <div class="flex flex-wrap gap-2 mb-6">
        <a href={buildJenisHref("tengah")} class={tabClass(jenis === "tengah")}>
          <span class="material-symbols-outlined text-[18px]">event_upcoming</span>
          Tengah Semester
        </a>
        <a href={buildJenisHref("penuh")} class={tabClass(jenis === "penuh")}>
          <span class="material-symbols-outlined text-[18px]">event_available</span>
          Semester Penuh
        </a>
      </div>

      {!range ? (
        <div class={CARD}>
          <EmptyState
            icon="event_busy"
            title="Tanggal semester belum diatur lengkap"
            description="Isi Tanggal Mulai dan Tanggal Selesai Semester di Administrasi › Pengaturan › Laporan Pekanan supaya laporan periode ini bisa dihitung."
          />
        </div>
      ) : (
        <>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-6">
            Menampilkan capaian dari <b>{formatTanggal(range.from)}</b> sampai{" "}
            <b>{formatTanggal(range.to)}</b>.
          </p>

          <SearchFilter
            search={search}
            sort={sort}
            classId={classId}
            classes={classes}
            action="/leaderboard/periode"
            sortOptions={SORT_OPTIONS}
            defaultSort="ayat"
            hiddenFields={[{ name: "jenis", value: jenis }]}
          />

          <PeriodTable
            members={members}
            total={total}
            page={page}
            totalPages={totalPages}
            perPage={perPage}
            search={search}
            sort={sort}
            classId={classId}
            jenis={jenis}
          />
        </>
      )}
    </PageShell>
  );
};
