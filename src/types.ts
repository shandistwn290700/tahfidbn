export type UserRole = "admin" | "guru";

export interface User {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/** Bentuk user yang aman dialirkan ke view — tidak pernah membawa hash password. */
export type PublicUser = Omit<User, "password_hash">;

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface ClassRoom {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Kelas beserta angka ringkasan untuk halaman administrasi. */
export interface ClassRoomSummary extends ClassRoom {
  student_count: number;
  teacher_count: number;
  teacher_names: string;
}

export interface Student {
  id: number;
  nis: string | null;
  name: string;
  gender: "L" | "P" | null;
  class_id: number | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentWithClass extends Student {
  class_name: string | null;
}

/**
 * Jenis input yang bisa ditugaskan ke guru. Kini tinggal Tahfid — Tilawati sudah
 * dihapus — tetapi kolom `class_teachers.subject` dan parameternya dipertahankan
 * supaya jenis baru bisa ditambahkan lagi tanpa migrasi struktur.
 */
export type TeachingSubject = "tahfid";

export interface ClassTeacher {
  class_id: number;
  user_id: number;
  subject: TeachingSubject;
  created_at: string;
}

export interface ProgressEntry {
  id: number;
  student_id: number;
  surah_number: number;
  last_ayah: number;
  completed: number;
  created_at: string;
  updated_at: string;
}

export interface ProgressLog {
  id: number;
  student_id: number;
  recorded_by: number | null;
  surah_number: number;
  ayah_from: number;
  ayah_to: number;
  logged_at: string;
}

export interface ReadingBookmark {
  id: number;
  user_id: number;
  surah_number: number;
  ayah_number: number;
  created_at: string;
  updated_at: string;
}

/** Satu baris pada papan peringkat. */
export interface RankedStudent {
  id: number;
  name: string;
  nis: string | null;
  photo_path: string | null;
  class_id: number | null;
  class_name: string | null;
  rank: number;
  class_rank: number;
  total_memorized: number;
  juz_completed: number;
  progress_percent: number;
  current_surah: string;
  current_surah_number: number;
  current_ayah: number;
  current_juz: number;
  in_progress_surahs: {
    number: number;
    name: string;
    last_ayah: number;
    total_ayahs: number;
  }[];
  trend: number;
}

export type Env = {
  Variables: {
    user: User;
  };
};
