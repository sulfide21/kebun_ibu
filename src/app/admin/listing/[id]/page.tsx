import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { ListingLengkap } from "@/lib/types";
import FormListing from "../FormListing";

export const revalidate = 0;

export default async function UbahListing({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("listings")
    .select("*, listing_foto(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const listing = data as ListingLengkap;
  const fotoAwal = [...(listing.listing_foto ?? [])]
    .sort((a, b) => a.urutan - b.urutan)
    .map((f) => f.path);

  return (
    <>
      <nav className="mb-4">
        <Link href="/admin/listing" className="text-base text-daun underline">
          ← Kembali ke daftar barang
        </Link>
      </nav>
      <h1 className="mb-5 text-3xl font-extrabold text-daun-tua">Ubah barang</h1>
      <FormListing listing={listing} fotoAwal={fotoAwal} />
    </>
  );
}
