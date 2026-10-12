import { supabaseServer } from "@/lib/supabase/server";
import { TEMPLAT_KOSONG, type TemplatPesan } from "@/lib/templat";
import type { Pengaturan } from "@/lib/types";
import FormPengaturan from "./FormPengaturan";

export const revalidate = 0;

export default async function HalamanPengaturan() {
  const supabase = await supabaseServer();
  const [{ data }, { data: templat }] = await Promise.all([
    supabase.from("pengaturan").select("*").eq("id", 1).single(),
    // Gagal dibaca (misalnya migrasi belum dijalankan) = semua kotak
    // menampilkan teks bawaan.
    supabase
      .from("templat_pesan")
      .select("wa_pesan, wa_lelang, bagikan_jual, bagikan_lelang")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  return (
    <>
      <h1 className="mb-1 text-3xl font-extrabold text-daun-tua">Pengaturan</h1>
      <p className="mb-6 text-daun">
        Tulisan musim di halaman depan, dan isi pesan WhatsApp.
      </p>
      <FormPengaturan
        pengaturan={data as Pengaturan | null}
        templat={{ ...TEMPLAT_KOSONG, ...((templat ?? {}) as Partial<TemplatPesan>) }}
      />
    </>
  );
}
