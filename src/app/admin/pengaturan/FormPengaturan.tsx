"use client";

import { useActionState } from "react";
import { simpanPengaturan, type HasilAksi } from "../actions";
import type { Pengaturan } from "@/lib/types";

export default function FormPengaturan({
  pengaturan,
}: {
  pengaturan: Pengaturan | null;
}) {
  const [hasil, simpan, sedangSimpan] = useActionState<
    HasilAksi | null,
    FormData
  >(simpanPengaturan, null);

  return (
    <form action={simpan} className="grid gap-5">
      <label className="block">
        <span className="mb-1.5 block font-semibold">Tulisan musim</span>
        <input
          name="teks_musim"
          defaultValue={pengaturan?.teks_musim ?? ""}
          placeholder="Musim mangga: Oktober - Desember"
          className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
        />
        <span className="mt-1 block text-base text-daun">
          Ini hanya keterangan, tidak mengubah apa pun. Yang menentukan bisa
          dipesan atau tidak adalah status tiap barang.
        </span>
        {hasil?.error?.teks_musim ? (
          <span className="mt-1 block font-semibold text-bata">
            {hasil.error.teks_musim}
          </span>
        ) : null}
      </label>

      <label className="flex min-h-13 items-center gap-3 rounded-[10px] border-2 border-daun-tua bg-putih px-4">
        <input
          type="checkbox"
          name="tampilkan_banner"
          defaultChecked={pengaturan?.tampilkan_banner ?? true}
          className="size-6"
        />
        <span className="font-semibold">Tampilkan di halaman depan</span>
      </label>

      {hasil?.pesan ? (
        <p
          className={`rounded-[10px] border-2 bg-putih px-4 py-3 font-semibold ${
            hasil.ok ? "border-daun text-daun-tua" : "border-bata text-bata"
          }`}
        >
          {hasil.pesan}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sedangSimpan}
        className="min-h-13 rounded-full bg-daun-tua px-6 py-3 text-lg font-bold text-putih disabled:opacity-60"
      >
        {sedangSimpan ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}
