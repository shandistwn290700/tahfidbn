import type { FC } from "hono/jsx";
import {
  PageShell,
  Collapsible,
  EmptyState,
  ToggleHint,
  BTN_PRIMARY,
  BTN_DANGER,
  INPUT,
  LABEL,
  CARD,
} from "../components/ui.tsx";
import type { User, ClassRoom } from "../../types.ts";

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", guru: "Guru" };

const ClassPicker: FC<{
  classes: ClassRoom[];
  selected: number[];
  idPrefix: string;
  fieldName: string;
}> = ({ classes, selected, idPrefix, fieldName }) => {
  if (classes.length === 0) {
    return (
      <p class="text-text-secondary dark:text-text-secondary-dark text-sm italic">
        Belum ada kelas. Buat kelas lebih dulu di menu Administrasi &rsaquo; Kelas.
      </p>
    );
  }

  return (
    <div class="flex flex-wrap gap-2">
      {classes.map((kelas) => {
        const id = `${idPrefix}-kelas-${kelas.id}`;
        const checked = selected.includes(kelas.id);
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
              value={String(kelas.id)}
              checked={checked}
              class="rounded border-slate-300 text-primary focus:ring-primary"
            />
            {kelas.name}
          </label>
        );
      })}
    </div>
  );
};

/** Dua kelompok kelas ampuan sekaligus — Tahfid dan Tilawati punya guru yang bisa berbeda. */
const SubjectClassPickers: FC<{
  classes: ClassRoom[];
  selectedTahfid: number[];
  selectedTilawati: number[];
  idPrefix: string;
}> = ({ classes, selectedTahfid, selectedTilawati, idPrefix }) => (
  <div class="mt-5 space-y-4">
    <div>
      <span class={LABEL}>Kelas Ampuan &mdash; Hafalan Qur'an (Tahfid)</span>
      <ClassPicker
        classes={classes}
        selected={selectedTahfid}
        idPrefix={`${idPrefix}-tahfid`}
        fieldName="class_ids_tahfid"
      />
    </div>
    <div>
      <span class={LABEL}>Kelas Ampuan &mdash; Capaian Tilawati</span>
      <ClassPicker
        classes={classes}
        selected={selectedTilawati}
        idPrefix={`${idPrefix}-tilawati`}
        fieldName="class_ids_tilawati"
      />
    </div>
    <p class="text-text-secondary dark:text-text-secondary-dark text-xs">
      Administrator otomatis dapat menginput kedua jenis di seluruh kelas, tanpa perlu ditugaskan.
      Guru bisa ditugaskan untuk salah satu jenis saja, keduanya, atau kelas yang berbeda untuk
      tiap jenis.
    </p>
  </div>
);

