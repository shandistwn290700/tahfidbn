import type { FC } from "hono/jsx";
import { StudentAvatar } from "./ui.tsx";
import type { RecapStudent } from "../../types.ts";

const ClassTag: FC<{ name: string | null }> = ({ name }) => (
  <p class="text-text-secondary dark:text-text-secondary-dark text-xs">
    {name || "Belum berkelas"}
  </p>
);

const Card: FC<{ member: RecapStudent; rank: 1 | 2 | 3 }> = ({ member, rank }) => {
  const style =
    rank === 1
      ? {
          order: "order-1 md:order-2",
          box: "border-2 border-primary/20 shadow-xl transform md:-translate-y-4",
          badge: "bg-primary text-white",
          avatar: "w-24 h-24 border-4 border-primary",
        }
      : rank === 2
        ? {
            order: "order-2 md:order-1",
            box: "border border-border-light dark:border-border-light-dark",
            badge:
              "bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark",
            avatar: "w-20 h-20 border-2 border-slate-100 dark:border-slate-800",
          }
        : {
            order: "order-3",
            box: "border border-border-light dark:border-border-light-dark",
            badge:
              "bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark text-amber-700 dark:text-amber-500",
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
        </div>
        <div class="w-full flex items-center justify-center gap-4 text-xs text-text-secondary dark:text-text-secondary-dark">
          <span>Tahfid {member.tahfid_percent}%</span>
          <span>&bull;</span>
          <span>Tilawati {member.tilawati_percent}%</span>
        </div>
        <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
          <div
            class="bg-primary h-3 rounded-full"
            style={`width: ${Math.max(member.recap_percent, 1.5)}%`}
          />
        </div>
        <p class="text-primary text-sm font-black">{member.recap_percent}% rekapitulasi</p>
      </div>
    </div>
  );
};

export const RecapTopThree: FC<{ topThree: RecapStudent[] }> = ({ topThree }) => {
  if (topThree.length === 0) {
    return (
      <div class="w-full text-center py-12 mb-6 text-text-secondary dark:text-text-secondary-dark border border-dashed border-border-light dark:border-border-light-dark rounded-xl">
        <span class="material-symbols-outlined text-4xl mb-2 opacity-60">emoji_events</span>
        <p class="font-semibold text-text-main dark:text-text-main-dark">Podium masih kosong</p>
        <p class="text-sm mt-1">
          Peringkat akan muncul setelah ada catatan Tahfid atau Tilawati.
        </p>
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
