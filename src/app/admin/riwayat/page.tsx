import { supabaseServer } from "@/lib/supabase/server";
import DaftarRiwayat from "./DaftarRiwayat";
import type { PesananDenganListing } from "@/lib/types";

export const revalidate = 0;

export default async function Riwayat() {
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("pesanan")
    .select("*, listings(id, judul, harga, satuan, status)")
    .eq("status", "selesai")
    .order("diputuskan_at", { ascending: false });

  const selesai = (data ?? []) as PesananDenganListing[];

  return (
    <>
      <h1 className="mb-1 text-3xl font-extrabold text-daun-tua">Riwayat</h1>
      <p className="mb-6 text-daun">
        Penjualan yang sudah selesai. Berguna untuk menentukan harga musim
        berikutnya.
      </p>

      {selesai.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-12 text-center">
          <p className="text-xl font-semibold">Belum ada penjualan selesai.</p>
          <p className="mt-2 text-daun">
            Penawaran yang sudah ditandai &ldquo;sudah diambil &amp; lunas&rdquo;
            akan muncul di sini.
          </p>
        </div>
      ) : (
        <DaftarRiwayat selesai={selesai} />
      )}
    </>
  );
}