export const UsersPage: FC<{
  user: User;
  users: User[];
  classes: ClassRoom[];
  assignmentsTahfid: Record<number, number[]>;
  assignmentsTilawati: Record<number, number[]>;
  adminCount: number;
}> = ({ user, users, classes, assignmentsTahfid, assignmentsTilawati, adminCount }) => {
  const guruCount = users.filter((u) => u.role === "guru").length;

  return (
    <PageShell
      user={user}
      currentPath="/administrasi/pengguna"
      title="Pengguna"
      heading="Pengguna"
      subheading={`Akun yang dapat masuk ke aplikasi: ${adminCount} administrator dan ${guruCount} guru. Siswa tidak memiliki akun — datanya dikelola di menu Siswa.`}
      wide
    >
      <Collapsible id="form-tambah-pengguna" label="Tambah Pengguna" icon="person_add">
        <form method="POST" action="/administrasi/pengguna" data-loader-text="Membuat akun">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label class={LABEL} for="nama-pengguna-baru">
                Nama Lengkap
              </label>
              <input
                id="nama-pengguna-baru"
                name="name"
                class={INPUT}
                placeholder="Contoh: Ust. Fatahilah"
                required
              />
            </div>
            <div>
              <label class={LABEL} for="username-baru">
                Nama Pengguna
              </label>
              <input
                id="username-baru"
                name="username"
                class={INPUT}
                placeholder="dipakai untuk login, tanpa spasi"
                pattern="[A-Za-z0-9._-]{3,32}"
                title="3–32 karakter, hanya huruf, angka, titik, garis bawah, atau strip"
                required
              />
            </div>
            <div>
              <label class={LABEL} for="password-baru">
                Password
              </label>
              <input
                id="password-baru"
                name="password"
                type="password"
                class={INPUT}
                placeholder="Minimal 8 karakter"
                minlength={8}
                required
              />
            </div>
            <div>
              <label class={LABEL} for="email-baru">
                Email <span class="normal-case font-normal">(opsional)</span>
              </label>
              <input id="email-baru" name="email" type="email" class={INPUT} />
            </div>
            <div>
              <label class={LABEL} for="peran-baru">
                Peran
              </label>
              <select id="peran-baru" name="role" class={INPUT}>
                <option value="guru">Guru — input hafalan kelas ampuannya</option>
                <option value="admin">Administrator — akses penuh</option>
              </select>
            </div>
          </div>

          <SubjectClassPickers
            classes={classes}
            selectedTahfid={[]}
            selectedTilawati={[]}
            idPrefix="pengguna-baru"
          />

          <div class="mt-5">
            <button type="submit" class={BTN_PRIMARY}>
              <span class="material-symbols-outlined text-[20px]">save</span>
              Buat Akun
            </button>
          </div>
        </form>
      </Collapsible>

      <div class={CARD}>
        {users.length === 0 ? (
          <EmptyState icon="group" title="Belum ada pengguna" />
        ) : (
          <div class="divide-y divide-border-light dark:divide-border-light-dark">
            {users.map((u) => {
              const kelasTahfid = assignmentsTahfid[u.id] || [];
              const kelasTilawati = assignmentsTilawati[u.id] || [];
              const namaKelasTahfid = classes
                .filter((k) => kelasTahfid.includes(k.id))
                .map((k) => k.name)
                .join(", ");
              const namaKelasTilawati = classes
                .filter((k) => kelasTilawati.includes(k.id))
                .map((k) => k.name)
                .join(", ");
              const ringkasanKelas = [
                namaKelasTahfid ? `Tahfid: ${namaKelasTahfid}` : "",
                namaKelasTilawati ? `Tilawati: ${namaKelasTilawati}` : "",
              ]
                .filter(Boolean)
                .join(" • ");
              const diriSendiri = u.id === user.id;
              const adminTerakhir = u.role === "admin" && adminCount <= 1;

              return (
                <details class="group">
                  <summary class="flex items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div
                      class={`size-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        u.role === "admin"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark"
                      }`}
                    >
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-text-main dark:text-text-main-dark text-sm font-bold flex items-center gap-2">
                        {u.name}
                        {diriSendiri && (
                          <span class="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded uppercase tracking-wider font-black">
                            Anda
                          </span>
                        )}
                      </p>
                      <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5 truncate">
                        {ROLE_LABEL[u.role]} &bull; {u.username}
                        {u.role === "guru" &&
                          (ringkasanKelas ? ` • ${ringkasanKelas}` : " • belum ditugaskan")}
                      </p>
                    </div>
                    <ToggleHint closed="Ubah" open="Tutup" />
                    <span class="material-symbols-outlined text-text-secondary text-[20px] group-open:rotate-180 transition-transform shrink-0">
                      expand_more
                    </span>
                  </summary>

                  <div class="px-5 pb-5 pt-2 bg-slate-50/50 dark:bg-slate-800/20">
                    <form
                      method="POST"
                      action={`/administrasi/pengguna/${u.id}`}
                      data-loader-text="Menyimpan perubahan"
                    >
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label class={LABEL} for={`nama-u-${u.id}`}>
                            Nama Lengkap
                          </label>
                          <input
                            id={`nama-u-${u.id}`}
                            name="name"
                            class={INPUT}
                            value={u.name}
                            required
                          />
                        </div>
                        <div>
                          <label class={LABEL} for={`email-u-${u.id}`}>
                            Email
                          </label>
                          <input
                            id={`email-u-${u.id}`}
                            name="email"
                            type="email"
                            class={INPUT}
                            value={u.email || ""}
                          />
                        </div>
                        <div>
                          <label class={LABEL} for={`peran-u-${u.id}`}>
                            Peran
                          </label>
                          <select
                            id={`peran-u-${u.id}`}
                            name="role"
                            class={INPUT}
                            disabled={adminTerakhir}
                          >
                            <option value="guru" selected={u.role === "guru"}>
                              Guru
                            </option>
                            <option value="admin" selected={u.role === "admin"}>
                              Administrator
                            </option>
                          </select>
                          {adminTerakhir && (
                            <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-1.5">
                              Satu-satunya admin — peran tidak dapat diturunkan.
                            </p>
                          )}
                        </div>
                      </div>

                      {adminTerakhir && <input type="hidden" name="role" value="admin" />}

                      <SubjectClassPickers
                        classes={classes}
                        selectedTahfid={kelasTahfid}
                        selectedTilawati={kelasTilawati}
                        idPrefix={`pengguna-${u.id}`}
                      />

                      <div class="mt-5">
                        <button type="submit" class={BTN_PRIMARY}>
                          <span class="material-symbols-outlined text-[20px]">save</span>
                          Simpan Perubahan
                        </button>
                      </div>
                    </form>

                    <form
                      method="POST"
                      action={`/administrasi/pengguna/${u.id}/password`}
                      class="mt-5 pt-4 border-t border-border-light dark:border-border-light-dark"
                      data-confirm={`Password <b>${u.name}</b> akan diganti dan seluruh sesi loginnya akan dikeluarkan.`}
                      data-confirm-title="Ganti password?"
                      data-confirm-icon="question"
                      data-confirm-ok="Ya, ganti password"
                      data-loader-text="Mengganti password"
                    >
                      <label class={LABEL} for={`pass-u-${u.id}`}>
                        Atur Ulang Password
                      </label>
                      <div class="flex flex-col sm:flex-row gap-2">
                        <input
                          id={`pass-u-${u.id}`}
                          name="password"
                          type="password"
                          class={`${INPUT} sm:max-w-xs`}
                          placeholder="Password baru, minimal 8 karakter"
                          minlength={8}
                          required
                        />
                        <button type="submit" class={BTN_PRIMARY}>
                          <span class="material-symbols-outlined text-[20px]">key</span>
                          Ganti Password
                        </button>
                      </div>
                    </form>

                    {!diriSendiri && !adminTerakhir && (
                      <form
                        method="POST"
                        action={`/administrasi/pengguna/${u.id}/hapus`}
                        class="mt-5 pt-4 border-t border-border-light dark:border-border-light-dark"
                        data-confirm={`Akun <b>${u.name}</b> akan dihapus permanen dan tidak bisa login lagi.<br><br>Data siswa dan catatan hafalan <b>tidak terpengaruh</b>.`}
                        data-confirm-title="Hapus akun ini?"
                        data-confirm-ok="Ya, hapus akun"
                        data-loader-text="Menghapus akun"
                      >
                        <button type="submit" class={BTN_DANGER}>
                          <span class="material-symbols-outlined text-[20px]">delete</span>
                          Hapus Akun
                        </button>
                      </form>
                    )}
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
