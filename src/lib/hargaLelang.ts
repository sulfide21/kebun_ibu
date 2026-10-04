import { tertinggiSebelum } from "./lelang";
import { supabaseAdmin } from "./supabase/admin";
import { awalHariIniWita } from "./waktu";

/**
 * Harga lelang yang boleh dilihat publik, per barang: tawaran tertinggi
 * sebelum 00.00 WITA hari ini. Butuh service role karena publik tidak
 * boleh membaca tabel pesanan; yang keluar dari fungsi ini hanya angka.
 *
 * Sengaja bukan fungsi database security definer - yang seperti itu
 * ditandai Security Advisor Supabase (lint 0028).
 */
export async function ambilTertinggiKemarin(
  listingIds: string[],
  sekarang = new Date(),
): Promise<Record<string, number>> {
  if (listingIds.length === 0) return {};
  const batas = awalHariIniWita(sekarang);

  try {
    const { data, error } = await supabaseAdmin()
      .from("pesanan")
      .select("listing_id, harga_tawar, created_at, status")
      .eq("jenis", "lelang")
      .in("listing_id", listingIds)
      .in("status", ["baru", "diterima", "selesai"])
      .lt("created_at", batas.toISOString());
    if (error) throw error;
    return tertinggiSebelum(data ?? [], batas);
  } catch (error) {
    // Gagal membaca = tampil harga minimum. Lebih baik daripada halaman error.
    console.error("[lelang] gagal membaca harga tertinggi:", error);
    return {};
  }
}
