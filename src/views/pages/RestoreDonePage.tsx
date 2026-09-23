import type { FC } from "hono/jsx";
import { Layout } from "../Layout.tsx";
import { getSiteName } from "../../lib/settings.ts";

/**
 * Ditampilkan langsung (bukan redirect) setelah pemulihan basis data berhasil.
 * Sengaja tidak memakai PageShell/Header: sesi admin yang sedang login boleh
 * jadi sudah tidak ada lagi di basis data yang baru dipulihkan, jadi halaman
 * ini tidak berasumsi ada sesi yang valid dan mengarahkan untuk masuk ulang.
 */
export const RestoreDonePage: FC<{ safetyBackup: string }> = ({ safetyBackup }) => {
  return (
    <Layout title={`Pemulihan Berhasil - ${getSiteName()}`}>
      <main class="flex-1 flex items-center justify-center px-4 py-12">
        <div class="w-full max-w-md text-center">
          <div class="size-16 mx-auto mb-5 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-4xl">task_alt</span>
          </div>
          <h1 class="text-text-main dark:text-text-main-dark text-2xl font-black tracking-[-0.02em] mb-2">
            Basis Data Berhasil Dipulihkan
          </h1>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-6">
            Seluruh data kini berasal dari berkas cadangan yang diunggah. Data yang sebelumnya
            berjalan telah disimpan otomatis sebagai cadangan pengaman:
          </p>

          <div class="bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl shadow-sm p-4 mb-6">
            <p class="font-mono text-xs text-text-main dark:text-text-main-dark break-all">
              {safetyBackup}
            </p>
          </div>

          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-6">
            Karena data akun ikut berubah, Anda perlu masuk kembali. Bila akun ini tidak ada pada
            data yang dipulihkan, gunakan akun yang tersedia di data tersebut.
          </p>

          <a
            href="/login"
            data-no-loader
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-bold transition-colors shadow-sm"
          >
            <span class="material-symbols-outlined text-[20px]">login</span>
            Masuk Kembali
          </a>
        </div>
      </main>
    </Layout>
  );
};
