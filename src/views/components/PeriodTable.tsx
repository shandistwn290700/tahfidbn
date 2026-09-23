import type { FC } from "hono/jsx";
import { EmptyState, CARD, StudentAvatar } from "./ui.tsx";
import type { PeriodStudent, PeriodJenis } from "../../lib/period-report.ts";

const RANK_STYLE: Record<number, string> = {
  1: "bg-primary text-white border-primary",
  2: "bg-slate-200 dark:bg-slate-700 text-text-main dark:text-text-main-dark border-slate-300 dark:border-slate-600",
  3: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
};

const Row: FC<{ member: PeriodStudent; showClassRank: boolean; jenis: PeriodJenis }> = ({
  member,
  showClassRank,
  jenis,
}) => {
  const rankClass =
    RANK_STYLE[member.rank] ||
    "bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark border-border-light dark:border-border-light-dark";

  return (
    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div class="flex items-center md:justify-center col-span-12 md:col-span-1">
        <span
          class={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold border shadow-sm ${rankClass}`}
        >
          {member.rank}
        </span>
        <span class="ml-2 md:hidden text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
          Peringkat aktivitas
        </span>
      </div>

      <div class="col-span-12 md:col-span-4 flex items-center gap-3">
        <StudentAvatar name={member.name} photoPath={member.photo_path} />
        <div class="min-w-0">
          <p class="text-text-main dark:text-text-main-dark text-sm font-bold truncate">
            {member.name}
          </p>
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs truncate">
            {member.class_name || "Belum berkelas"}
            {showClassRank && member.class_rank > 0 && (
              <span class="text-primary font-semibold"> &bull; #{member.class_rank} di kelas</span>
            )}
            {member.nis ? ` • NIS ${member.nis}` : ""}
          </p>
        </div>
      </div>

      <div class="col-span-6 md:col-span-3">
        <div class="text-text-secondary dark:text-text-secondary-dark md:hidden mb-1 text-xs uppercase font-bold">
          Selama periode ini
        </div>
        <p class="text-text-main dark:text-text-main-dark text-sm font-bold">
          {member.ayat_periode} ayat
        </p>
        <p class="text-text-secondary dark:text-text-secondary-dark text-xs">
          {member.halaman_periode} halaman Tilawati
        </p>
      </div>

      <div class="col-span-4 md:col-span-3">
        <div class="text-text-secondary dark:text-text-secondary-dark md:hidden mb-1 text-xs uppercase font-bold">
          Kumulatif
        </div>
        <p class="text-text-main dark:text-text-main-dark text-xs">
          {member.juz_completed} juz &bull; {member.jilid_completed} jilid
        </p>
        <p class="text-primary text-sm font-black">{member.recap_percent}% rekap</p>
      </div>

      <div class="col-span-2 md:col-span-1 flex md:justify-end items-center">
        <a
          href={`/laporan/siswa/${member.id}/periode?jenis=${jenis}`}
          class="inline-flex items-center gap-1 text-primary text-xs font-bold hover:underline"
          data-no-loader
          title="Cetak PDF laporan periode ini"
        >
          <span class="material-symbols-outlined text-[18px]">description</span>
          <span class="hidden md:inline">Cetak</span>
        </a>
      </div>
    </div>
  );
};

export const PeriodTable: FC<{
  members: PeriodStudent[];
  total: number;
  page: number;
  totalPages: number;
  perPage: number;
  search: string;
  sort: string;
  classId: number | null;
  jenis: PeriodJenis;
}> = ({ members, total, page, totalPages, perPage, search, sort, classId, jenis }) => {
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set("jenis", jenis);
    if (search) params.set("cari", search);
    if (sort && sort !== "ayat") params.set("urut", sort);
    if (classId !== null) params.set("kelas", String(classId));
    params.set("hal", String(targetPage));
    return `/leaderboard/periode?${params.toString()}`;
  };

  const dari = total === 0 ? 0 : (page - 1) * perPage + 1;
  const sampai = Math.min(page * perPage, total);

  const pageLink =
    "px-3 py-1.5 rounded-lg border border-border-light dark:border-border-light-dark bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark text-sm hover:text-text-main dark:hover:text-text-main-dark hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium";
  const pageDisabled =
    "px-3 py-1.5 rounded-lg border border-border-light dark:border-border-light-dark bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark text-sm font-medium opacity-50 cursor-not-allowed";

  return (
    <div class={`${CARD} w-full overflow-hidden mb-8`}>
      <div class="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-border-light dark:border-border-light-dark bg-slate-50/50 dark:bg-slate-800/50 text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
        <div class="col-span-1 text-center">Peringkat</div>
        <div class="col-span-4">Siswa</div>
        <div class="col-span-3">Selama Periode Ini</div>
        <div class="col-span-3">Kumulatif</div>
        <div class="col-span-1 text-right">PDF</div>
      </div>

      <div class="divide-y divide-border-light dark:divide-border-light-dark">
        {members.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="Tidak ada siswa yang cocok"
            description={
              search || classId !== null
                ? "Coba ubah kata kunci pencarian atau pilih kelas lain."
                : "Belum ada catatan hafalan/Tilawati pada rentang periode ini."
            }
          />
        ) : (
          members.map((member) => (
            <Row member={member} showClassRank={classId !== null} jenis={jenis} />
          ))
        )}
      </div>

      <div class="bg-slate-50/50 dark:bg-slate-800/50 border-t border-border-light dark:border-border-light-dark px-6 py-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <p class="text-text-secondary dark:text-text-secondary-dark text-sm text-center sm:text-left">
          Menampilkan {dari}&ndash;{sampai} dari {total} siswa
        </p>
        <div class="flex gap-2">
          {page > 1 ? (
            <a href={buildHref(page - 1)} class={pageLink}>
              Sebelumnya
            </a>
          ) : (
            <span class={pageDisabled}>Sebelumnya</span>
          )}
          <span class="px-3 py-1.5 text-text-secondary dark:text-text-secondary-dark text-sm font-medium">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <a href={buildHref(page + 1)} class={pageLink}>
              Berikutnya
            </a>
          ) : (
            <span class={pageDisabled}>Berikutnya</span>
          )}
        </div>
      </div>
    </div>
  );
};
