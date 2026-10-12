"use client";

import { useRef, useState } from "react";
import {
  CONTOH,
  TAG,
  TEMPLAT_AWAL,
  isiTemplat,
  pakaiTemplat,
  type JenisTemplat,
} from "@/lib/templat";

/**
 * Satu kotak templat: teks bebas, tombol untuk menyisipkan tag di posisi
 * kursor, dan pratinjau dengan data contoh. Kotak dikendalikan state,
 * jadi isinya tidak hilang saat simpan gagal.
 *
 * Dibungkus <details> supaya halaman Pengaturan tetap ringkas. Kotak yang
 * tertutup tetap ikut terkirim saat Simpan, karena isinya tetap ada di
 * dalam form - hanya tidak ditampilkan.
 */
export default function KotakTemplat({
  jenis,
  judul,
  keterangan,
  awal,
  galat,
}: {
  jenis: JenisTemplat;
  judul: string;
  keterangan: string;
  /** Isi tersimpan. Kosong = tampilkan teks bawaan. */
  awal: string;
  galat?: string;
}) {
  const [teks, setTeks] = useState(awal || TEMPLAT_AWAL[jenis]);
  const [buka, setBuka] = useState(Boolean(galat));
  const kotak = useRef<HTMLTextAreaElement>(null);

  // Galat baru dari Simpan membuka kotaknya sendiri, supaya tulisan
  // merahnya tidak tersembunyi di kotak yang tertutup.
  const [galatLalu, setGalatLalu] = useState(galat);
  if (galat !== galatLalu) {
    setGalatLalu(galat);
    if (galat) setBuka(true);
  }

  const diubah = teks.trim() !== "" && teks.replace(/\r\n/g, "\n") !== TEMPLAT_AWAL[jenis];

  function sisipkan(tag: string) {
    const el = kotak.current;
    const sisip = `{${tag}}`;
    const mulai = el?.selectionStart ?? teks.length;
    const akhir = el?.selectionEnd ?? teks.length;
    setTeks(teks.slice(0, mulai) + sisip + teks.slice(akhir));
    // Kursor dipindah ke setelah tag, setelah React memperbarui kotaknya.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(mulai + sisip.length, mulai + sisip.length);
    });
  }

  return (
    <details
      open={buka}
      onToggle={(e) => setBuka(e.currentTarget.open)}
      className={`rounded-[10px] border-2 bg-putih ${galat ? "border-bata" : "border-daun-tua"}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-daun-tua">{judul}</span>
            {diubah ? (
              <span className="rounded-full bg-emas px-2.5 py-0.5 text-sm font-bold text-daun-tua">
                Sudah diubah
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-base text-daun">{keterangan}</span>
        </span>
        <span
          aria-hidden="true"
          className="flex min-h-11 shrink-0 items-center rounded-full border-2 border-daun-tua px-4 font-semibold text-daun-tua"
        >
          {buka ? "Tutup ▴" : "Ubah ▾"}
        </span>
      </summary>

      <div className="grid gap-4 border-t-2 border-kertas-tua px-4 pt-4 pb-4">
        <textarea
          ref={kotak}
          name={jenis}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          // Tinggi mengikuti isi, supaya tidak ada scroll di dalam kotak.
          rows={Math.max(6, teks.split("\n").length + 1)}
          maxLength={1000}
          spellCheck={false}
          aria-label={judul}
          className="w-full resize-y rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-base leading-relaxed"
        />

        <div>
          <p className="mb-2 text-sm font-bold text-daun">Sisipkan:</p>
          <div className="flex flex-wrap gap-2">
            {TAG[jenis].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => sisipkan(tag)}
                className="min-h-11 rounded-full border-2 border-daun-tua px-3 font-semibold text-daun-tua"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        {galat ? <p className="font-semibold text-bata">{galat}</p> : null}

        <div className="rounded-[10px] bg-kertas px-4 py-3">
          <p className="mb-2 text-sm font-bold text-daun">Contoh hasil</p>
          <p className="text-base leading-relaxed break-words whitespace-pre-wrap">
            {isiTemplat(pakaiTemplat(teks, jenis), CONTOH[jenis])}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTeks(TEMPLAT_AWAL[jenis])}
          disabled={!diubah}
          className="min-h-11 justify-self-start rounded-full border-2 border-daun-tua px-4 font-semibold disabled:opacity-40"
        >
          Kembalikan ke awal
        </button>
      </div>
    </details>
  );
}
