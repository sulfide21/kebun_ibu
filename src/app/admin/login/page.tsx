"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function HalamanLogin() {
  return (
    <Suspense>
      <FormLogin />
    </Suspense>
  );
}

function FormLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [sedangMasuk, setSedangMasuk] = useState(false);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    setSedangMasuk(true);
    setPesan(null);

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password: sandi,
    });

    if (error) {
      setPesan("Email atau kata sandi salah.");
      setSedangMasuk(false);
      return;
    }

    router.replace(params.get("lanjut") || "/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-extrabold text-daun-tua">Masuk</h1>
      <p className="mt-1 text-daun">Halaman ini untuk Ibu dan Bapak saja.</p>

      <form onSubmit={masuk} className="mt-8 grid gap-4">
        <label className="block">
          <span className="mb-1.5 block font-semibold">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-semibold">Kata sandi</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-lg"
          />
        </label>

        {pesan ? (
          <p className="rounded-[10px] border-2 border-bata bg-putih px-4 py-3 font-semibold text-bata">
            {pesan}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={sedangMasuk}
          className="min-h-13 rounded-full bg-daun-tua px-6 py-3 text-lg font-bold text-putih disabled:opacity-60"
        >
          {sedangMasuk ? "Sebentar…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
