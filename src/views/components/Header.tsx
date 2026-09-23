import type { FC } from "hono/jsx";
import type { User } from "../../types.ts";
import { getSiteName } from "../../lib/settings.ts";

const Logo: FC = () => (
  <svg class="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z"
      fill="currentColor"
    />
  </svg>
);

const ThemeToggle: FC<{ id: string }> = ({ id }) => (
  <button
    id={id}
    type="button"
    class="ikon-berlabel size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-text-secondary dark:text-text-secondary-dark"
    data-label="Tema"
    aria-label="Ganti tema terang atau gelap"
  >
    <span class="material-symbols-outlined theme-icon-light hidden dark:block">light_mode</span>
    <span class="material-symbols-outlined theme-icon-dark block dark:hidden">dark_mode</span>
  </button>
);

const ADMIN_LINKS = [
  { href: "/administrasi/kelas", label: "Kelas", icon: "school" },
  { href: "/administrasi/siswa", label: "Siswa", icon: "groups" },
  { href: "/administrasi/pengguna", label: "Pengguna", icon: "manage_accounts" },
  { href: "/administrasi/pengaturan", label: "Pengaturan", icon: "settings" },
];

/** Link Administrasi aktif juga saat berada di sub-halamannya, mis. /pengaturan/backup. */
function isAdminLinkActive(currentPath: string, href: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

const PAPAN_PERINGKAT_LINKS = [
  { href: "/leaderboard", label: "Tahfid Al-Qur'an", icon: "auto_stories" },
  { href: "/leaderboard/tilawati", label: "Tilawati", icon: "import_contacts" },
  { href: "/leaderboard/rekap", label: "Rekapitulasi", icon: "summarize" },
  { href: "/leaderboard/periode", label: "Laporan Periode", icon: "event_note" },
];

const INPUT_LINKS = [
  { href: "/progress", label: "Hafalan Qur'an", icon: "auto_stories" },
  { href: "/progress/tilawati", label: "Capaian Tilawati", icon: "import_contacts" },
];

/** Grup dropdown aktif bila berada pada salah satu halamannya. */
function isGroupActive(currentPath: string, links: { href: string }[]): boolean {
  return links.some((l) => currentPath === l.href || currentPath.startsWith(`${l.href}/`));
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  guru: "Guru",
};

const headerScript = `
(function () {
  var mobileBtn = document.getElementById('mobile-menu-btn');
  var mobileMenu = document.getElementById('mobile-menu');
  var mobileIcon = document.getElementById('mobile-menu-icon');

  if (mobileBtn && mobileMenu && mobileIcon) {
    mobileBtn.addEventListener('click', function () {
      mobileMenu.classList.toggle('hidden');
      var tertutup = mobileMenu.classList.contains('hidden');
      mobileIcon.textContent = tertutup ? 'menu' : 'close';
      document.body.style.overflow = tertutup ? '' : 'hidden';
    });
  }

  function pasangDropdown(tombolId, panelId) {
    var tombol = document.getElementById(tombolId);
    var panel = document.getElementById(panelId);
    if (!tombol || !panel) return;

    tombol.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('hidden');
      tombol.setAttribute('aria-expanded', panel.classList.contains('hidden') ? 'false' : 'true');
    });

    document.addEventListener('click', function (e) {
      if (!tombol.contains(e.target) && !panel.contains(e.target)) {
        panel.classList.add('hidden');
        tombol.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        panel.classList.add('hidden');
        tombol.setAttribute('aria-expanded', 'false');
      }
    });
  }

  pasangDropdown('tombol-profil', 'panel-profil');
  pasangDropdown('tombol-administrasi', 'panel-administrasi');
  pasangDropdown('tombol-papan-peringkat', 'panel-papan-peringkat');
  pasangDropdown('tombol-input', 'panel-input');

  function pasangMobileToggle(tombolId, panelId, ikonId) {
    var tombol = document.getElementById(tombolId);
    var panel = document.getElementById(panelId);
    var ikon = document.getElementById(ikonId);
    if (!tombol || !panel || !ikon) return;

    tombol.addEventListener('click', function () {
      panel.classList.toggle('hidden');
      ikon.textContent = panel.classList.contains('hidden') ? 'expand_more' : 'expand_less';
    });
  }

  pasangMobileToggle(
    'administrasi-mobile-toggle', 'administrasi-mobile-panel', 'administrasi-mobile-icon'
  );
  pasangMobileToggle(
    'papan-peringkat-mobile-toggle', 'papan-peringkat-mobile-panel', 'papan-peringkat-mobile-icon'
  );
  pasangMobileToggle('input-mobile-toggle', 'input-mobile-panel', 'input-mobile-icon');

  function pasangTema(id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var gelap = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', gelap ? 'dark' : 'light');
    });
  }

  pasangTema('tema-desktop');
  pasangTema('tema-mobile');
})();
`;

export const Header: FC<{ user: User; currentPath: string }> = ({ user, currentPath }) => {
  const quranLink = { href: "/quran", label: "Al-Qur'an", icon: "menu_book" };

  const isAdmin = user.role === "admin";
  const adminActive = currentPath.startsWith("/administrasi");
  const papanPeringkatActive = isGroupActive(currentPath, PAPAN_PERINGKAT_LINKS);
  const inputActive = isGroupActive(currentPath, INPUT_LINKS);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const deskLink = (active: boolean) =>
    active
      ? "text-primary text-sm font-semibold leading-normal border-b-2 border-primary pb-0.5"
      : "text-text-secondary dark:text-text-secondary-dark hover:text-primary transition-colors text-sm font-medium leading-normal";

  return (
    <>
      <header class="sticky top-0 z-40 flex flex-col border-b border-solid border-border-light dark:border-border-light-dark bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div class="flex items-center justify-between px-4 sm:px-8 w-full h-16">
          <a href="/leaderboard" class="flex items-center gap-3 shrink-0">
            <div class="size-8 text-primary">
              <Logo />
            </div>
            <h2 class="text-text-main dark:text-text-main-dark text-lg sm:text-xl font-bold leading-tight tracking-[-0.015em]">
              {getSiteName()}
            </h2>
          </a>

          {/* Navigasi layar lebar */}
          <div class="hidden lg:flex flex-1 justify-end gap-6 items-center">
            <nav class="flex items-center gap-7">
              <div class="relative">
                <button
                  id="tombol-papan-peringkat"
                  type="button"
                  aria-expanded="false"
                  class={`${deskLink(papanPeringkatActive)} flex items-center gap-1`}
                >
                  Papan Peringkat
                  <span class="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                <div
                  id="panel-papan-peringkat"
                  class="hidden absolute right-0 mt-3 w-52 bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl shadow-lg overflow-hidden py-1"
                >
                  {PAPAN_PERINGKAT_LINKS.map((link) => (
                    <a
                      href={link.href}
                      class={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        currentPath === link.href
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-text-secondary dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-text-main dark:hover:text-text-main-dark"
                      }`}
                    >
                      <span class="material-symbols-outlined text-[20px]">{link.icon}</span>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <div class="relative">
                <button
                  id="tombol-input"
                  type="button"
                  aria-expanded="false"
                  class={`${deskLink(inputActive)} flex items-center gap-1`}
                >
                  Input
                  <span class="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                <div
                  id="panel-input"
                  class="hidden absolute right-0 mt-3 w-56 bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl shadow-lg overflow-hidden py-1"
                >
                  {INPUT_LINKS.map((link) => (
                    <a
                      href={link.href}
                      class={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        currentPath === link.href
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-text-secondary dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-text-main dark:hover:text-text-main-dark"
                      }`}
                    >
                      <span class="material-symbols-outlined text-[20px]">{link.icon}</span>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <a class={deskLink(currentPath === quranLink.href)} href={quranLink.href}>
                {quranLink.label}
              </a>

              {isAdmin && (
                <div class="relative">
                  <button
                    id="tombol-administrasi"
                    type="button"
                    aria-expanded="false"
                    class={`${deskLink(adminActive)} flex items-center gap-1`}
                  >
                    Administrasi
                    <span class="material-symbols-outlined text-[18px]">expand_more</span>
                  </button>
                  <div
                    id="panel-administrasi"
                    class="hidden absolute right-0 mt-3 w-52 bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl shadow-lg overflow-hidden py-1"
                  >
                    {ADMIN_LINKS.map((link) => (
                      <a
                        href={link.href}
                        class={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isAdminLinkActive(currentPath, link.href)
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-text-secondary dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-text-main dark:hover:text-text-main-dark"
                        }`}
                      >
                        <span class="material-symbols-outlined text-[20px]">{link.icon}</span>
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </nav>

            <ThemeToggle id="tema-desktop" />

            <div class="relative">
              <button
                id="tombol-profil"
                type="button"
                aria-expanded="false"
                class="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div class="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                  {initials}
                </div>
                <span class="material-symbols-outlined text-text-secondary dark:text-text-secondary-dark text-[20px]">
                  arrow_drop_down
                </span>
              </button>

              <div
                id="panel-profil"
                class="hidden absolute right-0 mt-3 w-60 bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl shadow-lg overflow-hidden"
              >
                <div class="px-4 py-3 border-b border-border-light dark:border-border-light-dark">
                  <p class="text-text-main dark:text-text-main-dark text-sm font-bold truncate">
                    {user.name}
                  </p>
                  <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5">
                    {ROLE_LABEL[user.role] || user.role} &bull; {user.username}
                  </p>
                </div>
                <a
                  href="/akun"
                  class="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span class="material-symbols-outlined text-[20px]">key</span>
                  Ganti Password
                </a>
                <form method="POST" action="/auth/logout" data-loader-text="Keluar dari aplikasi">
                  <button
                    type="submit"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  >
                    <span class="material-symbols-outlined text-[20px]">logout</span>
                    Keluar
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Tombol layar kecil */}
          <div class="flex lg:hidden items-center gap-1">
            <ThemeToggle id="tema-mobile" />
            <button
              id="mobile-menu-btn"
              type="button"
              class="ikon-berlabel size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-text-main dark:text-text-main-dark"
              data-label="Menu"
              aria-label="Buka menu"
            >
              <span id="mobile-menu-icon" class="material-symbols-outlined">
                menu
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Menu layar kecil */}
      <div
        id="mobile-menu"
        class="hidden lg:hidden fixed inset-0 top-16 z-30 bg-background dark:bg-background-dark overflow-y-auto"
      >
        <nav class="flex flex-col p-4 gap-1">
          <button
            id="papan-peringkat-mobile-toggle"
            type="button"
            class={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base w-full text-left transition-colors ${
              papanPeringkatActive
                ? "bg-primary/10 text-primary font-bold"
                : "text-text-main dark:text-text-main-dark hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span class="material-symbols-outlined">leaderboard</span>
            Papan Peringkat
            <span
              id="papan-peringkat-mobile-icon"
              class="material-symbols-outlined ml-auto text-[20px]"
            >
              {papanPeringkatActive ? "expand_less" : "expand_more"}
            </span>
          </button>
          <div
            id="papan-peringkat-mobile-panel"
            class={papanPeringkatActive ? "" : "hidden"}
          >
            {PAPAN_PERINGKAT_LINKS.map((link) => (
              <a
                href={link.href}
                class={`flex items-center gap-3 pl-12 pr-4 py-3 rounded-xl text-sm transition-colors ${
                  currentPath === link.href
                    ? "text-primary font-bold"
                    : "text-text-secondary dark:text-text-secondary-dark hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span class="material-symbols-outlined text-[20px]">{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>

          <button
            id="input-mobile-toggle"
            type="button"
            class={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base w-full text-left transition-colors ${
              inputActive
                ? "bg-primary/10 text-primary font-bold"
                : "text-text-main dark:text-text-main-dark hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span class="material-symbols-outlined">edit_note</span>
            Input
            <span id="input-mobile-icon" class="material-symbols-outlined ml-auto text-[20px]">
              {inputActive ? "expand_less" : "expand_more"}
            </span>
          </button>
          <div id="input-mobile-panel" class={inputActive ? "" : "hidden"}>
            {INPUT_LINKS.map((link) => (
              <a
                href={link.href}
                class={`flex items-center gap-3 pl-12 pr-4 py-3 rounded-xl text-sm transition-colors ${
                  currentPath === link.href
                    ? "text-primary font-bold"
                    : "text-text-secondary dark:text-text-secondary-dark hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span class="material-symbols-outlined text-[20px]">{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>

          <a
            href={quranLink.href}
            class={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base transition-colors ${
              currentPath === quranLink.href
                ? "bg-primary/10 text-primary font-bold"
                : "text-text-main dark:text-text-main-dark hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span class="material-symbols-outlined">{quranLink.icon}</span>
            {quranLink.label}
          </a>

          {isAdmin && (
            <>
              <button
                id="administrasi-mobile-toggle"
                type="button"
                class={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base w-full text-left transition-colors ${
                  adminActive
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-text-main dark:text-text-main-dark hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span class="material-symbols-outlined">admin_panel_settings</span>
                Administrasi
                <span
                  id="administrasi-mobile-icon"
                  class="material-symbols-outlined ml-auto text-[20px]"
                >
                  {adminActive ? "expand_less" : "expand_more"}
                </span>
              </button>
              <div id="administrasi-mobile-panel" class={adminActive ? "" : "hidden"}>
                {ADMIN_LINKS.map((link) => (
                  <a
                    href={link.href}
                    class={`flex items-center gap-3 pl-12 pr-4 py-3 rounded-xl text-sm transition-colors ${
                      isAdminLinkActive(currentPath, link.href)
                        ? "text-primary font-bold"
                        : "text-text-secondary dark:text-text-secondary-dark hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span class="material-symbols-outlined text-[20px]">{link.icon}</span>
                    {link.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </nav>

        <div class="mt-2 mx-4 p-4 rounded-xl bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark">
          <p class="text-text-main dark:text-text-main-dark text-sm font-bold">{user.name}</p>
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5 mb-3">
            {ROLE_LABEL[user.role] || user.role} &bull; {user.username}
          </p>
          <a
            href="/akun"
            class="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark mb-3"
          >
            <span class="material-symbols-outlined text-[20px]">key</span>
            Ganti Password
          </a>
          <form method="POST" action="/auth/logout" data-loader-text="Keluar dari aplikasi">
            <button
              type="submit"
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm font-bold"
            >
              <span class="material-symbols-outlined text-[20px]">logout</span>
              Keluar
            </button>
          </form>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: headerScript }} />
    </>
  );
};
