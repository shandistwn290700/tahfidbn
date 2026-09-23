import type { FC } from "hono/jsx";
import { PageShell, CARD, BTN_PRIMARY, EmptyState } from "../components/ui.tsx";
import type { User } from "../../types.ts";

export interface ImportCount {
  label: string;
  value: number;
  tone?: "success" | "info" | "warn" | "muted";
}

export interface ImportIssue {
  label: string;
  reason: string;
}

const TONE_CLASS: Record<string, string> = {
  success: "text-primary",
  info: "text-blue-600 dark:text-blue-400",
  warn: "text-amber-600 dark:text-amber-400",
  muted: "text-text-secondary dark:text-text-secondary-dark",
};

export const ImportResultPage: FC<{
  user: User;
  currentPath: string;
  backHref: string;
  backLabel: string;
  title: string;
  summary: string;
  counts: ImportCount[];
  issues: ImportIssue[];
}> = ({ user, currentPath, backHref, backLabel, title, summary, counts, issues }) => {
  return (
    <PageShell user={user} currentPath={currentPath} title={title} heading={title} subheading={summary}>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {counts.map((count) => (
          <div class={`${CARD} p-5 text-center`}>
            <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider mb-1">
              {count.label}
            </p>
            <p class={`text-3xl font-black ${TONE_CLASS[count.tone || "muted"]}`}>{count.value}</p>
          </div>
        ))}
      </div>

      <div class={CARD}>
        <div class="px-5 py-3.5 border-b border-border-light dark:border-border-light-dark">
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs font-bold uppercase tracking-wider">
            {issues.length > 0 ? `Baris/berkas yang dilewati (${issues.length})` : "Rincian"}
          </p>
        </div>
        {issues.length === 0 ? (
          <EmptyState icon="task_alt" title="Semua data berhasil diproses tanpa masalah." />
        ) : (
          <div class="divide-y divide-border-light dark:divide-border-light-dark max-h-[420px] overflow-y-auto">
            {issues.map((issue) => (
              <div class="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <span class="font-semibold text-text-main dark:text-text-main-dark shrink-0">
                  {issue.label}
                </span>
                <span class="text-text-secondary dark:text-text-secondary-dark text-right">
                  {issue.reason}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="mt-6">
        <a href={backHref} class={BTN_PRIMARY} data-loader-text="Memuat halaman">
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
          {backLabel}
        </a>
      </div>
    </PageShell>
  );
};
