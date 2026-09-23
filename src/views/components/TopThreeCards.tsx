import type { FC } from "hono/jsx";
import { StudentAvatar } from "./ui.tsx";
import type { RankedStudent } from "../../types.ts";

const ClassTag: FC<{ name: string | null }> = ({ name }) => (
  <p class="text-text-secondary dark:text-text-secondary-dark text-xs">
    {name || "Belum berkelas"}
  </p>
);

const Trend: FC<{ value: number }> = ({ value }) => {
  if (value <= 0) return null;
  return (
    <span class="flex items-center gap-1 text-primary">
      <span class="material-symbols-outlined text-sm">trending_up</span>+{value} ayat
    </span>
  );
};

const SecondPlace: FC<{ member: RankedStudent }> = ({ member }) => (
  <div class="order-2 md:order-1 relative flex flex-col bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl p-6 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
    <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm whitespace-nowrap">
      <span class="material-symbols-outlined text-base text-slate-400 dark:text-slate-500">
        emoji_events
      </span>
      Peringkat 2
    </div>
    <div class="flex flex-col items-center text-center gap-4 mt-3">
      <div class="w-20 h-20 rounded-full p-1 border-2 border-slate-100 dark:border-slate-800">
        <StudentAvatar name={member.name} photoPath={member.photo_path} size="w-full h-full" textClass="text-lg font-bold" />
      </div>
      <div>
        <h3 class="text-text-main dark:text-text-main-dark text-lg font-bold">{member.name}</h3>
        <ClassTag name={member.class_name} />
        <p class="text-text-secondary dark:text-text-secondary-dark text-sm mt-1">
          {member.juz_completed} juz &bull; {member.total_memorized} ayat
        </p>
      </div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          class="bg-slate-400 dark:bg-slate-500 h-2.5 rounded-full"
          style={`width: ${Math.max(member.progress_percent, 1.5)}%`}
        />
      </div>
      <div class="flex items-center justify-between w-full text-xs text-text-secondary dark:text-text-secondary-dark font-medium">
        <span>{member.progress_percent}% dari 30 juz</span>
        <Trend value={member.trend} />
      </div>
    </div>
  </div>
);

const FirstPlace: FC<{ member: RankedStudent }> = ({ member }) => (
  <div class="order-1 md:order-2 relative flex flex-col bg-surface dark:bg-surface-dark border-2 border-primary/20 rounded-xl p-6 shadow-xl dark:shadow-none transform md:-translate-y-4 hover:shadow-2xl transition-all duration-300">
    <div class="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-white text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg whitespace-nowrap">
      <span class="material-symbols-outlined text-lg">workspace_premium</span> Peringkat 1
    </div>
    <div class="flex flex-col items-center text-center gap-5 mt-4">
      <div class="relative">
        <div class="w-24 h-24 rounded-full p-1 border-4 border-primary shadow-sm">
          <StudentAvatar name={member.name} photoPath={member.photo_path} size="w-full h-full" textClass="text-lg font-bold" />
        </div>
        <div class="hanya-ikon absolute -bottom-2 -right-2 bg-surface dark:bg-surface-dark rounded-full p-1.5 border border-primary shadow-sm">
          <span class="material-symbols-outlined text-orange-500 text-xl">
            local_fire_department
          </span>
        </div>
      </div>
      <div>
        <h3 class="text-text-main dark:text-text-main-dark text-xl font-bold">{member.name}</h3>
        <ClassTag name={member.class_name} />
        <p class="text-primary-dark dark:text-primary font-semibold text-sm mt-1">
          {member.juz_completed === 30 ? "Hafiz • " : ""}
          {member.juz_completed} juz &bull; {member.total_memorized} ayat
        </p>
      </div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-slate-700">
        <div
          class="bg-primary h-3 rounded-full relative overflow-hidden"
          style={`width: ${Math.max(member.progress_percent, 1.5)}%`}
        >
          {member.progress_percent >= 100 && (
            <div class="absolute top-0 left-0 bottom-0 right-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]" />
          )}
        </div>
      </div>
      <div class="flex items-center justify-between w-full text-xs font-semibold">
        <span class="text-primary">{member.progress_percent}% dari 30 juz</span>
        {member.juz_completed === 30 ? (
          <span class="text-text-secondary dark:text-text-secondary-dark">Khatam 30 Juz</span>
        ) : (
          <Trend value={member.trend} />
        )}
      </div>
    </div>
  </div>
);

const ThirdPlace: FC<{ member: RankedStudent }> = ({ member }) => (
  <div class="order-3 relative flex flex-col bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark rounded-xl p-6 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
    <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-surface dark:bg-surface-dark border border-border-light dark:border-border-light-dark text-text-secondary dark:text-text-secondary-dark text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm whitespace-nowrap">
      <span class="material-symbols-outlined text-base text-amber-700 dark:text-amber-500">
        emoji_events
      </span>
      Peringkat 3
    </div>
    <div class="flex flex-col items-center text-center gap-4 mt-3">
      <div class="w-20 h-20 rounded-full p-1 border-2 border-amber-100 dark:border-amber-900/50">
        <StudentAvatar name={member.name} photoPath={member.photo_path} size="w-full h-full" textClass="text-lg font-bold" />
      </div>
      <div>
        <h3 class="text-text-main dark:text-text-main-dark text-lg font-bold">{member.name}</h3>
        <ClassTag name={member.class_name} />
        <p class="text-text-secondary dark:text-text-secondary-dark text-sm mt-1">
          {member.juz_completed} juz &bull; {member.total_memorized} ayat
        </p>
      </div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          class="bg-amber-600/70 dark:bg-amber-600/50 h-2.5 rounded-full"
          style={`width: ${Math.max(member.progress_percent, 1.5)}%`}
        />
      </div>
      <div class="flex items-center justify-between w-full text-xs text-text-secondary dark:text-text-secondary-dark font-medium">
        <span>{member.progress_percent}% dari 30 juz</span>
        <Trend value={member.trend} />
      </div>
    </div>
  </div>
);

export const TopThreeCards: FC<{ topThree: RankedStudent[] }> = ({ topThree }) => {
  if (topThree.length === 0) {
    return (
      <div class="w-full text-center py-12 mb-6 text-text-secondary dark:text-text-secondary-dark border border-dashed border-border-light dark:border-border-light-dark rounded-xl">
        <span class="material-symbols-outlined text-4xl mb-2 opacity-60">emoji_events</span>
        <p class="font-semibold text-text-main dark:text-text-main-dark">
          Podium masih kosong
        </p>
        <p class="text-sm mt-1">
          Peringkat akan muncul setelah ada hafalan siswa yang tercatat.
        </p>
      </div>
    );
  }

  const [first, second, third] = topThree;

  return (
    <div class="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
      {second ? <SecondPlace member={second} /> : <div class="order-2 md:order-1" />}
      {first && <FirstPlace member={first} />}
      {third ? <ThirdPlace member={third} /> : <div class="order-3" />}
    </div>
  );
};
