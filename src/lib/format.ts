const WIB = "Asia/Jakarta";

export function rupiah(nilai: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(nilai);
}

/** "12 Okt 2026, 14.30" - selalu dalam WIB, bukan zona waktu server. */
export function tanggalWIB(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: WIB,
  }).format(new Date(iso));
}

export function tanggalSingkatWIB(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: WIB,
  }).format(new Date(iso));
}

export function bulanWIB(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: WIB,
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
  return tanggalSingkatWIB(iso);
}

/** 628123456789 -> 0812-3456-789 (lebih enak dibaca Ibu/Bapak) */
export function tampilkanNoWa(no: string): string {
  const lokal = no.startsWith("62") ? "0" + no.slice(2) : no;
  return lokal.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");
}
