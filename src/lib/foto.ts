/** Bucket "foto" bersifat publik, jadi URL-nya bisa dibentuk langsung. */
export function urlFoto(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/foto/${path}`;
}

const URUTAN_STATUS = { tersedia: 0, segera: 1, sudah_laku: 2 } as const;

/** Yang bisa dibeli muncul lebih dulu; yang sudah laku tetap ditampilkan
 *  di bawah sebagai bukti kebun ini hidup. */
export function urutkanListing<T extends { status: keyof typeof URUTAN_STATUS; created_at: string }>(
  daftar: T[],
): T[] {
  return [...daftar].sort((a, b) => {
    const selisih = URUTAN_STATUS[a.status] - URUTAN_STATUS[b.status];
    if (selisih !== 0) return selisih;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
