"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { buatPesanan, type HasilPesanan } from "@/app/actions/pesanan";
import { rupiah } from "@/lib/format";
import type { JenisPesanan } from "@/lib/types";

type Props = {
  listingId: string;
  judul: string;
  harga: number;
  satuan: string;
};

export default function FormPesanan({
  listingId,
  judul,
  harga,
  satuan,
}: Props) {
  const [mode, setMode] = useState<JenisPesanan | null>(null);
  const [hasil, kirim, sedangKirim] = useActionState<
    HasilPesanan | null,
    FormData
  >(buatPesanan, null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Tutup dengan Escape, seperti yang diharapkan dari panel yang menutupi layar
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  useEffect(() => {
    if (mode) panelRef.current?.querySelector("input")?.focus();
  }, [mode]);

  if (hasil?.ok) {
    return (
      <div className="rounded-[10px] border-2 border-daun bg-putih px-5 py-6 text-center">
        <p className="text-xl font-bold text-daun-tua">{hasil.pesan}</p>
        <p className="mt-2 text-daun">
          Simpan nomor Ibu supaya pesannya tidak masuk ke spam.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("pesan")}
          className="min-h-13 rounded-full bg-daun-tua px-6 py-3 text-lg font-bold text-putih"
        >
          Pesan {rupiah(harga)}
        </button>
        <button
          type="button"
          onClick={() => setMode("nawar")}
          className="min-h-13 rounded-full border-2 border-daun-tua bg-emas px-6 py-3 text-lg font-bold text-daun-tua"
        >
          Nawar harga
        </button>
      </div>
      <p className="mt-3 text-center text-base text-daun">
        Tidak perlu daftar akun. Ibu yang akan menghubungi lewat WhatsApp.
      </p>

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-daun-tua/50 sm:items-center">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={mode === "pesan" ? "Form pesan" : "Form nawar"}
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[16px] border-t-4 border-daun-tua bg-kertas px-5 pt-5 pb-8 sm:rounded-[16px] sm:border-4"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-daun-tua">
                  {mode === "pesan" ? "Pesan barang ini" : "Nawar harga"}
                </h2>
                <p className="text-daun">{judul}</p>
              </div>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="min-h-11 min-w-11 rounded-full border-2 border-daun-tua text-xl font-bold"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <form action={kirim} className="grid gap-4">
              <input type="hidden" name="listing_id" value={listingId} />
              <input type="hidden" name="jenis" value={mode} />
              {/* Jebakan bot: disembunyikan dari mata dan dari pembaca layar */}
              <input
                type="text"
                name="alamat_web"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute h-0 w-0 opacity-0"
              />

              <Kolom label="Nama" error={hasil?.error?.nama}>
                <input
                  name="nama"
                  required
                  autoComplete="name"
                  placeholder="Nama yang Ibu kenal"
                  className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
                />
              </Kolom>

              <Kolom label="Nomor WhatsApp" error={hasil?.error?.no_wa}>
                <input
                  name="no_wa"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0812-3456-7890"
                  className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
                />
              </Kolom>

              {mode === "nawar" ? (
                <Kolom
                  label={`Harga yang ditawar ${satuan}`}
                  error={hasil?.error?.harga_tawar}
                >
                  <div className="flex items-center gap-2 rounded-[10px] border-2 border-daun-tua bg-putih px-4">
                    <span className="text-lg font-semibold text-daun">Rp</span>
                    <input
                      name="harga_tawar"
                      required
                      inputMode="numeric"
                      placeholder={String(harga)}
                      className="angka w-full bg-transparent py-3 text-lg"
                    />
                  </div>
                  <p className="mt-1 text-base text-daun">
                    Harga yang dipasang {rupiah(harga)} {satuan}.
                  </p>
                </Kolom>
              ) : null}

              <Kolom label="Catatan (boleh dikosongkan)" error={hasil?.error?.catatan}>
                <textarea
                  name="catatan"
                  rows={3}
                  placeholder="Contoh: ambilnya hari Sabtu sore"
                  className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
                />
              </Kolom>

              {hasil && !hasil.ok && hasil.pesan ? (
                <p className="rounded-[10px] border-2 border-bata bg-putih px-4 py-3 font-semibold text-bata">
                  {hasil.pesan}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={sedangKirim}
                className="min-h-13 rounded-full bg-daun-tua px-6 py-3 text-lg font-bold text-putih disabled:opacity-60"
              >
                {sedangKirim ? "Mengirim…" : "Kirim ke Ibu"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
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
      <span className="mb-1.5 block font-semibold text-daun-tua">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block font-semibold text-bata">{error}</span>
      ) : null}
    </label>
  );
}
