"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { kirimPemberitahuanPesanan } from "@/lib/email";
import { pesanError, skemaPesanan } from "@/lib/validasi";
import { tampilkanNoWa } from "@/lib/format";

export type HasilPesanan = {
  ok: boolean;
  pesan?: string;
  error?: Record<string, string>;
};

const JEDA_MENIT = 5;

export async function buatPesanan(
  _sebelumnya: HasilPesanan | null,
  formData: FormData,
): Promise<HasilPesanan> {
  const hasil = skemaPesanan.safeParse({
    listing_id: formData.get("listing_id"),
    nama: formData.get("nama"),
    no_wa: formData.get("no_wa"),
    jenis: formData.get("jenis"),
    harga_tawar: formData.get("harga_tawar") ?? undefined,
    catatan: formData.get("catatan") ?? "",
    alamat_web: formData.get("alamat_web") ?? "",
  });

  if (!hasil.success) {
    return { ok: false, error: pesanError(hasil.error) };
  }

  const data = hasil.data;

  // Pencegah kiriman ganda: tombol yang ditekan dua kali, atau orang yang
  // mengirim ulang karena sinyal lambat. Butuh service role karena publik
  // memang sengaja tidak boleh membaca tabel pesanan.
  try {
    const batas = new Date(Date.now() - JEDA_MENIT * 60_000).toISOString();
    const { data: kembar } = await supabaseAdmin()
      .from("pesanan")
      .select("id")
      .eq("listing_id", data.listing_id)
      .eq("no_wa", data.no_wa)
      .gte("created_at", batas)
      .limit(1);

    if (kembar && kembar.length > 0) {
      return {
        ok: true,
        pesan: "Penawaran kamu sudah masuk. Tidak perlu dikirim dua kali.",
      };
    }
  } catch (error) {
    // Kalau pengecekan ini gagal, lanjut saja. Kemungkinan terburuknya
    // satu baris ganda di kotak masuk - jauh lebih ringan daripada
    // menolak pesanan yang sebenarnya sah.
    console.error("[pesanan] gagal cek kiriman ganda:", error);
  }

  const supabase = await supabaseServer();

  // Judul dan harga disalin ke pesanan. Kalau listingnya dihapus nanti,
  // riwayat penjualan masih bisa dibaca.
  const { data: listing } = await supabase
    .from("listings")
    .select("judul, harga")
    .eq("id", data.listing_id)
    .single();

  // Disimpan lewat anon key supaya RLS ikut memeriksa: kalau listing sudah
  // laku, database sendiri yang menolak, bukan cuma tampilan.
  const { error } = await supabase.from("pesanan").insert({
    listing_id: data.listing_id,
    judul_snapshot: listing?.judul ?? "",
    harga_listing: listing?.harga ?? null,
    nama: data.nama,
    no_wa: data.no_wa,
    jenis: data.jenis,
    harga_tawar: data.jenis === "nawar" ? data.harga_tawar : null,
    catatan: data.catatan,
  });

  if (error) {
    console.error("[pesanan] gagal simpan:", error.message);
    // Ditolak RLS = listing sudah laku atau belum dibuka.
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return {
        ok: false,
        pesan: "Maaf, barang ini sudah laku atau belum dibuka. Coba muat ulang halaman.",
      };
    }
    return {
      ok: false,
      pesan: "Penawaran gagal terkirim. Coba lagi sebentar lagi.",
    };
  }

  // Pesanan sudah aman tersimpan. Email menyusul, dan kalau gagal pun
  // tidak mengubah apa pun bagi pembeli.
  await kirimPemberitahuanPesanan({
    nama: data.nama,
    noWa: tampilkanNoWa(data.no_wa),
    judulListing: listing?.judul ?? "(barang tidak dikenali)",
    jenis: data.jenis,
    hargaTawar: data.harga_tawar,
    catatan: data.catatan,
  });

  revalidatePath("/admin");
  revalidatePath(`/l/${data.listing_id}`);

  return {
    ok: true,
    pesan:
      data.jenis === "nawar"
        ? "Penawaran terkirim. Ibu akan menghubungi lewat WhatsApp."
        : "Pesanan terkirim. Ibu akan menghubungi lewat WhatsApp.",
  };
}
