"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { hapusListing } from "../actions";
import { urlFoto } from "@/lib/foto";
import { rupiah } from "@/lib/format";
import { formatWita } from "@/lib/waktu";
import TombolBagikan from "@/components/TombolBagikan";
import { LABEL_STATUS_LISTING, type ListingLengkap } from "@/lib/types";

const WARNA_STATUS: Record<string, string> = {
  tersedia: "bg-daun text-putih",
  segera: "bg-emas text-daun-tua",
  sudah_laku: "bg-kertas-tua text-daun-tua",
};

export default function BarisListing({
  listing,
  jumlahPesanan,
}: {
  listing: ListingLengkap;
  jumlahPesanan: number;
}) {
  const [menunggu, mulai] = useTransition();
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const foto = [...(listing.listing_foto ?? [])].sort(
    (a, b) => a.urutan - b.urutan,
  )[0];

  return (
    <article className="rounded-[10px] border-2 border-daun-tua bg-putih p-3">
      <div className="flex gap-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-[6px] border-2 border-kertas-tua bg-kertas-tua">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlFoto(foto.path)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate font-bold text-daun-tua">{listing.judul}</h2>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${
                WARNA_STATUS[listing.status]
              }`}
            >
              {LABEL_STATUS_LISTING[listing.status]}
            </span>
          </div>
          <p className="angka mt-0.5 text-xl font-extrabold">
            {rupiah(listing.harga)}
            <span className="ml-1 text-base font-semibold text-daun">
              {listing.satuan}
            </span>
          </p>
          {listing.mode === "lelang" ? (
            <p className="text-base font-semibold text-daun-tua">
              Lelang · ditutup{" "}
              {listing.batas_waktu ? formatWita(new Date(listing.batas_waktu)) : "-"}
            </p>
          ) : null}
          <p className="text-base text-daun">
            {jumlahPesanan > 0
              ? `${jumlahPesanan} ${listing.mode === "lelang" ? "tawaran" : "pesanan"} masuk`
              : listing.mode === "lelang"
                ? "Belum ada tawaran"
                : "Belum ada pesanan"}
          </p>
        </div>
      </div>

      {listing.mode === "lelang" ? (
        <Link
          href={`/admin/listing/${listing.id}/tawaran`}
          className="mt-3 flex min-h-13 items-center justify-center rounded-full bg-daun-tua px-4 font-bold text-putih"
        >
          Lihat tawaran
        </Link>
      ) : null}

      {galat ? (
        <p className="mt-3 rounded-[6px] border-2 border-bata px-3 py-2 font-semibold text-bata">
          {galat}
        </p>
      ) : null}

      {konfirmasi ? (
        <div className="mt-3 rounded-[10px] border-2 border-bata bg-kertas px-4 py-3">
          <p className="font-bold">Hapus &ldquo;{listing.judul}&rdquo;?</p>
          <p className="mt-1 text-base text-daun">
            Fotonya ikut terhapus dan tidak bisa dikembalikan. Penjualan yang
            sudah selesai tetap tersimpan di Riwayat. Kalau cuma mau
            menyembunyikan dari halaman depan, ubah saja statusnya jadi
            &ldquo;Sudah laku&rdquo;.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() =>
                mulai(async () => {
                  const hasil = await hapusListing(listing.id);
                  if (!hasil.ok) setGalat(hasil.pesan ?? "Gagal menghapus.");
                })
              }
              disabled={menunggu}
              className="min-h-13 rounded-full bg-bata px-5 font-bold text-putih disabled:opacity-60"
            >
              {menunggu ? "Menghapus…" : "Ya, hapus"}
            </button>
            <button
              onClick={() => setKonfirmasi(false)}
              className="min-h-13 rounded-full border-2 border-daun-tua px-5 font-bold"
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <TombolBagikan listing={listing} />
          <Link
            href={`/admin/listing/${listing.id}`}
            className="flex min-h-13 items-center justify-center rounded-full border-2 border-daun-tua px-4 font-bold"
          >
            Ubah
          </Link>
          <button
            onClick={() => setKonfirmasi(true)}
            className="min-h-13 rounded-full border-2 border-bata px-4 font-bold text-bata"
          >
            Hapus
          </button>
        </div>
      )}
    </article>
  );
}
