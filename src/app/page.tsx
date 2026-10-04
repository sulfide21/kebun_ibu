import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ambilTertinggiKemarin } from "@/lib/hargaLelang";
import { lelangTerbuka } from "@/lib/lelang";
import DaftarBarangPublik from "./DaftarBarangPublik";
import type { ListingLengkap, Pengaturan } from "@/lib/types";

export const revalidate = 0;

export default async function Beranda() {
  const supabase = await supabaseServer();

  const [{ data: listings }, { data: pengaturan }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, listing_foto(*)")
      .order("created_at", { ascending: false }),
    supabase.from("pengaturan").select("*").eq("id", 1).single(),
  ]);

  const daftar = (listings ?? []) as ListingLengkap[];
  const setelan = pengaturan as Pengaturan | null;
  const sekarang = new Date();
  const tertinggi = await ambilTertinggiKemarin(
    daftar.filter((l) => l.mode === "lelang").map((l) => l.id),
    sekarang,
  );
  const adaYangDijual = daftar.some((l) =>
    l.mode === "lelang" ? lelangTerbuka(l, sekarang) : l.status === "tersedia",
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-20">
      <header className="pt-10 pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-daun-tua">
          Kebun Ibu
        </h1>
        <p className="mt-1 text-daun">
          Mangga dan pisang, dipetik sendiri, dijual ke keluarga.
        </p>
      </header>

      {setelan?.tampilkan_banner && setelan.teks_musim ? (
        <div className="papan mb-8 rounded-[10px] bg-daun-tua px-5 py-4 text-putih">
          <p className="text-lg font-semibold">{setelan.teks_musim}</p>
        </div>
      ) : null}

      {daftar.length === 0 ? (
        <KosongTotal />
      ) : (
        <>
          {!adaYangDijual ? (
            <p className="mb-6 rounded-[10px] border-2 border-kertas-tua bg-putih px-5 py-4">
              Belum ada yang dijual sekarang. Yang di bawah ini sudah laku —
              nanti kalau panen lagi, Ibu kabari di grup.
            </p>
          ) : null}

          <DaftarBarangPublik
            daftar={daftar}
            tertinggi={tertinggi}
            sekarang={sekarang.toISOString()}
          />
        </>
      )}

      <footer className="mt-16 border-t-2 border-kertas-tua pt-5">
        <Link href="/admin" className="text-base text-daun underline">
          Masuk sebagai penjual
        </Link>
      </footer>
    </main>
  );
}

function KosongTotal() {
  return (
    <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-12 text-center">
      <p className="text-xl font-semibold">Belum ada barang yang dipasang.</p>
      <p className="mt-2 text-daun">
        Kalau panen sudah siap, barangnya akan muncul di sini.
      </p>
    </div>
  );
}
