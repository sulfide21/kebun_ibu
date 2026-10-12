import { teksPemberitahuan, type IsiPemberitahuan } from "./pemberitahuan";
import type { TemplatPesan } from "./templat";

/**
 * Pemberitahuan pesanan baru ke WhatsApp Ibu lewat Fonnte.
 *
 * Fonnte mengirim dari nomor yang ditautkan lewat scan QR (seperti
 * WhatsApp Web). Sengaja nomor terpisah, bukan nomor Ibu: gateway
 * tidak resmi bisa membuat nomornya diblokir WhatsApp, dan nomor Ibu
 * dipakai untuk pembeli dan keluarga.
 *
 * Seperti email, fungsi ini TIDAK PERNAH melempar error, dan menyerah
 * setelah 8 detik. Pesanan sudah tersimpan sebelum fungsi ini dipanggil.
 */
export async function kirimWaPemberitahuan(
  isi: IsiPemberitahuan,
  templat: Partial<TemplatPesan> = {},
): Promise<void> {
  const token = process.env.FONNTE_TOKEN;
  const tujuan = process.env.WA_TUJUAN;
  if (!token || !tujuan) return; // belum dipasang: lewati diam-diam

  const { judul, teks } = teksPemberitahuan(isi, new Date(), templat);

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      // Fonnte memakai token apa adanya, tanpa awalan "Bearer".
      headers: { Authorization: token },
      body: new URLSearchParams({
        // Nomor 08... diubah Fonnte sendiri jadi 628... (countryCode 62).
        target: tujuan.split(",").map((t) => t.trim()).join(","),
        message: `*${judul}*\n\n${teks}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const hasil = (await res.json()) as { status?: boolean; reason?: string };
    if (!hasil.status) console.error("[wa] Fonnte menolak pesan:", hasil.reason);
  } catch (error) {
    console.error("[wa] gagal mengirim pemberitahuan:", error);
  }
}
