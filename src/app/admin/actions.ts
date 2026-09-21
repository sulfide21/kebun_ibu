"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { pesanError, skemaListing, skemaPengaturan } from "@/lib/validasi";
import type { StatusPesanan } from "@/lib/types";

export type HasilAksi = {
  ok: boolean;
  pesan?: string;
  error?: Record<string, string>;
};

function segarkan() {
  revalidatePath("/", "layout");
}

// --------------------------- PESANAN ---------------------------

/**
 * Menerima penawaran lewat fungsi database, bukan lewat update biasa.
 * Alasannya: Ibu dan Bapak bisa menekan "Terima" hampir bersamaan di HP
 * masing-masing. Fungsi itu mengunci listing dulu, jadi tidak mungkin ada
 * dua pemenang untuk satu barang.
 */
export async function terimaPesanan(
  id: string,
  tandaiLaku: boolean,
  tolakLain: boolean,
): Promise<HasilAksi> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("terima_pesanan", {
    p_id: id,
    p_tandai_laku: tandaiLaku,
    p_tolak_lain: tolakLain,
  });

  if (error) {
    console.error("[admin] terima pesanan gagal:", error.message);
    return { ok: false, pesan: "Gagal menerima penawaran. Coba lagi." };
  }

  const hasil = data as { ok: boolean; pesan?: string };
  segarkan();
  return hasil.ok
    ? { ok: true, pesan: "Penawaran diterima." }
    : { ok: false, pesan: hasil.pesan };
}

export async function ubahStatusPesanan(
  id: string,
  status: Extract<StatusPesanan, "ditolak" | "selesai" | "batal" | "baru">,
): Promise<HasilAksi> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("pesanan")
    .update({
      status,
      diputuskan_at: status === "baru" ? null : new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[admin] ubah status gagal:", error.message);
    return { ok: false, pesan: "Gagal mengubah status." };
  }
  segarkan();
  return { ok: true };
}

export async function hapusPesanan(id: string): Promise<HasilAksi> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("pesanan").delete().eq("id", id);
  if (error) return { ok: false, pesan: "Gagal menghapus pesanan." };
  segarkan();
  return { ok: true };
}

// --------------------------- LISTING ---------------------------

export async function simpanListing(
  _sebelumnya: HasilAksi | null,
  formData: FormData,
): Promise<HasilAksi> {
  const id = (formData.get("id") as string) || null;

  const hasil = skemaListing.safeParse({
    jenis: formData.get("jenis"),
    judul: formData.get("judul"),
    deskripsi: formData.get("deskripsi") ?? "",
    harga: formData.get("harga"),
    satuan: formData.get("satuan") || "/keranjang",
    status: formData.get("status"),
  });

  if (!hasil.success) return { ok: false, error: pesanError(hasil.error) };

  const supabase = await supabaseServer();
  let listingId = id;

  if (id) {
    const { error } = await supabase
      .from("listings")
      .update(hasil.data)
      .eq("id", id);
    if (error) {
      console.error("[admin] gagal ubah listing:", error.message);
      return { ok: false, pesan: "Gagal menyimpan perubahan." };
    }
  } else {
    const { data, error } = await supabase
      .from("listings")
      .insert(hasil.data)
      .select("id")
      .single();
    if (error || !data) {
      console.error("[admin] gagal membuat listing:", error?.message);
      return { ok: false, pesan: "Gagal membuat listing baru." };
    }
    listingId = data.id;
  }

  // Foto sudah diunggah langsung dari browser; di sini hanya dicatat
  // urutannya. Client mengirim daftar lengkap yang diinginkan.
  const daftarFotoMentah = formData.get("foto_paths");
  if (typeof daftarFotoMentah === "string" && listingId) {
    let daftarFoto: string[] = [];
    try {
      const parsed = JSON.parse(daftarFotoMentah);
      if (Array.isArray(parsed)) daftarFoto = parsed.filter((p) => typeof p === "string");
    } catch {
      daftarFoto = [];
    }

    const { data: fotoLama } = await supabase
      .from("listing_foto")
      .select("path")
      .eq("listing_id", listingId);

    const pathLama = (fotoLama ?? []).map((f) => f.path);
    const dibuang = pathLama.filter((p) => !daftarFoto.includes(p));

    await supabase.from("listing_foto").delete().eq("listing_id", listingId);

    if (daftarFoto.length > 0) {
      await supabase.from("listing_foto").insert(
        daftarFoto.map((path, urutan) => ({
          listing_id: listingId,
          path,
          urutan,
        })),
      );
    }

    // Buang juga berkasnya supaya kuota penyimpanan tidak penuh sampah.
    if (dibuang.length > 0) {
      await supabase.storage.from("foto").remove(dibuang);
    }
  }

  segarkan();
  redirect("/admin/listing");
}

export async function hapusListing(id: string): Promise<HasilAksi> {
  const supabase = await supabaseServer();

  const { data: foto } = await supabase
    .from("listing_foto")
    .select("path")
    .eq("listing_id", id);

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) {
    console.error("[admin] gagal hapus listing:", error.message);
    return { ok: false, pesan: "Gagal menghapus listing." };
  }

  if (foto && foto.length > 0) {
    await supabase.storage.from("foto").remove(foto.map((f) => f.path));
  }

  segarkan();
  return { ok: true };
}

export async function ubahStatusListing(
  id: string,
  status: "segera" | "tersedia" | "sudah_laku",
): Promise<HasilAksi> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, pesan: "Gagal mengubah status." };
  segarkan();
  return { ok: true };
}

// --------------------------- PENGATURAN ---------------------------

export async function simpanPengaturan(
  _sebelumnya: HasilAksi | null,
  formData: FormData,
): Promise<HasilAksi> {
  const hasil = skemaPengaturan.safeParse({
    teks_musim: formData.get("teks_musim") ?? "",
    tampilkan_banner: formData.get("tampilkan_banner") === "on",
  });

  if (!hasil.success) return { ok: false, error: pesanError(hasil.error) };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("pengaturan")
    .update(hasil.data)
    .eq("id", 1);

  if (error) {
    console.error("[admin] gagal simpan pengaturan:", error.message);
    return { ok: false, pesan: "Gagal menyimpan pengaturan." };
  }

  segarkan();
  return { ok: true, pesan: "Pengaturan tersimpan." };
}

// --------------------------- AKUN ---------------------------

export async function keluar() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
