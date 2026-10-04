import { createClient } from "@supabase/supabase-js";

/**
 * Service role MENEMBUS seluruh RLS. Hanya untuk hal yang memang tidak bisa
 * dikerjakan dengan anon key - di proyek ini dua: mengecek pesanan ganda
 * sebelum menyimpan, dan membaca harga lelang tertinggi untuk halaman publik
 * (hanya angkanya yang keluar).
 *
 * Kunci ini tidak boleh pernah masuk ke NEXT_PUBLIC_*, tidak boleh diimpor
 * dari Client Component, dan tidak boleh dikirim ke browser.
 */
export function supabaseAdmin() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin() tidak boleh dipanggil dari browser.");
  }

  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!kunci) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, kunci, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
