import type { FC } from "hono/jsx";
import { PageShell, BTN_PRIMARY, BTN_DANGER, INPUT, LABEL, CARD } from "../components/ui.tsx";
import { SettingsTabs } from "../components/SettingsTabs.tsx";
import type { User } from "../../types.ts";

export const CanvaSettingsPage: FC<{
  user: User;
  connected: boolean;
  brandTemplateId: string | null;
}> = ({ user, connected, brandTemplateId }) => {
  const currentPath = "/administrasi/pengaturan/canva";

  return (
    <PageShell
      user={user}
      currentPath={currentPath}
      title="Integrasi Canva"
      heading="Pengaturan"
      subheading="Hubungkan akun Canva untuk mengisi Brand Template laporan secara otomatis (Autofill)."
    >
      <SettingsTabs currentPath={currentPath} />

      <div class={`${CARD} p-6 mb-6`}>
        <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">link</span>
          Koneksi Akun Canva
        </h2>
        <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
          Aplikasi akan meminta izin mengakses Brand Template dan Asset di akun Canva Anda, untuk
          mengisi laporan secara otomatis lewat fitur Autofill.
        </p>

        {connected ? (
          <div class="flex flex-wrap items-center gap-3">
            <span class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              Terhubung
            </span>
            <form
              method="POST"
              action="/administrasi/pengaturan/canva/disconnect"
              data-confirm="Koneksi ke akun Canva akan diputuskan. Fitur autofill laporan tidak akan berfungsi sampai dihubungkan kembali."
              data-confirm-title="Putuskan koneksi Canva?"
              data-confirm-ok="Ya, putuskan"
              data-loader-text="Memutuskan koneksi"
            >
              <button type="submit" class={BTN_DANGER}>
                <span class="material-symbols-outlined text-[20px]">link_off</span>
                Putuskan Koneksi
              </button>
            </form>
          </div>
        ) : (
          <a href="/administrasi/pengaturan/canva/connect" class={BTN_PRIMARY} data-no-loader>
            <span class="material-symbols-outlined text-[20px]">add_link</span>
            Hubungkan Akun Canva
          </a>
        )}
      </div>

      {connected && (
        <div class={`${CARD} p-6`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">dashboard_customize</span>
            Brand Template
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            ID Brand Template Canva yang dipakai untuk Autofill laporan. Buat template di Canva
            (Brand Kit &rsaquo; Brand Templates) terlebih dahulu, tandai elemen yang ingin diisi
            otomatis sebagai autofill field, lalu tempel ID-nya di sini.
          </p>

          <form
            method="POST"
            action="/administrasi/pengaturan/canva/template"
            data-loader-text="Menyimpan ID Brand Template"
          >
            <label class={LABEL} for="brand-template-id">
              ID Brand Template
            </label>
            <input
              id="brand-template-id"
              name="brand_template_id"
              class={INPUT}
              value={brandTemplateId || ""}
              placeholder="Contoh: DAFxxxxxxxxx"
            />
            <div class="mt-5">
              <button type="submit" class={BTN_PRIMARY}>
                <span class="material-symbols-outlined text-[20px]">save</span>
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
};
