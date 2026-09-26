"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import KotakCari from "@/components/KotakCari";
import { buatPencocok } from "@/lib/cari";
import { urlFoto } from "@/lib/foto";
import { rupiah } from "@/lib/format";
import { LABEL_JENIS, type ListingLengkap } from "@/lib/types";

export default function DaftarBarangPublik({
  daftar,
}: {
  daftar: ListingLengkap[];
}) {
  const [kueri, setKueri] = useState("");

  const hasil = useMemo(() => {
    const cocok = buatPencocok(kueri);
    return daftar.filter((l) =>
      // Nama jenisnya ikut dicari, jadi mengetik "pisang" tetap ketemu
      // walau judulnya cuma "Setandan besar".
      cocok(
        l.judul,
        l.deskripsi,
        LABEL_JENIS[l.jenis],
        l.satuan,
        String(l.harga),
        rupiah(l.harga),
      ),
    );
  }, [daftar, kueri]);

  return (
    <>
      <KotakCari
        nilai={kueri}
        ubah={setKueri}
        label="Cari barang"
        petunjuk="Cari mangga, pisang, harga…"
        hasil={hasil.length}
        total={daftar.length}
      />

      {hasil.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-12 text-center">
          <p className="text-xl font-semibold">Tidak ketemu.</p>
          <p className="mt-2 text-daun">
            Coba kata lain, atau kosongkan kotak pencarian untuk melihat
            semuanya.
          </p>
        </div>
      ) : (
        <ul className="grid gap-6">
          {hasil.map((listing) => (
            <li key={listing.id}>
              <KartuListing listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </>
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
