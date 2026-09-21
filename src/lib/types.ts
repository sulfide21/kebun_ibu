export type JenisBuah = "mangga" | "pisang" | "lainnya";
export type StatusListing = "segera" | "tersedia" | "sudah_laku";
export type JenisPesanan = "pesan" | "nawar";
export type StatusPesanan =
  | "baru"
  | "diterima"
  | "ditolak"
  | "selesai"
  | "batal";

export type Listing = {
  id: string;
  jenis: JenisBuah;
  judul: string;
  deskripsi: string;
  harga: number;
  satuan: string;
  status: StatusListing;
  created_at: string;
};

export type ListingFoto = {
  id: string;
  listing_id: string;
  path: string;
  urutan: number;
};

export type ListingLengkap = Listing & { listing_foto: ListingFoto[] };

export type Pesanan = {
  id: string;
  /** null kalau barangnya sudah dihapus - riwayatnya tetap disimpan. */
  listing_id: string | null;
  /** Salinan judul dan harga saat pesanan dibuat, supaya laporan tetap
   *  terbaca walau listing aslinya sudah tidak ada. */
  judul_snapshot: string;
  harga_listing: number | null;
  nama: string;
  no_wa: string;
  jenis: JenisPesanan;
  harga_tawar: number | null;
  catatan: string;
  status: StatusPesanan;
  created_at: string;
  diputuskan_at: string | null;
};

export type PesananDenganListing = Pesanan & {
  listings: Pick<Listing, "id" | "judul" | "harga" | "satuan" | "status"> | null;
};

export type Pengaturan = {
  id: number;
  teks_musim: string;
  tampilkan_banner: boolean;
};

export const LABEL_STATUS_LISTING: Record<StatusListing, string> = {
  segera: "Segera",
  tersedia: "Tersedia",
  sudah_laku: "Sudah laku",
};

export const LABEL_STATUS_PESANAN: Record<StatusPesanan, string> = {
  baru: "Baru",
  diterima: "Diterima",
  ditolak: "Ditolak",
  selesai: "Selesai",
  batal: "Batal",
};

export const LABEL_JENIS: Record<JenisBuah, string> = {
  mangga: "Mangga",
  pisang: "Pisang",
  lainnya: "Lainnya",
};
