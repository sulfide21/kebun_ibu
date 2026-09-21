"use client";

import { useActionState, useState } from "react";
import { simpanListing, type HasilAksi } from "../actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { urlFoto } from "@/lib/foto";
import type { Listing } from "@/lib/types";

const MAKS_FOTO = 6;

type Props = {
  listing?: Listing;
  fotoAwal?: string[];
};

export default function FormListing({ listing, fotoAwal = [] }: Props) {
  const [hasil, simpan, sedangSimpan] = useActionState<HasilAksi | null, FormData>(
    simpanListing,
    null,
  );
  const [foto, setFoto] = useState<string[]>(fotoAwal);
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [galatFoto, setGalatFoto] = useState<string | null>(null);

  /**
   * Foto dari HP bisa 3-8 MB. Dikecilkan dulu di browser supaya tidak
   * putus di tengah jalan saat sinyal lemah, dan supaya kuota
   * penyimpanan gratis tidak cepat habis.
   */
  async function unggah(berkas: FileList | null) {
    if (!berkas || berkas.length === 0) return;
    setGalatFoto(null);
    setSedangUnggah(true);

    try {
      const { default: kecilkan } = await import("browser-image-compression");
      const supabase = supabaseBrowser();
      const hasilUnggah: string[] = [];

      for (const file of Array.from(berkas).slice(0, MAKS_FOTO - foto.length)) {
        if (!file.type.startsWith("image/")) {
          setGalatFoto("Hanya bisa mengunggah gambar.");
          continue;
        }

        const kecil = await kecilkan(file, {
          maxSizeMB: 0.35,
          maxWidthOrHeight: 1400,
          useWebWorker: true,
          fileType: "image/jpeg",
        });

        const nama = `${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("foto")
          .upload(nama, kecil, { contentType: "image/jpeg", upsert: false });

        if (error) {
          setGalatFoto(`Foto gagal diunggah: ${error.message}`);
          continue;
        }
        hasilUnggah.push(nama);
      }

      setFoto((lama) => [...lama, ...hasilUnggah].slice(0, MAKS_FOTO));
    } catch {
      setGalatFoto("Foto gagal diproses. Coba foto lain.");
    } finally {
      setSedangUnggah(false);
    }
  }

  return (
    <form action={simpan} className="grid gap-5">
      {listing ? <input type="hidden" name="id" value={listing.id} /> : null}
      <input type="hidden" name="foto_paths" value={JSON.stringify(foto)} />

      <fieldset className="grid gap-2">
        <span className="font-semibold">Foto (maksimal {MAKS_FOTO})</span>

        {foto.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {foto.map((path, i) => (
              <li key={path} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlFoto(path)}
                  alt={`Foto ${i + 1}`}
                  className="aspect-square w-full rounded-[6px] border-2 border-daun-tua object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFoto((l) => l.filter((p) => p !== path))}
                  className="absolute -top-2 -right-2 size-9 rounded-full border-2 border-daun-tua bg-putih text-lg font-bold"
                  aria-label={`Hapus foto ${i + 1}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {foto.length < MAKS_FOTO ? (
          <label className="flex min-h-13 cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-daun px-4 font-semibold text-daun">
            {sedangUnggah ? "Mengunggah…" : "Ambil atau pilih foto"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={sedangUnggah}
              onChange={(e) => {
                void unggah(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}

        {galatFoto ? (
          <p className="font-semibold text-bata">{galatFoto}</p>
        ) : null}
      </fieldset>

      <Kolom label="Judul" error={hasil?.error?.judul}>
        <input
          name="judul"
          required
          defaultValue={listing?.judul}
          placeholder="Mangga harum manis sekeranjang"
          className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
        />
      </Kolom>

      <div className="grid gap-5 sm:grid-cols-2">
        <Kolom label="Harga" error={hasil?.error?.harga}>
          <div className="flex items-center gap-2 rounded-[10px] border-2 border-daun-tua bg-putih px-4">
            <span className="font-semibold text-daun">Rp</span>
            <input
              name="harga"
              required
              inputMode="numeric"
              defaultValue={listing?.harga}
              placeholder="200000"
              className="angka w-full bg-transparent py-3 text-lg"
            />
          </div>
        </Kolom>

        <Kolom label="Satuan" error={hasil?.error?.satuan}>
          <input
            name="satuan"
            defaultValue={listing?.satuan ?? "/keranjang"}
            placeholder="/keranjang"
            className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
          />
        </Kolom>
      </div>

      <Kolom label="Keterangan" error={hasil?.error?.deskripsi}>
        <textarea
          name="deskripsi"
          rows={5}
          defaultValue={listing?.deskripsi}
          placeholder="Tulis apa saja: manis, petik pagi ini, bisa diambil sore."
          className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
        />
      </Kolom>

      <div className="grid gap-5 sm:grid-cols-2">
        <Kolom label="Jenis" error={hasil?.error?.jenis}>
          <select
            name="jenis"
            defaultValue={listing?.jenis ?? "mangga"}
            className="min-h-13 w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 text-lg"
          >
            <option value="mangga">Mangga</option>
            <option value="pisang">Pisang</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </Kolom>

        <Kolom label="Status" error={hasil?.error?.status}>
          <select
            name="status"
            defaultValue={listing?.status ?? "tersedia"}
            className="min-h-13 w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 text-lg"
          >
            <option value="tersedia">Tersedia</option>
            <option value="segera">Segera</option>
            <option value="sudah_laku">Sudah laku</option>
          </select>
        </Kolom>
      </div>

      {hasil && !hasil.ok && hasil.pesan ? (
        <p className="rounded-[10px] border-2 border-bata bg-putih px-4 py-3 font-semibold text-bata">
          {hasil.pesan}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sedangSimpan || sedangUnggah}
        className="min-h-13 rounded-full bg-daun-tua px-6 py-3 text-lg font-bold text-putih disabled:opacity-60"
      >
        {sedangSimpan ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}

function Kolom({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block font-semibold text-bata">{error}</span>
      ) : null}
    </label>
  );
}
