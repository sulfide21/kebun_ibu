"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import KotakCari from "@/components/KotakCari";
import { buatPencocok } from "@/lib/cari";
import { urlFoto } from "@/lib/foto";
import { rupiah } from "@/lib/format";
import { lelangTerbuka, susunBeranda } from "@/lib/lelang";
import { LABEL_JENIS, type ListingLengkap } from "@/lib/types";
import { sisaWaktu } from "@/lib/waktu";

export default function DaftarBarangPublik({
  daftar,
  tertinggi,
  sekarang,
}: {
  daftar: ListingLengkap[];
  /** Tawaran tertinggi sampai kemarin, per id barang lelang. */
  tertinggi: Record<string, number>;
  /** Jam server (ISO), supaya hitungan "3 hari lagi" sama di server dan browser. */
  sekarang: string;
}) {
  const [kueri, setKueri] = useState("");
  const waktuSekarang = useMemo(() => new Date(sekarang), [sekarang]);

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
        l.mode === "lelang" ? "lelang" : undefined,
      ),
    );
  }, [daftar, kueri]);

  const { lelang, lainnya } = useMemo(
    () => susunBeranda(hasil, waktuSekarang),
    [hasil, waktuSekarang],
  );

  const kartu = (listing: ListingLengkap) => (
    <li key={listing.id}>
      <KartuListing
        listing={listing}
        tertinggi={tertinggi[listing.id]}
        sekarang={waktuSekarang}
      />
    </li>
  );

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
        <>
          {lelang.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-4 text-2xl font-extrabold text-daun-tua">
                Sedang dilelang
              </h2>
              <ul className="grid gap-6">{lelang.map(kartu)}</ul>
            </section>
          ) : null}

          {lainnya.length > 0 ? (
            <section>
              {lelang.length > 0 ? (
                <h2 className="mb-4 text-2xl font-extrabold text-daun-tua">
                  Dijual
                </h2>
              ) : null}
              <ul className="grid gap-6">{lainnya.map(kartu)}</ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function KartuListing({
  listing,
  tertinggi,
  sekarang,
}: {
  listing: ListingLengkap;
  tertinggi: number | undefined;
  sekarang: Date;
}) {
  const foto = [...(listing.listing_foto ?? [])].sort(
    (a, b) => a.urutan - b.urutan,
  )[0];
  const laku = listing.status === "sudah_laku";
  const lelang = listing.mode === "lelang";
  const terbuka = lelangTerbuka(listing, sekarang);
  const harga = lelang ? (tertinggi ?? listing.harga) : listing.harga;

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

        {lelang && !laku ? (
          <span className="absolute top-3 right-3 rounded-full border-2 border-daun-tua bg-emas px-4 py-1 text-sm font-extrabold tracking-wide text-daun-tua">
            LELANG
          </span>
        ) : null}

        {/* Harga ditempel di tepi bawah foto, seperti label di peti buah */}
        <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-3 bg-linear-to-t from-black/70 to-transparent px-4 pt-10 pb-3">
          <div>
            {lelang ? (
              <p className="text-sm font-semibold text-white/90">
                {tertinggi !== undefined ? "Tertinggi" : "Mulai"}
              </p>
            ) : null}
            <p className="angka text-3xl font-extrabold text-emas">
              {rupiah(harga)}
            </p>
          </div>
          <p className="pb-1.5 text-sm font-semibold text-white/90">
            {listing.satuan}
          </p>
        </div>
      </div>

      <div className="px-4 py-4">
        <h2 className="text-xl font-bold text-daun-tua">{listing.judul}</h2>
        {/* Lelang yang masih "segera" cukup ditandai lencana Segera */}
        {lelang && !laku && listing.status !== "segera" && listing.batas_waktu ? (
          <p className="mt-1 font-semibold text-daun-tua">
            {terbuka
              ? `Ditutup ${sisaWaktu(new Date(listing.batas_waktu), sekarang)}`
              : "Lelang ditutup"}
          </p>
        ) : null}
        {listing.deskripsi ? (
          <p className="mt-1 line-clamp-2 text-daun">{listing.deskripsi}</p>
        ) : null}
      </div>
    </Link>
  );
}
