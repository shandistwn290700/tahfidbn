import type { FC } from "hono/jsx";
import { PageShell, BTN_PRIMARY, INPUT, LABEL, CARD, EmptyState } from "../components/ui.tsx";
import { SettingsTabs } from "../components/SettingsTabs.tsx";
import type { User } from "../../types.ts";
import type { BackupFileInfo } from "../../lib/backup.ts";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const BackupPage: FC<{
  user: User;
  database: { size: number; modifiedAt: string };
  backups: BackupFileInfo[];
}> = ({ user, database, backups }) => {
  const currentPath = "/administrasi/pengaturan/backup";

  return (
    <PageShell
      user={user}
      currentPath={currentPath}
      title="Cadangan & Pemulihan"
      heading="Pengaturan"
      subheading="Unduh cadangan basis data secara berkala, atau pulihkan dari cadangan bila diperlukan."
    >
      <SettingsTabs currentPath={currentPath} />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Unduh Cadangan */}
        <div class={`${CARD} p-6`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">cloud_download</span>
            Unduh Cadangan
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            Mengunduh salinan basis data saat ini apa adanya — seluruh kelas, siswa, akun, dan
            catatan hafalan. Simpan berkas ini di tempat aman di luar server, secara berkala.
          </p>

          <div class="flex items-center gap-4 mb-5 px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <span class="material-symbols-outlined text-text-secondary dark:text-text-secondary-dark">
              database
            </span>
            <div class="text-sm">
              <p class="text-text-main dark:text-text-main-dark font-semibold">
                {formatSize(database.size)}
              </p>
              <p class="text-text-secondary dark:text-text-secondary-dark text-xs">
                Terakhir diubah {formatDateTime(database.modifiedAt)}
              </p>
            </div>
          </div>

          <a
            href="/administrasi/pengaturan/backup/unduh"
            download
            class={BTN_PRIMARY}
            data-no-loader
          >
            <span class="material-symbols-outlined text-[20px]">download</span>
            Unduh Cadangan Sekarang
          </a>
        </div>

        {/* Pulihkan dari Cadangan */}
        <div class={`${CARD} p-6`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-rose-600 dark:text-rose-400">
              settings_backup_restore
            </span>
            Pulihkan dari Cadangan
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            Menimpa <b>seluruh</b> data yang sedang berjalan dengan isi berkas cadangan yang
            diunggah. Basis data saat ini akan dicadangkan otomatis lebih dulu sebelum ditimpa,
            dan seluruh akun akan perlu masuk kembali setelah proses selesai.
          </p>

          <form
            method="POST"
            action="/administrasi/pengaturan/backup/pulihkan"
            enctype="multipart/form-data"
            data-confirm="Seluruh data yang sedang berjalan (kelas, siswa, akun, dan catatan hafalan) akan <b>ditimpa</b> dengan isi berkas ini.<br><br>Data saat ini akan dicadangkan otomatis lebih dulu, tetapi pastikan berkas yang diunggah benar sebelum melanjutkan."
            data-confirm-title="Pulihkan dari cadangan ini?"
            data-confirm-ok="Ya, timpa data sekarang"
            data-loader-text="Memulihkan basis data"
          >
            <label class={LABEL} for="restore-file">
              Berkas Cadangan (.db)
            </label>
            <input
              id="restore-file"
              name="file"
              type="file"
              accept=".db"
              class={`${INPUT} file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-rose-100 file:text-rose-700 dark:file:bg-rose-900/30 dark:file:text-rose-300 hover:file:bg-rose-200 dark:hover:file:bg-rose-900/50 cursor-pointer`}
              required
            />
            <div class="mt-5">
              <button
                type="submit"
                class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors shadow-sm"
              >
                <span class="material-symbols-outlined text-[20px]">upload</span>
                Pulihkan &amp; Timpa Data
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Daftar Cadangan */}
      <div class={CARD}>
        <div class="px-5 py-3.5 border-b border-border-light dark:border-border-light-dark">
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
            Cadangan Tersimpan di Server ({backups.length})
          </p>
        </div>
        {backups.length === 0 ? (
          <EmptyState
            icon="folder_off"
            title="Belum ada cadangan tersimpan"
            description="Cadangan yang diunduh dari sini, maupun cadangan otomatis dari proses migrasi, akan muncul di daftar ini."
          />
        ) : (
          <div class="divide-y divide-border-light dark:divide-border-light-dark max-h-[420px] overflow-y-auto">
            {backups.map((backup) => (
              <div class="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <div class="min-w-0">
                  <p class="font-semibold text-text-main dark:text-text-main-dark truncate">
                    {backup.filename}
                  </p>
                  <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5">
                    {formatSize(backup.size)} &bull; {formatDateTime(backup.modifiedAt)}
                  </p>
                </div>
                <div class="shrink-0 flex items-center gap-4">
                  <a
                    href={`/administrasi/pengaturan/backup/unduh/${encodeURIComponent(backup.filename)}`}
                    download
                    data-no-loader
                    class="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold"
                  >
                    <span class="material-symbols-outlined text-[18px]">download</span>
                    Unduh
                  </a>
                  <form
                    method="POST"
                    action="/administrasi/pengaturan/backup/hapus"
                    data-confirm={`Berkas cadangan <b>${backup.filename}</b> akan dihapus permanen dari server.`}
                    data-confirm-title="Hapus cadangan ini?"
                    data-confirm-ok="Ya, hapus"
                    data-loader-text="Menghapus cadangan"
                  >
                    <input type="hidden" name="filename" value={backup.filename} />
                    <button
                      type="submit"
                      class="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                      Hapus
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};
