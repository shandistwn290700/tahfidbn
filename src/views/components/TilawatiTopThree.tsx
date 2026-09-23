import type { FC } from "hono/jsx";
import { StudentAvatar } from "./ui.tsx";
import type { RankedTilawatiStudent } from "../../types.ts";
import { TOTAL_JILID } from "../../data/tilawati-meta.ts";

const ClassTag: FC<{ name: string | null }> = ({ name }) => (
  <p class="text-text-secondary dark:text-text-secondary-dark text-xs">
    {name || "Belum berkelas"}
  </p>
);

const Trend: FC<{ value: number }> = ({ value }) => {
  if (value <= 0) return null;
  return (
    <span class="flex items-center gap-1 text-primary">
      <span class="material-symbols-outlined text-sm">trending_up</span>+{value} halaman
    </span>
  );
};

const Card: FC<{
  member: RankedTilawatiStudent;
  rank: 1 | 2 | 3;
}> = ({ member, rank }) => {
  const style =
    rank === 1
      ? {
          order: "order-1 md:order-2",
          box: "border-2 border-primary/20 shadow-xl transform md:-translate-y-4",
          badge: "bg-primary text-white",
          bar: "bg-primary h-3",
          avatar: "w-24 h-24 border-4 border-primary",
        }
      : rank === 2
        ? {
            order: "order-2 md:order-1",
            box: "border border-border-light dark:border-border-light-dark",
            badge:
              "bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark",
            bar: "bg-slate-400 dark:bg-slate-500 h-2.5",
            avatar: "w-20 h-20 border-2 border-slate-100 dark:border-slate-800",
          }
        : {
            order: "order-3",
            box: "border border-border-light dark:border-border-light-dark",
            badge:
              "bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark text-amber-700 dark:text-amber-500",
            bar: "bg-amber-600/70 dark:bg-amber-600/50 h-2.5",
            avatar: "w-20 h-20 border-2 border-amber-100 dark:border-amber-900/50",
          };

  return (
    <div
      class={`${style.order} relative flex flex-col bg-surface dark:bg-surface-dark rounded-xl p-6 hover:shadow-md transition-all duration-300 ${style.box}`}
    >
      <div
        class={`absolute ${rank === 1 ? "-top-5" : "-top-4"} left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm whitespace-nowrap ${style.badge}`}
      >
        <span class="material-symbols-outlined text-base">
          {rank === 1 ? "workspace_premium" : "emoji_events"}
        </span>
        Peringkat {rank}
      </div>
      <div class="flex flex-col items-center text-center gap-4 mt-3">
        <div class={`rounded-full p-1 ${style.avatar}`}>
          <StudentAvatar name={member.name} photoPath={member.photo_path} size="w-full h-full" textClass="text-lg font-bold" />
        </div>
        <div>
          <h3 class="text-text-main dark:text-text-main-dark text-lg font-bold">{member.name}</h3>
          <ClassTag name={member.class_name} />
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mt-1">
            {member.jilid_completed === TOTAL_JILID ? "Khatam • " : ""}
            {member.jilid_completed} jilid &bull; {member.total_pages} halaman
          </p>
        </div>
        <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
          <div
            class={`rounded-full ${style.bar}`}
            style={`width: ${Math.max(member.progress_percent, 1.5)}%`}
          />
        </div>
        <div class="flex items-center justify-between w-full text-xs font-semibold">
          <span class="text-primary">{member.progress_percent}% dari {TOTAL_JILID} jilid</span>
          <Trend value={member.trend} />
        </div>
      </div>
    </div>
  );
};

export const TilawatiTopThree: FC<{ topThree: RankedTilawatiStudent[] }> = ({ topThree }) => {
  if (topThree.length === 0) {
    return (
      <div class="w-full text-center py-12 mb-6 text-text-secondary dark:text-text-secondary-dark border border-dashed border-border-light dark:border-border-light-dark rounded-xl">
        <span class="material-symbols-outlined text-4xl mb-2 opacity-60">emoji_events</span>
        <p class="font-semibold text-text-main dark:text-text-main-dark">Podium masih kosong</p>
        <p class="text-sm mt-1">Peringkat akan muncul setelah ada bacaan Tilawati yang tercatat.</p>
      </div>
    );
  }

  const [first, second, third] = topThree;

  return (
    <div class="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
      {second ? <Card member={second} rank={2} /> : <div class="order-2 md:order-1" />}
      {first && <Card member={first} rank={1} />}
      {third ? <Card member={third} rank={3} /> : <div class="order-3" />}
    </div>
  );
};
