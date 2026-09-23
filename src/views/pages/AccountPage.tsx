import type { FC } from "hono/jsx";
import { PageShell, BTN_PRIMARY, INPUT, LABEL, CARD } from "../components/ui.tsx";
import type { User } from "../../types.ts";

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", guru: "Guru" };

export const AccountPage: FC<{ user: User }> = ({ user }) => (
  <PageShell
    user={user}
    currentPath="/akun"
    title="Akun Saya"
    heading="Akun Saya"
    subheading="Perbarui password akun Anda secara berkala demi keamanan data siswa."
  >
    <div class={`${CARD} p-6 mb-6`}>
      <div class="flex items-center gap-4">
        <div class="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold border border-primary/20">
          {user.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p class="text-text-main dark:text-text-main-dark text-lg font-bold">{user.name}</p>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm">
            {ROLE_LABEL[user.role] || user.role} &bull; {user.username}
          </p>
        </div>
      </div>
    </div>

    <div class={`${CARD} p-6`}>
      <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1">
        Ganti Password
      </h2>
      <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
        Setelah password diganti, Anda akan diminta masuk kembali.
      </p>

      <form
        method="POST"
        action="/akun/password"
        data-confirm="Anda akan dikeluarkan dari aplikasi dan perlu masuk kembali dengan password baru."
        data-confirm-title="Ganti password sekarang?"
        data-confirm-icon="question"
        data-confirm-ok="Ya, ganti password"
        data-loader-text="Mengganti password"
      >
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class={LABEL} for="password-lama">
              Password Lama
            </label>
            <input
              id="password-lama"
              name="current_password"
              type="password"
              class={INPUT}
              required
            />
          </div>
          <div>
            <label class={LABEL} for="password-baru">
              Password Baru
            </label>
            <input
              id="password-baru"
              name="new_password"
              type="password"
              class={INPUT}
              minlength={8}
              placeholder="Minimal 8 karakter"
              required
            />
          </div>
          <div>
            <label class={LABEL} for="password-konfirmasi">
              Ulangi Password Baru
            </label>
            <input
              id="password-konfirmasi"
              name="confirm_password"
              type="password"
              class={INPUT}
              minlength={8}
              required
            />
          </div>
        </div>

        <div class="mt-6">
          <button type="submit" class={BTN_PRIMARY}>
            <span class="material-symbols-outlined text-[20px]">key</span>
            Simpan Password Baru
          </button>
        </div>
      </form>
    </div>
  </PageShell>
);
