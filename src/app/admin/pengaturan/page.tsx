import { supabaseServer } from "@/lib/supabase/server";
import type { Pengaturan } from "@/lib/types";
import FormPengaturan from "./FormPengaturan";

export const revalidate = 0;

export default async function HalamanPengaturan() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("pengaturan")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <>
      <h1 className="mb-1 text-3xl font-extrabold text-daun-tua">Pengaturan</h1>
      <p className="mb-6 text-daun">
        Tulisan musim yang muncul di bagian atas halaman depan.
      </p>
      <FormPengaturan pengaturan={data as Pengaturan | null} />
    </>
  );
}
