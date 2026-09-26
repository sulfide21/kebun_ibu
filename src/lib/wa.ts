import { rupiah } from "./format";
import type { Listing, PesananDenganListing } from "./types";

export function alamatSitus(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function linkWa(no: string, pesan: string): string {
  return `https://wa.me/${no}?text=${encodeURIComponent(pesan)}`;
}

/** Pesan siap tempel untuk dibagikan Ibu/Bapak ke grup keluarga. */
export function pesanBagikan(listing: Listing): string {
  const link = `${alamatSitus()}/l/${listing.id}`;
  return [
    `Ada ${listing.judul} nih.`,
    `Harga ${rupiah(listing.harga)} ${listing.satuan}.`,
    ``,
    `Mau pesan atau nawar? Lewat sini aja:`,
    link,
  ].join("\n");
}

/** Dibuka Ibu/Bapak setelah menerima penawaran, untuk menghubungi pemenang. */
export function pesanPenawaranDiterima(pesanan: PesananDenganListing): string {
  const nilai =
    pesanan.jenis === "nawar" && pesanan.harga_tawar !== null
      ? pesanan.harga_tawar
      : (pesanan.harga_listing ?? pesanan.listings?.harga ?? null);
  const harga = nilai === null ? "" : rupiah(nilai);
  const judul = pesanan.listings?.judul || pesanan.judul_snapshot || "barang";

  return [
    `Halo ${pesanan.nama},`,
    ``,
    `Penawarannya untuk ${judul} diterima ya.`,
    harga ? `Harga: ${harga}.` : ``,
    ``,
    `Enaknya diambil kapan?`,
  ]
    .filter(Boolean)
    .join("\n");
}
