"use client";

import { useActionState, useState } from "react";
import { simpanListing, type HasilAksi } from "../actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { urlFoto } from "@/lib/foto";
import type { Listing, ModeListing } from "@/lib/types";
import { keInputWita } from "@/lib/waktu";

const MAKS_FOTO = 6;

/**
 * crypto.randomUUID() hanya ada di "secure context": https atau localhost.
 * Membuka situs ini dari HP lewat alamat LAN (http://192.168.x.x:3000) -
 * yang pasti dilakukan saat mencoba di HP Ibu - bukan secure context, dan
 * di sana randomUUID tidak ada sama sekali.
 */
function namaAcak(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Props = {
  listing?: Listing;
  fotoAwal?: string[];
  modeTerkunci?: boolean;
};

export default function FormListing({ listing, fotoAwal = [], modeTerkunci = false }: Props) {
  const [hasil, simpan, sedangSimpan] = useActionState<HasilAksi | null, FormData>(
    simpanListing,
    null,
  );
  const [foto, setFoto] = useState<string[]>(fotoAwal);
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [galatFoto, setGalatFoto] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeListing>(listing?.mode ?? "jual");

  /**
   * Foto dari HP bisa 3-8 MB. Dikecilkan dulu di browser supaya tidak
   * putus di tengah jalan saat sinyal lemah, dan supaya kuota
   * penyimpanan gratis tidak cepat habis.
   *
   * Tiap langkah menulis status ke layar. Versi pertama fungsi ini gagal
   * tanpa suara sedikit pun, dan itu yang paling lama dicari - jadi
   * sekarang lebih baik cerewet daripada diam.
   */
  async function unggah(berkas: FileList | null) {
    // Disalin ke array SEKARANG JUGA, sebelum ada await satu pun.
    // Input file dikosongkan tepat setelah fungsi ini menyentuh await
    // pertamanya, dan mengosongkan input ikut mengosongkan FileList-nya.
    const daftarBerkas = berkas ? Array.from(berkas) : [];

    setGalatFoto(null);
    setStatus(`Menerima ${daftarBerkas.length} berkas…`);

    if (daftarBerkas.length === 0) {
      setGalatFoto("Tidak ada berkas yang terbaca. Coba pilih fotonya lagi.");
      setStatus(null);
      return;
    }

    setSedangUnggah(true);
    const sisaSlot = MAKS_FOTO - foto.length;
    const antre = daftarBerkas.slice(0, Math.max(sisaSlot, 0));
    const hasilUnggah: string[] = [];

    try {
      const supabase = supabaseBrowser();

      for (let i = 0; i < antre.length; i++) {
        const file = antre[i];
        const urutanTeks = `${i + 1} dari ${antre.length}`;

        if (!file.type.startsWith("image/")) {
          setGalatFoto(`"${file.name}" bukan gambar, dilewati.`);
          continue;
        }

        setStatus(`Mengecilkan foto ${urutanTeks}…`);
        let siapKirim: Blob = file;
        try {
          const { default: kecilkan } = await import(
            "browser-image-compression"
          );
          siapKirim = await kecilkan(file, {
            maxSizeMB: 0.35,
            maxWidthOrHeight: 1400,
            useWebWorker: true,
            fileType: "image/jpeg",
          });
        } catch (error) {
          // Gagal dikecilkan bukan alasan untuk gagal total. Foto besar
          // yang terunggah tetap lebih berguna daripada tidak ada foto.
          console.warn("[foto] gagal dikecilkan, kirim aslinya:", error);
          setStatus(`Foto ${urutanTeks} dikirim tanpa dikecilkan…`);
        }

        setStatus(`Mengunggah foto ${urutanTeks}…`);
        const nama = `${namaAcak()}.jpg`;
        const { error } = await supabase.storage
          .from("foto")
          .upload(nama, siapKirim, {
            contentType: "image/jpeg",
            upsert: false,
          });

        if (error) {
          console.error("[foto] gagal diunggah:", error);
          setGalatFoto(`Foto ${urutanTeks} gagal diunggah: ${error.message}`);
          continue;
        }
        hasilUnggah.push(nama);
      }

      if (hasilUnggah.length > 0) {
        setFoto((lama) => [...lama, ...hasilUnggah].slice(0, MAKS_FOTO));
        setStatus(
          `${hasilUnggah.length} foto terunggah. Tekan Simpan supaya menempel di barang ini.`,
        );
      } else {
        setStatus(null);
      }
    } catch (error) {
      const pesan = error instanceof Error ? error.message : String(error);
      console.error("[foto] gagal:", error);
      setGalatFoto(`Foto gagal diproses: ${pesan}`);
      setStatus(null);
    } finally {
      setSedangUnggah(false);
    }
  }

  return (
    <form action={simpan} className="grid gap-5">
      {listing ? <input type="hidden" name="id" value={listing.id} /> : null}
      <input type="hidden" name="foto_paths" value={JSON.stringify(foto)} />

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 font-semibold">Cara menjual</legend>
        {/* Radio yang disabled tidak ikut terkirim, jadi nilainya dikirim lewat sini */}
        {modeTerkunci ? <input type="hidden" name="mode" value={mode} /> : null}
        <div className="grid grid-cols-2 gap-3">
          {(["jual", "lelang"] as const).map((m) => (
            <label
              key={m}
              className={`flex min-h-13 items-center justify-center rounded-full border-2 border-daun-tua px-4 text-lg font-bold ${
                mode === m ? "bg-daun-tua text-putih" : "bg-putih text-daun-tua"
              } ${modeTerkunci ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name={modeTerkunci ? undefined : "mode"}
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                disabled={modeTerkunci}
                className="sr-only"
              />
              {m === "jual" ? "Jual" : "Lelang"}
            </label>
          ))}
        </div>
        {modeTerkunci ? (
          <p className="text-base text-daun">
            Tidak bisa diubah karena sudah ada pesanan atau tawaran masuk.
          </p>
        ) : null}
        {hasil?.error?.mode ? (
          <p className="font-semibold text-bata">{hasil.error.mode}</p>
        ) : null}
      </fieldset>

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
                // Input baru dikosongkan SESUDAH unggahan selesai.
                // Mengosongkannya lebih awal ikut mengosongkan daftar
                // berkasnya, dan unggahan batal tanpa pesan apa pun.
                const input = e.target;
                void unggah(input.files).finally(() => {
                  input.value = "";
                });
              }}
            />
          </label>
        ) : null}

        {status ? (
          <p
            aria-live="polite"
            className="rounded-[6px] border-2 border-daun bg-putih px-3 py-2 font-semibold text-daun-tua"
          >
            {status}
          </p>
        ) : null}

        {galatFoto ? (
          <p aria-live="polite" className="font-semibold text-bata">
            {galatFoto}
          </p>
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
        <Kolom label={mode === "lelang" ? "Harga minimum" : "Harga"} error={hasil?.error?.harga}>
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

      {mode === "lelang" ? (
        <Kolom label="Ditutup pada (jam WITA)" error={hasil?.error?.batas_waktu}>
          <input
            type="datetime-local"
            name="batas_waktu"
            required
            defaultValue={
              listing?.batas_waktu ? keInputWita(new Date(listing.batas_waktu)) : ""
            }
            className="min-h-13 w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 text-lg"
          />
        </Kolom>
      ) : null}

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
