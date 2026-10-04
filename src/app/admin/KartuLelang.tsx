import Link from "next/link";
import { rupiah } from "@/lib/format";
import type { RingkasanLelang } from "@/lib/lelang";
import { sisaWaktu } from "@/lib/waktu";

export default function KartuLelang({
  ringkasan,
  sekarang,
}: {
  ringkasan: RingkasanLelang;
  sekarang: Date;
}) {
  const { listing, jumlahPenawar, tertinggi } = ringkasan;
  const sisa = listing.batas_waktu
    ? sisaWaktu(new Date(listing.batas_waktu), sekarang)
    : "Ditutup";

  return (
    <article className="rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-4">
      <p className="text-sm font-extrabold tracking-wide text-emas-tua">LELANG</p>
      <p className="text-lg font-bold text-daun-tua">{listing.judul}</p>
      <p className="mt-1 text-base text-daun">
        {jumlahPenawar} penawar · tertinggi{" "}
        {tertinggi !== null ? rupiah(tertinggi) : "-"} ·{" "}
        {sisa === "Ditutup" ? "sudah ditutup" : `ditutup ${sisa}`}
      </p>
      <Link
        href={`/admin/listing/${listing.id}/tawaran`}
        className="mt-4 flex min-h-13 items-center justify-center rounded-full bg-daun-tua px-5 font-bold text-putih"
      >
        Lihat tawaran
      </Link>
    </article>
  );
}
