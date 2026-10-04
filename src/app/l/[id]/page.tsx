import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { urlFoto } from "@/lib/foto";
import { rupiah, waktuLalu } from "@/lib/format";
import { ambilTertinggiKemarin } from "@/lib/hargaLelang";
import { lelangTerbuka } from "@/lib/lelang";
import { LABEL_JENIS, type ListingLengkap } from "@/lib/types";
import FormPesanan from "./FormPesanan";
import HargaLelang from "./HargaLelang";

export const revalidate = 0;

export default async function DetailListing({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("listings")
    .select("*, listing_foto(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const listing = data as ListingLengkap;
  const foto = [...(listing.listing_foto ?? [])].sort(
    (a, b) => a.urutan - b.urutan,
  );

  const sekarang = new Date();
  const lelang = listing.mode === "lelang";
  const bisaDibeli = lelang
    ? lelangTerbuka(listing, sekarang)
    : listing.status === "tersedia";
  const lelangDitutup = lelang && listing.status === "tersedia" && !bisaDibeli;
  const tertinggi = lelang
    ? ((await ambilTertinggiKemarin([listing.id], sekarang))[listing.id] ?? null)
    : null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-20">
      <nav className="py-5">
        <Link href="/" className="text-base text-daun underline">
          ← Kembali ke daftar
        </Link>
      </nav>

      {foto.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2">
          {foto.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.id}
              src={urlFoto(f.path)}
              alt={listing.judul}
              className="aspect-4/3 w-[85%] shrink-0 snap-center rounded-[6px] border-2 border-daun-tua object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="flex aspect-4/3 items-center justify-center rounded-[6px] border-2 border-dashed border-daun-muda bg-putih text-daun-muda">
          Tanpa foto
        </div>
      )}

      <div className="mt-6">
        <p className="font-semibold text-daun">
          {LABEL_JENIS[listing.jenis]}
          {lelang ? (
            <span className="ml-2 rounded-full bg-emas px-3 py-0.5 text-sm font-extrabold tracking-wide text-daun-tua">
              LELANG
            </span>
          ) : null}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-daun-tua">
          {listing.judul}
        </h1>

        {lelang ? (
          <HargaLelang
            hargaMinimum={listing.harga}
            tertinggi={tertinggi}
            batas={listing.batas_waktu}
            satuan={listing.satuan}
            sekarang={sekarang}
          />
        ) : (
          <p className="angka mt-4 text-4xl font-extrabold text-emas-tua">
            {rupiah(listing.harga)}
            <span className="ml-2 text-xl font-semibold text-daun">
              {listing.satuan}
            </span>
          </p>
        )}

        {listing.deskripsi ? (
          <p className="mt-5 whitespace-pre-wrap text-lg">{listing.deskripsi}</p>
        ) : null}

        <p className="mt-4 text-base text-daun">
          Dipasang {waktuLalu(listing.created_at)}
        </p>
      </div>

      <div className="mt-8">
        {bisaDibeli ? (
          <FormPesanan
            listingId={listing.id}
            judul={listing.judul}
            harga={listing.harga}
            satuan={listing.satuan}
            jenis={lelang ? "lelang" : "pesan"}
          />
        ) : (
          <div className="rounded-[10px] border-2 border-daun-tua bg-putih px-5 py-6 text-center">
            <p className="text-xl font-bold text-daun-tua">
              {listing.status === "sudah_laku"
                ? "Barang ini sudah laku."
                : lelangDitutup
                  ? "Lelang sudah ditutup."
                  : "Belum dibuka."}
            </p>
            <p className="mt-2 text-daun">
              {listing.status === "sudah_laku"
                ? "Nanti kalau panen lagi, Ibu kabari di grup keluarga."
                : lelangDitutup
                  ? "Ibu sedang memilih pemenang. Kalau terpilih, Ibu akan menghubungi lewat WhatsApp."
                  : "Tunggu kabar dari Ibu ya, sebentar lagi dibuka."}
            </p>
            <Link
              href="/"
              className="mt-5 inline-block min-h-13 rounded-full border-2 border-daun-tua px-6 py-3 font-bold text-daun-tua"
            >
              Lihat yang lain
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
