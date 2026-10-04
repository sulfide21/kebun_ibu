"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  batalkanTolak,
  terimaPesanan,
  tolakPenawar,
  tolakSemuaTawaran,
  tutupLelangSekarang,
  ubahStatusPesanan,
  type HasilAksi,
} from "@/app/admin/actions";
import { rupiah, tampilkanNoWa } from "@/lib/format";
import type { Penawar, Urutan } from "@/lib/lelang";
import { linkWa, pesanMenangLelang } from "@/lib/wa";
import { formatWita } from "@/lib/waktu";

/** `noWa` diisi kalau pertanyaannya milik satu baris penawar; kotaknya
 *  lalu tampil tepat di bawah baris itu, bukan di atas daftar. */
type Pertanyaan = {
  teks: string;
  ya: string;
  aksi: () => Promise<HasilAksi>;
  noWa?: string;
};

const kelasUtama =
  "min-h-13 rounded-full bg-daun-tua px-5 font-bold text-putih disabled:opacity-50";
const kelasKedua =
  "min-h-13 rounded-full border-2 border-daun-tua bg-putih px-5 font-bold disabled:opacity-50";

export default function DaftarTawaran({
  listingId,
  judul,
  terbuka,
  urut,
  aktif,
  ditolak,
  pemenang,
}: {
  listingId: string;
  judul: string;
  terbuka: boolean;
  urut: Urutan;
  aktif: Penawar[];
  ditolak: Penawar[];
  pemenang: Penawar | null;
}) {
  const [menunggu, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);
  const [tanya, setTanya] = useState<Pertanyaan | null>(null);
  const kotakTanya = useRef<HTMLDivElement>(null);
  const kotakGalat = useRef<HTMLParagraphElement>(null);

  // Di HP kotak bisa muncul di luar layar; gulir ke sana supaya terlihat.
  useEffect(() => {
    if (tanya) kotakTanya.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [tanya]);
  useEffect(() => {
    if (galat) kotakGalat.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [galat]);

  function jalankan(aksi: () => Promise<HasilAksi>) {
    setGalat(null);
    mulai(async () => {
      const hasil = await aksi();
      if (!hasil.ok) setGalat(hasil.pesan ?? "Gagal.");
      setTanya(null);
    });
  }

  const bisaPilih = !terbuka && pemenang === null;

  const tampilkanTanya = (t: Pertanyaan) => (
    <div ref={kotakTanya} className="rounded-[10px] border-2 border-daun bg-kertas px-4 py-4">
      <p className="font-bold">{t.teks}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button disabled={menunggu} onClick={() => jalankan(t.aksi)} className={kelasUtama}>
          {menunggu ? "Sebentar…" : t.ya}
        </button>
        <button disabled={menunggu} onClick={() => setTanya(null)} className={kelasKedua}>
          Batal
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-6 grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Urutkan:</span>
        {(["tertinggi", "terbaru"] as const).map((u) => (
          <Link
            key={u}
            href={`/admin/listing/${listingId}/tawaran?urut=${u}`}
            className={`inline-flex min-h-11 items-center rounded-full border-2 border-daun-tua px-4 font-semibold ${
              urut === u ? "bg-daun-tua text-putih" : "bg-putih text-daun-tua"
            }`}
          >
            {u === "tertinggi" ? "Tertinggi" : "Terbaru"}
          </Link>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {terbuka ? (
          <button
            disabled={menunggu}
            onClick={() =>
              setTanya({
                teks: "Tutup lelang sekarang? Setelah ditutup, kerabat tidak bisa menawar lagi.",
                ya: "Ya, tutup",
                aksi: () => tutupLelangSekarang(listingId),
              })
            }
            className={kelasKedua}
          >
            Tutup lelang sekarang
          </button>
        ) : null}
        {aktif.length > 0 ? (
          <button
            disabled={menunggu}
            onClick={() =>
              setTanya({
                teks: `Tolak semua ${aktif.length} penawar? Lelang tetap terbuka sampai batas waktunya.`,
                ya: "Ya, tolak semua",
                aksi: () => tolakSemuaTawaran(listingId),
              })
            }
            className="min-h-13 rounded-full border-2 border-bata bg-putih px-5 font-bold text-bata disabled:opacity-50"
          >
            Tolak semua
          </button>
        ) : null}
      </div>

      {tanya && !tanya.noWa ? tampilkanTanya(tanya) : null}

      {galat ? (
        <p
          ref={kotakGalat}
          className="rounded-[6px] border-2 border-bata px-3 py-2 font-semibold text-bata"
        >
          {galat}
        </p>
      ) : null}

      {pemenang ? (
        <section className="rounded-[10px] border-2 border-daun bg-putih px-4 py-4">
          <p className="text-sm font-extrabold tracking-wide text-daun">
            {pemenang.terbaru.status === "selesai" ? "SUDAH LUNAS" : "PEMENANG"}
          </p>
          <p className="text-xl font-bold text-daun-tua">{pemenang.nama}</p>
          <p className="angka text-3xl font-extrabold">
            {rupiah(pemenang.terbaru.harga_tawar ?? 0)}
          </p>
          <p className="text-base text-daun">{tampilkanNoWa(pemenang.no_wa)}</p>
          {pemenang.terbaru.status === "diterima" ? (
            <div className="mt-4 grid gap-2">
              <a
                href={linkWa(
                  pemenang.no_wa,
                  pesanMenangLelang(pemenang.nama, judul, pemenang.terbaru.harga_tawar ?? 0),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-13 items-center justify-center rounded-full bg-emas px-5 font-bold text-daun-tua"
              >
                Hubungi lewat WhatsApp
              </a>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  disabled={menunggu}
                  onClick={() => jalankan(() => ubahStatusPesanan(pemenang.terbaru.id, "selesai"))}
                  className={kelasUtama}
                >
                  Sudah diambil &amp; lunas
                </button>
                <button
                  disabled={menunggu}
                  onClick={() =>
                    setTanya({
                      teks: `${pemenang.nama} tidak jadi ambil? Barangnya dibuka lagi supaya Ibu bisa memilih penawar berikutnya.`,
                      ya: "Ya, tidak jadi",
                      aksi: () => ubahStatusPesanan(pemenang.terbaru.id, "batal"),
                    })
                  }
                  className={kelasKedua}
                >
                  Tidak jadi ambil
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {aktif.length === 0 ? (
        <div className="rounded-[10px] border-2 border-dashed border-daun-muda bg-putih px-6 py-10 text-center">
          <p className="text-xl font-semibold">Belum ada tawaran.</p>
        </div>
      ) : (
        <ol className="grid gap-3">
          {aktif.map((p, i) => (
            <li key={p.no_wa} className="rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-lg font-bold text-daun-tua">
                  {i + 1}. {p.nama}
                </p>
                <p className="angka shrink-0 text-2xl font-extrabold">
                  {rupiah(p.terbaru.harga_tawar ?? 0)}
                </p>
              </div>
              <p className="text-base text-daun">
                {formatWita(new Date(p.terbaru.created_at))}
                {p.jumlahNaik > 0 ? ` · naik ${p.jumlahNaik}x` : ""} · {tampilkanNoWa(p.no_wa)}
              </p>
              {p.terbaru.catatan ? (
                <p className="mt-2 rounded-[6px] bg-kertas px-3 py-2">{p.terbaru.catatan}</p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  disabled={menunggu || !bisaPilih}
                  onClick={() =>
                    setTanya({
                      teks: `Pilih ${p.nama} dengan ${rupiah(p.terbaru.harga_tawar ?? 0)}? Barangnya ditandai sudah laku. Penawar lain tetap disimpan sebagai cadangan.`,
                      ya: "Ya, pilih",
                      aksi: () => terimaPesanan(p.terbaru.id, true, false),
                      noWa: p.no_wa,
                    })
                  }
                  className={kelasUtama}
                >
                  Pilih
                </button>
                <button
                  disabled={menunggu}
                  onClick={() => jalankan(() => tolakPenawar(listingId, p.no_wa))}
                  className={kelasKedua}
                >
                  Tolak
                </button>
              </div>
              {tanya?.noWa === p.no_wa ? <div className="mt-3">{tampilkanTanya(tanya)}</div> : null}
            </li>
          ))}
        </ol>
      )}

      {terbuka && aktif.length > 0 ? (
        <p className="text-base text-daun">
          Tombol Pilih bisa ditekan setelah lelang ditutup.
        </p>
      ) : null}

      {ditolak.length > 0 ? (
        <details className="rounded-[10px] border-2 border-kertas-tua bg-putih px-4 py-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            Ditolak ({ditolak.length})
          </summary>
          <ul className="mt-2 grid gap-2">
            {ditolak.map((p) => (
              <li key={p.no_wa} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {p.nama} · {rupiah(p.terbaru.harga_tawar ?? 0)}
                  {p.terbaru.status === "batal" ? " · batal" : ""}
                </span>
                {p.terbaru.status === "ditolak" ? (
                  <button
                    disabled={menunggu}
                    onClick={() => jalankan(() => batalkanTolak(listingId, p.no_wa))}
                    className="min-h-11 shrink-0 rounded-full border-2 border-daun-tua px-4 font-semibold disabled:opacity-50"
                  >
                    Batalkan
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
