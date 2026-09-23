import type { FC, Child } from "hono/jsx";
import { getSiteName, getFaviconUrl, getFaviconMimeType } from "../lib/settings.ts";

const themeBootstrap = `
  if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
`;

/**
 * Gaya loader ditulis sebagai CSS biasa, bukan kelas Tailwind, supaya tetap
 * tampil benar walau berkas Tailwind dari CDN gagal dimuat.
 */
const loaderStyles = `
  #page-loader {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(248, 250, 249, 0.82);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    opacity: 0;
    visibility: hidden;
    transition: opacity 220ms ease, visibility 220ms ease;
  }
  html.dark #page-loader { background: rgba(15, 23, 42, 0.85); }
  #page-loader.is-visible { opacity: 1; visibility: visible; }

  .loader-shell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.1rem;
    transform: translateY(8px) scale(0.96);
    opacity: 0;
    transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease;
  }
  #page-loader.is-visible .loader-shell { transform: translateY(0) scale(1); opacity: 1; }

  .loader-orbit {
    position: relative;
    width: 62px;
    height: 62px;
  }
  .loader-orbit span {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    border: 3px solid transparent;
    animation: loader-spin 1.15s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
  }
  .loader-orbit span:nth-child(1) { border-top-color: #10b981; }
  .loader-orbit span:nth-child(2) {
    inset: 9px;
    border-bottom-color: #34d399;
    animation-duration: 1.45s;
    animation-direction: reverse;
  }
  .loader-orbit span:nth-child(3) {
    inset: 18px;
    border-left-color: #6ee7b7;
    animation-duration: 1.75s;
  }
  .loader-core {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 11px;
    height: 11px;
    margin: -5.5px 0 0 -5.5px;
    border-radius: 9999px;
    background: #10b981;
    animation: loader-pulse 1.15s ease-in-out infinite;
  }

  .loader-text {
    font-family: 'Lexend', system-ui, sans-serif;
    font-size: 0.83rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #64748b;
  }
  html.dark .loader-text { color: #94a3b8; }
  .loader-text::after {
    content: '';
    animation: loader-dots 1.4s steps(4, end) infinite;
  }

  @keyframes loader-spin { to { transform: rotate(360deg); } }
  @keyframes loader-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.55); opacity: 0.45; }
  }
  @keyframes loader-dots {
    0% { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
  }

  @media (prefers-reduced-motion: reduce) {
    .loader-orbit span, .loader-core, .loader-text::after { animation: none; }
    .loader-shell, #page-loader { transition: none; }
  }

  .swal2-popup { font-family: 'Lexend', system-ui, sans-serif; border-radius: 0.9rem; }
  .swal2-title { font-size: 1.22rem; font-weight: 700; }
  .swal2-html-container { font-size: 0.94rem; }
  .swal2-toast { font-family: 'Lexend', system-ui, sans-serif; }
`;

/**
 * Satu skrip untuk tiga hal: loader perpindahan halaman, notifikasi hasil
 * proses CRUD, dan dialog konfirmasi sebelum aksi yang menghapus data.
 */
