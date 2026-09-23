import type { FC } from "hono/jsx";
import { PageShell, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, CARD } from "../components/ui.tsx";
import { SettingsTabs } from "../components/SettingsTabs.tsx";
import type { ReportContact } from "../../lib/settings.ts";
import type { User } from "../../types.ts";

function pekanKeBerapa(semesterStart: string | null): string {
  if (!semesterStart) return "Belum diatur";

  const start = new Date(`${semesterStart}T00:00:00`);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Tanggal mulai masih di masa depan";

  return `Pekan ke-${Math.floor(diffDays / 7) + 1}`;
}

function formatTanggal(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const ReportSettingsPage: FC<{
  user: User;
  reportLogo: string | null;
  reportSchoolName: string;
  contact: ReportContact;
  semesterStart: string | null;
  semesterEnd: string | null;
  semesterMidpoint: string | null;
}> = ({ user, reportLogo, reportSchoolName, contact, semesterStart, semesterEnd, semesterMidpoint }) => {
  const currentPath = "/administrasi/pengaturan/laporan";

  return (
    <PageShell
      user={user}
      currentPath={currentPath}
      title="Pengaturan Laporan"
      heading="Pengaturan"
      subheading="Atur tampilan Laporan Pekanan yang diunduh guru dari halaman Hafalan Qur'an."
      actions={
        <a
          href="/administrasi/pengaturan/laporan/pratinjau"
          target="_blank"
          rel="noopener"
          class={BTN_GHOST}
          data-no-loader
        >
          <span class="material-symbols-outlined text-[20px]">visibility</span>
          Pratinjau Contoh Laporan
        </a>
      }
    >
      <SettingsTabs currentPath={currentPath} />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo laporan */}
        <div class={`${CARD} p-6`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">image</span>
            Logo Laporan
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            Logo yang tampil di bagian atas Laporan Pekanan (PDF). Format PNG atau JPEG, maksimal
            2MB — beda dari favicon, supaya hasil cetaknya tetap tajam.
          </p>

          <div class="flex items-center gap-4 mb-5">
            <div class="size-14 rounded-lg border border-border-light dark:border-border-light-dark bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden shrink-0">
              {reportLogo ? (
                <img src={reportLogo} alt="Logo laporan saat ini" class="w-full h-full object-contain" />
              ) : (
                <span class="material-symbols-outlined text-text-secondary">image</span>
              )}
            </div>
            <div class="text-sm text-text-secondary dark:text-text-secondary-dark">
              {reportLogo ? "Logo kustom sedang dipakai." : "Belum ada logo — laporan akan tampil tanpa logo."}
            </div>
          </div>

          <form
            method="POST"
            action="/administrasi/pengaturan/laporan/logo"
            enctype="multipart/form-data"
            data-loader-text="Mengunggah logo laporan"
          >
            <label class={LABEL} for="report-logo-file">
              Unggah Logo Baru
            </label>
            <input
              id="report-logo-file"
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              class={`${INPUT} file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer`}
              required
            />
            <div class="mt-5">
              <button type="submit" class={BTN_PRIMARY}>
                <span class="material-symbols-outlined text-[20px]">upload</span>
                Unggah &amp; Simpan
              </button>
            </div>
          </form>

          {reportLogo && (
            <form
              method="POST"
              action="/administrasi/pengaturan/laporan/logo/reset"
              class="mt-4 pt-4 border-t border-border-light dark:border-border-light-dark"
              data-confirm="Logo pada Laporan Pekanan akan dihapus."
              data-confirm-title="Hapus logo laporan?"
              data-confirm-icon="question"
              data-confirm-ok="Ya, hapus"
              data-loader-text="Menghapus logo laporan"
            >
              <button type="submit" class={BTN_GHOST}>
                <span class="material-symbols-outlined text-[20px]">delete</span>
                Hapus Logo
              </button>
            </form>
          )}
        </div>

        {/* Identitas & kontak */}
        <div class={`${CARD} p-6`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">contact_page</span>
            Identitas &amp; Kontak
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            Tampil di bagian judul dan footer Laporan Pekanan. Kosongkan kontak yang tidak
            dipakai — baris itu tidak akan ditampilkan.
          </p>
          <form
            method="POST"
            action="/administrasi/pengaturan/laporan/identitas"
            data-loader-text="Menyimpan identitas laporan"
            class="space-y-4"
          >
            <div>
              <label class={LABEL} for="report-school-name">
                Nama Sekolah pada Laporan
              </label>
              <input
                id="report-school-name"
                name="report_school_name"
                class={INPUT}
                value={reportSchoolName}
                maxlength={80}
                placeholder="SDIT Bahtera Nuh"
              />
            </div>
            <div>
              <label class={LABEL} for="report-website">
                Website
              </label>
              <input
                id="report-website"
                name="website"
                class={INPUT}
                value={contact.website}
                placeholder="www.contoh-sekolah.sch.id"
              />
            </div>
            <div>
              <label class={LABEL} for="report-whatsapp">
                Nomor WhatsApp
              </label>
              <input
                id="report-whatsapp"
                name="whatsapp"
                class={INPUT}
                value={contact.whatsapp}
                placeholder="0811 1147 706"
              />
            </div>
            <div>
              <label class={LABEL} for="report-instagram">
                Instagram <span class="normal-case font-normal">(tanpa @)</span>
              </label>
              <input
                id="report-instagram"
                name="instagram"
                class={INPUT}
                value={contact.instagram}
                placeholder="namasekolah"
              />
            </div>
            <div>
              <label class={LABEL} for="report-tiktok">
                TikTok <span class="normal-case font-normal">(tanpa @)</span>
              </label>
              <input
                id="report-tiktok"
                name="tiktok"
                class={INPUT}
                value={contact.tiktok}
                placeholder="namasekolah"
              />
            </div>
            <div class="mt-5">
              <button type="submit" class={BTN_PRIMARY}>
                <span class="material-symbols-outlined text-[20px]">save</span>
                Simpan
              </button>
            </div>
          </form>
        </div>

        {/* Tanggal mulai & selesai semester */}
        <div class={`${CARD} p-6 lg:col-span-2`}>
          <h2 class="text-text-main dark:text-text-main-dark text-lg font-bold mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">event</span>
            Tanggal Semester
          </h2>
          <p class="text-text-secondary dark:text-text-secondary-dark text-sm mb-5">
            Dasar penghitungan "Laporan Pekanan ke-N", serta cakupan tanggal Laporan Tengah
            Semester dan Laporan Semester. Atur ulang setiap awal semester/tahun ajaran baru.
          </p>

          <div class="flex flex-wrap gap-2 mb-5">
            <span class="px-4 py-3 rounded-lg bg-primary/10 text-primary text-sm font-bold inline-block">
              {pekanKeBerapa(semesterStart)}
            </span>
            {semesterMidpoint && (
              <span class="px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-secondary-dark text-sm font-semibold inline-block">
                Tengah semester: {formatTanggal(semesterMidpoint)}
              </span>
            )}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div class="flex flex-col sm:flex-row items-end gap-4">
                <form
                  method="POST"
                  action="/administrasi/pengaturan/laporan/semester"
                  data-loader-text="Menyimpan tanggal mulai semester"
                  class="flex flex-col sm:flex-row items-end gap-4 flex-1"
                >
                  <div class="flex-1">
                    <label class={LABEL} for="semester-start">
                      Tanggal Mulai
                    </label>
                    <input
                      id="semester-start"
                      name="semester_start"
                      type="date"
                      class={INPUT}
                      value={semesterStart || ""}
                      required
                    />
                  </div>
                  <button type="submit" class={BTN_PRIMARY}>
                    <span class="material-symbols-outlined text-[20px]">save</span>
                    Simpan
                  </button>
                </form>
                {semesterStart && (
                  <form
                    method="POST"
                    action="/administrasi/pengaturan/laporan/semester/reset"
                    data-confirm="Tanggal mulai semester akan dihapus. Laporan Pekanan tidak akan menampilkan nomor pekan sampai diatur ulang."
                    data-confirm-title="Hapus tanggal mulai semester?"
                    data-confirm-icon="question"
                    data-confirm-ok="Ya, hapus"
                    data-loader-text="Menghapus tanggal mulai semester"
                  >
                    <button type="submit" class={BTN_GHOST}>
                      <span class="material-symbols-outlined text-[20px]">restart_alt</span>
                      Hapus
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div>
              <div class="flex flex-col sm:flex-row items-end gap-4">
                <form
                  method="POST"
                  action="/administrasi/pengaturan/laporan/semester-selesai"
                  data-loader-text="Menyimpan tanggal selesai semester"
                  class="flex flex-col sm:flex-row items-end gap-4 flex-1"
                >
                  <div class="flex-1">
                    <label class={LABEL} for="semester-end">
                      Tanggal Selesai
                    </label>
                    <input
                      id="semester-end"
                      name="semester_end"
                      type="date"
                      class={INPUT}
                      value={semesterEnd || ""}
                      required
                    />
                  </div>
                  <button type="submit" class={BTN_PRIMARY}>
                    <span class="material-symbols-outlined text-[20px]">save</span>
                    Simpan
                  </button>
                </form>
                {semesterEnd && (
                  <form
                    method="POST"
                    action="/administrasi/pengaturan/laporan/semester-selesai/reset"
                    data-confirm="Tanggal selesai semester akan dihapus. Laporan Tengah Semester dan Laporan Semester tidak akan bisa dibuat sampai diatur ulang."
                    data-confirm-title="Hapus tanggal selesai semester?"
                    data-confirm-icon="question"
                    data-confirm-ok="Ya, hapus"
                    data-loader-text="Menghapus tanggal selesai semester"
                  >
                    <button type="submit" class={BTN_GHOST}>
                      <span class="material-symbols-outlined text-[20px]">restart_alt</span>
                      Hapus
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {!semesterMidpoint && (
            <p class="text-text-secondary dark:text-text-secondary-dark text-xs mt-4">
              Isi kedua tanggal (mulai dan selesai) supaya Laporan Tengah Semester dan Laporan
              Semester bisa dibuat.
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
};
