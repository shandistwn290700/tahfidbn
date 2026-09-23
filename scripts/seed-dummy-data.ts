/**
 * Mengisi basis data dengan contoh kelas, guru, siswa, hafalan Tahfid, dan
 * capaian Tilawati. Jalankan dengan: bun run scripts/seed-dummy-data.ts
 *
 * Aman dijalankan berulang: data contoh dikenali dari namanya dan
 * diperbarui, bukan digandakan.
 */
import { db } from "../src/db/connection.ts";
import { initializeDatabase } from "../src/db/schema.ts";
import { hashPassword } from "../src/lib/session.ts";

initializeDatabase();

const KELAS = [
  { name: "6A", description: "Kelas putra, gedung utara" },
  { name: "6B", description: "Kelas putri, gedung utara" },
  { name: "5A", description: "Kelas putra, gedung selatan" },
];

// kelasTahfid dan kelasTilawati sengaja bisa berbeda — mencontohkan guru yang
// hanya mengampu salah satu jenis pada kelas tertentu.
const GURU = [
  { username: "fatahilah", name: "Ust. Fatahilah", kelasTahfid: ["6A", "6B"], kelasTilawati: ["6A", "6B"] },
  { username: "syifa", name: "Usth. Syifa Nuraini", kelasTahfid: ["5A"], kelasTilawati: ["5A"] },
  { username: "hasan", name: "Ust. Hasan Basri", kelasTahfid: [], kelasTilawati: ["6A", "6B", "5A"] },
];

const SISWA: {
  name: string;
  kelas: string;
  hafalan: [number, number][];
  tilawati: [number, number][];
}[] = [
  // Hafalan dimulai dari surah pertama tiap juz lalu maju ke surah
  // berikutnya — untuk juz 30, urutannya An-Naba(78) -> An-Nas(114).
  // tilawati: [nomor jilid, halaman terakhir dibaca].
  { name: "Ahmad Fauzan", kelas: "6A", hafalan: [[78, 40], [79, 46], [80, 42], [81, 29], [82, 10]], tilawati: [[1, 40], [2, 44], [3, 20]] },
  { name: "Muhammad Rizki", kelas: "6A", hafalan: [[78, 40], [79, 46], [80, 20]], tilawati: [[1, 40], [2, 15]] },
  { name: "Abdullah Hakim", kelas: "6A", hafalan: [[1, 7], [78, 15]], tilawati: [[1, 25]] },
  { name: "Umar Faruq", kelas: "6A", hafalan: [], tilawati: [] },
  { name: "Siti Aisyah", kelas: "6B", hafalan: [[1, 7], [2, 45], [78, 40], [79, 46], [80, 10]], tilawati: [[1, 40], [2, 44], [3, 44], [4, 10]] },
  { name: "Fatimah Azzahra", kelas: "6B", hafalan: [[1, 7], [2, 20], [78, 12]], tilawati: [[1, 40], [2, 30]] },
  { name: "Khadijah Salma", kelas: "6B", hafalan: [[78, 12]], tilawati: [[1, 12]] },
  { name: "Zaid Abdurrahman", kelas: "5A", hafalan: [[78, 40], [79, 46], [80, 5]], tilawati: [[1, 40], [2, 44]] },
  { name: "Bilal Ramadhan", kelas: "5A", hafalan: [[78, 15]], tilawati: [[1, 18]] },
  { name: "Hamzah Ali", kelas: "5A", hafalan: [], tilawati: [] },
];

const TOTAL_HALAMAN_JILID: Record<number, number> = {
  1: 40, 2: 44, 3: 44, 4: 44, 5: 44, 6: 31,
};

const TOTAL_AYAT: Record<number, number> = {
  1: 7, 2: 286, 78: 40, 79: 46, 80: 42, 81: 29, 82: 19,
};

const passwordHash = await hashPassword("password123");

for (const kelas of KELAS) {
  db.prepare(
    `INSERT INTO classes (name, description) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET description = excluded.description`
  ).run(kelas.name, kelas.description);
}

const classIdByName = new Map<string, number>();
for (const row of db.prepare("SELECT id, name FROM classes").all() as {
  id: number;
  name: string;
}[]) {
  classIdByName.set(row.name, row.id);
}

for (const guru of GURU) {
  db.prepare(
    `INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, 'guru')
     ON CONFLICT(username) DO UPDATE SET name = excluded.name`
  ).run(guru.username, passwordHash, guru.name);

  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(guru.username) as {
    id: number;
  };

  db.prepare("DELETE FROM class_teachers WHERE user_id = ?").run(user.id);
  for (const namaKelas of guru.kelasTahfid) {
    const classId = classIdByName.get(namaKelas);
    if (classId) {
      db.prepare(
        "INSERT OR IGNORE INTO class_teachers (class_id, user_id, subject) VALUES (?, ?, 'tahfid')"
      ).run(classId, user.id);
    }
  }
  for (const namaKelas of guru.kelasTilawati) {
    const classId = classIdByName.get(namaKelas);
    if (classId) {
      db.prepare(
        "INSERT OR IGNORE INTO class_teachers (class_id, user_id, subject) VALUES (?, ?, 'tilawati')"
      ).run(classId, user.id);
    }
  }
}

for (const siswa of SISWA) {
  const classId = classIdByName.get(siswa.kelas) ?? null;

  const existing = db.prepare("SELECT id FROM students WHERE name = ?").get(siswa.name) as
    | { id: number }
    | null;

  const studentId = existing
    ? (db.prepare("UPDATE students SET class_id = ? WHERE id = ?").run(classId, existing.id),
      existing.id)
    : Number(
        db
          .prepare("INSERT INTO students (name, class_id) VALUES (?, ?)")
          .run(siswa.name, classId).lastInsertRowid
      );

  for (const [surah, ayat] of siswa.hafalan) {
    const selesai = TOTAL_AYAT[surah] === ayat ? 1 : 0;
    db.prepare(
      `INSERT INTO progress_entries (student_id, surah_number, last_ayah, completed)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, surah_number)
       DO UPDATE SET last_ayah = excluded.last_ayah, completed = excluded.completed`
    ).run(studentId, surah, ayat, selesai);

    db.prepare(
      `INSERT INTO progress_log (student_id, recorded_by, surah_number, ayah_from, ayah_to)
       VALUES (?, NULL, ?, 0, ?)`
    ).run(studentId, surah, ayat);
  }

  for (const [jilid, halaman] of siswa.tilawati) {
    const selesai = TOTAL_HALAMAN_JILID[jilid] === halaman ? 1 : 0;
    db.prepare(
      `INSERT INTO tilawati_entries (student_id, jilid_number, last_page, completed)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, jilid_number)
       DO UPDATE SET last_page = excluded.last_page, completed = excluded.completed`
    ).run(studentId, jilid, halaman, selesai);

    db.prepare(
      `INSERT INTO tilawati_log (student_id, recorded_by, jilid_number, page_from, page_to)
       VALUES (?, NULL, ?, 0, ?)`
    ).run(studentId, jilid, halaman);
  }
}

console.log(
  `Data contoh selesai dibuat: ${KELAS.length} kelas, ${GURU.length} guru, ${SISWA.length} siswa ` +
    `(Tahfid & Tilawati).`
);
console.log('Password semua akun guru contoh: "password123".');
