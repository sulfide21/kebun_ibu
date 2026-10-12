import { Resend } from "resend";
import { teksPemberitahuan, type IsiPemberitahuan } from "./pemberitahuan";

/**
 * Kenapa lewat HTTP API dan bukan SMTP Gmail: di Vercel, begitu fungsi
 * mengembalikan response, pekerjaan async yang belum selesai dihentikan.
 * Percakapan SMTP butuh banyak langkah bolak-balik, jadi sering terpotong
 * di tengah tanpa pesan error. Resend mengirim lewat satu request HTTPS,
 * dan emailnya tetap masuk ke Gmail Ibu/Bapak.
 *
 * Fungsi ini TIDAK PERNAH melempar error. Pesanan yang batal tersimpan
 * karena email gagal jauh lebih mahal daripada email yang tidak terkirim.
 */
export async function kirimPemberitahuanPesanan(
  isi: IsiPemberitahuan,
): Promise<void> {
  const kunci = process.env.RESEND_API_KEY;
  const tujuan = process.env.EMAIL_TUJUAN;
  if (!kunci || !tujuan) return; // belum dipasang: lewati diam-diam

  const { judul, teks } = teksPemberitahuan(isi);

  try {
    const resend = new Resend(kunci);
    await resend.emails.send({
      from: process.env.EMAIL_PENGIRIM || "Kebun Ibu <onboarding@resend.dev>",
      to: tujuan.split(",").map((t) => t.trim()),
      subject: judul,
      text: teks,
    });
  } catch (error) {
    console.error("[email] gagal mengirim pemberitahuan:", error);
  }
}
