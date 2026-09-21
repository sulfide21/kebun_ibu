import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { urutkanListing } from "@/lib/foto";
import type { ListingLengkap } from "@/lib/types";
import BarisListing from "./BarisListing";

export const revalidate = 0;

export default async function KelolaListing() {
  const supabase = await supabaseServer();

  const [{ data: listings }, { data: pesanan }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, listing_foto(*)")
      .order("created_at", { ascending: false }),
    supabase.from("pesanan").select("listing_id"),
  ]);

  const hitung = new Map<string, number>();
  for (const p of pesanan ?? []) {
    hitung.set(p.listing_id, (hitung.get(p.listing_id) ?? 0) + 1);
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
        <ul className="grid gap-4">
          {daftar.map((l) => (
            <li key={l.id}>
              <BarisListing listing={l} jumlahPesanan={hitung.get(l.id) ?? 0} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
