import type { FC } from "hono/jsx";
import { Layout } from "../Layout.tsx";
import { getSiteName } from "../../lib/settings.ts";

export const LoginPage: FC<{ error?: string; success?: string }> = ({ error }) => {
  return (
    <Layout title={`Masuk - ${getSiteName()}`}>
      <main class="flex-1 flex items-center justify-center px-4 py-12">
        <div class="w-full max-w-md">
          <div class="flex flex-col items-center text-center mb-8">
            <div class="size-14 text-primary mb-4">
              <svg class="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <h1 class="text-text-main dark:text-text-main-dark text-3xl font-black tracking-[-0.033em]">
              {getSiteName()}
            </h1>
            <p class="text-text-secondary dark:text-text-secondary-dark text-sm mt-2">
              Masuk untuk mencatat dan memantau hafalan siswa.
            </p>
          </div>

          <div class="bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl shadow-sm p-6 sm:p-8">
            {error && (
              <div class="mb-5 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2.5">
                <span class="material-symbols-outlined text-[20px] shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <form method="POST" action="/auth/login" data-loader-text="Memverifikasi akun">
              <div class="mb-4">
                <label
                  class="block text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider mb-1.5"
                  for="username"
                >
                  Nama Pengguna
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autocomplete="username"
                  autofocus
                  required
                  class="w-full bg-slate-50 dark:bg-slate-800/50 text-text-main dark:text-text-main-dark text-sm rounded-lg border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary px-3.5 py-2.5 transition-all"
                  placeholder="Nama pengguna Anda"
                />
              </div>

              <div class="mb-6">
                <label
                  class="block text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider mb-1.5"
                  for="password"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="w-full bg-slate-50 dark:bg-slate-800/50 text-text-main dark:text-text-main-dark text-sm rounded-lg border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary px-3.5 py-2.5 transition-all"
                  placeholder="Password Anda"
                />
              </div>

              <button
                type="submit"
                class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-bold transition-colors shadow-sm"
              >
                <span class="material-symbols-outlined text-[20px]">login</span>
                Masuk
              </button>
            </form>
          </div>

          <p class="text-center text-text-secondary dark:text-text-secondary-dark text-xs mt-6">
            Akun hanya dibuat oleh administrator sekolah. Hubungi admin bila Anda belum memiliki
            akses.
          </p>
        </div>
      </main>
    </Layout>
  );
};
