import type { FC } from "hono/jsx";
import { TAB_LIST, TAB_ITEM, TAB_BTN_ACTIVE, TAB_BTN_INACTIVE } from "./ui.tsx";

const TABS = [
  { href: "/administrasi/pengaturan", label: "Umum", icon: "tune" },
  { href: "/administrasi/pengaturan/laporan", label: "Laporan & Semester", icon: "description" },
  { href: "/administrasi/pengaturan/backup", label: "Cadangan & Pemulihan", icon: "backup" },
  { href: "/administrasi/pengaturan/canva", label: "Integrasi Canva", icon: "extension" },
];

/** Sub-navigasi di dalam menu Pengaturan. */
export const SettingsTabs: FC<{ currentPath: string }> = ({ currentPath }) => (
  <div class={TAB_LIST}>
    {TABS.map((tab) => {
      const active = currentPath === tab.href;
      return (
        <a
          href={tab.href}
          data-loader-text={`Memuat ${tab.label}`}
          class={`${TAB_ITEM} ${active ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}`}
        >
          <span class="material-symbols-outlined text-[18px] shrink-0">{tab.icon}</span>
          {tab.label}
        </a>
      );
    })}
  </div>
);
