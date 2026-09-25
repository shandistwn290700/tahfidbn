# Dipakai oleh Railway (dan platform sejenis yang mendukung Dockerfile) untuk
# menjalankan aplikasi ini sebagai proses yang menyala terus-menerus — beda
# dari Vercel yang serverless dan tidak cocok untuk basis data SQLite berkas.
FROM oven/bun:1

WORKDIR /app

# Pasang dependensi dulu secara terpisah supaya lapisan ini bisa dipakai lagi
# dari cache selama package.json/bun.lock tidak berubah.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

# Data Al-Qur'an (data/quran/) disimpan cadangannya di lokasi terpisah, supaya
# bisa dipulihkan otomatis kalau Volume Railway yang di-mount di /app/data
# ternyata kosong (Volume baru menimpa isi folder itu dari image).
RUN cp -r data/quran /app/quran-seed

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "mkdir -p data && if [ -z \"$(ls -A data/quran 2>/dev/null)\" ]; then cp -r /app/quran-seed data/quran; fi && bun run start"]
