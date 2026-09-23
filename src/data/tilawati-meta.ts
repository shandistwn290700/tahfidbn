export interface JilidMeta {
  number: number;
  totalPages: number;
}

/** Standar halaman per jilid Tilawati. */
export const JILID_LIST: JilidMeta[] = [
  { number: 1, totalPages: 40 },
  { number: 2, totalPages: 44 },
  { number: 3, totalPages: 44 },
  { number: 4, totalPages: 44 },
  { number: 5, totalPages: 44 },
  { number: 6, totalPages: 31 },
];

export const TOTAL_JILID = JILID_LIST.length;

export const TOTAL_TILAWATI_PAGES = JILID_LIST.reduce((sum, j) => sum + j.totalPages, 0);

export function getJilid(number: number): JilidMeta | undefined {
  return JILID_LIST[number - 1];
}
