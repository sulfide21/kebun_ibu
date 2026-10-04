import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { awalBulanWita, rupiah } from "@/lib/format";
import type { PesananDenganListing } from "@/lib/types";

/** Harga yang benar-benar terjadi pada satu pesanan. */
function hargaAkhir(p: PesananDenganListing): number {
  if (p.jenis === "nawar" && p.harga_tawar !== null) return p.harga_tawar;
  return p.harga_listing ?? p.listings?.harga ?? 0;
}

function rataRata(daftar: PesananDenganListing[]): number | null {
  if (daftar.length === 0) return null;
  return Math.round(
    daftar.reduce((j, p) => j + hargaAkhir(p), 0) / daftar.length,
  );
}

export default async function Ringkasan() {
  const supabase = await supabaseServer();
  const awalBulanIni = awalBulanWita(0);
  const awalBulanLalu = awalBulanWita(1);

  const [baru, menunggu, tersedia, selesai] = await Promise.all([
    supabase
      .from("pesanan")
      .select("id", { count: "exact", head: true })
      .eq("status", "baru"),
    supabase
      .from("pesanan")
      .select("id", { count: "exact", head: true })
      .eq("status", "diterima"),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "tersedia"),
    supabase
      .from("pesanan")
      .select("*, listings(id, judul, harga, satuan, status)")
      .eq("status", "selesai")
      .gte("diputuskan_at", awalBulanLalu),
  ]);

  const semuaSelesai = (selesai.data ?? []) as PesananDenganListing[];
  const bulanIni = semuaSelesai.filter(
    (p) => (p.diputuskan_at ?? p.created_at) >= awalBulanIni,
  );
  const bulanLalu = semuaSelesai.filter(
    (p) => (p.diputuskan_at ?? p.created_at) < awalBulanIni,
  );

  const totalBulanIni = bulanIni.reduce((j, p) => j + hargaAkhir(p), 0);
  const rataIni = rataRata(bulanIni);
  const rataLalu = rataRata(bulanLalu);

  const jumlahBaru = baru.count ?? 0;

  return (
    <section className="mb-8" aria-label="Ringkasan">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Satu-satunya angka yang mendesak, jadi satu-satunya yang berwarna */}
        <Petak
          label="Penawaran baru"
          nilai={String(jumlahBaru)}
          menonjol={jumlahBaru > 0}
        />
        <Petak label="Menunggu diambil" nilai={String(menunggu.count ?? 0)} />
        <Petak label="Barang tersedia" nilai={String(tersedia.count ?? 0)} />
        <Petak
          label="Penjualan bulan ini"
          nilai={totalBulanIni > 0 ? rupiah(totalBulanIni) : "—"}
          kecil
        />
      </div>

      {rataIni !== null ? (
        <p className="mt-3 rounded-[10px] border-2 border-kertas-tua bg-putih px-4 py-3">
          Harga rata-rata bulan ini{" "}
          <strong className="angka">{rupiah(rataIni)}</strong>
          {rataLalu !== null ? (
            <>
              {" "}
              — bulan lalu <span className="angka">{rupiah(rataLalu)}</span>.{" "}
              {rataIni > rataLalu
                ? "Naik, harga boleh dipertahankan."
                : rataIni < rataLalu
                  ? "Turun dari bulan lalu."
                  : "Sama dengan bulan lalu."}
            </>
          ) : (
            <> dari {bulanIni.length} penjualan.</>
          )}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link
          href="/admin/listing/baru"
          className="flex min-h-13 items-center justify-center rounded-full bg-daun-tua px-5 font-bold text-putih"
        >
          Pasang barang
        </Link>
        <Link
          href="/admin/listing"
          className="flex min-h-13 items-center justify-center rounded-full border-2 border-daun-tua px-5 font-bold text-daun-tua"
        >
          Lihat semua barang
        </Link>
      </div>
    </section>
  );
}

function Petak({
  label,
  nilai,
  menonjol = false,
  kecil = false,
}: {
  label: string;
  nilai: string;
  menonjol?: boolean;
  kecil?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border-2 px-3 py-3 ${
        menonjol
          ? "border-daun-tua bg-daun-tua"
          : "border-kertas-tua bg-putih"
      }`}
    >
      <p
        className={`angka font-extrabold ${kecil ? "text-xl" : "text-3xl"} ${
          menonjol ? "text-emas" : "text-daun-tua"
        }`}
      >
        {nilai}
      </p>
      <p
        className={`text-base leading-tight ${
          menonjol ? "text-putih/85" : "text-daun"
        }`}
      >
        {label}
      </p>
    </div>
  );
}
