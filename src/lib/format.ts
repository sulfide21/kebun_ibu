import { ZONA_WITA } from "./waktu";

export function rupiah(nilai: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(nilai);
}

/** "12 Okt 2026, 14.30" - selalu dalam WITA, bukan zona waktu server. */
export function tanggalWita(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ZONA_WITA,
  }).format(new Date(iso));
}

export function tanggalSingkatWita(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: ZONA_WITA,
  }).format(new Date(iso));
}

export function bulanWita(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: ZONA_WITA,
  }).format(new Date(iso));
}

/** "2 jam lalu". Dihitung dari selisih waktu, jadi zona waktu tidak berpengaruh. */
export function waktuLalu(iso: string): string {
  const detik = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return "baru saja";
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.round(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return tanggalSingkatWita(iso);
}

/**
 * Awal bulan menurut WITA, dikembalikan sebagai ISO untuk dipakai query.
 * mundur=0 berarti bulan ini, mundur=1 bulan lalu.
 *
 * Batas bulan dihitung di WITA, bukan UTC. Penjualan jam 8 malam tanggal 31
 * masih masuk bulan itu bagi Ibu, padahal di UTC sudah lewat tengah malam.
 */
export function awalBulanWita(mundur = 0, sekarang = new Date()): string {
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WITA,
    year: "numeric",
    month: "2-digit",
  }).format(sekarang);

  const [tahun, bulan] = bagian.split("-").map(Number);
  const total = tahun * 12 + (bulan - 1) - mundur;
  const t = Math.floor(total / 12);
  const b = (total % 12) + 1;

  // +08:00 = WITA, tidak pernah berubah (tidak ada daylight saving)
  return new Date(
    `${t}-${String(b).padStart(2, "0")}-01T00:00:00+08:00`,
  ).toISOString();
}

/** 628123456789 -> 0812-3456-789 (lebih enak dibaca Ibu/Bapak) */
export function tampilkanNoWa(no: string): string {
  const lokal = no.startsWith("62") ? "0" + no.slice(2) : no;
  return lokal.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");
}
