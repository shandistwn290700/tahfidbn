import { Database } from "bun:sqlite";
import { join } from "path";

// DB_PATH memungkinkan basis data dialihkan sementara lewat variabel
// lingkungan (mis. `DB_PATH=... bun run dev`) — berguna untuk menguji di atas
// salinan basis data tanpa menyunting berkas ini, yang lewat --hot bisa ikut
// memuat ulang proses dev lain yang kebetulan sedang berjalan.
export const dbPath = process.env.DB_PATH || join(import.meta.dir, "../../data/ngaji.db");

function openDatabase(): Database {
  const instance = new Database(dbPath, { create: true });
  instance.exec("PRAGMA journal_mode = WAL");
  instance.exec("PRAGMA foreign_keys = ON");
  return instance;
}

// `let`, bukan `const`: setelah pemulihan cadangan menimpa berkas di disk,
// reconnectDatabase() menutup koneksi lama dan menugaskan koneksi baru ke
// binding ini. Karena modul lain mengimpor `db` sebagai live binding ES
// module (bukan salinan nilai), seluruh `db.prepare(...)` di tempat lain
// otomatis memakai koneksi baru tanpa perlu me-restart proses aplikasi.
export let db = openDatabase();

/** Dipakai setelah berkas basis data ditimpa (mis. pemulihan cadangan). */
export function reconnectDatabase(): void {
  try {
    db.close();
  } catch {
    /* koneksi lama mungkin sudah tertutup atau rusak — boleh diabaikan */
  }
  db = openDatabase();
}
