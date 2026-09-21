import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { LABEL_STATUS_PESANAN, type PesananDenganListing } from "@/lib/types";
import KartuPesanan from "./KartuPesanan";

export const revalidate = 0;

const SARINGAN = [
  { nilai: "baru", label: "Baru" },
  { nilai: "diterima", label: "Diterima" },
  { nilai: "selesai", label: "Selesai" },
  { nilai: "semua", label: "Semua" },
] as const;

export default async function KotakMasuk({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "baru" } = await searchParams;
  const supabase = await supabaseServer();

  let query = supabase
    .from("pesanan")
    .select("*, listings(id, judul, harga, satuan, status)")
    .order("created_at", { ascending: false });

  if (status !== "semua") query = query.eq("status", status);

  const [{ data: pesanan }, { count: jumlahBaru }] = await Promise.all([
    query,
    supabase
      .from("pesanan")
      .select("id", { count: "exact", head: true })
      .eq("status", "baru"),
  ]);

  const daftar = (pesanan ?? []) as PesananDenganListing[];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold text-daun-tua">Kotak masuk</h1>
        <p className="mt-1 text-daun">
          {jumlahBaru && jumlahBaru > 0
            ? `${jumlahBaru} penawaran menunggu dijawab.`
            : "Tidak ada penawaran yang menunggu."}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {SARINGAN.map((s) => {
          const aktif = status === s.nilai;
          return (
            <Link
              key={s.nilai}
              href={`/admin?status=${s.nilai}`}
              className={`inline-flex min-h-11 items-center rounded-full border-2 border-daun-tua px-4 font-semibold ${
                aktif ? "bg-daun-tua text-putih" : "bg-putih text-daun-tua"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {daftar.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-12 text-center">
          <p className="text-xl font-semibold">
            Belum ada pesanan{" "}
            {status === "semua"
              ? ""
              : `berstatus "${LABEL_STATUS_PESANAN[status as keyof typeof LABEL_STATUS_PESANAN] ?? status}"`}
            .
          </p>
          <p className="mt-2 text-daun">
            Pasang barang dulu, lalu bagikan linknya ke grup keluarga.
          </p>
          <Link
            href="/admin/listing/baru"
            className="mt-5 inline-block min-h-13 rounded-full bg-daun-tua px-6 py-3 font-bold text-putih"
          >
            Pasang barang
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4">
          {daftar.map((p) => (
            <li key={p.id}>
              <KartuPesanan pesanan={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
