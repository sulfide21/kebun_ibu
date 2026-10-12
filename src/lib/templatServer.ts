import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type { TemplatPesan } from "./templat";

/**
 * Templat untuk pemberitahuan WhatsApp. Pesanan dikirim pembeli tanpa
 * login, sedangkan tabel templat hanya boleh dibaca pengelola, jadi
 * dibaca lewat service role. Yang keluar dari sini hanya teks templat.
 *
 * Tidak pernah melempar: gagal dibaca (termasuk tabel belum dibuat) =
 * {} = teks bawaan. Pemberitahuan tetap terkirim.
 */
export async function ambilTemplat(): Promise<Partial<TemplatPesan>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("templat_pesan")
      .select("wa_pesan, wa_lelang")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data ?? {};
  } catch (error) {
    console.error("[templat] gagal membaca templat:", error);
    return {};
  }
}
