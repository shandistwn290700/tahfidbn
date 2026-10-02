import type { FC } from "hono/jsx";

export interface ColumnPoint {
  /** Label lengkap untuk tooltip, mis. "Rab, 1 Okt 2026". */
  label: string;
  /** Label ringkas sumbu X, mis. "1 Okt"; "\n" memecahnya menjadi dua baris. */
  short: string;
  value: number;
  /** Periode berjalan (belum selesai): batang dipudarkan & diberi keterangan. */
  current?: boolean;
  /** Keterangan tambahan di tooltip, mis. "dari 12 siswa". */
  extra?: string;
}

const fmt = (n: number) => n.toLocaleString("id-ID");

/** Langkah sumbu "rapi" (1, 2, 5 × 10ⁿ), minimal 1 karena nilainya bilangan bulat. */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow);
}

/**
 * Batas label sumbu X supaya tidak bertabrakan di layar HP 320 px; periode terbaru
 * selalu berlabel, sisanya lewat tooltip & tabel.
 */
const MAX_X_LABELS = 5;
const MAX_X_LABELS_TWO_LINE = 6;

/**
 * Grafik kolom satu seri, dirender di server dengan HTML/CSS (tanpa pustaka grafik
 * dari CDN) supaya tetap jalan tanpa internet dan di APK. Warna batang lolos uji
 * kontras ≥ 3:1: #059669 di permukaan terang, #12a87b di permukaan gelap.
 * Tooltip dipasang oleh skrip di DashboardPage lewat atribut data-tip-*.
 */
export const ColumnChart: FC<{ points: ColumnPoint[]; unit: string; ariaLabel: string }> = ({
  points,
  unit,
  ariaLabel,
}) => {
  const max = Math.max(0, ...points.map((p) => p.value));
  const step = niceStep(Math.max(max, 1) / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);

  // Label dua baris (semester) cukup sempit untuk ditampilkan semua.
  const twoLine = points.some((p) => p.short.includes("\n"));
  const every = Math.ceil(points.length / (twoLine ? MAX_X_LABELS_TWO_LINE : MAX_X_LABELS));
  const showLabel = (i: number) => (points.length - 1 - i) % every === 0;
  const pct = (v: number) => `${100 - (v / top) * 100}%`;

  return (
    <div class="relative" data-chart role="group" aria-label={ariaLabel}>
      <div class="flex">
        {/* Sumbu Y */}
        <div class="relative w-9 shrink-0 h-44 sm:h-52" aria-hidden="true">
          {ticks.map((t) => (
            <span
              class="absolute right-2 -translate-y-1/2 text-[10px] text-text-secondary dark:text-text-secondary-dark tabular-nums"
              style={`top: ${pct(t)}`}
            >
              {fmt(t)}
            </span>
          ))}
        </div>

        {/* Area plot */}
        <div class="relative flex-1 min-w-0 h-44 sm:h-52">
          {ticks.map((t) => (
            <div
              class={`absolute inset-x-0 border-t ${
                t === 0
                  ? "border-slate-300 dark:border-slate-600"
                  : "border-slate-100 dark:border-slate-700/60"
              }`}
              style={`top: ${pct(t)}`}
              aria-hidden="true"
            />
          ))}
          <div class="absolute inset-0 flex items-end gap-[2px]">
            {points.map((p) => (
              <div
                tabindex={0}
                role="img"
                aria-label={`${p.label}: ${fmt(p.value)} ${unit}${p.extra ? `, ${p.extra}` : ""}${p.current ? " (berjalan)" : ""}`}
                data-tip-value={`${fmt(p.value)} ${unit}`}
                data-tip-label={`${p.label}${p.current ? " · berjalan" : ""}`}
                data-tip-extra={p.extra || ""}
                class="group flex-1 min-w-0 h-full flex items-end justify-center cursor-default outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {p.value > 0 && (
                  <div
                    class={`w-full max-w-[24px] rounded-t-[4px] bg-[#059669] dark:bg-[#12a87b] transition-opacity group-hover:opacity-75 group-focus:opacity-75 ${
                      p.current ? "opacity-55" : ""
                    }`}
                    style={`height: max(2px, ${(p.value / top) * 100}%)`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sumbu X */}
      <div class="flex gap-[2px] ml-9 mt-1.5" aria-hidden="true">
        {points.map((p, i) => (
          <div class={`flex-1 min-w-0 relative ${twoLine ? "h-7" : "h-4"}`}>
            {showLabel(i) && (
              <span
                class={`absolute top-0 text-[10px] leading-tight text-text-secondary dark:text-text-secondary-dark whitespace-pre ${
                  i === points.length - 1
                    ? "right-0 text-right"
                    : i === 0
                      ? "left-0 text-left"
                      : "left-1/2 -translate-x-1/2 text-center"
                }`}
              >
                {p.short}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Tooltip: nilai di depan (tebal), label menyusul */}
      <div
        data-tooltip
        class="hidden absolute z-10 top-0 -translate-x-1/2 -translate-y-full pointer-events-none rounded-lg bg-slate-900 dark:bg-slate-700 text-white px-2.5 py-1.5 shadow-lg whitespace-nowrap"
      >
        <p data-tip-v class="text-sm font-bold tabular-nums" />
        <p data-tip-l class="text-[11px] text-slate-300" />
        <p data-tip-x class="text-[11px] text-slate-300" />
      </div>
    </div>
  );
};
