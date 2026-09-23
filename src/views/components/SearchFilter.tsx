import type { FC } from "hono/jsx";
import { INPUT, BTN_PRIMARY, BTN_GHOST, CARD } from "./ui.tsx";
import type { ClassRoom } from "../../types.ts";

const TAHFID_SORT_OPTIONS = [
  { value: "juz", label: "Urutkan: Juz terbanyak" },
  { value: "nama", label: "Urutkan: Nama" },
  { value: "kelas", label: "Urutkan: Kelas" },
  { value: "tren", label: "Urutkan: Paling giat pekan ini" },
];

export const SearchFilter: FC<{
  search: string;
  sort: string;
  classId: number | null;
  classes: ClassRoom[];
  /** Rute tujuan formulir. Default papan peringkat Tahfid. */
  action?: string;
  /** Opsi dropdown urutan. Default urutan Tahfid (juz/nama/kelas/tren). */
  sortOptions?: { value: string; label: string }[];
  /** Nilai urut default (dipakai untuk deteksi filter aktif). Default "juz". */
  defaultSort?: string;
  /** Field tersembunyi tambahan yang perlu ikut terkirim (mis. jenis periode). */
  hiddenFields?: { name: string; value: string }[];
}> = ({
  search,
  sort,
  classId,
  classes,
  action = "/leaderboard",
  sortOptions = TAHFID_SORT_OPTIONS,
  defaultSort = "juz",
  hiddenFields = [],
}) => {
  const filterAktif = Boolean(search || classId !== null || sort !== defaultSort);

  return (
    <form
      method="GET"
      action={action}
      class={`${CARD} w-full flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 mb-6 p-3`}
    >
      {hiddenFields.map((field) => (
        <input type="hidden" name={field.name} value={field.value} />
      ))}
      <div class="relative flex-1 lg:min-w-[280px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-text-secondary-dark material-symbols-outlined text-[20px]">
          search
        </span>
        <input
          class={`${INPUT} pl-10`}
          placeholder="Cari nama atau NIS siswa..."
          type="text"
          name="cari"
          value={search}
        />
      </div>

      <div class="flex flex-col sm:flex-row items-stretch gap-3">
        <select name="kelas" class={`${INPUT} sm:w-48`} onchange="this.form.submit()">
          <option value="" selected={classId === null}>
            Semua kelas
          </option>
          {classes.map((kelas) => (
            <option value={String(kelas.id)} selected={classId === kelas.id}>
              {kelas.name}
            </option>
          ))}
        </select>

        <select name="urut" class={`${INPUT} sm:w-60`} onchange="this.form.submit()">
          {sortOptions.map((option) => (
            <option value={option.value} selected={sort === option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button type="submit" class={BTN_PRIMARY}>
          <span class="material-symbols-outlined text-[18px]">filter_alt</span>
          Terapkan
        </button>

        {filterAktif && (
          <a
            href={
              hiddenFields.length > 0
                ? `${action}?${hiddenFields.map((f) => `${f.name}=${encodeURIComponent(f.value)}`).join("&")}`
                : action
            }
            class={BTN_GHOST}
          >
            Reset
          </a>
        )}
      </div>
    </form>
  );
};
