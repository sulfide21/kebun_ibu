import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { keluar } from "./actions";
import NavAdmin from "./NavAdmin";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Halaman login ikut lewat sini. Tanpa sesi, tampilkan polos saja -
  // menu dan tombol keluar tidak ada gunanya sebelum masuk.
  if (!user) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      <header className="border-b-2 border-daun-tua bg-daun-tua text-putih">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-lg font-extrabold">
            Kebun Ibu
          </Link>
          <form action={keluar}>
            <button className="min-h-11 rounded-full border-2 border-putih/40 px-4 font-semibold">
              Keluar
            </button>
          </form>
        </div>
        <NavAdmin />
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24">{children}</main>
    </div>
  );
}
