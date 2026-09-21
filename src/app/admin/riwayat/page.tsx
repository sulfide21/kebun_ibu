import { supabaseServer } from "@/lib/supabase/server";
import { bulanWIB, rupiah, tanggalSingkatWIB } from "@/lib/format";
import type { PesananDenganListing } from "@/lib/types";

export const revalidate = 0;

/** Harga yang benar-benar terjadi: tawaran kalau menawar, kalau tidak
 *  harga yang dipasang saat pesanan dibuat. */
function hargaAkhir(p: PesananDenganListing): number {
  if (p.jenis === "nawar" && p.harga_tawar !== null) return p.harga_tawar;
  return p.harga_listing ?? p.listings?.harga ?? 0;
}

export default async function Riwayat() {
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("pesanan")
    .select("*, listings(id, judul, harga, satuan, status)")
    .eq("status", "selesai")
    .order("diputuskan_at", { ascending: false });

  const selesai = (data ?? []) as PesananDenganListing[];

  const perBulan = new Map<string, PesananDenganListing[]>();
  for (const p of selesai) {
    const kunci = bulanWIB(p.diputuskan_at ?? p.created_at);
    const isi = perBulan.get(kunci) ?? [];
    isi.push(p);
    perBulan.set(kunci, isi);
  }

  const totalSemua = selesai.reduce((j, p) => j + hargaAkhir(p), 0);

  return (
    <>
      <h1 className="mb-1 text-3xl font-extrabold text-daun-tua">Riwayat</h1>
      <p className="mb-6 text-daun">
        Penjualan yang sudah selesai. Berguna untuk menentukan harga musim
        berikutnya.
      </p>

      {selesai.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-12 text-center">
          <p className="text-xl font-semibold">Belum ada penjualan selesai.</p>
          <p className="mt-2 text-daun">
            Penawaran yang sudah ditandai &ldquo;sudah diambil &amp; lunas&rdquo;
            akan muncul di sini.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8 rounded-[10px] border-2 border-daun-tua bg-daun-tua px-5 py-4 text-putih">
            <p className="text-base text-putih/80">Total seluruh penjualan</p>
            <p className="angka text-4xl font-extrabold text-emas">
              {rupiah(totalSemua)}
            </p>
            <p className="mt-1 text-base text-putih/80">
              dari {selesai.length} penjualan
            </p>
          </div>

          <div className="grid gap-8">
            {[...perBulan.entries()].map(([bulan, isi]) => {
              const total = isi.reduce((j, p) => j + hargaAkhir(p), 0);
              const rata = Math.round(total / isi.length);

              return (
                <section key={bulan}>
                  <div className="mb-3 border-b-2 border-daun-tua pb-2">
                    <h2 className="text-xl font-bold text-daun-tua">{bulan}</h2>
                    <p className="angka text-daun">
                      {isi.length} penjualan · {rupiah(total)} · rata-rata{" "}
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
                            {tanggalSingkatWIB(p.diputuskan_at ?? p.created_at)}
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
