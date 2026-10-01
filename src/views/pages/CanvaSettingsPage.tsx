import type { FC } from "hono/jsx";
import { PageShell, BTN_PRIMARY, BTN_DANGER, INPUT, LABEL, CARD } from "../components/ui.tsx";
import { SettingsTabs } from "../components/SettingsTabs.tsx";
import type { User } from "../../types.ts";

/** Host dari sebuah URL, atau null bila tidak bisa dibaca. */
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const ConfigRow: FC<{ ok: boolean; label: string; detail: string }> = ({ ok, label, detail }) => (
  <li class="flex items-start gap-3">
    <span
      class={`material-symbols-outlined text-[20px] ${ok ? "text-primary" : "text-rose-600 dark:text-rose-400"}`}
    >
      {ok ? "check_circle" : "error"}
    </span>
    <div class="min-w-0">
      <p class="text-text-main dark:text-text-main-dark text-sm font-bold">{label}</p>
      <p class="text-text-secondary dark:text-text-secondary-dark text-xs break-all">{detail}</p>
    </div>
  </li>
);

export const CanvaSettingsPage: FC<{
  user: User;
  connected: boolean;
  brandTemplateId: string | null;
  config: {
    hasClientId: boolean;
    hasClientSecret: boolean;
    redirectUri: string | null;
    redirectFromAppUrl: boolean;
  };
  currentHost: string | null;
}> = ({ user, connected, brandTemplateId, config, currentHost }) => {
  const currentPath = "/administrasi/pengaturan/canva";
  const redirectHost = hostOf(config.redirectUri);
  const hostMismatch = Boolean(redirectHost && currentHost && redirectHost !== currentHost);
  const insecure = Boolean(
    config.redirectUri?.startsWith("http://") && redirectHost && !/^(127\.0\.0\.1|localhost)(:|$)/.test(redirectHost)
  );

  return (
    <PageShell
      user={user}
      currentPath={currentPath}
      title="Integrasi Canva"
      heading="Pengaturan"
      subheading="Laporan Pekanan dibuat dengan mengisi Brand Template Canva secara otomatis (Autofill)."
    >
      <SettingsTabs currentPath={currentPath} />

      <div class={`${CARD} p-6 mb-6`}>
        <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">fact_check</span>
          Pemeriksaan Konfigurasi Server
        </h2>
        <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
          Dibaca dari berkas <code>.env</code> di server ini. Setelah mengubah <code>.env</code>,
          aplikasi harus di-restart (mis. <code>pm2 restart ngaji --update-env</code>).
        </p>
        <ul class="space-y-3">
          <ConfigRow
            ok={config.hasClientId}
            label="CANVA_CLIENT_ID"
            detail={config.hasClientId ? "Terisi." : "Belum diisi — salin dari halaman App di canva.com/developers."}
          />
          <ConfigRow
            ok={config.hasClientSecret}
            label="CANVA_CLIENT_SECRET"
            detail={config.hasClientSecret ? "Terisi." : "Belum diisi — salin dari halaman App di canva.com/developers."}
          />
          <ConfigRow
            ok={Boolean(config.redirectUri) && !hostMismatch && !insecure}
            label={`Redirect URI${config.redirectFromAppUrl && config.redirectUri ? " (dari APP_URL)" : ""}`}
            detail={config.redirectUri ?? "Belum diisi — isi CANVA_REDIRECT_URI atau APP_URL."}
          />
        </ul>

        {config.redirectUri && (
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-4">
            Alamat di atas harus didaftarkan <b>persis sama</b> di canva.com/developers › App Anda ›
            Authentication › Authorized redirects.
          </p>
        )}
        {hostMismatch && (
          <p class="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm">
            Redirect URI menunjuk ke <b>{redirectHost}</b>, padahal halaman ini dibuka lewat{" "}
            <b>{currentHost}</b>. Setelah login, Canva akan mengarahkan ke alamat yang salah dan
            koneksi gagal. Ubah <code>CANVA_REDIRECT_URI</code> (atau hapus dan isi <code>APP_URL</code>)
            di <code>.env</code> server ini.
          </p>
        )}
        {insecure && (
          <p class="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm">
            Redirect URI memakai <b>http://</b> untuk domain publik. Pastikan situs ini dibuka lewat
            https dan pakai alamat <b>https://</b> di <code>.env</code> maupun di Canva.
          </p>
        )}
      </div>

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
              placeholder="Contoh: EAFxxxxxxxx (bukan ID desain yang berawalan DA)"
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
