import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { urlFoto, urutkanListing } from "@/lib/foto";
import { rupiah } from "@/lib/format";
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

  const daftar = urutkanListing((listings ?? []) as ListingLengkap[]);
  const setelan = pengaturan as Pengaturan | null;
  const adaYangDijual = daftar.some((l) => l.status === "tersedia");

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

          <ul className="grid gap-6">
            {daftar.map((listing) => (
              <li key={listing.id}>
                <KartuListing listing={listing} />
              </li>
            ))}
          </ul>
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

function KartuListing({ listing }: { listing: ListingLengkap }) {
  const foto = [...(listing.listing_foto ?? [])].sort(
    (a, b) => a.urutan - b.urutan,
  )[0];
  const laku = listing.status === "sudah_laku";

  return (
    <Link
      href={`/l/${listing.id}`}
      className="block overflow-hidden rounded-[10px] border-2 border-daun-tua bg-putih"
    >
      <div className="relative aspect-4/3 bg-kertas-tua">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFoto(foto.path)}
            alt={listing.judul}
            className={`h-full w-full object-cover ${laku ? "opacity-55" : ""}`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-daun-muda">
            Tanpa foto
          </div>
        )}

        {laku ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="stempel rounded-[6px] px-5 py-2 text-2xl">
              Sudah laku
            </span>
          </div>
        ) : null}

        {listing.status === "segera" ? (
          <span className="absolute top-3 left-3 rounded-full bg-daun-tua px-4 py-1.5 text-sm font-semibold text-putih">
            Segera
          </span>
        ) : null}

        {/* Harga ditempel di tepi bawah foto, seperti label di peti buah */}
        <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-3 bg-linear-to-t from-black/70 to-transparent px-4 pt-10 pb-3">
          <p className="angka text-3xl font-extrabold text-emas">
            {rupiah(listing.harga)}
          </p>
          <p className="pb-1.5 text-sm font-semibold text-white/90">
            {listing.satuan}
          </p>
        </div>
      </div>

      <div className="px-4 py-4">
        <h2 className="text-xl font-bold text-daun-tua">{listing.judul}</h2>
        {listing.deskripsi ? (
          <p className="mt-1 line-clamp-2 text-daun">{listing.deskripsi}</p>
        ) : null}
      </div>
    </Link>
  );
}
