import type { FC } from "hono/jsx";
import {
  PageShell,
  TabbedPanels,
  TabPanel,
  EmptyState,
  ToggleHint,
  BTN_PRIMARY,
  BTN_GHOST,
  BTN_DANGER,
  INPUT,
  LABEL,
  CARD,
} from "../components/ui.tsx";
import type { User, ClassRoom, StudentWithClass } from "../../types.ts";

type StudentRow = StudentWithClass & { total_ayah: number };

const GENDER_LABEL: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

const ClassSelect: FC<{
  id: string;
  classes: ClassRoom[];
  value: number | null;
  allowEmpty?: boolean;
}> = ({ id, classes, value, allowEmpty = true }) => (
  <select id={id} name="class_id" class={INPUT}>
    {allowEmpty && (
      <option value="" selected={value === null}>
        — Belum berkelas —
      </option>
    )}
    {classes.map((kelas) => (
      <option value={String(kelas.id)} selected={value === kelas.id}>
        {kelas.name}
      </option>
    ))}
  </select>
);

export const StudentsPage: FC<{
  user: User;
  students: StudentRow[];
  classes: ClassRoom[];
  kelasFilter: string;
  cari: string;
  totalStudents: number;
  unassignedCount: number;
}> = ({ user, students, classes, kelasFilter, cari, totalStudents, unassignedCount }) => {
  const filterAktif = Boolean(kelasFilter || cari);

  return (
    <PageShell
      user={user}
      currentPath="/administrasi/siswa"
      title="Siswa"
      heading="Siswa"
      subheading={`Tambahkan siswa dan tempatkan pada kelasnya. Total ${totalStudents} siswa terdaftar${
        unassignedCount > 0 ? `, ${unassignedCount} di antaranya belum berkelas` : ""
      }.`}
      wide
    >
      {classes.length === 0 && (
        <div class="mb-6 px-5 py-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-3">
          <span class="material-symbols-outlined text-[20px] shrink-0">info</span>
          <p>
            Belum ada kelas yang dibuat. Siswa tetap bisa ditambahkan, tetapi guru baru dapat
            menginput hafalan setelah siswa ditempatkan di sebuah kelas.{" "}
            <a href="/administrasi/kelas" class="font-bold underline">
              Buat kelas dulu
            </a>
            .
          </p>
        </div>
      )}

      <TabbedPanels
        id="tab-tambah-siswa"
        tabs={[
          { id: "satu", label: "Tambah Siswa", icon: "person_add" },
          { id: "massal", label: "Tambah Banyak Sekaligus", icon: "upload_file" },
          { id: "excel", label: "Impor dari Excel", icon: "table_view" },
          { id: "foto", label: "Unggah Foto Massal", icon: "add_a_photo" },
        ]}
      >
        <TabPanel id="satu" active>
          <div class={`${CARD} p-6`}>
            <form method="POST" action="/administrasi/siswa" data-loader-text="Menyimpan siswa">
              <input type="hidden" name="return_kelas" value={kelasFilter} />
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="md:col-span-2">
                  <label class={LABEL} for="nama-siswa-baru">
                    Nama Lengkap
                  </label>
                  <input
                    id="nama-siswa-baru"
                    name="name"
                    class={INPUT}
                    placeholder="Nama siswa"
                    required
                  />
                </div>
                <div>
                  <label class={LABEL} for="nis-siswa-baru">
                    NIS <span class="normal-case font-normal">(opsional)</span>
                  </label>
                  <input id="nis-siswa-baru" name="nis" class={INPUT} placeholder="Nomor induk" />
                </div>
                <div>
                  <label class={LABEL} for="jk-siswa-baru">
                    Jenis Kelamin
                  </label>
                  <select id="jk-siswa-baru" name="gender" class={INPUT}>
                    <option value="">—</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class={LABEL} for="kelas-siswa-baru">
                    Kelas
                  </label>
                  <ClassSelect
                    id="kelas-siswa-baru"
                    classes={classes}
                    value={kelasFilter && kelasFilter !== "belum" ? parseInt(kelasFilter, 10) : null}
                  />
                </div>
              </div>
              <div class="mt-5">
                <button type="submit" class={BTN_PRIMARY}>
                  <span class="material-symbols-outlined text-[20px]">save</span>
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </TabPanel>

        <TabPanel id="massal">
          <div class={`${CARD} p-6`}>
            <form
              method="POST"
              action="/administrasi/siswa/massal"
              data-loader-text="Menambahkan siswa"
            >
              <input type="hidden" name="return_kelas" value={kelasFilter} />
              <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-3">
                Tulis satu siswa per baris. Bisa hanya nama, atau <code>NIS,Nama</code> bila ingin
                sekalian mengisi nomor induk.
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2">
                  <label class={LABEL} for="daftar-massal">
                    Daftar Siswa
                  </label>
                  <textarea
                    id="daftar-massal"
                    name="daftar"
                    rows={8}
                    class={`${INPUT} font-mono text-xs leading-relaxed`}
                    placeholder={"Ahmad Fauzan\n2024001,Siti Aisyah\nMuhammad Rizki"}
                    required
                  />
                </div>
                <div>
                  <label class={LABEL} for="kelas-massal">
                    Tempatkan di Kelas
                  </label>
                  <ClassSelect
                    id="kelas-massal"
                    classes={classes}
                    value={kelasFilter && kelasFilter !== "belum" ? parseInt(kelasFilter, 10) : null}
                  />
                  <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-2">
                    Seluruh siswa pada daftar akan masuk ke kelas ini.
                  </p>
                </div>
              </div>
              <div class="mt-5">
                <button type="submit" class={BTN_PRIMARY}>
                  <span class="material-symbols-outlined text-[20px]">playlist_add</span>
                  Tambahkan Semua
                </button>
              </div>
            </form>
          </div>
        </TabPanel>

        <TabPanel id="excel">
          <div class={`${CARD} p-6`}>
            <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-1">
              Unggah berkas <code>.xlsx</code> dengan kolom <b>NIS</b>, <b>Nama Lengkap</b>, dan{" "}
              <b>Kelas</b>. Nama kelas pada berkas harus persis sama dengan kelas yang sudah dibuat
              di menu{" "}
              <a href="/administrasi/kelas" class="font-bold underline">
                Administrasi &rsaquo; Kelas
              </a>
              . Siswa dengan NIS yang sudah terdaftar akan diperbarui datanya, bukan digandakan.
            </p>
            <a
              href="/administrasi/siswa/impor/template"
              class="inline-flex items-center gap-1.5 text-primary text-xs font-bold hover:underline mb-4"
              data-no-loader
            >
              <span class="material-symbols-outlined text-[16px]">download</span>
              Unduh Template Excel
            </a>
            <form
              method="POST"
              action="/administrasi/siswa/impor"
              enctype="multipart/form-data"
              data-loader-text="Mengimpor data siswa"
            >
              <input type="hidden" name="return_kelas" value={kelasFilter} />
              <label class={LABEL} for="berkas-impor-excel">
                Berkas Excel (.xlsx)
              </label>
              <input
                id="berkas-impor-excel"
                name="file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                class={`${INPUT} file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer`}
                required
              />
              <div class="mt-5">
                <button type="submit" class={BTN_PRIMARY}>
                  <span class="material-symbols-outlined text-[20px]">upload_file</span>
                  Impor dari Excel
                </button>
              </div>
            </form>
          </div>
        </TabPanel>

        <TabPanel id="foto">
          <div class={`${CARD} p-6`}>
            <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-4">
              Unggah satu berkas <code>.zip</code> berisi banyak foto sekaligus. Nama setiap
              berkas foto di dalam ZIP harus berupa <b>NIS siswa</b>, misalnya{" "}
              <code>2024001.jpg</code>. Format yang didukung: JPG, JPEG, PNG, WEBP (maksimal 3MB
              per foto).
            </p>
            <form
              method="POST"
              action="/administrasi/siswa/foto"
              enctype="multipart/form-data"
              data-loader-text="Mengunggah foto siswa"
            >
              <input type="hidden" name="return_kelas" value={kelasFilter} />
              <label class={LABEL} for="berkas-foto-zip">
                Berkas ZIP Foto
              </label>
              <input
                id="berkas-foto-zip"
                name="file"
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                class={`${INPUT} file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer`}
                required
              />
              <div class="mt-5">
                <button type="submit" class={BTN_PRIMARY}>
                  <span class="material-symbols-outlined text-[20px]">upload</span>
                  Unggah Foto
                </button>
              </div>
            </form>
          </div>
        </TabPanel>
      </TabbedPanels>

      {/* Penyaring */}
      <form method="GET" action="/administrasi/siswa" class={`${CARD} p-3 mb-6 flex flex-col sm:flex-row gap-3`}>
        <div class="relative flex-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary material-symbols-outlined text-[20px]">
            search
          </span>
          <input
            name="cari"
            value={cari}
            class={`${INPUT} pl-10`}
            placeholder="Cari nama atau NIS siswa..."
          />
        </div>
        <select name="kelas" class={`${INPUT} sm:w-56`} onchange="this.form.submit()">
          <option value="" selected={kelasFilter === ""}>
            Semua kelas
          </option>
          <option value="belum" selected={kelasFilter === "belum"}>
            Belum berkelas
          </option>
          {classes.map((kelas) => (
            <option value={String(kelas.id)} selected={kelasFilter === String(kelas.id)}>
              {kelas.name}
            </option>
          ))}
        </select>
        <button type="submit" class={BTN_PRIMARY}>
          <span class="material-symbols-outlined text-[20px]">filter_alt</span>
          Saring
        </button>
        {filterAktif && (
          <a href="/administrasi/siswa" class={BTN_GHOST}>
            Reset
          </a>
        )}
      </form>

      <div class={CARD}>
        <div class="px-5 py-3.5 border-b border-border-light dark:border-border-light-dark flex items-center justify-between">
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
            Menampilkan {students.length} siswa
          </p>
        </div>

        {students.length === 0 ? (
          <EmptyState
            icon="person_search"
            title={filterAktif ? "Tidak ada siswa yang cocok" : "Belum ada siswa"}
            description={
              filterAktif
                ? "Coba ubah kata kunci pencarian atau pilih kelas lain."
                : "Gunakan formulir di atas untuk menambahkan siswa satu per satu atau sekaligus banyak."
            }
          />
        ) : (
          <div class="divide-y divide-border-light dark:divide-border-light-dark">
            {students.map((siswa) => (
              <details class="group">
                <summary class="flex items-center gap-4 px-5 py-3.5 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  {siswa.photo_path ? (
                    <div
                      class="size-9 rounded-full bg-slate-100 dark:bg-slate-800 bg-cover bg-center shrink-0 border border-border-light dark:border-border-light-dark"
                      style={`background-image: url("${siswa.photo_path}")`}
                    />
                  ) : (
                    <div class="size-9 rounded-full bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark flex items-center justify-center text-xs font-bold shrink-0">
                      {siswa.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div class="min-w-0 flex-1">
                    <p class="text-text-main dark:text-text-main-dark text-sm font-bold truncate">
                      {siswa.name}
                    </p>
                    <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5">
                      {siswa.nis ? `NIS ${siswa.nis} • ` : ""}
                      {siswa.class_name || "Belum berkelas"}
                    </p>
                  </div>
                  <span class="hidden sm:inline text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                    {siswa.total_ayah} ayat
                  </span>
                  <ToggleHint closed="Ubah" open="Tutup" />
                  <span class="material-symbols-outlined text-text-secondary text-[20px] group-open:rotate-180 transition-transform shrink-0">
                    expand_more
                  </span>
                </summary>

                <div class="px-5 pb-5 pt-2 bg-slate-50/50 dark:bg-slate-800/20">
                  <form
                    method="POST"
                    action={`/administrasi/siswa/${siswa.id}`}
                    data-loader-text="Menyimpan perubahan"
                  >
                    <input type="hidden" name="return_kelas" value={kelasFilter} />
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div class="md:col-span-2">
                        <label class={LABEL} for={`nama-${siswa.id}`}>
                          Nama Lengkap
                        </label>
                        <input
                          id={`nama-${siswa.id}`}
                          name="name"
                          class={INPUT}
                          value={siswa.name}
                          required
                        />
                      </div>
                      <div>
                        <label class={LABEL} for={`nis-${siswa.id}`}>
                          NIS
                        </label>
                        <input
                          id={`nis-${siswa.id}`}
                          name="nis"
                          class={INPUT}
                          value={siswa.nis || ""}
                        />
                      </div>
                      <div>
                        <label class={LABEL} for={`jk-${siswa.id}`}>
                          Jenis Kelamin
                        </label>
                        <select id={`jk-${siswa.id}`} name="gender" class={INPUT}>
                          <option value="" selected={!siswa.gender}>
                            —
                          </option>
                          <option value="L" selected={siswa.gender === "L"}>
                            {GENDER_LABEL.L}
                          </option>
                          <option value="P" selected={siswa.gender === "P"}>
                            {GENDER_LABEL.P}
                          </option>
                        </select>
                      </div>
                      <div class="md:col-span-2">
                        <label class={LABEL} for={`kelas-${siswa.id}`}>
                          Kelas
                        </label>
                        <ClassSelect
                          id={`kelas-${siswa.id}`}
                          classes={classes}
                          value={siswa.class_id}
                        />
                      </div>
                    </div>

                    <div class="mt-5">
                      <button type="submit" class={BTN_PRIMARY}>
                        <span class="material-symbols-outlined text-[20px]">save</span>
                        Simpan Perubahan
                      </button>
                    </div>
                  </form>

                  <form
                    method="POST"
                    action={`/administrasi/siswa/${siswa.id}/hapus`}
                    class="mt-4 pt-4 border-t border-border-light dark:border-border-light-dark"
                    data-confirm={`Data siswa <b>${siswa.name}</b> akan dihapus permanen, <b>termasuk seluruh catatan hafalannya</b> (${siswa.total_ayah} ayat).<br><br>Tindakan ini tidak dapat dibatalkan.`}
                    data-confirm-title="Hapus siswa ini?"
                    data-confirm-ok="Ya, hapus siswa"
                    data-loader-text="Menghapus siswa"
                  >
                    <input type="hidden" name="return_kelas" value={kelasFilter} />
                    <button type="submit" class={BTN_DANGER}>
                      <span class="material-symbols-outlined text-[20px]">delete</span>
                      Hapus Siswa
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
