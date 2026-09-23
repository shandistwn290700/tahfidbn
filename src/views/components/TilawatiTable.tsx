import type { FC } from "hono/jsx";
import { EmptyState, CARD, StudentAvatar } from "./ui.tsx";
import type { RankedTilawatiStudent } from "../../types.ts";

const TrendBadge: FC<{ trend: number }> = ({ trend }) => {
  if (trend > 0) {
    return (
      <div class="flex items-center gap-1 text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded">
        <span class="material-symbols-outlined text-[16px]">arrow_upward</span>
        {trend}
      </div>
    );
  }
  if (trend < 0) {
    return (
      <div class="flex items-center gap-1 text-rose-500 text-xs font-bold bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">
        <span class="material-symbols-outlined text-[16px]">arrow_downward</span>
        {Math.abs(trend)}
      </div>
    );
  }
  return (
    <div class="flex items-center gap-1 text-text-secondary dark:text-text-secondary-dark text-xs font-medium px-2 py-1">
      <span class="material-symbols-outlined text-[16px]">remove</span>
    </div>
  );
};

const RANK_STYLE: Record<number, string> = {
  1: "bg-primary text-white border-primary",
  2: "bg-slate-200 dark:bg-slate-700 text-text-main dark:text-text-main-dark border-slate-300 dark:border-slate-600",
  3: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
};

const Row: FC<{ member: RankedTilawatiStudent; showClassRank: boolean }> = ({
  member,
  showClassRank,
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
          Peringkat sekolah
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
          Posisi
        </div>
        {member.current_jilid > 0 ? (
          <div class="flex flex-col gap-1.5">
            <div>
              <p class="text-text-main dark:text-text-main-dark text-sm font-medium">
                Jilid {member.current_jilid}
              </p>
              <p class="text-text-secondary dark:text-text-secondary-dark text-[11px]">
                Halaman {member.current_page}
              </p>
            </div>

            {member.in_progress_jilid.length > 1 && (
              <div class="flex flex-wrap gap-1 mt-0.5">
                {member.in_progress_jilid
                  .filter((j) => j.number !== member.current_jilid)
                  .slice(0, 4)
                  .map((j) => (
                    <span
                      title={`Jilid ${j.number}: halaman ${j.last_page} dari ${j.total_pages}`}
                      class="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark rounded border border-border-light dark:border-border-light-dark font-bold"
                    >
                      Jilid {j.number}
                    </span>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm italic">
            Belum ada catatan
          </p>
        )}
      </div>

      <div class="col-span-6 md:col-span-3">
        <div class="text-text-secondary dark:text-text-secondary-dark md:hidden mb-1 text-xs uppercase font-bold">
          Capaian
        </div>
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-text-main dark:text-text-main-dark text-sm font-bold">
            {member.jilid_completed} jilid
          </span>
          <span class="text-text-secondary dark:text-text-secondary-dark text-xs">
            {member.total_pages} halaman
          </span>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex-1 rounded-full h-2 bg-slate-100 dark:bg-slate-800">
            <div
              class={`h-2 rounded-full ${
                member.progress_percent > 80
                  ? "bg-primary"
                  : member.progress_percent > 50
                    ? "bg-primary/80"
                    : member.progress_percent > 20
                      ? "bg-primary/60"
                      : "bg-primary/40"
              }`}
              style={`width: ${member.total_pages > 0 ? Math.max(member.progress_percent, 1.5) : 0}%`}
            />
          </div>
          <span class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold tabular-nums">
            {member.progress_percent}%
          </span>
        </div>
      </div>

      <div class="col-span-12 md:col-span-1 flex md:justify-end items-center gap-2">
        <span class="md:hidden text-xs uppercase font-bold text-text-secondary dark:text-text-secondary-dark">
          Pekan ini
        </span>
        <TrendBadge trend={member.trend} />
      </div>
    </div>
  );
};

export const TilawatiTable: FC<{
  members: RankedTilawatiStudent[];
  total: number;
  page: number;
  totalPages: number;
  perPage: number;
  search: string;
  sort: string;
  classId: number | null;
  podiumHidden: boolean;
}> = ({ members, total, page, totalPages, perPage, search, sort, classId, podiumHidden }) => {
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("cari", search);
    if (sort && sort !== "jilid") params.set("urut", sort);
    if (classId !== null) params.set("kelas", String(classId));
    params.set("hal", String(targetPage));
    return `/leaderboard/tilawati?${params.toString()}`;
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
        <div class="col-span-3">Posisi Bacaan</div>
        <div class="col-span-3">Capaian</div>
        <div class="col-span-1 text-right">Pekan Ini</div>
      </div>

      <div class="divide-y divide-border-light dark:divide-border-light-dark">
        {members.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="Tidak ada siswa yang cocok"
            description={
              search || classId !== null
                ? "Coba ubah kata kunci pencarian atau pilih kelas lain."
                : "Peringkat akan terisi setelah guru mulai menginput capaian Tilawati siswa."
            }
          />
        ) : (
          members.map((member) => <Row member={member} showClassRank={classId !== null} />)
        )}
      </div>

      <div class="bg-slate-50/50 dark:bg-slate-800/50 border-t border-border-light dark:border-border-light-dark px-6 py-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <p class="text-text-secondary dark:text-text-secondary-dark text-sm text-center sm:text-left">
          Menampilkan {dari}&ndash;{sampai} dari {total} siswa
          {podiumHidden && " (di luar tiga besar pada podium)"}
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
