"use client";

import { useMemo, useState } from "react";
import KotakCari from "@/components/KotakCari";
import { buatPencocok } from "@/lib/cari";
import {
  bulanWita,
  rupiah,
  tampilkanNoWa,
  tanggalSingkatWita,
} from "@/lib/format";
import type { PesananDenganListing } from "@/lib/types";

/** Harga yang benar-benar terjadi: tawaran kalau menawar, kalau tidak
 *  harga yang dipasang saat pesanan dibuat. */
function hargaAkhir(p: PesananDenganListing): number {
  if (p.jenis === "nawar" && p.harga_tawar !== null) return p.harga_tawar;
  return p.harga_listing ?? p.listings?.harga ?? 0;
}

export default function DaftarRiwayat({
  selesai,
}: {
  selesai: PesananDenganListing[];
}) {
  const [kueri, setKueri] = useState("");

  const hasil = useMemo(() => {
    const cocok = buatPencocok(kueri);
    return selesai.filter((p) =>
      // Nomor WhatsApp ikut dicari dalam dua bentuk, karena yang
      // diingat biasanya "0812...", bukan "62812..." yang disimpan.
      cocok(
        p.listings?.judul,
        p.judul_snapshot,
        p.nama,
        p.no_wa,
        tampilkanNoWa(p.no_wa),
        p.catatan,
        bulanWita(p.diputuskan_at ?? p.created_at),
        tanggalSingkatWita(p.diputuskan_at ?? p.created_at),
        p.jenis === "nawar" ? "nawar" : "sesuai harga",
        String(hargaAkhir(p)),
        rupiah(hargaAkhir(p)),
      ),
    );
  }, [selesai, kueri]);

  const perBulan = useMemo(() => {
    const peta = new Map<string, PesananDenganListing[]>();
    for (const p of hasil) {
      const kunci = bulanWita(p.diputuskan_at ?? p.created_at);
      const isi = peta.get(kunci) ?? [];
      isi.push(p);
      peta.set(kunci, isi);
    }
    return peta;
  }, [hasil]);

  const total = hasil.reduce((j, p) => j + hargaAkhir(p), 0);
  const menyaring = kueri.trim().length > 0;

  return (
    <>
      <KotakCari
        nilai={kueri}
        ubah={setKueri}
        label="Cari penjualan"
        petunjuk="Cari nama, barang, bulan, harga…"
        hasil={hasil.length}
        total={selesai.length}
      />

      {hasil.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-10 text-center">
          <p className="text-xl font-semibold">Tidak ketemu.</p>
          <p className="mt-2 text-daun">
            Coba kata lain, atau tekan &times; untuk melihat seluruh riwayat.
          </p>
        </div>
      ) : (
        <>
          {/* Totalnya ikut menyusut saat menyaring. Itu gunanya:
              mengetik satu nama langsung memberi jumlah belanja orang itu. */}
          <div className="mb-8 rounded-[10px] border-2 border-daun-tua bg-daun-tua px-5 py-4 text-putih">
            <p className="text-base text-putih/80">
              {menyaring
                ? `Total yang cocok dengan “${kueri}”`
                : "Total seluruh penjualan"}
            </p>
            <p className="angka text-4xl font-extrabold text-emas">
              {rupiah(total)}
            </p>
            <p className="mt-1 text-base text-putih/80">
              dari {hasil.length} penjualan
            </p>
          </div>

          <div className="grid gap-8">
            {[...perBulan.entries()].map(([bulan, isi]) => {
              const totalBulan = isi.reduce((j, p) => j + hargaAkhir(p), 0);
              const rata = Math.round(totalBulan / isi.length);

              return (
                <section key={bulan}>
                  <div className="mb-3 border-b-2 border-daun-tua pb-2">
                    <h2 className="text-xl font-bold text-daun-tua">{bulan}</h2>
                    <p className="angka text-daun">
                      {isi.length} penjualan · {rupiah(totalBulan)} · rata-rata{" "}
                      {rupiah(rata)}
                    </p>
                  </div>

                  <ul className="grid gap-2">
                    {isi.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-baseline justify-between gap-3 rounded-[10px] border-2 border-kertas-tua bg-putih px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-daun-tua">
                            {p.listings?.judul || p.judul_snapshot || "(dihapus)"}
                          </p>
                          <p className="truncate text-base text-daun">
                            {p.nama} ·{" "}
                            {tanggalSingkatWita(p.diputuskan_at ?? p.created_at)}
                            {p.jenis === "nawar" ? " · nawar" : ""}
                          </p>
                        </div>
                        <p className="angka shrink-0 text-lg font-extrabold">
                          {rupiah(hargaAkhir(p))}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
