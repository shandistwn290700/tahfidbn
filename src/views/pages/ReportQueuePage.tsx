import type { FC } from "hono/jsx";
import { PageShell, EmptyState, BTN_PRIMARY, BTN_GHOST, BTN_DANGER, CARD } from "../components/ui.tsx";
import type { User } from "../../types.ts";
import type { ReportJobSummary } from "../../lib/report-queue.ts";

/** datetime('now') SQLite tersimpan dalam UTC tanpa penanda zona. */
function formatWaktu(sqliteUtc: string): string {
  return new Date(`${sqliteUtc.replace(" ", "T")}Z`).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

const STATUS: Record<string, { label: string; icon: string; cls: string }> = {
  queued: {
    label: "Menunggu",
    icon: "schedule",
    cls: "bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark",
  },
  running: {
    label: "Diproses",
    icon: "autorenew",
    cls: "bg-primary/10 text-primary",
  },
  done: {
    label: "Selesai",
    icon: "check_circle",
    cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  },
  canceled: {
    label: "Dibatalkan",
    icon: "cancel",
    cls: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
  },
};

/** Halaman dimuat ulang berkala selama masih ada antrean berjalan, supaya progres terlihat. */
const autoRefreshScript = `
setTimeout(function () {
  if (document.visibilityState === 'visible') location.reload();
  else document.addEventListener('visibilitychange', function () { location.reload(); }, { once: true });
}, 5000);
`;

const JobCard: FC<{
  job: ReportJobSummary;
  failed: { student_name: string; error: string | null }[];
  showCreator: boolean;
}> = ({ job, failed, showCreator }) => {
  const status = STATUS[job.status] ?? STATUS.queued!;
  const active = job.status === "queued" || job.status === "running";
  const processed = job.done_count + job.failed_count;
  const percent = job.total > 0 ? Math.round((processed / job.total) * 100) : 0;

  let keterangan: string;
  if (job.status === "queued" && job.ahead > 0) {
    keterangan = `Menunggu giliran — ada ${job.ahead} laporan lain di depan.`;
  } else if (active) {
    keterangan = `${processed} dari ${job.total} laporan selesai diproses.`;
  } else if (job.status === "done") {
    keterangan =
      job.failed_count > 0
        ? `${job.done_count} berhasil, ${job.failed_count} gagal.`
        : `${job.done_count} laporan siap diunduh.`;
  } else {
    keterangan = `${job.done_count} laporan sempat selesai sebelum dibatalkan.`;
  }

  return (
    <div class="px-5 py-4">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="hanya-ikon size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined">{job.kind === "kelas" ? "folder_zip" : "person"}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-text-main dark:text-text-main-dark text-sm font-bold flex flex-wrap items-center gap-2">
            {job.label}
            <span
              class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${status.cls}`}
            >
              <span class="material-symbols-outlined text-[14px]">{status.icon}</span>
              {status.label}
            </span>
          </p>
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5">
            {job.week_number ? `Pekan ke-${job.week_number} • ` : ""}
            Diminta {formatWaktu(job.created_at)}
            {showCreator && job.creator_name ? ` oleh ${job.creator_name}` : ""}
          </p>
          <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-0.5">{keterangan}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          {job.done_count > 0 && (
            <a href={`/laporan/antrean/${job.id}/unduh`} class={BTN_PRIMARY} data-no-loader>
              <span class="material-symbols-outlined text-[20px]">download</span>
              {job.kind === "kelas" ? (active ? "Unduh yang sudah jadi" : "Unduh ZIP") : "Unduh PDF"}
            </a>
          )}
          {!active && job.failed_count > 0 && (
            <form method="POST" action={`/laporan/antrean/${job.id}/ulang`} data-loader-text="Memasukkan ulang ke antrean">
              <button type="submit" class={BTN_GHOST}>
                <span class="material-symbols-outlined text-[20px]">replay</span>
                Ulangi yang gagal
              </button>
            </form>
          )}
          {active && (
            <form
              method="POST"
              action={`/laporan/antrean/${job.id}/batal`}
              data-confirm={`Pembuatan laporan <b>${job.label}</b> akan dihentikan. Laporan yang sudah jadi tetap bisa diunduh.`}
              data-confirm-title="Batalkan antrean ini?"
              data-confirm-ok="Ya, batalkan"
              data-loader-text="Membatalkan"
            >
              <button type="submit" class={BTN_DANGER}>
                <span class="material-symbols-outlined text-[20px]">block</span>
                Batalkan
              </button>
            </form>
          )}
        </div>
      </div>

      {job.total > 1 && (active || processed < job.total) && (
        <div class="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div class="h-full bg-primary transition-all" style={`width: ${percent}%`} />
        </div>
      )}

      {failed.length > 0 && (
        <details class="mt-3">
          <summary class="text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer select-none">
            Lihat {failed.length} laporan yang gagal
          </summary>
          <ul class="mt-2 space-y-1 text-xs text-text-secondary dark:text-text-secondary-dark">
            {failed.map((f) => (
              <li>
                <b class="text-text-main dark:text-text-main-dark">{f.student_name}</b>: {f.error || "gagal"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export const ReportQueuePage: FC<{
  user: User;
  jobs: ReportJobSummary[];
  failedByJob: Record<number, { student_name: string; error: string | null }[]>;
  canvaReady: boolean;
}> = ({ user, jobs, failedByJob, canvaReady }) => {
  const isAdmin = user.role === "admin";
  const adaAktif = jobs.some((j) => j.status === "queued" || j.status === "running");

  return (
    <PageShell
      user={user}
      currentPath="/laporan/antrean"
      title="Antrean Laporan"
      heading="Antrean Laporan"
      subheading={
        "Laporan Pekanan dibuat lewat Canva satu siswa demi satu, urut siapa yang meminta lebih dulu. " +
        "Halaman boleh ditutup — proses tetap berjalan di server. Hasil disimpan 7 hari."
      }
      wide
    >
      {!canvaReady && (
        <div class="mb-6 flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm">
          <span class="material-symbols-outlined">warning</span>
          <div>
            <b>Antrean berhenti sementara.</b> Canva belum terhubung atau ID Brand Template belum
            diisi, jadi laporan belum bisa dibuat.{" "}
            {isAdmin ? (
              <a href="/administrasi/pengaturan/canva" class="underline font-bold">
                Atur di Pengaturan › Integrasi Canva
              </a>
            ) : (
              "Hubungi administrator."
            )}{" "}
            Antrean otomatis berlanjut setelah terhubung.
          </div>
        </div>
      )}

      <div class={CARD}>
        {jobs.length === 0 ? (
          <EmptyState
            icon="pending_actions"
            title="Belum ada laporan di antrean"
            description="Buat Laporan Pekanan dari halaman Input › Hafalan Qur'an, per siswa atau sekelas sekaligus."
          />
        ) : (
          <div class="divide-y divide-border-light dark:divide-border-light-dark">
            {jobs.map((job) => (
              <JobCard job={job} failed={failedByJob[job.id] ?? []} showCreator={isAdmin} />
            ))}
          </div>
        )}
      </div>

      {adaAktif && canvaReady && <script dangerouslySetInnerHTML={{ __html: autoRefreshScript }} />}
    </PageShell>
  );
};
