import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import {
  lelangTerbuka,
  tawaranTerbaruPerNomor,
  tertinggiSebelum,
  urutkanPenawar,
  type Tawaran,
  type Urutan,
} from "@/lib/lelang";
import type { Listing } from "@/lib/types";
import { awalHariIniWita, formatWita, sisaWaktu } from "@/lib/waktu";
import DaftarTawaran from "./DaftarTawaran";

export const revalidate = 0;

export default async function HalamanTawaran({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ urut?: string }>;
}) {
  const [{ id }, { urut: urutMentah }] = await Promise.all([params, searchParams]);
  const urut: Urutan = urutMentah === "terbaru" ? "terbaru" : "tertinggi";
  const supabase = await supabaseServer();

  const [{ data: dataListing }, { data: dataTawaran }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).single(),
    supabase
      .from("pesanan")
      .select("id, listing_id, nama, no_wa, harga_tawar, catatan, status, created_at")
      .eq("listing_id", id)
      .eq("jenis", "lelang"),
  ]);

  const listing = dataListing as Listing | null;
  if (!listing || listing.mode !== "lelang") notFound();

  const sekarang = new Date();
  const semua = (dataTawaran ?? []) as (Tawaran & { listing_id: string })[];
  const { aktif, ditolak, pemenang } = tawaranTerbaruPerNomor(semua);
  const tampil = tertinggiSebelum(semua, awalHariIniWita(sekarang))[id] ?? null;
  const sebenarnya = Math.max(
    0,
    ...aktif.map((p) => p.terbaru.harga_tawar ?? 0),
    pemenang?.terbaru.harga_tawar ?? 0,
  );
  const batas = listing.batas_waktu ? new Date(listing.batas_waktu) : null;

  return (
    <>
      <nav className="mb-4">
        <Link href="/admin/listing" className="text-base text-daun underline">
          ← Kembali ke daftar barang
        </Link>
      </nav>

      <h1 className="text-3xl font-extrabold text-daun-tua">
        {listing.judul} — Lelang
      </h1>
      <p className="mt-2 text-lg">
        Minimum {rupiah(listing.harga)}
        {batas ? ` · Ditutup ${formatWita(batas)} (${sisaWaktu(batas, sekarang)})` : ""}
      </p>
      <p className="mt-1 text-base text-daun">
        Tampil di publik:{" "}
        {tampil !== null
          ? rupiah(tampil)
          : `${rupiah(listing.harga)} (belum ada tawaran sampai kemarin)`}
        {" · "}Tertinggi sebenarnya: {sebenarnya > 0 ? rupiah(sebenarnya) : "-"}
      </p>

      <DaftarTawaran
        listingId={listing.id}
        judul={listing.judul}
        terbuka={lelangTerbuka(listing, sekarang)}
        urut={urut}
        aktif={urutkanPenawar(aktif, urut)}
        ditolak={ditolak}
        pemenang={pemenang}
      />
    </>
  );
}
