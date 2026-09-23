import type { FC } from "hono/jsx";
import {
  PageShell,
  Collapsible,
  EmptyState,
  ToggleHint,
  BTN_PRIMARY,
  BTN_GHOST,
  BTN_DANGER,
  INPUT,
  LABEL,
  CARD,
} from "../components/ui.tsx";
import type { User, ClassRoomSummary } from "../../types.ts";

const TeacherPicker: FC<{
  teachers: User[];
  selected: number[];
  idPrefix: string;
  fieldName: string;
}> = ({ teachers, selected, idPrefix, fieldName }) => {
  if (teachers.length === 0) {
    return (
      <p class="text-text-secondary dark:text-text-secondary-dark text-sm italic">
        Belum ada akun guru. Tambahkan lebih dulu di menu Administrasi &rsaquo; Pengguna.
      </p>
    );
  }

  return (
    <div class="flex flex-wrap gap-2">
      {teachers.map((teacher) => {
        const id = `${idPrefix}-guru-${teacher.id}`;
        const checked = selected.includes(teacher.id);
        return (
          <label
            for={id}
            class={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
              checked
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <input
              id={id}
              type="checkbox"
              name={fieldName}
              value={String(teacher.id)}
              checked={checked}
              class="rounded border-slate-300 text-primary focus:ring-primary"
            />
            {teacher.name}
            {teacher.role === "admin" && (
              <span class="text-[10px] uppercase tracking-wider opacity-70">admin</span>
            )}
          </label>
        );
      })}
    </div>
  );
};

/** Guru pengampu Tahfid dan Tilawati bisa berbeda untuk kelas yang sama. */
const SubjectTeacherPickers: FC<{
  teachers: User[];
  selectedTahfid: number[];
  selectedTilawati: number[];
  idPrefix: string;
}> = ({ teachers, selectedTahfid, selectedTilawati, idPrefix }) => (
  <div class="space-y-4">
    <div>
      <span class={LABEL}>Guru Pengampu &mdash; Hafalan Qur'an (Tahfid)</span>
      <TeacherPicker
        teachers={teachers}
        selected={selectedTahfid}
        idPrefix={`${idPrefix}-tahfid`}
        fieldName="teacher_ids_tahfid"
      />
    </div>
    <div>
      <span class={LABEL}>Guru Pengampu &mdash; Capaian Tilawati</span>
      <TeacherPicker
        teachers={teachers}
        selected={selectedTilawati}
        idPrefix={`${idPrefix}-tilawati`}
        fieldName="teacher_ids_tilawati"
      />
    </div>
  </div>
);

export const ClassesPage: FC<{
  user: User;
  classes: ClassRoomSummary[];
  teachers: User[];
  assignmentsTahfid: Record<number, number[]>;
  assignmentsTilawati: Record<number, number[]>;
}> = ({ user, classes, teachers, assignmentsTahfid, assignmentsTilawati }) => {
  const totalStudents = classes.reduce((sum, k) => sum + k.student_count, 0);

  return (
    <PageShell
      user={user}
      currentPath="/administrasi/kelas"
      title="Kelas"
      heading="Kelas"
      subheading={`Kelola daftar kelas dan tentukan guru pengampunya. Saat ini ada ${classes.length} kelas dengan total ${totalStudents} siswa.`}
      wide
    >
      <Collapsible id="form-tambah-kelas" label="Tambah Kelas Baru" icon="add_circle">
        <form method="POST" action="/administrasi/kelas" data-loader-text="Menyimpan kelas">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label class={LABEL} for="nama-kelas-baru">
                Nama Kelas
              </label>
              <input
                id="nama-kelas-baru"
                name="name"
                class={INPUT}
                placeholder="Contoh: 6A atau 5 Abu Bakar"
                maxlength={60}
                required
              />
            </div>
            <div>
              <label class={LABEL} for="ket-kelas-baru">
                Keterangan <span class="normal-case font-normal">(opsional)</span>
              </label>
              <input
                id="ket-kelas-baru"
                name="description"
                class={INPUT}
                placeholder="Contoh: Kelas putra, gedung utara"
              />
            </div>
          </div>

          <div class="mt-5">
            <SubjectTeacherPickers
              teachers={teachers}
              selectedTahfid={[]}
              selectedTilawati={[]}
              idPrefix="baru"
            />
          </div>

          <div class="mt-5">
            <button type="submit" class={BTN_PRIMARY}>
              <span class="material-symbols-outlined text-[20px]">save</span>
              Simpan Kelas
            </button>
          </div>
        </form>
      </Collapsible>

      <div class={CARD}>
        {classes.length === 0 ? (
          <EmptyState
            icon="school"
            title="Belum ada kelas"
            description="Tambahkan kelas terlebih dahulu, lalu tempatkan siswa dan guru pengampunya."
          />
        ) : (
          <div class="divide-y divide-border-light dark:divide-border-light-dark">
            {classes.map((kelas) => (
              <details class="group">
                <summary class="flex items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div class="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                    {kelas.name.slice(0, 3).toUpperCase()}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-text-main dark:text-text-main-dark text-sm font-bold">
                      {kelas.name}
                    </p>
                    <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5 truncate">
                      {kelas.teacher_names
                        ? `Pengampu: ${kelas.teacher_names}`
                        : "Belum ada guru pengampu"}
                    </p>
                  </div>
                  <div class="hidden sm:flex items-center gap-2 shrink-0">
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark">
                      {kelas.student_count} siswa
                    </span>
                  </div>
                  <ToggleHint closed="Ubah" open="Tutup" />
                  <span class="material-symbols-outlined text-text-secondary text-[20px] group-open:rotate-180 transition-transform shrink-0">
                    expand_more
                  </span>
                </summary>

                <div class="px-5 pb-5 pt-2 bg-slate-50/50 dark:bg-slate-800/20">
                  <form
                    method="POST"
                    action={`/administrasi/kelas/${kelas.id}`}
                    data-loader-text="Menyimpan perubahan"
                  >
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class={LABEL} for={`nama-${kelas.id}`}>
                          Nama Kelas
                        </label>
                        <input
                          id={`nama-${kelas.id}`}
                          name="name"
                          class={INPUT}
                          value={kelas.name}
                          maxlength={60}
                          required
                        />
                      </div>
                      <div>
                        <label class={LABEL} for={`ket-${kelas.id}`}>
                          Keterangan
                        </label>
                        <input
                          id={`ket-${kelas.id}`}
                          name="description"
                          class={INPUT}
                          value={kelas.description || ""}
                        />
                      </div>
                    </div>

                    <div class="mt-4">
                      <SubjectTeacherPickers
                        teachers={teachers}
                        selectedTahfid={assignmentsTahfid[kelas.id] || []}
                        selectedTilawati={assignmentsTilawati[kelas.id] || []}
                        idPrefix={`kelas-${kelas.id}`}
                      />
                    </div>

                    <div class="mt-5 flex items-center gap-2">
                      <button type="submit" class={BTN_PRIMARY}>
                        <span class="material-symbols-outlined text-[20px]">save</span>
                        Simpan Perubahan
                      </button>
                      <a
                        href={`/administrasi/siswa?kelas=${kelas.id}`}
                        class={BTN_GHOST}
                        data-loader-text="Membuka daftar siswa"
                      >
                        <span class="material-symbols-outlined text-[20px]">groups</span>
                        Lihat Siswa
                      </a>
                    </div>
                  </form>

                  <form
                    method="POST"
                    action={`/administrasi/kelas/${kelas.id}/hapus`}
                    class="mt-4 pt-4 border-t border-border-light dark:border-border-light-dark"
                    data-confirm={`Kelas <b>${kelas.name}</b> akan dihapus.<br><br>${kelas.student_count} siswa di dalamnya <b>tidak ikut terhapus</b>, tetapi statusnya menjadi belum berkelas dan perlu ditempatkan ulang.`}
                    data-confirm-title="Hapus kelas ini?"
                    data-confirm-ok="Ya, hapus kelas"
                    data-loader-text="Menghapus kelas"
                  >
                    <button type="submit" class={BTN_DANGER}>
                      <span class="material-symbols-outlined text-[20px]">delete</span>
                      Hapus Kelas
                    </button>
                  </form>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};
