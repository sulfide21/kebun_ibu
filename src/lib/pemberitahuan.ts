import { rupiah, tampilkanNoWa } from "./format";
import { isiTemplat, pakaiTemplat, type TemplatPesan } from "./templat";
import { formatWita, sisaWaktu } from "./waktu";
import { alamatSitus } from "./wa";

export type IsiPemberitahuan = {
  nama: string;
  /** Bentuk yang disimpan, 62812..., supaya bisa jadi link wa.me. */
  noWa: string;
  judulListing: string;
  jenis: "pesan" | "lelang";
  /** Harga yang dipasang. Untuk lelang = harga minimum. */
  hargaListing: number;
  hargaTawar: number | null;
  /** Hanya untuk lelang, ISO. */
  batasWaktu: string | null;
  catatan: string;
};

/** Nilai setiap tag pemberitahuan. Yang tidak berlaku diisi "-". */
export function nilaiPemberitahuan(
  isi: IsiPemberitahuan,
  sekarang = new Date(),
): Record<string, string> {
  const batas = isi.batasWaktu ? new Date(isi.batasWaktu) : null;
  return {
    nama: isi.nama,
    nomor: tampilkanNoWa(isi.noWa),
    barang: isi.judulListing,
    harga: rupiah(isi.hargaListing),
    tawaran: isi.hargaTawar !== null ? rupiah(isi.hargaTawar) : "-",
    catatan: isi.catatan || "-",
    ditutup: batas ? formatWita(batas) : "-",
    sisa_waktu: batas ? sisaWaktu(batas, sekarang) : "-",
    link_balas: `https://wa.me/${isi.noWa}`,
    link_admin: `${alamatSitus()}/admin`,
  };
}

/**
 * Isi pemberitahuan pesanan baru untuk Ibu/Bapak. Email memanggil tanpa
 * templat (selalu teks bawaan); WhatsApp memberikan templat dari
 * Pengaturan. Judul tidak ikut templat.
 */
export function teksPemberitahuan(
  isi: IsiPemberitahuan,
  sekarang = new Date(),
  templat: Partial<TemplatPesan> = {},
): { judul: string; teks: string } {
  const jenis = isi.jenis === "lelang" ? "wa_lelang" : "wa_pesan";
  return {
    judul:
      isi.jenis === "lelang"
        ? `Tawaran lelang baru: ${isi.judulListing}`
        : `Pesanan baru: ${isi.judulListing}`,
    teks: isiTemplat(pakaiTemplat(templat[jenis], jenis), nilaiPemberitahuan(isi, sekarang)),
  };
}
