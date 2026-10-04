import { rupiah } from "@/lib/format";
import { formatWita, sisaWaktu } from "@/lib/waktu";

/**
 * "Sampai kemarin" sengaja ditulis: tawaran hari ini baru terlihat
 * setelah 00.00 WITA, jadi angka ini bukan tawaran tertinggi saat ini.
 */
export default function HargaLelang({
  hargaMinimum,
  tertinggi,
  batas,
  satuan,
  sekarang,
}: {
  hargaMinimum: number;
  tertinggi: number | null;
  batas: string | null;
  satuan: string;
  sekarang: Date;
}) {
  const tutup = batas ? new Date(batas) : null;
  const masihBuka = tutup !== null && tutup > sekarang;

  return (
    <div className="mt-4">
      <p className="font-semibold text-daun">
        {tertinggi !== null
          ? "Tawaran tertinggi sampai kemarin"
          : "Belum ada tawaran sampai kemarin"}
      </p>
      <p className="angka text-4xl font-extrabold text-emas-tua">
        {rupiah(tertinggi ?? hargaMinimum)}
        <span className="ml-2 text-xl font-semibold text-daun">{satuan}</span>
      </p>
      <p className="mt-2 text-lg">Harga minimum {rupiah(hargaMinimum)}</p>
      {tutup ? (
        <p className="mt-1 text-lg font-semibold text-daun-tua">
          Ditutup {formatWita(tutup)}
          {masihBuka ? ` (${sisaWaktu(tutup, sekarang)})` : ""}
        </p>
      ) : null}
      <p className="mt-1 text-base text-daun">
        Harga diperbarui tiap hari jam 00.00 WITA.
      </p>
    </div>
  );
}
