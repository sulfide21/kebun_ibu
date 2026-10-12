"use client";

import { useMemo, useState } from "react";
import KotakCari from "@/components/KotakCari";
import { buatPencocok } from "@/lib/cari";
import { rupiah } from "@/lib/format";
import BarisListing from "./BarisListing";
import type { TemplatPesan } from "@/lib/templat";
import {
  LABEL_JENIS,
  LABEL_STATUS_LISTING,
  type ListingLengkap,
} from "@/lib/types";

export default function DaftarBarangAdmin({
  daftar,
  hitung,
  templat,
}: {
  daftar: ListingLengkap[];
  hitung: Record<string, number>;
  templat: Partial<TemplatPesan>;
}) {
  const [kueri, setKueri] = useState("");

  const hasil = useMemo(() => {
    const cocok = buatPencocok(kueri);
    return daftar.filter((l) =>
      // Label statusnya ikut dicari, jadi mengetik "laku" langsung
      // menyaring yang sudah terjual.
      cocok(
        l.judul,
        l.deskripsi,
        LABEL_JENIS[l.jenis],
        LABEL_STATUS_LISTING[l.status],
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
        petunjuk="Cari judul, harga, atau status…"
        hasil={hasil.length}
        total={daftar.length}
      />

      {hasil.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-10 text-center">
          <p className="text-xl font-semibold">Tidak ketemu.</p>
          <p className="mt-2 text-daun">
            Coba kata lain, atau tekan &times; untuk melihat semuanya.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {hasil.map((l) => (
            <li key={l.id}>
              <BarisListing listing={l} jumlahPesanan={hitung[l.id] ?? 0} templat={templat} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
