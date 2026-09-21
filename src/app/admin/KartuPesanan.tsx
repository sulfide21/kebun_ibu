"use client";

import { useState, useTransition } from "react";
import {
  hapusPesanan,
  terimaPesanan,
  ubahStatusPesanan,
} from "./actions";
import { rupiah, tampilkanNoWa, waktuLalu } from "@/lib/format";
import { linkWa, pesanPenawaranDiterima } from "@/lib/wa";
import { LABEL_STATUS_PESANAN, type PesananDenganListing } from "@/lib/types";

const WARNA_STATUS: Record<string, string> = {
  baru: "bg-emas text-daun-tua",
  diterima: "bg-daun text-putih",
  selesai: "bg-daun-tua text-putih",
  ditolak: "bg-kertas-tua text-daun-tua",
  batal: "bg-bata text-putih",
};

export default function KartuPesanan({
  pesanan,
}: {
  pesanan: PesananDenganListing;
}) {
  const [menunggu, mulai] = useTransition();
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [tandaiLaku, setTandaiLaku] = useState(true);
  const [tolakLain, setTolakLain] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const harga =
    pesanan.jenis === "nawar" && pesanan.harga_tawar !== null
      ? pesanan.harga_tawar
      : (pesanan.harga_listing ?? pesanan.listings?.harga ?? 0);
  const judul = pesanan.listings?.judul || pesanan.judul_snapshot;

  function jalankan(aksi: () => Promise<{ ok: boolean; pesan?: string }>) {
    setGalat(null);
    mulai(async () => {
      const hasil = await aksi();
      if (!hasil.ok) setGalat(hasil.pesan ?? "Gagal.");
      else setKonfirmasi(false);
    });
  }

  return (
    <article className="rounded-[10px] border-2 border-daun-tua bg-putih">
      <div className="flex items-start justify-between gap-3 border-b-2 border-kertas-tua px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-daun-tua">
            {pesanan.nama}
          </p>
          <p className="truncate text-base text-daun">
            {judul || "(barang sudah dihapus)"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
            WARNA_STATUS[pesanan.status] ?? "bg-kertas-tua"
          }`}
        >
          {LABEL_STATUS_PESANAN[pesanan.status]}
        </span>
      </div>

      <div className="px-4 py-4">
        <p className="angka text-3xl font-extrabold text-daun-tua">
          {rupiah(harga)}
          <span className="ml-2 text-base font-semibold text-daun">
            {pesanan.jenis === "nawar" ? "nawar" : "sesuai harga"}
            {pesanan.listings?.satuan ? ` ${pesanan.listings.satuan}` : ""}
          </span>
        </p>

        {pesanan.catatan ? (
          <p className="mt-3 rounded-[6px] bg-kertas px-3 py-2">
            {pesanan.catatan}
          </p>
        ) : null}

        <p className="mt-3 text-base text-daun">
          {tampilkanNoWa(pesanan.no_wa)} · {waktuLalu(pesanan.created_at)}
        </p>

        {galat ? (
          <p className="mt-3 rounded-[6px] border-2 border-bata px-3 py-2 font-semibold text-bata">
            {galat}
          </p>
        ) : null}

        {konfirmasi ? (
          <div className="mt-4 rounded-[10px] border-2 border-daun bg-kertas px-4 py-4">
            <p className="font-bold">Terima penawaran {pesanan.nama}?</p>
            <label className="mt-3 flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={tandaiLaku}
                onChange={(e) => setTandaiLaku(e.target.checked)}
                className="size-6"
              />
              <span>Tandai barang jadi &ldquo;sudah laku&rdquo;</span>
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={tolakLain}
                onChange={(e) => setTolakLain(e.target.checked)}
                className="size-6"
              />
              <span>Tolak penawaran lain untuk barang ini</span>
            </label>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                onClick={() =>
                  jalankan(() =>
                    terimaPesanan(pesanan.id, tandaiLaku, tolakLain),
                  )
                }
                disabled={menunggu}
                className="min-h-13 rounded-full bg-daun-tua px-5 font-bold text-putih disabled:opacity-60"
              >
                {menunggu ? "Sebentar…" : "Ya, terima"}
              </button>
              <button
                onClick={() => setKonfirmasi(false)}
                disabled={menunggu}
                className="min-h-13 rounded-full border-2 border-daun-tua px-5 font-bold"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <Tombol
            pesanan={pesanan}
            menunggu={menunggu}
            bukaKonfirmasi={() => setKonfirmasi(true)}
            jalankan={jalankan}
          />
        )}
      </div>
    </article>
  );
}

function Tombol({
  pesanan,
  menunggu,
  bukaKonfirmasi,
  jalankan,
}: {
  pesanan: PesananDenganListing;
  menunggu: boolean;
  bukaKonfirmasi: () => void;
  jalankan: (aksi: () => Promise<{ ok: boolean; pesan?: string }>) => void;
}) {
  const kelasUtama =
    "min-h-13 rounded-full bg-daun-tua px-5 font-bold text-putih disabled:opacity-60";
  const kelasKedua =
    "min-h-13 rounded-full border-2 border-daun-tua px-5 font-bold disabled:opacity-60";

  if (pesanan.status === "baru") {
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={bukaKonfirmasi} disabled={menunggu} className={kelasUtama}>
          Terima
        </button>
        <button
          onClick={() => jalankan(() => ubahStatusPesanan(pesanan.id, "ditolak"))}
          disabled={menunggu}
          className={kelasKedua}
        >
          Tolak
        </button>
      </div>
    );
  }

  if (pesanan.status === "diterima") {
    return (
      <div className="mt-4 grid gap-2">
        <a
          href={linkWa(pesanan.no_wa, pesanPenawaranDiterima(pesanan))}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-13 items-center justify-center rounded-full bg-emas px-5 font-bold text-daun-tua"
        >
          Hubungi lewat WhatsApp
        </a>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => jalankan(() => ubahStatusPesanan(pesanan.id, "selesai"))}
            disabled={menunggu}
            className={kelasUtama}
          >
            Sudah diambil &amp; lunas
          </button>
          <button
            onClick={() => jalankan(() => ubahStatusPesanan(pesanan.id, "batal"))}
            disabled={menunggu}
            className={kelasKedua}
          >
            Tidak jadi ambil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <button
        onClick={() => jalankan(() => ubahStatusPesanan(pesanan.id, "baru"))}
        disabled={menunggu}
        className={kelasKedua}
      >
        Kembalikan ke baru
      </button>
      <button
        onClick={() => jalankan(() => hapusPesanan(pesanan.id))}
        disabled={menunggu}
        className="min-h-13 rounded-full border-2 border-bata px-5 font-bold text-bata disabled:opacity-60"
      >
        Hapus
      </button>
    </div>
  );
}
