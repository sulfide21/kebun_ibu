import type { Listing, Pesanan, PesananDenganListing } from "./types";

type ListingRingkas = NonNullable<PesananDenganListing["listings"]>;

const waktu = (t: { created_at: string }) => new Date(t.created_at).getTime();
const waktuBatas = (l: { batas_waktu: string | null }) =>
  l.batas_waktu ? new Date(l.batas_waktu).getTime() : Number.POSITIVE_INFINITY;

/** Harga yang benar-benar terjadi pada satu pesanan: jumlah tawaran kalau
 *  lelang (atau nawar di riwayat lama), kalau tidak harga yang dipasang. */
export function hargaAkhir(
  p: Pick<Pesanan, "jenis" | "harga_tawar" | "harga_listing"> & {
    listings?: { harga: number } | null;
  },
): number {
  if (p.jenis !== "pesan" && p.harga_tawar !== null) return p.harga_tawar;
  return p.harga_listing ?? p.listings?.harga ?? 0;
}

/** Lelang terbuka = masih tersedia dan batas waktunya belum lewat. Tidak
 *  ada job yang menutup lelang; keadaannya dihitung setiap kali dibaca. */
export function lelangTerbuka(
  listing: Pick<Listing, "mode" | "status" | "batas_waktu">,
  sekarang: Date,
): boolean {
  if (listing.mode !== "lelang" || listing.status !== "tersedia") return false;
  if (!listing.batas_waktu) return false;
  return sekarang.getTime() < new Date(listing.batas_waktu).getTime();
}

export type BarisHarga = Pick<Pesanan, "listing_id" | "harga_tawar" | "created_at" | "status">;

/**
 * Tawaran tertinggi per barang yang masuk sebelum `batas` (00.00 WITA
 * hari ini). Inilah satu-satunya angka lelang yang boleh dilihat publik.
 * Tawaran yang ditolak atau batal tidak dihitung, supaya tawaran iseng
 * yang sudah ditolak Ibu tidak tetap tampil sebagai harga tertinggi.
 */
export function tertinggiSebelum(baris: BarisHarga[], batas: Date): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const b of baris) {
    if (!b.listing_id || b.harga_tawar === null) continue;
    if (b.status === "ditolak" || b.status === "batal") continue;
    if (waktu(b) >= batas.getTime()) continue;
    hasil[b.listing_id] = Math.max(hasil[b.listing_id] ?? 0, b.harga_tawar);
  }
  return hasil;
}

export type Tawaran = Pick<
  Pesanan,
  "id" | "nama" | "no_wa" | "harga_tawar" | "catatan" | "status" | "created_at"
>;

export type Penawar = {
  no_wa: string;
  nama: string;
  terbaru: Tawaran;
  /** Berapa kali orang ini menaikkan tawarannya. */
  jumlahNaik: number;
};

export type DaftarPenawar = {
  aktif: Penawar[];
  ditolak: Penawar[];
  pemenang: Penawar | null;
};

function jadikanPenawar(riwayat: Tawaran[]): Penawar {
  const terbaru = riwayat[riwayat.length - 1];
  let jumlahNaik = 0;
  for (let i = 1; i < riwayat.length; i++) {
    if ((riwayat[i].harga_tawar ?? 0) > (riwayat[i - 1].harga_tawar ?? 0)) jumlahNaik++;
  }
  return { no_wa: terbaru.no_wa, nama: terbaru.nama, terbaru, jumlahNaik };
}

/**
 * Setiap tawaran disimpan sebagai baris baru (publik tidak boleh mengubah
 * baris). Admin melihat satu baris per nomor WhatsApp:
 *   - pemenang: punya baris diterima/selesai
 *   - aktif:    masih punya baris baru (termasuk yang ditolak lalu menawar lagi)
 *   - ditolak:  semua barisnya ditolak atau batal
 */
