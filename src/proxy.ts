import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Dua tugas:
 * 1. Menyegarkan sesi Supabase supaya Ibu/Bapak tidak logout sendiri.
 * 2. Menjaga /admin. Ini lapis pertama saja - RLS di database tetap
 *    jadi penjaga sebenarnya kalau lapisan ini tembus.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(daftarCookie) {
          for (const { name, value } of daftarCookie) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of daftarCookie) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const halamanLogin = path.startsWith("/admin/login");

  if (path.startsWith("/admin") && !halamanLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("lanjut", path);
    return NextResponse.redirect(url);
  }

  if (halamanLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
