import { createBrowserClient } from "@supabase/ssr";

/**
 * Klien untuk Client Component (login, unggah foto).
 * Anon key memang ikut terkirim ke browser - itu wajar dan bukan rahasia.
 * Yang menjaga data adalah RLS di database, bukan kerahasiaan kunci ini.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
