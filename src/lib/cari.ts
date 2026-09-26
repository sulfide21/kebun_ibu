/**
 * Pencarian dilakukan di browser, bukan di database.
 *
 * Alasannya jumlah barang memang sedikit - satu musim paling banyak
 * puluhan baris, dan semuanya sudah ikut terkirim saat halaman dibuka.
 * Mengirim ulang permintaan ke server tiap huruf diketik cuma menambah
 * lambat, dan di kebun sinyalnya belum tentu bagus.
 */

/**
 * Membuat penyaring dari kata yang diketik.
 *
 * Semua kata harus ketemu, tapi urutannya bebas dan huruf besar-kecil
 * diabaikan: "budi mangga" tetap cocok dengan "Mangga harum - Budi".
 * Kotak kosong berarti semuanya lolos.
 */
export function buatPencocok(
  kueri: string,
): (...bidang: (string | null | undefined)[]) => boolean {
  const kata = kueri.toLowerCase().trim().split(/\s+/).filter(Boolean);

  return (...bidang) => {
    if (kata.length === 0) return true;
    const isi = bidang.filter(Boolean).join(" ").toLowerCase();
    return kata.every((k) => isi.includes(k));
  };
}
