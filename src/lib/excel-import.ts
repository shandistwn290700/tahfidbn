import * as XLSX from "xlsx";

export interface StudentImportRow {
  rowNumber: number;
  nis: string | null;
  name: string;
  className: string | null;
}

const NIS_HEADERS = ["nis", "no induk", "nomor induk"];
const NAME_HEADERS = ["nama lengkap", "nama", "nama siswa"];
const CLASS_HEADERS = ["kelas", "nama kelas", "kelas/rombel"];

function findColumnKey(row: Record<string, unknown>, candidates: string[]): string | undefined {
  return Object.keys(row).find((key) => candidates.includes(key.trim().toLowerCase()));
}

/** Membaca lembar pertama berkas .xlsx dan mengambil kolom NIS, Nama Lengkap, dan Kelas. */
export function parseStudentWorkbook(buffer: ArrayBuffer): StudentImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const result: StudentImportRow[] = [];

  rows.forEach((row, index) => {
    const nisKey = findColumnKey(row, NIS_HEADERS);
    const nameKey = findColumnKey(row, NAME_HEADERS);
    const classKey = findColumnKey(row, CLASS_HEADERS);

    const nis = nisKey ? String(row[nisKey] ?? "").trim() : "";
    const name = nameKey ? String(row[nameKey] ?? "").trim() : "";
    const className = classKey ? String(row[classKey] ?? "").trim() : "";

    // Baris yang seluruhnya kosong (mis. baris pemisah di Excel) dilewati diam-diam.
    if (!nis && !name && !className) return;

    result.push({
      rowNumber: index + 2, // +2: baris 1 adalah header, index dimulai dari 0
      nis: nis || null,
      name,
      className: className || null,
    });
  });

  return result;
}

/** Membuat berkas .xlsx contoh, lengkap dengan daftar nama kelas yang sudah ada. */
export function buildStudentTemplateWorkbook(classNames: string[]): ArrayBuffer {
  const sheetData = [
    ["NIS", "Nama Lengkap", "Kelas"],
    ["2024001", "Ahmad Fauzan", classNames[0] || "6A"],
    ["2024002", "Siti Aisyah", classNames[0] || "6A"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  sheet["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Siswa");

  if (classNames.length > 0) {
    const classSheet = XLSX.utils.aoa_to_sheet([
      ["Nama kelas harus persis sama dengan salah satu di bawah ini:"],
      ...classNames.map((name) => [name]),
    ]);
    classSheet["!cols"] = [{ wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, classSheet, "Daftar Kelas");
  }

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
