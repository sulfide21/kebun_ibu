"use client";

/**
 * Kotak pencarian. Menyaring sambil diketik, tanpa tombol "cari" dan
 * tanpa memuat ulang halaman.
 *
 * Jumlah hasil sengaja ditulis di bawah kotak dan diberi aria-live,
 * supaya jelas kenapa daftarnya tiba-tiba pendek - termasuk untuk
 * pembaca layar, yang tidak melihat daftarnya menyusut.
 */
export default function KotakCari({
  nilai,
  ubah,
  petunjuk,
  label,
  hasil,
  total,
}: {
  nilai: string;
  ubah: (teks: string) => void;
  petunjuk: string;
  label: string;
  hasil: number;
  total: number;
}) {
  const menyaring = nilai.trim().length > 0;

  return (
    <div className="mb-5">
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={nilai}
          onChange={(e) => ubah(e.target.value)}
          placeholder={petunjuk}
          autoComplete="off"
          className="w-full rounded-full border-2 border-daun-tua bg-putih py-3 pr-13 pl-5 text-lg placeholder:text-daun-muda"
        />
        {menyaring ? (
          <button
            type="button"
            onClick={() => ubah("")}
            aria-label="Kosongkan pencarian"
            className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-daun-tua text-xl font-bold text-daun-tua"
          >
            &times;
          </button>
        ) : null}
      </label>

      <p aria-live="polite" className="mt-2 min-h-6 px-2 text-base text-daun">
        {menyaring
          ? hasil === 0
            ? `Tidak ada yang cocok dengan "${nilai}".`
            : `${hasil} dari ${total} ditampilkan.`
          : ""}
      </p>
    </div>
  );
}