export function tawaranTerbaruPerNomor(tawaran: Tawaran[]): DaftarPenawar {
  const perNomor = new Map<string, Tawaran[]>();
  for (const t of tawaran) {
    const daftar = perNomor.get(t.no_wa) ?? [];
    daftar.push(t);
    perNomor.set(t.no_wa, daftar);
  }

  const hasil: DaftarPenawar = { aktif: [], ditolak: [], pemenang: null };
  for (const acak of perNomor.values()) {
    const riwayat = [...acak].sort((a, b) => waktu(a) - waktu(b));

    const menang = riwayat.filter((t) => t.status === "diterima" || t.status === "selesai");
    if (menang.length > 0) {
      hasil.pemenang = { ...jadikanPenawar(riwayat), terbaru: menang[menang.length - 1] };
      continue;
    }

    const masihBaru = riwayat.filter((t) => t.status === "baru");
    if (masihBaru.length > 0) hasil.aktif.push(jadikanPenawar(masihBaru));
    else hasil.ditolak.push(jadikanPenawar(riwayat));
  }
  return hasil;
}

export type Urutan = "tertinggi" | "terbaru";

export function urutkanPenawar(daftar: Penawar[], urut: Urutan): Penawar[] {
  return [...daftar].sort((a, b) => {
    if (urut === "terbaru") return waktu(b.terbaru) - waktu(a.terbaru);
    const selisih = (b.terbaru.harga_tawar ?? 0) - (a.terbaru.harga_tawar ?? 0);
    // Sama besar: yang lebih dulu menawar di atas
    return selisih !== 0 ? selisih : waktu(a.terbaru) - waktu(b.terbaru);
  });
}

export type RingkasanLelang = {
  listing: ListingRingkas;
  jumlahPenawar: number;
  tertinggi: number | null;
};

/** Satu kartu per lelang di kotak masuk, paling cepat ditutup di atas. */
export function ringkasLelang(
  baris: Pick<PesananDenganListing, "jenis" | "no_wa" | "harga_tawar" | "listings">[],
): RingkasanLelang[] {
  const peta = new Map<string, { listing: ListingRingkas; nomor: Set<string>; tertinggi: number | null }>();
  for (const b of baris) {
    if (b.jenis !== "lelang" || !b.listings) continue;
    const isi = peta.get(b.listings.id) ?? {
      listing: b.listings,
      nomor: new Set<string>(),
      tertinggi: null,
    };
    isi.nomor.add(b.no_wa);
    if (b.harga_tawar !== null) isi.tertinggi = Math.max(isi.tertinggi ?? 0, b.harga_tawar);
    peta.set(b.listings.id, isi);
  }
  return [...peta.values()]
    .map(({ listing, nomor, tertinggi }) => ({ listing, jumlahPenawar: nomor.size, tertinggi }))
    .sort((a, b) => waktuBatas(a.listing) - waktuBatas(b.listing));
}

type ListingBeranda = Pick<Listing, "mode" | "status" | "batas_waktu" | "created_at">;

/**
 * Beranda: lelang yang terbuka dipisah ke bagian atas, paling cepat
 * ditutup dulu. Sisanya: yang bisa dibeli, yang segera, lelang yang sudah
 * ditutup, lalu yang sudah laku (tetap ditampilkan sebagai bukti kebun ini hidup).
 */
export function susunBeranda<T extends ListingBeranda>(
  daftar: T[],
  sekarang: Date,
): { lelang: T[]; lainnya: T[] } {
  const peringkat = (l: T) =>
    l.status === "sudah_laku" ? 3 : l.status === "segera" ? 1 : l.mode === "lelang" ? 2 : 0;

  const lelang = daftar
    .filter((l) => lelangTerbuka(l, sekarang))
    .sort((a, b) => waktuBatas(a) - waktuBatas(b));
  const lainnya = daftar
    .filter((l) => !lelangTerbuka(l, sekarang))
    .sort((a, b) => peringkat(a) - peringkat(b) || waktu(b) - waktu(a));
  return { lelang, lainnya };
}
