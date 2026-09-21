import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Supabase paket gratis menidurkan database yang tidak dipakai selama
 * 7 hari. Musim mangga cuma sekali setahun, jadi tanpa ini situsnya
 * mati persis di saat paling tidak diinginkan. Vercel memanggil route
 * ini sekali sehari (lihat vercel.json) hanya untuk menyentuh database.
 */
export async function GET(request: NextRequest) {
  const rahasia = process.env.CRON_SECRET;
  if (rahasia) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${rahasia}`) {
      return new NextResponse("Tidak diizinkan", { status: 401 });
    }
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true });

    if (error) throw error;
    return NextResponse.json({ ok: true, waktu: new Date().toISOString() });
  } catch (error) {
    console.error("[keepalive] gagal:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
