import type { FC } from "hono/jsx";

const TABS = [
  { href: "/administrasi/pengaturan", label: "Umum", icon: "tune" },
  { href: "/administrasi/pengaturan/laporan", label: "Laporan Pekanan", icon: "description" },
  { href: "/administrasi/pengaturan/backup", label: "Cadangan & Pemulihan", icon: "backup" },
  { href: "/administrasi/pengaturan/canva", label: "Integrasi Canva", icon: "extension" },
];

/** Sub-navigasi di dalam menu Pengaturan. */
export const SettingsTabs: FC<{ currentPath: string }> = ({ currentPath }) => (
  <div class="flex items-center gap-1 mb-6 border-b border-border-light dark:border-border-light-dark overflow-x-auto">
    {TABS.map((tab) => {
      const active = currentPath === tab.href;
      return (
        <a
          href={tab.href}
          data-loader-text={`Memuat ${tab.label}`}
          class={`inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
            active
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark hover:border-border-light dark:hover:border-border-light-dark"
          }`}
        >
          <span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
          {tab.label}
        </a>
      );
    })}
  </div>
);
