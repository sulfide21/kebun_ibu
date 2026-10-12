import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { urutkanListing } from "@/lib/foto";
import type { TemplatPesan } from "@/lib/templat";
import type { ListingLengkap } from "@/lib/types";
import DaftarBarangAdmin from "./DaftarBarangAdmin";

export const revalidate = 0;

export default async function KelolaListing() {
  const supabase = await supabaseServer();

  const [{ data: listings }, { data: pesanan }, { data: templat }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, listing_foto(*)")
      .order("created_at", { ascending: false }),
    supabase.from("pesanan").select("listing_id"),
    // Gagal dibaca (misalnya migrasi belum dijalankan) = null, dan
    // tombol Bagikan memakai teks bawaan.
    supabase.from("templat_pesan").select("bagikan_jual, bagikan_lelang").eq("id", 1).maybeSingle(),
  ]);

  const hitung: Record<string, number> = {};
  for (const p of pesanan ?? []) {
    hitung[p.listing_id] = (hitung[p.listing_id] ?? 0) + 1;
  }

  const daftar = urutkanListing((listings ?? []) as ListingLengkap[]);

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-daun-tua">Barang</h1>
          <p className="mt-1 text-daun">
            Pasang foto, tulis harga, bagikan linknya.
          </p>
        </div>
        <Link
          href="/admin/listing/baru"
          className="flex min-h-13 shrink-0 items-center rounded-full bg-daun-tua px-5 font-bold text-putih"
        >
          Pasang
        </Link>
      </div>

      {daftar.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-12 text-center">
          <p className="text-xl font-semibold">Belum ada barang.</p>
          <p className="mt-2 text-daun">
            Mulai dari satu foto dan satu harga. Keterangannya bebas.
          </p>
          <Link
            href="/admin/listing/baru"
            className="mt-5 inline-block min-h-13 rounded-full bg-daun-tua px-6 py-3 font-bold text-putih"
          >
            Pasang barang pertama
          </Link>
        </div>
      ) : (
        <DaftarBarangAdmin
          daftar={daftar}
          hitung={hitung}
          templat={(templat ?? {}) as Partial<TemplatPesan>}
        />
      )}
    </>
  );
}
