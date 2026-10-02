import type { FC } from "hono/jsx";
import { PageShell, StatCard, CARD, EmptyState } from "../components/ui.tsx";
import { ColumnChart } from "../components/ColumnChart.tsx";
import {
  DASHBOARD_RANGES,
  type DashboardRange,
  type DashboardSummary,
  type SeriesPoint,
  type TeacherActivity,
  type TeacherStatus,
} from "../../lib/dashboard.ts";
import type { User } from "../../types.ts";

const fmt = (n: number) => n.toLocaleString("id-ID");

const PERIODE: Record<DashboardRange, string> = {
  harian: "hari",
  pekanan: "pekan",
  bulanan: "bulan",
  semester: "semester",
};

// Warna status dipakai khusus untuk status, selalu bersama ikon + teks.
const STATUS: Record<TeacherStatus, { label: string; icon: string; cls: string }> = {
  aktif: {
    label: "Aktif",
    icon: "check_circle",
    cls: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  },
  jarang: {
    label: "Jarang",
    icon: "schedule",
    cls: "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  },
  "tidak-aktif": {
    label: "Tidak aktif",
    icon: "do_not_disturb_on",
    cls: "bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark",
  },
};

/** "3 hari lalu" dari waktu UTC SQLite. */
function sejak(sqliteUtc: string, now: Date): string {
  const then = new Date(`${sqliteUtc.replace(" ", "T")}Z`);
  const menit = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 60_000));
  if (menit < 60) return menit <= 1 ? "baru saja" : `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return then.toLocaleDateString("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });
}

function perbandingan(sekarang: number, sebelumnya: number): string {
  if (sebelumnya === 0) return sekarang > 0 ? "pekan lalu 0 ayat" : "belum ada setoran";
  const persen = Math.round(((sekarang - sebelumnya) / sebelumnya) * 100);
  const arah = persen > 0 ? "▲" : persen < 0 ? "▼" : "=";
  return `${arah} ${Math.abs(persen)}% dari pekan lalu (${fmt(sebelumnya)})`;
}

export const DashboardPage: FC<{
  user: User;
  range: DashboardRange;
  series: SeriesPoint[];
  summary: DashboardSummary;
  teachers: TeacherActivity[];
  now: Date;
}> = ({ user, range, series, summary, teachers, now }) => {
  const periode = PERIODE[range];
  const rangeInfo = DASHBOARD_RANGES.find((r) => r.value === range)!;
  const totalAyat = series.reduce((sum, p) => sum + p.ayat, 0);
  const tertinggi = series.reduce((a, b) => (b.ayat > a.ayat ? b : a), series[0]!);
  const puncakGuru = Math.max(0, ...series.map((p) => p.guru));
  const adaData = totalAyat > 0 || puncakGuru > 0;

  return (
    <PageShell
      user={user}
      currentPath="/dashboard"
      title="Dashboard"
      heading="Dashboard"
      subheading="Perkembangan hafalan seluruh siswa dan keaktifan guru dalam menginput. Tanggal mengikuti WIB."
      wide
    >
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard
          icon="trending_up"
          label="Ayat pekan ini"
          value={fmt(summary.ayatPekanIni)}
          unit="ayat"
          hint={perbandingan(summary.ayatPekanIni, summary.ayatPekanLalu)}
        />
        <StatCard
          icon="calendar_month"
          label="Ayat bulan ini"
          value={fmt(summary.ayatBulanIni)}
          unit="ayat"
          hint={now.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
        />
        <StatCard
          icon="groups"
          label="Siswa setor"
          value={fmt(summary.siswaSetorPekanIni)}
          unit={`/ ${fmt(summary.totalSiswa)}`}
          hint="hafalannya bertambah pekan ini"
        />
        <StatCard
          icon="co_present"
          label="Guru aktif"
          value={fmt(summary.guruAktif)}
          unit={`/ ${fmt(summary.totalGuru)}`}
          hint="menginput dalam 7 hari terakhir"
        />
      </div>

      {/* Satu filter rentang di atas, berlaku untuk semua grafik & tabel di bawahnya */}
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
        <nav class="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 sm:w-auto" aria-label="Rentang waktu">
          {DASHBOARD_RANGES.map((r) => (
            <a
              href={`/dashboard?rentang=${r.value}`}
              aria-current={r.value === range ? "page" : undefined}
              class={`px-1 sm:px-4 py-2 rounded-lg text-center text-[13px] sm:text-sm font-semibold transition-colors ${
                r.value === range
                  ? "bg-surface dark:bg-surface-dark text-text-main dark:text-text-main-dark shadow-sm"
                  : "text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark"
              }`}
            >
              {r.label}
            </a>
          ))}
        </nav>
        <p class="text-sm text-text-secondary dark:text-text-secondary-dark">{rangeInfo.description}</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section class={`${CARD} p-4 sm:p-5`}>
          <h2 class="text-base font-bold text-text-main dark:text-text-main-dark">
            Tambahan ayat per {periode}
          </h2>
          <p class="text-xs sm:text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5 mb-8">
            Total {fmt(totalAyat)} ayat
            {tertinggi.ayat > 0 && ` · tertinggi ${fmt(tertinggi.ayat)} (${tertinggi.label})`}
          </p>
          <ColumnChart
            ariaLabel={`Tambahan ayat per ${periode}, ${rangeInfo.description}`}
            unit="ayat"
            points={series.map((p) => ({
              label: p.label,
              short: p.short,
              value: p.ayat,
              current: p.current,
              extra: p.siswa > 0 ? `dari ${fmt(p.siswa)} siswa` : "",
            }))}
          />
        </section>

        <section class={`${CARD} p-4 sm:p-5`}>
          <h2 class="text-base font-bold text-text-main dark:text-text-main-dark">
            Guru aktif per {periode}
          </h2>
          <p class="text-xs sm:text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5 mb-8">
            Guru yang menginput hafalan, dari {fmt(summary.totalGuru)} akun guru
          </p>
          <ColumnChart
            ariaLabel={`Guru aktif per ${periode}, ${rangeInfo.description}`}
            unit="guru"
            points={series.map((p) => ({ label: p.label, short: p.short, value: p.guru, current: p.current }))}
          />
        </section>
      </div>

      <p class="text-xs text-text-secondary dark:text-text-secondary-dark mb-3">
        Batang yang lebih pudar adalah {periode} berjalan. Ketuk batang untuk melihat angkanya.
        {!adaData && " Belum ada input hafalan pada rentang ini."}
      </p>

      {/* Tampilan tabel: semua angka grafik bisa dibaca tanpa tooltip */}
      <details class={`${CARD} mb-8 group`}>
        <summary class="flex items-center gap-2 px-4 sm:px-5 py-3 cursor-pointer select-none text-sm font-bold text-text-main dark:text-text-main-dark">
          <span class="material-symbols-outlined text-[20px] text-text-secondary">table_view</span>
          Lihat tabel angka
          <span class="material-symbols-outlined ml-auto text-text-secondary text-[20px] group-open:rotate-180 transition-transform">
            expand_more
          </span>
        </summary>
        <div class="overflow-x-auto border-t border-border-light dark:border-border-light-dark">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wider text-text-secondary dark:text-text-secondary-dark bg-slate-50/50 dark:bg-slate-800/50">
              <tr>
                <th class="px-4 sm:px-5 py-2.5 font-bold">Periode</th>
                <th class="px-3 py-2.5 font-bold text-right">Ayat</th>
                <th class="px-3 py-2.5 font-bold text-right">Siswa</th>
                <th class="px-4 sm:px-5 py-2.5 font-bold text-right">Guru aktif</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-light dark:divide-border-light-dark">
              {[...series].reverse().map((p) => (
                <tr class="text-text-main dark:text-text-main-dark">
                  <td class="px-4 sm:px-5 py-2 whitespace-nowrap">
                    {p.label}
                    {p.current && <span class="text-text-secondary dark:text-text-secondary-dark"> · berjalan</span>}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums">{fmt(p.ayat)}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{fmt(p.siswa)}</td>
                  <td class="px-4 sm:px-5 py-2 text-right tabular-nums">{fmt(p.guru)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <section class={`${CARD} overflow-hidden`}>
        <div class="px-4 sm:px-5 py-4 border-b border-border-light dark:border-border-light-dark">
          <h2 class="text-base font-bold text-text-main dark:text-text-main-dark">Keaktifan guru</h2>
          <p class="text-xs sm:text-sm text-text-secondary dark:text-text-secondary-dark mt-0.5">
            Aktif: menginput dalam 7 hari terakhir · Jarang: dalam 30 hari · Tidak aktif: lebih dari 30 hari
          </p>
        </div>
        {teachers.length === 0 ? (
          <EmptyState icon="person_off" title="Belum ada akun guru" description="Tambahkan guru di menu Administrasi › Pengguna." />
        ) : (
          <ul class="divide-y divide-border-light dark:divide-border-light-dark">
            {teachers.map((t) => {
              const s = STATUS[t.status];
              return (
                <li class="px-4 sm:px-5 py-3.5 flex items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-text-main dark:text-text-main-dark truncate">{t.name}</p>
                    <p class="text-xs text-text-secondary dark:text-text-secondary-dark truncate">
                      {t.classes ? `Mengampu ${t.classes}` : "Belum mengampu kelas"}
                    </p>
                    <p class="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                      {t.lastInput ? `Input terakhir ${sejak(t.lastInput, now)}` : "Belum pernah menginput"}
                      {t.inputs30 > 0 && ` · ${fmt(t.inputs30)} input, ${fmt(t.ayat30)} ayat dalam 30 hari`}
                    </p>
                  </div>
                  <span class={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${s.cls}`}>
                    <span class="material-symbols-outlined text-[16px]">{s.icon}</span>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  // Tooltip grafik: muncul saat batang disorot, difokus (keyboard), atau diketuk (HP).
  // Teks dimasukkan lewat textContent, bukan innerHTML.
  document.querySelectorAll('[data-chart]').forEach(function (chart) {
    var tip = chart.querySelector('[data-tooltip]');
    if (!tip) return;
    var v = tip.querySelector('[data-tip-v]');
    var l = tip.querySelector('[data-tip-l]');
    var x = tip.querySelector('[data-tip-x]');

    function tampil(col) {
      v.textContent = col.getAttribute('data-tip-value');
      l.textContent = col.getAttribute('data-tip-label');
      x.textContent = col.getAttribute('data-tip-extra') || '';
      x.classList.toggle('hidden', !x.textContent);
      tip.classList.remove('hidden');
      var c = chart.getBoundingClientRect();
      var r = col.getBoundingClientRect();
      var setengah = tip.offsetWidth / 2;
      var tengah = r.left + r.width / 2 - c.left;
      tip.style.left = Math.min(Math.max(tengah, setengah), c.width - setengah) + 'px';
      // Tepat di atas batang, tapi tidak keluar dari tepi atas grafik (menutupi judul)
      var batang = col.firstElementChild ? col.firstElementChild.getBoundingClientRect() : r;
      var atas = (col.firstElementChild ? batang.top : r.bottom) - c.top - 6;
      tip.style.top = Math.max(atas, tip.offsetHeight) + 'px';
    }
    function sembunyi() { tip.classList.add('hidden'); }

    chart.querySelectorAll('[data-tip-value]').forEach(function (col) {
      col.addEventListener('pointerenter', function () { tampil(col); });
      col.addEventListener('focus', function () { tampil(col); });
      col.addEventListener('click', function () { tampil(col); });
      col.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') sembunyi(); });
      col.addEventListener('blur', sembunyi);
    });
  });
})();
`,
        }}
      />
    </PageShell>
  );
};
