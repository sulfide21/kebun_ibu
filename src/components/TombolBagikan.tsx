"use client";

import { useState } from "react";
import { pesanBagikan } from "@/lib/wa";
import type { TemplatPesan } from "@/lib/templat";
import type { Listing } from "@/lib/types";

type Keadaan = "diam" | "tersalin" | "manual";

/**
 * Satu tombol, tiga cara, dicoba berurutan sampai ada yang jalan:
 *
 *   1. navigator.share   - di HP memunculkan daftar aplikasi bawaan
 *                          (WhatsApp, Facebook, Telegram, SMS, apa saja
 *                          yang terpasang). Hanya ada di HP dan hanya
 *                          jalan di https.
 *   2. clipboard         - disalin, tinggal tempel. Juga butuh https
 *                          atau localhost.
 *   3. kotak teks manual - dipakai saat situs dibuka lewat alamat LAN
 *                          (http://192.168.x.x:3000), yang pasti terjadi
 *                          waktu mencoba di HP Ibu. Di sana dua cara di
 *                          atas tidak ada sama sekali.
 */
export default function TombolBagikan({
  listing,
  templat,
  className = "",
}: {
  listing: Listing;
  templat?: Partial<TemplatPesan>;
  className?: string;
}) {
  const [keadaan, setKeadaan] = useState<Keadaan>("diam");
  const teks = pesanBagikan(listing, templat);

  async function salinKeClipboard(): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(teks);
        return true;
      }
    } catch {
      // lanjut ke cara berikutnya
    }
    try {
      const kotak = document.createElement("textarea");
      kotak.value = teks;
      kotak.style.position = "fixed";
      kotak.style.top = "-1000px";
      document.body.appendChild(kotak);
      kotak.select();
      const berhasil = document.execCommand("copy");
      document.body.removeChild(kotak);
      return berhasil;
    } catch {
      return false;
    }
  }

  async function bagikan() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: listing.judul, text: teks });
        return;
      } catch (error) {
        // Ditutup sendiri oleh pengguna bukan kegagalan.
        if ((error as Error)?.name === "AbortError") return;
      }
    }

    if (await salinKeClipboard()) {
      setKeadaan("tersalin");
      setTimeout(() => setKeadaan("diam"), 2500);
    } else {
      setKeadaan("manual");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void bagikan()}
        aria-live="polite"
        className={
          className ||
          "flex min-h-13 items-center justify-center rounded-full bg-emas px-4 font-bold text-daun-tua"
        }
      >
        {keadaan === "tersalin" ? "Tersalin ✓" : "Bagikan"}
      </button>

      {keadaan === "manual" ? (
        <div className="mt-2 rounded-[10px] border-2 border-daun-tua bg-putih p-3">
          <p className="mb-2 font-semibold">
            Salin sendiri ya, teksnya sudah disiapkan:
          </p>
          <textarea
            readOnly
            rows={5}
            value={teks}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-[6px] border-2 border-kertas-tua bg-kertas px-3 py-2 text-base"
          />
          <button
            type="button"
            onClick={() => setKeadaan("diam")}
            className="mt-2 min-h-11 rounded-full border-2 border-daun-tua px-4 font-semibold"
          >
            Tutup
          </button>
        </div>
      ) : null}
    </>
  );
}
