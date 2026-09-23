import type { FC } from "hono/jsx";
import { PageShell, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, CARD } from "../components/ui.tsx";
import { SettingsTabs } from "../components/SettingsTabs.tsx";
import type { User } from "../../types.ts";

export const SettingsPage: FC<{
  user: User;
  siteName: string;
  faviconUrl: string;
  hasCustomFavicon: boolean;
}> = ({ user, siteName, faviconUrl, hasCustomFavicon }) => {
  const currentPath = "/administrasi/pengaturan";

  return (
    <PageShell
      user={user}
      currentPath={currentPath}
      title="Pengaturan"
      heading="Pengaturan"
      subheading="Sesuaikan nama dan ikon situs yang tampil di seluruh halaman aplikasi."
    >
      <SettingsTabs currentPath={currentPath} />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nama Situs */}
        <div class={`${CARD} p-6`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">badge</span>
            Nama Situs
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            Nama ini tampil di judul tab peramban, halaman masuk, dan bagian atas setiap halaman.
          </p>
          <form
            method="POST"
            action="/administrasi/pengaturan/nama"
            data-loader-text="Menyimpan nama situs"
          >
            <label class={LABEL} for="site-name">
              Nama Situs
            </label>
            <input
              id="site-name"
              name="site_name"
              class={INPUT}
              value={siteName}
              maxlength={60}
              required
            />
            <div class="mt-5">
              <button type="submit" class={BTN_PRIMARY}>
                <span class="material-symbols-outlined text-[20px]">save</span>
                Simpan Nama
              </button>
            </div>
          </form>
        </div>

        {/* Favicon */}
        <div class={`${CARD} p-6`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">image</span>
            Favicon
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            Ikon kecil yang tampil pada tab peramban. Format PNG, JPG, ICO, atau SVG, maksimal
            512KB.
          </p>

          <div class="flex items-center gap-4 mb-5">
            <div class="size-14 rounded-lg border border-border-light dark:border-border-light-dark bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden shrink-0">
              <img src={faviconUrl} alt="Favicon saat ini" class="w-8 h-8 object-contain" />
            </div>
            <div class="text-sm text-text-secondary dark:text-text-secondary-dark">
              {hasCustomFavicon ? "Favicon kustom sedang dipakai." : "Favicon bawaan sedang dipakai."}
            </div>
          </div>

          <form
            method="POST"
            action="/administrasi/pengaturan/favicon"
            enctype="multipart/form-data"
            data-loader-text="Mengunggah favicon"
          >
            <label class={LABEL} for="favicon-file">
              Unggah Favicon Baru
            </label>
            <input
              id="favicon-file"
              name="favicon"
              type="file"
              accept="image/png,image/jpeg,image/x-icon,image/svg+xml,.ico"
              class={`${INPUT} file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer`}
              required
            />
            <div class="mt-5">
              <button type="submit" class={BTN_PRIMARY}>
                <span class="material-symbols-outlined text-[20px]">upload</span>
                Unggah &amp; Simpan
              </button>
            </div>
          </form>

          {hasCustomFavicon && (
            <form
              method="POST"
              action="/administrasi/pengaturan/favicon/reset"
              class="mt-4 pt-4 border-t border-border-light dark:border-border-light-dark"
              data-confirm="Favicon akan dikembalikan ke ikon bawaan aplikasi."
              data-confirm-title="Kembalikan favicon bawaan?"
              data-confirm-icon="question"
              data-confirm-ok="Ya, kembalikan"
              data-loader-text="Mengembalikan favicon bawaan"
            >
              <button type="submit" class={BTN_GHOST}>
                <span class="material-symbols-outlined text-[20px]">restart_alt</span>
                Kembalikan ke Favicon Bawaan
              </button>
            </form>
          )}
        </div>
      </div>
    </PageShell>
  );
};
