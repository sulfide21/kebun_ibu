/**
 * Semua urusan jam di situs ini lewat sini, dan selalu dalam WITA.
 *
 * Server Vercel berjalan dalam UTC dan TZ-nya tidak bisa diubah. Isian
 * "2026-10-10T14:00" yang dibaca dengan new Date() tanpa zona menjadi
 * 14.00 di laptop, tapi 22.00 WITA di server: selisih 8 jam yang baru
 * kelihatan setelah deploy. Karena itu zonanya selalu ditulis eksplisit.
 */
export const ZONA_WITA = "Asia/Makassar";

const OFFSET = "+08:00";
const OFFSET_MS = 8 * 60 * 60 * 1000; // WITA tidak punya daylight saving
const SEHARI_MS = 24 * 60 * 60 * 1000;
const POLA_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "2026-10-10T14:00" (isian datetime-local, dianggap WITA) -> Date. */
export function bacaInputWita(input: string): Date | null {
  if (!POLA_INPUT.test(input)) return null;
  const d = new Date(`${input}:00${OFFSET}`);
  if (Number.isNaN(d.getTime())) return null;
  // new Date() diam-diam menggeser tanggal mustahil (30 Feb jadi 2 Mar).
  // Dibalik lagi untuk memastikan yang diketik memang tanggal sungguhan.
  return keInputWita(d) === input ? d : null;
}

/** Date -> "2026-10-10T14:00" dalam WITA, untuk mengisi form edit. */
export function keInputWita(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** Pukul 00.00 WITA pada hari yang sama dengan `sekarang`. */
export function awalHariIniWita(sekarang: Date): Date {
  const geser = sekarang.getTime() + OFFSET_MS;
  return new Date(geser - (geser % SEHARI_MS) - OFFSET_MS);
}

const FORMAT_WITA = new Intl.DateTimeFormat("id-ID", {
  timeZone: ZONA_WITA,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Sab, 10 Okt, 14.00 WITA" */
export function formatWita(d: Date): string {
  return `${FORMAT_WITA.format(d)} WITA`;
}

/** "3 hari lagi", "5 jam lagi", "20 menit lagi", atau "Ditutup". */
export function sisaWaktu(batas: Date, sekarang: Date): string {
  const ms = batas.getTime() - sekarang.getTime();
  if (ms <= 0) return "Ditutup";
  const menit = Math.ceil(ms / 60_000);
  if (menit < 60) return `${menit} menit lagi`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lagi`;
  return `${Math.floor(jam / 24)} hari lagi`;
}
