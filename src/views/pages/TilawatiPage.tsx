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
import { JILID_LIST } from "../../data/tilawati-meta.ts";
import type { User, ClassRoom, TilawatiEntry } from "../../types.ts";

type Row = {
  student: { id: number; nis: string | null; name: string; photo_path: string | null };
  entries: TilawatiEntry[];
  totalPages: number;
  progressPercent: number;
  jilidCompleted: number;
  currentLocation: { jilid: number; page: number };
};

const JilidSelect: FC<{ id: string; value: number }> = ({ id, value }) => (
  <select id={id} name="jilid_number" class={INPUT}>
    {JILID_LIST.map((jilid) => (
      <option value={String(jilid.number)} selected={jilid.number === value}>
        Jilid {jilid.number} ({jilid.totalPages} halaman)
      </option>
    ))}
  </select>
);

export const TilawatiPage: FC<{
  user: User;
  classes: ClassRoom[];
  selectedClass: ClassRoom | null;
  rows: Row[];
}> = ({ user, classes, selectedClass, rows }) => {
  const isAdmin = user.role === "admin";

  if (classes.length === 0) {
    return (
      <PageShell
        user={user}
        currentPath="/progress/tilawati"
        title="Capaian Tilawati"
        heading="Capaian Tilawati"
        subheading="Catat perkembangan bacaan Tilawati siswa berdasarkan kelas yang Anda ampu."
        wide
      >
        <div class={CARD}>
          <EmptyState
            icon="school"
            title="Anda belum ditugaskan ke kelas mana pun untuk Tilawati"
            description={
              isAdmin
                ? "Belum ada kelas yang dibuat. Buat kelas terlebih dahulu di menu Administrasi › Kelas."
                : "Hubungi administrator agar Anda ditempatkan sebagai pengampu Tilawati salah satu kelas."
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

  const totalJilidKelas = rows.reduce((sum, r) => sum + r.jilidCompleted, 0);

  return (
    <PageShell
      user={user}
      currentPath="/progress/tilawati"
      title="Capaian Tilawati"
      heading="Capaian Tilawati"
      subheading={
        isAdmin
          ? "Sebagai administrator Anda dapat menginput capaian Tilawati seluruh kelas."
          : `Anda mengampu Tilawati ${classes.length} kelas. Pilih kelas, lalu catat bacaan tiap siswa.`
      }
      wide
    >
      {/* Pemilih kelas */}
      <div class={`${CARD} p-3 mb-6`}>
        <form
          method="GET"
          action="/progress/tilawati"
          class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
        >
          <div class="flex-1">
            <label class={LABEL} for="pilih-kelas-tilawati">
              Kelas
            </label>
            <select
              id="pilih-kelas-tilawati"
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
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
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
              Total Jilid
            </p>
            <p class="text-text-main dark:text-text-main-dark text-xl font-black mt-0.5">
              {totalJilidKelas}
            </p>
          </div>
          <div class={`${CARD} px-4 py-3 col-span-2 sm:col-span-1`}>
            <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
              Sudah Setor
            </p>
            <p class="text-text-main dark:text-text-main-dark text-xl font-black mt-0.5">
              {rows.filter((r) => r.totalPages > 0).length}
              <span class="text-text-secondary text-sm font-semibold"> / {rows.length}</span>
            </p>
          </div>
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
                row.currentLocation.jilid > 0
                  ? `Jilid ${row.currentLocation.jilid} halaman ${row.currentLocation.page}`
                  : "Belum ada catatan Tilawati";

              const defaultJilid = row.currentLocation.jilid > 0 ? row.currentLocation.jilid : 1;

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
                        {row.jilidCompleted} jilid
                      </span>
                      <span class="text-text-secondary dark:text-text-secondary-dark text-[11px]">
                        {row.totalPages} halaman
                      </span>
                    </div>
                    <ToggleHint closed="Input" open="Tutup" />
                    <span class="material-symbols-outlined text-text-secondary text-[20px] group-open:rotate-180 transition-transform shrink-0">
                      expand_more
                    </span>
                  </summary>

                  <div class="px-5 pb-5 pt-2 bg-slate-50/50 dark:bg-slate-800/20">
                    {/* Riwayat jilid yang sudah tercatat */}
                    {row.entries.length > 0 && (
                      <div class="mb-5">
                        <span class={LABEL}>Jilid yang Sudah Tercatat</span>
                        <div class="flex flex-wrap gap-2">
                          {row.entries.map((entry) => {
                            const jilid = JILID_LIST[entry.jilid_number - 1];
                            return (
                              <form
                                method="POST"
                                action="/progress/tilawati/hapus"
                                class="inline-flex"
                                data-confirm={`Catatan <b>Jilid ${entry.jilid_number}</b> untuk ${row.student.name} akan dihapus.`}
                                data-confirm-title="Hapus catatan jilid?"
                                data-confirm-ok="Ya, hapus"
                                data-loader-text="Menghapus catatan"
                              >
                                <input type="hidden" name="student_id" value={String(row.student.id)} />
                                <input
                                  type="hidden"
                                  name="jilid_number"
                                  value={String(entry.jilid_number)}
                                />
                                <input
                                  type="hidden"
                                  name="return_kelas"
                                  value={String(selectedClass?.id ?? "")}
                                />
                                <button
                                  type="submit"
                                  title="Klik untuk menghapus catatan jilid ini"
                                  class={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                    entry.completed
                                      ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                                      : "border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark hover:bg-slate-100 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  {Boolean(entry.completed) && (
                                    <span class="material-symbols-outlined text-[14px]">check_circle</span>
                                  )}
                                  Jilid {entry.jilid_number} {entry.last_page}/{jilid?.totalPages}
                                  <span class="material-symbols-outlined text-[14px] opacity-50">close</span>
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <form method="POST" action="/progress/tilawati" data-loader-text="Menyimpan capaian">
                      <input type="hidden" name="student_id" value={String(row.student.id)} />
                      <input
                        type="hidden"
                        name="return_kelas"
                        value={String(selectedClass?.id ?? "")}
                      />

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="sm:col-span-2">
                          <label class={LABEL} for={`jilid-${row.student.id}`}>
                            Jilid
                          </label>
                          <JilidSelect id={`jilid-${row.student.id}`} value={defaultJilid} />
                        </div>
                        <div>
                          <label class={LABEL} for={`halaman-${row.student.id}`}>
                            Baca Sampai Halaman
                          </label>
                          <input
                            id={`halaman-${row.student.id}`}
                            name="last_page"
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
                          Simpan Posisi Bacaan
                        </button>
                        <button type="submit" name="mode" value="complete" class={BTN_GHOST}>
                          <span class="material-symbols-outlined text-[20px]">task_alt</span>
                          Tandai Jilid Selesai
                        </button>
                      </div>

                      <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-3">
                        &ldquo;Simpan Posisi Bacaan&rdquo; menimpa catatan jilid tersebut dengan
                        angka yang Anda isi, jadi bisa dipakai juga untuk mengoreksi salah input.
                      </p>
                    </form>
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
