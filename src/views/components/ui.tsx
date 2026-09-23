import type { FC, Child } from "hono/jsx";
import { Layout } from "../Layout.tsx";
import { Header } from "./Header.tsx";
import type { User } from "../../types.ts";
import { getSiteName } from "../../lib/settings.ts";

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50";

export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border-light dark:border-border-light-dark bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors";

export const BTN_DANGER =
  "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm font-semibold transition-colors";

export const INPUT =
  "w-full bg-slate-50 dark:bg-slate-800/50 text-text-main dark:text-text-main-dark text-sm rounded-lg border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary px-3.5 py-2.5 transition-all placeholder:text-text-secondary/60";

export const LABEL =
  "block text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider mb-1.5";

export const CARD =
  "bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl shadow-sm";

/** Kerangka halaman: layout, header, dan area konten dengan lebar maksimum. */
export const PageShell: FC<{
  user: User;
  currentPath: string;
  title: string;
  heading: string;
  subheading?: string;
  actions?: Child;
  wide?: boolean;
  children: Child;
}> = ({ user, currentPath, title, heading, subheading, actions, wide, children }) => (
  <Layout title={`${title} - ${getSiteName()}`}>
    <Header user={user} currentPath={currentPath} />
    <main
      class={`flex-1 flex flex-col w-full px-4 sm:px-6 lg:px-8 py-8 ${
        wide ? "max-w-7xl" : "max-w-5xl"
      } mx-auto`}
    >
      <div class="w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div class="flex flex-col gap-2">
          <h1 class="text-text-main dark:text-text-main-dark text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">
            {heading}
          </h1>
          {subheading && (
            <p class="text-text-secondary dark:text-text-secondary-dark text-base leading-normal max-w-2xl">
              {subheading}
            </p>
          )}
        </div>
        {actions && <div class="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </main>
  </Layout>
);

export const EmptyState: FC<{ icon: string; title: string; description?: string }> = ({
  icon,
  title,
  description,
}) => (
  <div class="px-6 py-16 text-center text-text-secondary dark:text-text-secondary-dark">
    <span class="material-symbols-outlined text-5xl mb-3 opacity-60">{icon}</span>
    <p class="text-base font-semibold text-text-main dark:text-text-main-dark">{title}</p>
    {description && <p class="text-sm mt-1.5 max-w-md mx-auto">{description}</p>}
  </div>
);

/** Foto siswa bila ada, jatuh ke lingkaran inisial nama bila belum ada foto. */
export const StudentAvatar: FC<{
  name: string;
  photoPath: string | null;
  size?: string;
  textClass?: string;
}> = ({ name, photoPath, size = "size-10", textClass = "text-xs font-bold" }) => {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]!.toUpperCase())
    .join("");

  if (photoPath) {
    return (
      <div
        class={`${size} rounded-full bg-slate-100 dark:bg-slate-800 bg-cover bg-center border border-slate-200 dark:border-slate-700 shrink-0`}
        style={`background-image: url("${photoPath}")`}
      />
    );
  }

  return (
    <div
      class={`${size} rounded-full bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 ${textClass}`}
    >
      {initials}
    </div>
  );
};

export const StatCard: FC<{ icon: string; label: string; value: string; hint?: string }> = ({
  icon,
  label,
  value,
  hint,
}) => (
  <div class={`${CARD} p-5 flex items-start gap-4`}>
    <div class="hanya-ikon size-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <span class="material-symbols-outlined">{icon}</span>
    </div>
    <div class="min-w-0">
      <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
        {label}
      </p>
      <p class="text-text-main dark:text-text-main-dark text-2xl font-black mt-0.5">{value}</p>
      {hint && (
        <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5">{hint}</p>
      )}
    </div>
  </div>
);

/**
 * Penanda teks pada baris yang bisa dibuka. Ikon panah saja kurang jelas
 * sebagai ajakan, dan hilang sama sekali ketika font ikon tidak termuat.
 */
export const ToggleHint: FC<{ closed?: string; open?: string }> = ({
  closed = "Buka",
  open = "Tutup",
}) => (
  <span class="shrink-0 text-xs font-bold text-primary">
    <span class="group-open:hidden">{closed}</span>
    <span class="hidden group-open:inline">{open}</span>
  </span>
);

/** Panel yang bisa dibuka-tutup, dipakai untuk formulir tambah data. */
export const Collapsible: FC<{
  id: string;
  label: string;
  icon?: string;
  open?: boolean;
  children: Child;
}> = ({ id, label, icon = "add", open, children }) => (
  <details id={id} open={open} class={`${CARD} mb-6 overflow-hidden group`}>
    <summary class="flex items-center gap-2 px-5 py-4 cursor-pointer select-none text-text-main dark:text-text-main-dark font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <span class="material-symbols-outlined text-primary text-[20px]">{icon}</span>
      {label}
      <span class="material-symbols-outlined ml-auto text-text-secondary text-[20px] group-open:rotate-180 transition-transform">
        expand_more
      </span>
    </summary>
    <div class="px-5 pb-5 pt-1 border-t border-border-light dark:border-border-light-dark">
      {children}
    </div>
  </details>
);

const TAB_BTN_ACTIVE = "border-primary text-primary";
const TAB_BTN_INACTIVE =
  "border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark hover:border-border-light dark:hover:border-border-light-dark";

/**
 * Sekelompok tab yang menukar tampilan panel di bawahnya tanpa memuat ulang
 * halaman — gaya visualnya sama seperti SettingsTabs, tapi berpindah lewat
 * JavaScript di sisi klien (lihat `data-tab-btn` di uxScript pada Layout.tsx)
 * karena panel-panelnya berbagi satu halaman/rute, bukan rute terpisah.
 */
export const TabbedPanels: FC<{
  id: string;
  tabs: { id: string; label: string; icon: string }[];
  children: Child;
}> = ({ id, tabs, children }) => (
  <div id={id} data-tab-group class="mb-6">
    <div class="flex items-center gap-1 mb-6 border-b border-border-light dark:border-border-light-dark overflow-x-auto">
      {tabs.map((tab, i) => (
        <button
          type="button"
          data-tab-btn={tab.id}
          class={`inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
            i === 0 ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE
          }`}
        >
          <span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
    {children}
  </div>
);

/** Satu panel isi tab. `id` harus sama dengan salah satu `tabs[].id` pada `TabbedPanels`. */
export const TabPanel: FC<{ id: string; active?: boolean; children: Child }> = ({
  id,
  active,
  children,
}) => (
  <div data-tab-panel={id} class={active ? "" : "hidden"}>
    {children}
  </div>
);