const uxScript = `
(function () {
  // Bila font ikon gagal dimuat (umumnya karena internet mati), nama ikon
  // akan tampil sebagai tulisan mentah. Tandai <html> agar ikon disembunyikan.
  /**
   * Font ikon mengubah tulisan "check_circle" menjadi satu glif lewat ligatur,
   * sehingga jauh lebih sempit daripada teks biasa. Lebar itulah yang diukur:
   * cara ini bekerja baik ketika berkas fontnya gagal diunduh maupun ketika
   * lembar gaya Google Fonts sendiri tidak pernah sampai.
   */
  function ikonTersedia() {
    if (!document.body) return true;

    var uji = document.createElement('span');
    uji.textContent = 'check_circle';
    uji.setAttribute('aria-hidden', 'true');
    uji.style.cssText =
      'position:absolute;left:-9999px;top:-9999px;font-size:48px;white-space:nowrap;' +
      'line-height:1;letter-spacing:normal;';

    document.body.appendChild(uji);
    uji.style.fontFamily = 'monospace';
    var lebarTeks = uji.offsetWidth;
    uji.style.fontFamily = '"Material Symbols Outlined", monospace';
    var lebarIkon = uji.offsetWidth;
    document.body.removeChild(uji);

    if (!lebarTeks) return true;
    return lebarIkon < lebarTeks * 0.5;
  }

  function periksaFontIkon() {
    try {
      document.documentElement.classList.toggle('tanpa-ikon', !ikonTersedia());
    } catch (err) { /* abaikan */ }
  }

  periksaFontIkon();

  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(periksaFontIkon);
    }
  } catch (err) { /* abaikan */ }

  window.addEventListener('load', periksaFontIkon);
  setTimeout(periksaFontIkon, 2000);

  // Daftarkan service worker untuk mode PWA (Add to Home Screen). Cuma
  // berjaga saat aplikasi diakses lewat WiFi yang salah — lihat public/sw.js.
  try {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {
          /* abaikan — aplikasi tetap berjalan normal tanpa PWA */
        });
      });
    }
  } catch (err) { /* abaikan */ }

  var loader = document.getElementById('page-loader');
  var showTimer = null;

  function showLoader(message) {
    if (!loader) return;
    if (message) {
      var label = loader.querySelector('.loader-text');
      if (label) label.textContent = message;
    }
    clearTimeout(showTimer);
    // Ditunda sesaat supaya halaman yang terbuka instan tidak berkedip.
    showTimer = setTimeout(function () { loader.classList.add('is-visible'); }, 140);
  }

  function hideLoader() {
    clearTimeout(showTimer);
    if (loader) loader.classList.remove('is-visible');
  }

  window.tampilkanLoader = showLoader;
  window.sembunyikanLoader = hideLoader;

  // Kembali dari tombol back / bfcache: pastikan loader tidak tertinggal menyala.
  window.addEventListener('pageshow', hideLoader);
  window.addEventListener('pagehide', hideLoader);

  document.addEventListener('click', function (e) {
    var tabBtn = e.target.closest ? e.target.closest('[data-tab-btn]') : null;
    if (tabBtn) {
      var grup = tabBtn.closest('[data-tab-group]');
      if (!grup) return;
      var target = tabBtn.getAttribute('data-tab-btn');

      grup.querySelectorAll('[data-tab-btn]').forEach(function (tombol) {
        var aktif = tombol.getAttribute('data-tab-btn') === target;
        tombol.classList.toggle('border-primary', aktif);
        tombol.classList.toggle('text-primary', aktif);
        tombol.classList.toggle('border-transparent', !aktif);
        tombol.classList.toggle('text-text-secondary', !aktif);
        tombol.classList.toggle('dark:text-text-secondary-dark', !aktif);
      });

      grup.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
        panel.classList.toggle('hidden', panel.getAttribute('data-tab-panel') !== target);
      });
    }
  });

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var link = e.target.closest ? e.target.closest('a') : null;
    if (!link) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download') || link.dataset.noLoader !== undefined) return;
    if (link.hasAttribute('data-fetch-download')) return;

    var href = link.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;

    var url;
    try { url = new URL(link.href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash && url.search === window.location.search) return;

    showLoader(link.dataset.loaderText || 'Memuat halaman');
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.dataset.noLoader !== undefined) return;
    if (form.dataset.confirm !== undefined && !form.dataset.confirmed) return;
    showLoader(form.dataset.loaderText || 'Menyimpan data');
  });

  // Tautan unduhan yang prosesnya lama (mis. laporan via Canva) tidak memicu
  // navigasi halaman biasa (respons Content-Disposition: attachment tidak
  // pernah memunculkan event 'pageshow'/'pagehide'), jadi loader lewat klik
  // tautan biasa tidak akan pernah tertutup. Di sini prosesnya diambil lewat
  // fetch() supaya loader bisa ditutup persis saat berkasnya benar-benar siap.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var link = e.target.closest ? e.target.closest('[data-fetch-download]') : null;
    if (!link) return;

    e.preventDefault();
    var url = link.getAttribute('href');
    if (!url) return;

    showLoader(link.dataset.loaderText || 'Memproses');

    fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (text) {
            throw new Error(text || ('Gagal memproses (status ' + res.status + ').'));
          });
        }
        var disposition = res.headers.get('Content-Disposition') || '';
        var match = disposition.match(/filename="?([^";]+)"?/);
        var filename = match ? match[1] : 'unduhan';
        return res.blob().then(function (blob) {
          return { blob: blob, filename: filename };
        });
      })
      .then(function (result) {
        var blobUrl = URL.createObjectURL(result.blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 4000);
      })
      .catch(function (err) {
        siapSwal(function () {
          var pesan = (err && err.message) || 'Gagal memproses permintaan.';
          if (window.Swal) {
            window.Swal.fire({ icon: 'error', title: 'Gagal', text: pesan });
          } else {
            window.alert(pesan);
          }
        });
      })
      .finally(function () {
        hideLoader();
      });
  });

  function siapSwal(callback) {
    if (window.Swal) { callback(); return; }
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (window.Swal) { clearInterval(poll); callback(); }
      else if (tries > 40) { clearInterval(poll); }
    }, 100);
  }

  // Konfirmasi untuk aksi yang tidak bisa dibatalkan.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.dataset.confirm === undefined || form.dataset.confirmed) return;

    e.preventDefault();

    siapSwal(function () {
      // Cadangan terakhir bila SweetAlert benar-benar tidak tersedia:
      // pakai dialog bawaan peramban, jangan pernah langsung mengirim.
      if (!window.Swal) {
        var teks = (form.dataset.confirm || 'Lanjutkan tindakan ini?').replace(/<[^>]*>/g, '');
        if (window.confirm(teks)) {
          form.dataset.confirmed = '1';
          showLoader(form.dataset.loaderText || 'Memproses');
          form.submit();
        }
        return;
      }

      window.Swal.fire({
        title: form.dataset.confirmTitle || 'Yakin?',
        html: form.dataset.confirm || 'Tindakan ini tidak dapat dibatalkan.',
        icon: form.dataset.confirmIcon || 'warning',
        showCancelButton: true,
        confirmButtonText: form.dataset.confirmOk || 'Ya, lanjutkan',
        cancelButtonText: 'Batal',
        confirmButtonColor: form.dataset.confirmIcon === 'question' ? '#10b981' : '#e11d48',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        focusCancel: true
      }).then(function (hasil) {
        if (hasil.isConfirmed) {
          form.dataset.confirmed = '1';
          showLoader(form.dataset.loaderText || 'Memproses');
          form.submit();
        }
      });
    });
  });

  // Notifikasi hasil proses, dibaca dari query string lalu dibersihkan
  // supaya tidak muncul lagi saat halaman disegarkan.
  var params = new URLSearchParams(window.location.search);
  var sukses = params.get('success');
  var gagal = params.get('error');

  if (sukses || gagal) {
    siapSwal(function () {
      if (!window.Swal) return;
      window.Swal.fire({
        toast: true,
        position: 'top-end',
        icon: sukses ? 'success' : 'error',
        title: sukses || gagal,
        showConfirmButton: false,
        timer: sukses ? 3200 : 5000,
        timerProgressBar: true,
        didOpen: function (el) {
          el.addEventListener('mouseenter', window.Swal.stopTimer);
          el.addEventListener('mouseleave', window.Swal.resumeTimer);
        }
      });
    });

    params.delete('success');
    params.delete('error');
    var sisa = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (sisa ? '?' + sisa : ''));
  }
})();
`;

