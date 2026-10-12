import { rupiah } from "./format";
import { hargaAkhir } from "./lelang";
import { isiTemplat, pakaiTemplat, type TemplatPesan } from "./templat";
import type { Listing, PesananDenganListing } from "./types";
import { formatWita } from "./waktu";

export function alamatSitus(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://kebun-ibu.vercel.app"
  );
}

export function linkWa(no: string, pesan: string): string {
  return `https://wa.me/${no}?text=${encodeURIComponent(pesan)}`;
}

/** Pesan siap tempel untuk dibagikan Ibu/Bapak ke grup keluarga. */
export function pesanBagikan(listing: Listing, templat: Partial<TemplatPesan> = {}): string {
  const link = `${alamatSitus()}/l/${listing.id}`;

  if (listing.mode === "lelang" && listing.batas_waktu) {
    return isiTemplat(pakaiTemplat(templat.bagikan_lelang, "bagikan_lelang"), {
      barang: listing.judul,
      harga_mulai: rupiah(listing.harga),
      satuan: listing.satuan,
      ditutup: formatWita(new Date(listing.batas_waktu)),
      link,
    });
  }

  return isiTemplat(pakaiTemplat(templat.bagikan_jual, "bagikan_jual"), {
    barang: listing.judul,
    harga: rupiah(listing.harga),
    satuan: listing.satuan,
    link,
  });
}

/** Dikirim Ibu/Bapak ke pemenang lelang. */
export function pesanMenangLelang(nama: string, judul: string, harga: number): string {
  return [
    `Halo ${nama},`,
    ``,
    `Tawaranmu ${rupiah(harga)} untuk ${judul} menang lelang ya.`,
    ``,
    `Enaknya diambil kapan?`,
  ].join("\n");
}

/** Dibuka Ibu/Bapak setelah menerima pesanan, untuk menghubungi pembeli. */
export function pesanPenawaranDiterima(pesanan: PesananDenganListing): string {
  const nilai = hargaAkhir(pesanan);
  const judul = pesanan.listings?.judul || pesanan.judul_snapshot || "barang";

  if (pesanan.jenis === "lelang") return pesanMenangLelang(pesanan.nama, judul, nilai);

  return [
    `Halo ${pesanan.nama},`,
    ``,
    `Pesanannya untuk ${judul} diterima ya.`,
    nilai > 0 ? `Harga: ${rupiah(nilai)}.` : ``,
    ``,
    `Enaknya diambil kapan?`,
  ]
    .filter(Boolean)
    .join("\n");
}
