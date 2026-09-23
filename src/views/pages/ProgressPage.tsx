import type { FC } from "hono/jsx";
import {
  PageShell,
  EmptyState,
  ToggleHint,
  BTN_PRIMARY,
  BTN_GHOST,
  INPUT,
  LABEL,
  CARD,
  StudentAvatar,
} from "../components/ui.tsx";
import { SURAHS } from "../../data/quran-meta.ts";
import type { User, ClassRoom, ProgressEntry } from "../../types.ts";

type Row = {
  student: { id: number; nis: string | null; name: string; photo_path: string | null };
  entries: ProgressEntry[];
  totalMemorized: number;
  progressPercent: number;
  juzCompleted: number;
  currentLocation: { juz: number; surahName: string; surahNumber: number; ayah: number };
};

const SurahSelect: FC<{ id: string; value: number }> = ({ id, value }) => (
  <select id={id} name="surah_number" class={INPUT}>
    {SURAHS.map((surah) => (
      <option value={String(surah.number)} selected={surah.number === value}>
        {surah.number}. {surah.name} ({surah.totalAyahs} ayat)
      </option>
    ))}
  </select>
);

export const ProgressPage: FC<{
  user: User;
  classes: ClassRoom[];
  selectedClass: ClassRoom | null;
  rows: Row[];
  canvaReady?: boolean;
}> = ({ user, classes, selectedClass, rows, canvaReady }) => {
  const isAdmin = user.role === "admin";

  if (classes.length === 0) {
    return (
      <PageShell
        user={user}
        currentPath="/progress"
        title="Hafalan Qur'an"
        heading="Hafalan Qur'an"
        subheading="Catat perkembangan hafalan siswa berdasarkan kelas yang Anda ampu."
        wide
      >
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
          {isAdmin && (
            <div class="px-6 pb-8 text-center">
              <a href="/administrasi/kelas" class={BTN_PRIMARY}>
                <span class="material-symbols-outlined text-[20px]">add</span>
                Buat Kelas
              </a>
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  const totalJuzKelas = rows.reduce((sum, r) => sum + r.juzCompleted, 0);

  return (
    <PageShell
      user={user}
      currentPath="/progress"
      title="Hafalan Qur'an"
      heading="Hafalan Qur'an"
      subheading={
        isAdmin
          ? "Sebagai administrator Anda dapat menginput hafalan seluruh kelas."
          : `Anda mengampu ${classes.length} kelas. Pilih kelas, lalu catat hafalan tiap siswa.`
      }
      wide
    >
      {/* Pemilih kelas */}
      <div class={`${CARD} p-3 mb-6`}>
        <form method="GET" action="/progress" class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div class="flex-1">
            <label class={LABEL} for="pilih-kelas">
              Kelas
            </label>
            <select
              id="pilih-kelas"
              name="kelas"
              class={INPUT}
              onchange="this.form.submit()"
            >
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

      {selectedClass && rows.length > 0 && (
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div class={`${CARD} px-4 py-3`}>
            <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
              Siswa
            </p>
            <p class="text-text-main dark:text-text-main-dark text-xl font-black mt-0.5">
              {rows.length}
            </p>
          </div>
          <div class={`${CARD} px-4 py-3`}>
            <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
              Total Juz
            </p>
            <p class="text-text-main dark:text-text-main-dark text-xl font-black mt-0.5">
              {totalJuzKelas}
            </p>
          </div>
          <div class={`${CARD} px-4 py-3 col-span-2 sm:col-span-1`}>
            <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
              Sudah Setor
            </p>
            <p class="text-text-main dark:text-text-main-dark text-xl font-black mt-0.5">
              {rows.filter((r) => r.totalMemorized > 0).length}
              <span class="text-text-secondary text-sm font-semibold"> / {rows.length}</span>
            </p>
          </div>
        </div>
      )}

      {selectedClass && rows.length > 0 && (
        <div class="mb-6 flex flex-wrap gap-2">
          <a
            href={`/laporan/kelas/${selectedClass.id}`}
            class={BTN_GHOST}
            data-no-loader
          >
            <span class="material-symbols-outlined text-[20px]">folder_zip</span>
            Unduh Laporan Pekanan Sekelas (ZIP)
          </a>
          {canvaReady && (
            <a
              href={`/laporan/kelas/${selectedClass.id}/canva`}
              class={BTN_GHOST}
              data-fetch-download
              data-loader-text="Membuat laporan sekelas via Canva, satu per satu — bisa beberapa menit untuk kelas besar"
              title="Diproses satu per satu lewat Canva — bisa memakan waktu beberapa menit untuk kelas besar. Jangan tutup halaman ini sebelum unduhan dimulai."
            >
              <span class="material-symbols-outlined text-[20px]">palette</span>
              Cetak via Canva Sekelas (ZIP)
            </a>
          )}
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
            {rows.map((row) => {
              const posisi =
                row.currentLocation.surahNumber > 0
                  ? `Juz ${row.currentLocation.juz} • ${row.currentLocation.surahName} ayat ${row.currentLocation.ayah}`
                  : "Belum ada catatan hafalan";

              const defaultSurah =
                row.currentLocation.surahNumber > 0 ? row.currentLocation.surahNumber : 1;

              return (
                <details class="group">
                  <summary class="flex items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <StudentAvatar name={row.student.name} photoPath={row.student.photo_path} />
                    <div class="min-w-0 flex-1">
                      <p class="text-text-main dark:text-text-main-dark text-sm font-bold truncate">
                        {row.student.name}
                      </p>
                      <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5 truncate">
                        {posisi}
                      </p>
                    </div>
                    <div class="hidden sm:flex flex-col items-end shrink-0">
                      <span class="text-xs font-bold text-primary">
                        {row.juzCompleted} juz
                      </span>
                      <span class="text-text-secondary dark:text-text-secondary-dark text-[11px]">
                        {row.totalMemorized} ayat
                      </span>
                    </div>
                    <ToggleHint closed="Input" open="Tutup" />
                    <span class="material-symbols-outlined text-text-secondary text-[20px] group-open:rotate-180 transition-transform shrink-0">
                      expand_more
                    </span>
                  </summary>

                  <div class="px-5 pb-5 pt-2 bg-slate-50/50 dark:bg-slate-800/20">
                    {/* Riwayat surah yang sudah tercatat */}
                    {row.entries.length > 0 && (
                      <div class="mb-5">
                        <span class={LABEL}>Surah yang Sudah Tercatat</span>
                        <div class="flex flex-wrap gap-2">
                          {row.entries.map((entry) => {
                            const surah = SURAHS[entry.surah_number - 1];
                            return (
                              <form
                                method="POST"
                                action="/progress/hapus"
                                class="inline-flex"
                                data-confirm={`Catatan <b>${surah?.name}</b> untuk ${row.student.name} akan dihapus.`}
                                data-confirm-title="Hapus catatan surah?"
                                data-confirm-ok="Ya, hapus"
                                data-loader-text="Menghapus catatan"
                              >
                                <input type="hidden" name="student_id" value={String(row.student.id)} />
                                <input type="hidden" name="surah_number" value={String(entry.surah_number)} />
                                <input type="hidden" name="return_kelas" value={String(selectedClass?.id ?? "")} />
                                <button
                                  type="submit"
                                  title="Klik untuk menghapus catatan surah ini"
                                  class={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                    entry.completed
                                      ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                                      : "border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark hover:bg-slate-100 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  {/* completed adalah 0/1 dari SQLite — tanpa Boolean(),
                                      angka 0 ikut tercetak di layar. */}
                                  {Boolean(entry.completed) && (
                                    <span class="material-symbols-outlined text-[14px]">check_circle</span>
                                  )}
                                  {surah?.name} {entry.last_ayah}/{surah?.totalAyahs}
                                  <span class="material-symbols-outlined text-[14px] opacity-50">close</span>
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <form method="POST" action="/progress" data-loader-text="Menyimpan hafalan">
                      <input type="hidden" name="student_id" value={String(row.student.id)} />
                      <input
                        type="hidden"
                        name="return_kelas"
                        value={String(selectedClass?.id ?? "")}
                      />

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="sm:col-span-2">
                          <label class={LABEL} for={`surah-${row.student.id}`}>
                            Surah
                          </label>
                          <SurahSelect id={`surah-${row.student.id}`} value={defaultSurah} />
                        </div>
                        <div>
                          <label class={LABEL} for={`ayat-${row.student.id}`}>
                            Hafal Sampai Ayat
                          </label>
                          <input
                            id={`ayat-${row.student.id}`}
                            name="last_ayah"
                            type="number"
                            min={1}
                            class={INPUT}
                            placeholder="Contoh: 12"
                          />
                        </div>
                      </div>

                      <div class="mt-5 flex flex-wrap items-center gap-2">
                        <button type="submit" name="mode" value="set" class={BTN_PRIMARY}>
                          <span class="material-symbols-outlined text-[20px]">bookmark_added</span>
                          Simpan Posisi Hafalan
                        </button>
                        <button type="submit" name="mode" value="complete" class={BTN_GHOST}>
                          <span class="material-symbols-outlined text-[20px]">task_alt</span>
                          Tandai Surah Selesai
                        </button>
                      </div>

                      <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-3">
                        &ldquo;Simpan Posisi Hafalan&rdquo; menimpa catatan surah tersebut dengan
                        angka yang Anda isi, jadi bisa dipakai juga untuk mengoreksi salah input.
                      </p>
                    </form>

                    <div class="mt-5 pt-4 border-t border-border-light dark:border-border-light-dark flex flex-wrap gap-2">
                      <a
                        href={`/laporan/siswa/${row.student.id}`}
                        class={BTN_GHOST}
                        data-no-loader
                      >
                        <span class="material-symbols-outlined text-[20px]">description</span>
                        Cetak Laporan Pekanan
                      </a>
                      {canvaReady && (
                        <a
                          href={`/laporan/siswa/${row.student.id}/canva`}
                          class={BTN_GHOST}
                          data-fetch-download
                          data-loader-text="Membuat laporan via Canva"
                          title="Prosesnya lebih lama karena mengisi desain di Canva terlebih dahulu"
                        >
                          <span class="material-symbols-outlined text-[20px]">palette</span>
                          Cetak via Canva
                        </a>
                      )}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
};
