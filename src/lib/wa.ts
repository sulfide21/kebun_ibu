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
    `Assalamualaikum, ada ${listing.judul}.`,
    `Harga ${rupiah(listing.harga)} ${listing.satuan}.`,
    ``,
    `Yang mau pesan atau nawar bisa lewat sini ya:`,
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
    `Assalamualaikum ${pesanan.nama},`,
    ``,
    `Penawaran untuk ${judul} sudah diterima.`,
    harga ? `Harga: ${harga}.` : ``,
    ``,
    `Untuk pengambilan, bisa diatur kapan?`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Tautan bagikan lewat WhatsApp Web / aplikasi, tanpa nomor tujuan. */
export function linkBagikan(listing: Listing): string {
  return `https://wa.me/?text=${encodeURIComponent(pesanBagikan(listing))}`;
}
