import { buatPencocok } from "./cari";
import { tampilkanNoWa } from "./format";
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

export type BarisHarga = Pick<
  Pesanan,
  "listing_id" | "no_wa" | "harga_tawar" | "created_at" | "status"
>;

const ditolakAtauBatal = (b: { status: Pesanan["status"] }) =>
  b.status === "ditolak" || b.status === "batal";

/** Tawaran terbaru tiap nomor, dikelompokkan per barang. Tawaran baru
 *  menggantikan yang lama, jadi salah ketik yang sudah dibetulkan tidak
 *  ikut dihitung. */
function terbaruTiapNomor<T extends { no_wa: string; created_at: string }>(
  baris: T[],
  kunciBarang: (b: T) => string,
): Map<string, Map<string, T>> {
  const perBarang = new Map<string, Map<string, T>>();
  for (const b of baris) {
    const kunci = kunciBarang(b);
    const perNomor = perBarang.get(kunci) ?? new Map<string, T>();
    const lama = perNomor.get(b.no_wa);
    if (!lama || waktu(b) > waktu(lama)) perNomor.set(b.no_wa, b);
    perBarang.set(kunci, perNomor);
  }
  return perBarang;
}

/**
 * Tawaran tertinggi per barang yang masuk sebelum `batas` (00.00 WITA
 * hari ini), dihitung dari tawaran terbaru tiap nomor. Inilah
 * satu-satunya angka lelang yang boleh dilihat publik. Tawaran yang
 * ditolak atau batal tidak dihitung, supaya tawaran iseng yang sudah
 * ditolak Ibu tidak tetap tampil sebagai harga tertinggi.
 */
export function tertinggiSebelum(baris: BarisHarga[], batas: Date): Record<string, number> {
  const terpakai = baris.filter(
    (b): b is BarisHarga & { listing_id: string; harga_tawar: number } =>
      b.listing_id !== null &&
      b.harga_tawar !== null &&
      !ditolakAtauBatal(b) &&
      waktu(b) < batas.getTime(),
  );
  const hasil: Record<string, number> = {};
  for (const [listingId, perNomor] of terbaruTiapNomor(terpakai, (b) => b.listing_id)) {
    hasil[listingId] = Math.max(...[...perNomor.values()].map((b) => b.harga_tawar));
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

/**
 * Satu kartu per lelang di kotak masuk, paling cepat ditutup di atas.
 * Angka tertinggi diambil dari tawaran terbaru tiap nomor; jumlah
 * penawar menghitung nomor yang masih punya tawaran tidak ditolak/batal.
 * Lelang yang semua tawarannya ditolak atau batal tetap punya kartu.
 */
export function ringkasLelang(
  baris: Pick<
    PesananDenganListing,
    "jenis" | "no_wa" | "harga_tawar" | "status" | "created_at" | "listings"
  >[],
): RingkasanLelang[] {
  type Baris = (typeof baris)[number] & { listings: ListingRingkas };
  const lelang = baris.filter((b): b is Baris => b.jenis === "lelang" && b.listings !== null);

  const daftarListing = new Map<string, ListingRingkas>();
  for (const b of lelang) daftarListing.set(b.listings.id, b.listings);

  const terbaru = terbaruTiapNomor(
    lelang.filter((b) => !ditolakAtauBatal(b)),
    (b) => b.listings.id,
  );

  return [...daftarListing.values()]
    .map((listing) => {
      const perNomor = [...(terbaru.get(listing.id)?.values() ?? [])];
      const harga = perNomor.flatMap((b) => (b.harga_tawar === null ? [] : [b.harga_tawar]));
      return {
        listing,
        jumlahPenawar: perNomor.length,
        tertinggi: harga.length > 0 ? Math.max(...harga) : null,
      };
    })
    .sort((a, b) => waktuBatas(a.listing) - waktuBatas(b.listing));
}

/**
 * Pencarian di kotak masuk. Pesanan biasa disaring per baris. Kartu
 * lelang ikut tampil kalau judulnya atau salah satu penawarnya cocok,
 * tapi angkanya tetap dihitung dari semua tawaran - mencari "Budi" tidak
 * boleh membuat kartunya seolah hanya punya satu penawar.
 */
export function saringKotakMasuk(
  daftar: PesananDenganListing[],
  kueri: string,
): { lelang: RingkasanLelang[]; biasa: PesananDenganListing[] } {
  const cocok = buatPencocok(kueri);
  // Nomor ikut dicari dalam tiga bentuk: 62812..., 0812..., 0812-....
  const cocokPesanan = (p: PesananDenganListing) =>
    cocok(
      p.listings?.judul,
      p.judul_snapshot,
      p.nama,
      p.no_wa,
      p.no_wa.startsWith("62") ? "0" + p.no_wa.slice(2) : null,
      tampilkanNoWa(p.no_wa),
      p.catatan,
      String(hargaAkhir(p)),
    );

  const lelangCocok = new Set(
    daftar
      .filter((p) => p.jenis === "lelang" && p.listings !== null && cocokPesanan(p))
      .map((p) => p.listings!.id),
  );

  return {
    lelang: ringkasLelang(daftar).filter((r) => lelangCocok.has(r.listing.id)),
    biasa: daftar.filter((p) => p.jenis !== "lelang" && cocokPesanan(p)),
  };
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
