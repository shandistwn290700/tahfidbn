import type { FC } from "hono/jsx";
import {
  PageShell,
  EmptyState,
  BTN_PRIMARY,
  BTN_GHOST,
  INPUT,
  LABEL,
  CARD,
  StudentAvatar,
} from "../components/ui.tsx";
import type { User, ClassRoom } from "../../types.ts";

/** Satu siswa di halaman Laporan Pekanan — angka yang sama dengan yang dikirim ke Canva. */
export type ReportRow = {
  id: number;
  name: string;
  nis: string | null;
  photo_path: string | null;
  /** Tambahan ayat 7 hari terakhir (isian `ayat` di Canva). */
  ayatPekanIni: number;
  /** Total hafalan saat ini (isian `ayat_total` di Canva). */
  totalMemorized: number;
};

const PAGE = {
  currentPath: "/laporan",
  title: "Laporan Pekanan",
  heading: "Laporan Pekanan",
};

/**
 * Pembuatan Laporan Pekanan via Canva, terpisah dari Input Hafalan. Tombol hanya
 * memasukkan permintaan ke antrean; hasilnya diunduh di halaman Antrean Laporan.
 */
export const ReportCreatePage: FC<{
  user: User;
  classes: ClassRoom[];
  selectedClass: ClassRoom | null;
  rows: ReportRow[];
  canvaReady: boolean;
}> = ({ user, classes, selectedClass, rows, canvaReady }) => {
  const isAdmin = user.role === "admin";

  if (classes.length === 0) {
    return (
      <PageShell user={user} {...PAGE} subheading="Buat Laporan Pekanan siswa lewat Canva." wide>
        <div class={CARD}>
          <EmptyState
            icon="school"
            title="Anda belum ditugaskan ke kelas mana pun"
            description={
              isAdmin
                ? "Belum ada kelas yang dibuat. Buat kelas terlebih dahulu di menu Administrasi › Kelas."
                : "Hubungi administrator agar Anda ditempatkan sebagai pengampu salah satu kelas."
            }
          />
        </div>
      </PageShell>
    );
  }

  const sudahSetor = rows.filter((r) => r.ayatPekanIni > 0).length;

  return (
    <PageShell
      user={user}
      {...PAGE}
      subheading="Buat Laporan Pekanan lewat Canva, per siswa atau satu kelas sekaligus. Prosesnya berjalan di server; unduh hasilnya di Antrean Laporan."
      wide
    >
      {/* Pemilih kelas */}
      <div class={`${CARD} p-3 mb-6`}>
        <form method="get" action="/laporan" class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div class="flex-1">
            <label class={LABEL} for="pilih-kelas-laporan">
              Kelas
            </label>
            <select id="pilih-kelas-laporan" name="kelas" class={INPUT} onchange="this.form.submit()">
              {classes.map((kelas) => (
                <option value={String(kelas.id)} selected={selectedClass?.id === kelas.id}>
                  {kelas.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" class={BTN_GHOST}>
            <span class="material-symbols-outlined text-[20px]">sync</span>
            Tampilkan
          </button>
        </form>
      </div>

      {!canvaReady && (
        <div class={`${CARD} p-4 mb-6`}>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm flex items-start gap-2">
            <span class="material-symbols-outlined text-[20px] shrink-0">info</span>
            {/* Satu span supaya tautan ikut mengalir dalam kalimat, bukan kolom sendiri */}
            <span>
              Laporan Pekanan dibuat lewat Canva, yang belum terhubung atau belum diisi ID Brand
              Template-nya.{" "}
              {isAdmin ? (
                <a href="/administrasi/pengaturan/canva" class="text-primary font-bold hover:underline whitespace-nowrap">
                  Atur sekarang
                </a>
              ) : (
                "Hubungi administrator."
              )}
            </span>
          </p>
        </div>
      )}

      {selectedClass && rows.length > 0 && (
        <div class="mb-6 flex flex-wrap items-center gap-2">
          {canvaReady && (
            <form
              method="post"
              action={`/laporan/kelas/${selectedClass.id}/antrean`}
              data-confirm={`Laporan Pekanan untuk <b>${rows.length} siswa</b> kelas ${selectedClass.name} akan dibuat lewat Canva, satu per satu.<br><br>Prosesnya berjalan di server — halaman boleh ditutup. Unduh ZIP-nya di halaman Antrean Laporan setelah selesai.`}
              data-confirm-title="Buat laporan sekelas?"
              data-confirm-icon="question"
              data-confirm-ok="Ya, masukkan antrean"
              data-loader-text="Memasukkan ke antrean"
            >
              <button type="submit" class={BTN_PRIMARY}>
                <span class="material-symbols-outlined text-[20px]">folder_zip</span>
                Buat Laporan Sekelas ({rows.length} siswa)
              </button>
            </form>
          )}
          <a href="/laporan/antrean" class={BTN_GHOST}>
            <span class="material-symbols-outlined text-[20px]">pending_actions</span>
            Antrean Laporan
          </a>
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs w-full sm:w-auto sm:ml-auto">
            {sudahSetor} dari {rows.length} siswa bertambah hafalannya pekan ini.
          </p>
        </div>
      )}

      <div class={CARD}>
        {rows.length === 0 ? (
          <EmptyState
            icon="person_off"
            title={`Belum ada siswa di kelas ${selectedClass?.name ?? ""}`}
            description={
              isAdmin
                ? "Tambahkan siswa dan tempatkan pada kelas ini melalui menu Administrasi › Siswa."
                : "Hubungi administrator untuk menambahkan siswa ke kelas ini."
            }
          />
        ) : (
          <div class="divide-y divide-border-light dark:divide-border-light-dark">
            {rows.map((row) => (
              <div class="flex items-center gap-4 px-5 py-4">
                <StudentAvatar name={row.name} photoPath={row.photo_path} />
                <div class="min-w-0 flex-1">
                  <p class="text-text-main dark:text-text-main-dark text-sm font-bold truncate">{row.name}</p>
                  <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5">
                    <span class={row.ayatPekanIni > 0 ? "text-primary font-bold" : ""}>
                      +{row.ayatPekanIni} ayat pekan ini
                    </span>{" "}
                    &bull; total {row.totalMemorized} ayat
                    {!row.photo_path && <span> &bull; belum ada foto</span>}
                  </p>
                </div>
                {canvaReady && (
                  <form
                    method="post"
                    action={`/laporan/siswa/${row.id}/antrean`}
                    class="shrink-0"
                    data-loader-text="Memasukkan ke antrean"
                  >
                    <input type="hidden" name="return_kelas" value={String(selectedClass?.id ?? "")} />
                    <button type="submit" class={BTN_GHOST} title={`Buat Laporan Pekanan ${row.name}`}>
                      <span class="material-symbols-outlined text-[20px]">description</span>
                      <span class="hidden sm:inline">Buat Laporan</span>
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};
