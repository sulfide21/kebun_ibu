"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { kirimPemberitahuanPesanan } from "@/lib/email";
import { cekKiriman, pesanError, skemaPesanan } from "@/lib/validasi";
import { tampilkanNoWa } from "@/lib/format";
import type { Listing } from "@/lib/types";

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
  const lelang = data.jenis === "lelang";
  const supabase = await supabaseServer();

  const { data: barisListing } = await supabase
    .from("listings")
    .select("judul, harga, mode, status, batas_waktu")
    .eq("id", data.listing_id)
    .single();

  if (!barisListing) {
    return { ok: false, pesan: "Barang tidak ditemukan. Coba muat ulang halaman." };
  }
  const listing = barisListing as Pick<
    Listing,
    "judul" | "harga" | "mode" | "status" | "batas_waktu"
  >;

  const galat = cekKiriman(listing, data, new Date());
  if (galat) return { ok: false, ...galat };

  // Pencegah kiriman ganda: tombol yang ditekan dua kali, atau orang yang
  // mengirim ulang karena sinyal lambat. Untuk lelang, jumlahnya ikut
  // dicocokkan, supaya kerabat tetap bisa langsung menaikkan tawarannya.
  // Butuh service role karena publik sengaja tidak boleh membaca pesanan.
  try {
    const batas = new Date(Date.now() - JEDA_MENIT * 60_000).toISOString();
    let query = supabaseAdmin()
      .from("pesanan")
      .select("id")
      .eq("listing_id", data.listing_id)
      .eq("no_wa", data.no_wa)
      .gte("created_at", batas);
    if (lelang && data.harga_tawar !== null) query = query.eq("harga_tawar", data.harga_tawar);
    const { data: kembar } = await query.limit(1);

    if (kembar && kembar.length > 0) {
      return {
        ok: true,
        pesan: lelang
          ? "Tawaran kamu sudah masuk. Tidak perlu dikirim dua kali."
          : "Pesanan kamu sudah masuk. Tidak perlu dikirim dua kali.",
      };
    }
  } catch (error) {
    // Kalau pengecekan ini gagal, lanjut saja. Kemungkinan terburuknya
    // satu baris ganda di kotak masuk - jauh lebih ringan daripada
    // menolak pesanan yang sebenarnya sah.
    console.error("[pesanan] gagal cek kiriman ganda:", error);
  }

  // Disimpan lewat anon key supaya RLS ikut memeriksa: minimum, batas
  // waktu, dan status barang ditolak oleh database sendiri, bukan cuma
  // oleh pemeriksaan di atas.
  const { error } = await supabase.from("pesanan").insert({
    listing_id: data.listing_id,
    judul_snapshot: listing.judul,
    harga_listing: listing.harga,
    nama: data.nama,
    no_wa: data.no_wa,
    jenis: data.jenis,
    harga_tawar: lelang ? data.harga_tawar : null,
    catatan: data.catatan,
  });

  if (error) {
    console.error("[pesanan] gagal simpan:", error.message);
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return {
        ok: false,
        pesan: lelang
          ? "Lelang sudah ditutup, atau barangnya sudah laku. Coba muat ulang halaman."
          : "Maaf, barang ini sudah laku atau belum dibuka. Coba muat ulang halaman.",
      };
    }
    return { ok: false, pesan: "Gagal terkirim. Coba lagi sebentar lagi." };
  }

  // Sudah aman tersimpan. Email menyusul, dan kalau gagal pun tidak
  // mengubah apa pun bagi pembeli.
  await kirimPemberitahuanPesanan({
    nama: data.nama,
    noWa: tampilkanNoWa(data.no_wa),
    judulListing: listing.judul,
    jenis: data.jenis,
    hargaTawar: data.harga_tawar,
    batasWaktu: lelang ? listing.batas_waktu : null,
    catatan: data.catatan,
  });

  revalidatePath("/admin");
  revalidatePath(`/l/${data.listing_id}`);

  return {
    ok: true,
    pesan: lelang
      ? "Tawaran kamu masuk. Ibu akan menghubungi lewat WhatsApp kalau terpilih."
      : "Pesanan terkirim. Ibu akan menghubungi lewat WhatsApp.",
  };
}
