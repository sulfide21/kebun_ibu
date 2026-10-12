"use client";

import { useMemo, useState } from "react";
import KotakCari from "@/components/KotakCari";
import { ringkasLelang, saringKotakMasuk } from "@/lib/lelang";
import type { PesananDenganListing } from "@/lib/types";
import KartuLelang from "./KartuLelang";
import KartuPesanan from "./KartuPesanan";

export default function DaftarKotakMasuk({
  daftar,
  sekarang,
}: {
  daftar: PesananDenganListing[];
  sekarang: string;
}) {
  const [kueri, setKueri] = useState("");

  const { lelang, biasa } = useMemo(() => saringKotakMasuk(daftar, kueri), [daftar, kueri]);
  // Satu kartu lelang dihitung satu, sama seperti yang terlihat di layar.
  const total = useMemo(
    () => ringkasLelang(daftar).length + daftar.filter((p) => p.jenis !== "lelang").length,
    [daftar],
  );
  const hasil = lelang.length + biasa.length;
  // Waktu dibuat di server dan dikirim sebagai teks, supaya sisa waktu
  // lelang sama antara server dan browser.
  const waktu = new Date(sekarang);

  return (
    <>
      <KotakCari
        nilai={kueri}
        ubah={setKueri}
        label="Cari pesanan"
        petunjuk="Cari nama, nomor WA, barang…"
        hasil={hasil}
        total={total}
      />

      {hasil === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-10 text-center">
          <p className="text-xl font-semibold">Tidak ketemu.</p>
          <p className="mt-2 text-daun">
            Coba kata lain, atau tekan &times; untuk melihat semua pesanan.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {lelang.map((r) => (
            <KartuLelang key={r.listing.id} ringkasan={r} sekarang={waktu} />
          ))}
          <ul className="grid gap-4">
            {biasa.map((p) => (
              <li key={p.id}>
                <KartuPesanan pesanan={p} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