export const Layout: FC<{ title?: string; children: Child }> = ({ title, children }) => {
  return (
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
        <title>{title || getSiteName()}</title>
        <link rel="icon" type={getFaviconMimeType()} href={getFaviconUrl()} />
        {/*
          Berkas PWA — memungkinkan aplikasi "dipasang" ke layar utama HP
          (Android maupun iPhone) lewat Add to Home Screen, tanpa APK/IPA.
          apple-touch-icon wajib berkas gambar biasa (bukan data: URI), beda
          dari favicon di atas yang boleh data: URI hasil unggahan admin.
        */}
        <link rel="manifest" href="/static/manifest.json" />
        <link rel="apple-touch-icon" href="/static/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#10b981" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Tahfid" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/*
          Tailwind dan SweetAlert2 dilayani dari server ini sendiri, bukan dari
          CDN. Aplikasi berjalan di jaringan lokal sekolah, jadi tampilan dan
          dialog konfirmasi harus tetap utuh meskipun internet sedang mati.
        */}
        <link rel="stylesheet" href="/static/app.css" />
        <link rel="stylesheet" href="/static/sweetalert2.min.css" />
        <script src="/static/sweetalert2.min.js" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <style dangerouslySetInnerHTML={{ __html: loaderStyles }} />
      </head>
      <body class="min-h-screen flex flex-col">
        <div id="page-loader" role="status" aria-live="polite" aria-label="Sedang memuat">
          <div class="loader-shell">
            <div class="loader-orbit">
              <span />
              <span />
              <span />
              <div class="loader-core" />
            </div>
            <p class="loader-text">Memuat halaman</p>
          </div>
        </div>
        {children}
        <footer class="py-4 px-6 text-center text-xs text-text-secondary dark:text-text-secondary-dark">
          {getSiteName()} — Dikembangkan oleh Shandi Sutiawan
        </footer>
        <script dangerouslySetInnerHTML={{ __html: uxScript }} />
      </body>
    </html>
  );
};
