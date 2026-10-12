/**
 * Templat pesan yang bisa diubah Ibu/Bapak di halaman Pengaturan.
 *
 * Isi yang berubah-ubah ditulis sebagai tag, misalnya {nama}. File ini
 * murni (tanpa database) supaya bisa dipakai di server untuk mengirim
 * pesan dan di browser untuk pratinjau.
 */

export const JENIS_TEMPLAT = ["wa_pesan", "wa_lelang", "bagikan_jual", "bagikan_lelang"] as const;
export type JenisTemplat = (typeof JENIS_TEMPLAT)[number];
export type TemplatPesan = Record<JenisTemplat, string>;

const TAG_PEMBERITAHUAN = [
  "nama",
  "nomor",
  "barang",
  "harga",
  "catatan",
  "link_balas",
  "link_admin",
] as const;

/** Tag yang sah untuk tiap kotak. Urutannya = urutan tombol di Pengaturan. */
export const TAG: Record<JenisTemplat, readonly string[]> = {
  wa_pesan: TAG_PEMBERITAHUAN,
  wa_lelang: [...TAG_PEMBERITAHUAN, "tawaran", "ditutup", "sisa_waktu"],
  bagikan_jual: ["barang", "harga", "satuan", "link"],
  bagikan_lelang: ["barang", "harga_mulai", "satuan", "ditutup", "link"],
};

/** Dipakai kalau kolomnya kosong. Bagikan sama persis dengan teks lama. */
export const TEMPLAT_AWAL: TemplatPesan = {
  wa_pesan: [
    "Ada pesanan baru.",
    "",
    "Barang  : {barang}",
    "Nama    : {nama}",
    "No. WA  : {nomor}",
    "Harga   : {harga}",
    "Catatan : {catatan}",
    "",
    "Balas {nama}: {link_balas}",
    "Kotak masuk: {link_admin}",
  ].join("\n"),
  wa_lelang: [
    "Ada tawaran lelang baru.",
    "",
    "Barang  : {barang}",
    "Nama    : {nama}",
    "No. WA  : {nomor}",
    "Tawaran : {tawaran}",
    "Ditutup : {ditutup} ({sisa_waktu})",
    "Catatan : {catatan}",
    "",
    "Balas {nama}: {link_balas}",
    "Kotak masuk: {link_admin}",
  ].join("\n"),
  bagikan_jual: [
    "Ada {barang} nih.",
    "Harga {harga} {satuan}.",
    "",
    "Mau pesan? Lewat sini aja:",
    "{link}",
  ].join("\n"),
  bagikan_lelang: [
    "Ada {barang} nih, dilelang.",
    "Mulai {harga_mulai} {satuan}, ditutup {ditutup}.",
    "",
    "Ikut lelang lewat sini:",
    "{link}",
  ].join("\n"),
};

export const TEMPLAT_KOSONG: TemplatPesan = {
  wa_pesan: "",
  wa_lelang: "",
  bagikan_jual: "",
  bagikan_lelang: "",
};

const CONTOH_PEMBERITAHUAN = {
  nama: "Budi",
  nomor: "0812-3456-7890",
  barang: "Mangga arumanis",
  harga: "Rp 50.000",
  catatan: "Ambil sore ya",
  link_balas: "https://wa.me/6281234567890",
  link_admin: "https://kebun-ibu.vercel.app/admin",
};

/** Data pura-pura untuk pratinjau di halaman Pengaturan. */
export const CONTOH: Record<JenisTemplat, Record<string, string>> = {
  wa_pesan: CONTOH_PEMBERITAHUAN,
  wa_lelang: {
    ...CONTOH_PEMBERITAHUAN,
    tawaran: "Rp 80.000",
    ditutup: "Sab, 17 Okt, 20.00 WITA",
    sisa_waktu: "3 hari lagi",
  },
  bagikan_jual: {
    barang: "Pisang kepok",
    harga: "Rp 30.000",
    satuan: "/sisir",
    link: "https://kebun-ibu.vercel.app/l/contoh",
  },
  bagikan_lelang: {
    barang: "Mangga arumanis",
    harga_mulai: "Rp 50.000",
    satuan: "/keranjang",
    ditutup: "Sab, 17 Okt, 20.00 WITA",
    link: "https://kebun-ibu.vercel.app/l/contoh",
  },
};

// Apa pun di antara kurung kurawal dalam satu baris, supaya {Nama} dan
// { nama } ikut tertangkap sebagai tag yang salah, bukan diam-diam lolos.
const POLA_TAG = /\{([^{}\n]*)\}/g;

/**
 * Mengganti tag dengan nilainya dalam satu kali jalan. Nilai yang sudah
 * dimasukkan tidak dibaca ulang, jadi catatan pembeli yang berisi
 * "{link_admin}" tetap tampil apa adanya.
 */
export function isiTemplat(templat: string, nilai: Record<string, string>): string {
  return templat.replace(POLA_TAG, (utuh, nama: string) =>
    Object.prototype.hasOwnProperty.call(nilai, nama) ? nilai[nama] : utuh,
  );
}

export function tagTakDikenal(templat: string, jenis: JenisTemplat): string[] {
  const sah = new Set(TAG[jenis]);
  const asing = new Set<string>();
  for (const [, nama] of templat.matchAll(POLA_TAG)) if (!sah.has(nama)) asing.add(nama);
  return [...asing];
}

export function pakaiTemplat(templat: string | null | undefined, jenis: JenisTemplat): string {
  return templat && templat.trim() !== "" ? templat : TEMPLAT_AWAL[jenis];
}
