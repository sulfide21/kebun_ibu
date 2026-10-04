"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { galatBatasWaktu, galatUbahMode, pesanError, skemaListing, skemaPengaturan } from "@/lib/validasi";
import type { ModeListing, StatusPesanan } from "@/lib/types";

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
  const sekarang = new Date().toISOString();
  const { data: baris, error } = await supabase
    .from("pesanan")
    .update({
      status,
      diputuskan_at: status === "baru" ? null : sekarang,
    })
    .eq("id", id)
    .select("listing_id, jenis")
    .single();

  if (error) {
    console.error("[admin] ubah status gagal:", error.message);
    return { ok: false, pesan: "Gagal mengubah status." };
  }

  // Lelang punya cadangan. Penawar lain baru ditolak setelah pemenangnya
  // benar-benar lunas; kalau pemenangnya batal, barangnya dibuka lagi
  // supaya Ibu bisa memilih penawar berikutnya.
  if (baris?.jenis === "lelang" && baris.listing_id) {
    if (status === "selesai") {
      await supabase
        .from("pesanan")
        .update({ status: "ditolak", diputuskan_at: sekarang })
        .eq("listing_id", baris.listing_id)
        .eq("jenis", "lelang")
        .eq("status", "baru");
    } else if (status === "batal") {
      await supabase
        .from("listings")
        .update({ status: "tersedia" })
        .eq("id", baris.listing_id);
    }
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

// --------------------------- LELANG ---------------------------
// Semua lewat klien sesi biasa: RLS pesanan_kelola_admin yang menjaga
// bahwa hanya pengelola yang bisa menjalankannya.

async function ubahTawaran(
  listingId: string,
  dari: StatusPesanan,
  ke: StatusPesanan,
  noWa?: string,
): Promise<HasilAksi> {
  const supabase = await supabaseServer();
  let query = supabase
    .from("pesanan")
    .update({
      status: ke,
      diputuskan_at: ke === "baru" ? null : new Date().toISOString(),
    })
    .eq("listing_id", listingId)
    .eq("jenis", "lelang")
    .eq("status", dari);
  if (noWa) query = query.eq("no_wa", noWa);

  const { error } = await query;
  if (error) {
    console.error("[admin] ubah tawaran gagal:", error.message);
    return { ok: false, pesan: "Gagal mengubah tawaran." };
  }
  segarkan();
  return { ok: true };
}

/** Menolak SEMUA tawaran orang ini untuk barang ini, bukan hanya yang
 *  terbaru - kalau tidak, tawaran lamanya muncul lagi di daftar. */
export async function tolakPenawar(listingId: string, noWa: string): Promise<HasilAksi> {
  return ubahTawaran(listingId, "baru", "ditolak", noWa);
}

/** Lelang tetap terbuka sampai batas waktunya; pemenang tidak ikut ditolak. */
export async function tolakSemuaTawaran(listingId: string): Promise<HasilAksi> {
  return ubahTawaran(listingId, "baru", "ditolak");
}

export async function batalkanTolak(listingId: string, noWa: string): Promise<HasilAksi> {
  return ubahTawaran(listingId, "ditolak", "baru", noWa);
}

export async function tutupLelangSekarang(listingId: string): Promise<HasilAksi> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("listings")
    .update({ batas_waktu: new Date().toISOString() })
    .eq("id", listingId)
    .eq("mode", "lelang");
  if (error) {
    console.error("[admin] tutup lelang gagal:", error.message);
    return { ok: false, pesan: "Gagal menutup lelang." };
  }
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
    mode: formData.get("mode") ?? "jual",
    batas_waktu: formData.get("batas_waktu") ?? "",
  });

  if (!hasil.success) return { ok: false, error: pesanError(hasil.error) };

  const { batas_waktu: batasBaru, ...isian } = hasil.data;
  const supabase = await supabaseServer();

  let lama: { mode: ModeListing; batas_waktu: string | null } | null = null;
  let jumlahPesanan = 0;
  if (id) {
    const [{ data: listingLama }, { count }] = await Promise.all([
      supabase.from("listings").select("mode, batas_waktu").eq("id", id).single(),
      supabase
        .from("pesanan")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", id),
    ]);
    lama = listingLama;
    jumlahPesanan = count ?? 0;
  }

  const galatMode = galatUbahMode(lama?.mode ?? null, isian.mode, jumlahPesanan);
  if (galatMode) return { ok: false, error: { mode: galatMode } };

  const galatBatas = galatBatasWaktu({
    mode: isian.mode,
    batasBaru,
    batasLama: lama?.batas_waktu ? new Date(lama.batas_waktu) : null,
    sekarang: new Date(),
  });
  if (galatBatas) return { ok: false, error: { batas_waktu: galatBatas } };

  const baris = {
    ...isian,
    batas_waktu:
      isian.mode === "lelang" && batasBaru ? batasBaru.toISOString() : null,
  };
  let listingId = id;

  if (id) {
    const { error } = await supabase
      .from("listings")
      .update(baris)
      .eq("id", id);
    if (error) {
      console.error("[admin] gagal ubah listing:", error.message);
      return { ok: false, pesan: "Gagal menyimpan perubahan." };
    }
  } else {
    const { data, error } = await supabase
      .from("listings")
      .insert(baris)
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
