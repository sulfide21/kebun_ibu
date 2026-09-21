import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Klien untuk Server Component dan Server Action.
 * Memakai anon key, jadi SEMUA aturan RLS tetap berlaku. Ini yang kita mau:
 * kalau ada kesalahan di kode, database masih jadi lapisan pengaman.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(daftarCookie) {
          try {
            for (const { name, value, options } of daftarCookie) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Dipanggil dari Server Component: cookie tidak bisa ditulis.
            // Middleware yang menyegarkan sesi, jadi ini aman diabaikan.
          }
        },
      },
    },
  );
}
