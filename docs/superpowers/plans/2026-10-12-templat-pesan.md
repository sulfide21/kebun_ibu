# Templat Pesan yang Bisa Diubah - Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ibu/Bapak bisa menulis sendiri isi pemberitahuan WhatsApp dan pesan tombol Bagikan dari halaman Pengaturan, memakai tag seperti `{nama}`.

**Architecture:** Tabel baru `templat_pesan` (satu baris, hanya pengelola yang boleh baca/ubah). Logika templat murni di `src/lib/templat.ts` (dipakai server dan browser). Pemberitahuan WhatsApp membaca templat lewat service role; tombol Bagikan menerima templat dari halaman daftar barang admin. Templat kosong = teks bawaan di kode.

**Tech Stack:** Next.js 16.3.5 (App Router, server actions), Supabase (Postgres + RLS, pgTAP), zod 4, vitest 5, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-12-templat-pesan-design.md`

## Global Constraints

- Templat hanya untuk WhatsApp; email tetap memakai teks bawaan (`kirimPemberitahuanPesanan` tidak menerima templat).
- Baris judul tebal WhatsApp (`*Pesanan baru: ...*` / `*Tawaran lelang baru: ...*`) tetap, tidak ikut templat.
- Maksimal 1.000 karakter per templat, dihitung setelah baris baru diseragamkan ke `\n`.
- Templat kosong atau hanya spasi = teks bawaan. Templat yang sama persis dengan teks bawaan disimpan sebagai `''`.
- Tag tak dikenal: dibiarkan apa adanya saat diisi, ditolak saat disimpan dengan pesan yang menyebut tagnya.
- Pemberitahuan tidak boleh pernah membatalkan atau memperlambat pesanan secara berarti; gagal baca templat = teks bawaan.
- Tabel `templat_pesan`: anon tidak diberi hak apa pun; select/update hanya `is_pengelola()`.
- Teks UI dan komentar kode dalam Bahasa Indonesia, mengikuti gaya file sekitarnya.
- Jangan commit atau push. Pengguna melakukan git sendiri di akhir.
- Uji lokal selalu dengan override env var ke Supabase lokal, tidak pernah `npm run dev` biasa (`.env.local` menunjuk produksi).

## Review Focus

- Teks pembeli yang berisi pola tag (catatan `"{link_admin}"` atau `"$1"`) harus tampil apa adanya, tidak ikut diganti. Diuji di Task 2.
- Kotak teks browser mengirim baris baru sebagai `\r\n`; templat yang tidak diubah harus tetap tersimpan sebagai `''`, dan batas 1.000 menghitung huruf yang terlihat. Diuji di Task 5.
- Tag yang diketik dengan huruf besar atau spasi (`{Nama}`, `{ nama }`) harus ditolak saat simpan, bukan diam-diam tidak terisi. Diuji di Task 2.
- Kode terpasang sebelum migrasi produksi dijalankan (tabel belum ada): pemberitahuan tetap terkirim dengan teks bawaan, halaman Pengaturan dan daftar barang tetap terbuka. Diuji di Task 4 (templat `{}`), dan urutan peluncuran di Task 6.
- Templat berisi hanya spasi atau baris kosong dianggap kosong, bukan pesan kosong yang terkirim. Diuji di Task 2 dan Task 5.

---

### Task 1: Tabel `templat_pesan` dan uji aksesnya

**Files:**
- Create: `supabase/migrations/20261012000000_templat_pesan.sql`
- Create: `supabase/tests/templat.test.sql`

**Interfaces:**
- Produces: tabel `public.templat_pesan(id int =1, wa_pesan text, wa_lelang text, bagikan_jual text, bagikan_lelang text, diubah_at timestamptz)`, satu baris `id = 1`, semua kolom teks default `''`.

- [ ] **Step 1: Tulis uji database yang gagal**

`supabase/tests/templat.test.sql`:

```sql
-- Tes aturan akses templat pesan. Jalankan: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ibu@contoh.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'orang@asing.test');
insert into public.pengelola (user_id, nama)
values ('00000000-0000-0000-0000-0000000000a1', 'Ibu');

update public.templat_pesan set wa_pesan = 'Rahasia {nama}' where id = 1;

-- ---------- Publik (anon) ----------
set local role anon;
select throws_ok(
  $$ select * from public.templat_pesan $$,
  '42501', null, 'anon tidak bisa membaca templat');
reset role;

-- ---------- Akun biasa, bukan pengelola ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
set local role authenticated;
select is_empty(
  $$ select * from public.templat_pesan $$,
  'akun biasa tidak melihat templat');
select lives_ok(
  $$ update public.templat_pesan set wa_pesan = 'diubah orang asing' where id = 1 $$,
  'update akun biasa tidak error (RLS menyaring diam-diam)');
reset role;
select is(
  (select wa_pesan from public.templat_pesan where id = 1),
  'Rahasia {nama}',
  'akun biasa tidak bisa mengubah templat');

-- ---------- Pengelola ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select results_eq(
  $$ select wa_pesan from public.templat_pesan $$,
  $$ values ('Rahasia {nama}'::text) $$,
  'pengelola bisa membaca templat');
select lives_ok(
  $$ update public.templat_pesan set wa_pesan = 'Baru' where id = 1 $$,
  'pengelola bisa mengubah templat');
select throws_ok(
  $$ update public.templat_pesan set wa_pesan = repeat('a', 1001) where id = 1 $$,
  '23514', null, 'templat lebih dari 1000 huruf ditolak');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx supabase test db`
Expected: FAIL di `templat.test.sql` dengan `relation "public.templat_pesan" does not exist`. `lelang.test.sql` tetap lulus.

- [ ] **Step 3: Tulis migrasinya**

`supabase/migrations/20261012000000_templat_pesan.sql`:

```sql
-- =====================================================================
-- Kebun Ibu - templat pesan yang bisa diubah Ibu/Bapak
-- Jalankan SETELAH 20261004000000_lelang.sql, lewat SQL Editor.
-- Aman dijalankan ulang berkali-kali.
-- Rancangan: docs/superpowers/specs/2026-10-12-templat-pesan-design.md
-- =====================================================================

-- Sengaja tabel terpisah dari pengaturan. Pengaturan bisa dibaca publik
-- (beranda butuh tulisan musim), sedangkan templat hanya untuk pengelola.
-- Aturan akses berlaku per tabel, jadi tidak bisa dicampur.
--
-- Kolom kosong = pakai teks bawaan di src/lib/templat.ts. Dengan begitu
-- perbaikan teks bawaan nanti ikut terpakai tanpa migrasi baru.
create table if not exists public.templat_pesan (
  id             int primary key default 1 check (id = 1),
  wa_pesan       text not null default '',
  wa_lelang      text not null default '',
  bagikan_jual   text not null default '',
  bagikan_lelang text not null default '',
  diubah_at      timestamptz not null default now()
);

alter table public.templat_pesan drop constraint if exists templat_pesan_panjang;
alter table public.templat_pesan add constraint templat_pesan_panjang check (
  char_length(wa_pesan) <= 1000 and char_length(wa_lelang) <= 1000 and
  char_length(bagikan_jual) <= 1000 and char_length(bagikan_lelang) <= 1000
);

insert into public.templat_pesan (id) values (1) on conflict (id) do nothing;

-- Dicabut dulu, baru diberikan (alasannya sama dengan skema awal:
-- GRANT hanya menambah). Anon sengaja tidak diberi apa-apa.
revoke all on public.templat_pesan from anon, authenticated;
grant select, update on public.templat_pesan to authenticated;

alter table public.templat_pesan enable row level security;

drop policy if exists templat_baca_pengelola on public.templat_pesan;
drop policy if exists templat_ubah_pengelola on public.templat_pesan;
create policy templat_baca_pengelola on public.templat_pesan
  for select to authenticated using (public.is_pengelola());
create policy templat_ubah_pengelola on public.templat_pesan
  for update to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());
```

- [ ] **Step 4: Pasang ke database lokal**

Run: `docker exec -i supabase_db_kebun-ibu psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261012000000_templat_pesan.sql`
Expected: `CREATE TABLE`, `ALTER TABLE`, `INSERT 0 1`, `REVOKE`, `GRANT`, `CREATE POLICY` tanpa `ERROR`. Jalankan sekali lagi untuk membuktikan aman diulang: tidak ada `ERROR`, `INSERT 0 0`.

- [ ] **Step 5: Jalankan uji database, pastikan lulus**

Run: `npx supabase test db`
Expected: kedua file lulus, `templat.test.sql .. ok`.

---

### Task 2: Inti templat (`src/lib/templat.ts`)

**Files:**
- Create: `src/lib/templat.ts`
- Test: `src/lib/templat.test.ts`

**Interfaces:**
- Produces:
  - `JENIS_TEMPLAT: readonly ["wa_pesan","wa_lelang","bagikan_jual","bagikan_lelang"]`
  - `type JenisTemplat`, `type TemplatPesan = Record<JenisTemplat, string>`
  - `TAG: Record<JenisTemplat, readonly string[]>`
  - `TEMPLAT_AWAL: TemplatPesan`, `TEMPLAT_KOSONG: TemplatPesan`
  - `CONTOH: Record<JenisTemplat, Record<string, string>>` (data contoh pratinjau)
  - `isiTemplat(templat: string, nilai: Record<string, string>): string`
  - `tagTakDikenal(templat: string, jenis: JenisTemplat): string[]`
  - `pakaiTemplat(templat: string | null | undefined, jenis: JenisTemplat): string`

- [ ] **Step 1: Tulis uji yang gagal**

`src/lib/templat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CONTOH,
  JENIS_TEMPLAT,
  TAG,
  TEMPLAT_AWAL,
  isiTemplat,
  pakaiTemplat,
  tagTakDikenal,
} from "./templat";

describe("isiTemplat", () => {
  it("mengganti tag yang dikenal", () => {
    expect(isiTemplat("Halo {nama}, {barang}!", { nama: "Budi", barang: "Mangga" })).toBe(
      "Halo Budi, Mangga!",
    );
  });

  it("tag yang tidak ada nilainya dibiarkan apa adanya", () => {
    expect(isiTemplat("Halo {nma}", { nama: "Budi" })).toBe("Halo {nma}");
  });

  it("isi dari pembeli yang mirip tag tidak ikut diganti", () => {
    const teks = isiTemplat("Catatan: {catatan}", {
      catatan: "{link_admin} $1 $&",
      link_admin: "RAHASIA",
    });
    expect(teks).toBe("Catatan: {link_admin} $1 $&");
  });

  it("tidak membaca properti bawaan objek", () => {
    expect(isiTemplat("{constructor}", {})).toBe("{constructor}");
  });
});

describe("tagTakDikenal", () => {
  it("kosong kalau semua tag sah untuk kotaknya", () => {
    expect(tagTakDikenal("{nama} {tawaran} {ditutup}", "wa_lelang")).toEqual([]);
  });

  it("menyebut tag yang salah ketik, sekali saja", () => {
    expect(tagTakDikenal("{nma} {nma} {nama}", "wa_pesan")).toEqual(["nma"]);
  });

  it("tag lelang tidak sah di pesanan biasa", () => {
    expect(tagTakDikenal("{tawaran}", "wa_pesan")).toEqual(["tawaran"]);
  });

  it("huruf besar dan spasi di dalam kurung ditolak", () => {
    expect(tagTakDikenal("{Nama} { nama }", "wa_pesan")).toEqual(["Nama", " nama "]);
  });
});

describe("pakaiTemplat", () => {
  it("kosong, hanya spasi, atau null jatuh ke teks bawaan", () => {
    expect(pakaiTemplat("", "wa_pesan")).toBe(TEMPLAT_AWAL.wa_pesan);
    expect(pakaiTemplat("  \n \n", "wa_pesan")).toBe(TEMPLAT_AWAL.wa_pesan);
    expect(pakaiTemplat(null, "bagikan_jual")).toBe(TEMPLAT_AWAL.bagikan_jual);
    expect(pakaiTemplat(undefined, "bagikan_lelang")).toBe(TEMPLAT_AWAL.bagikan_lelang);
  });

  it("templat berisi dipakai apa adanya", () => {
    expect(pakaiTemplat("Ada {nama}", "wa_pesan")).toBe("Ada {nama}");
  });
});

describe("teks bawaan dan contoh", () => {
  it("teks bawaan hanya memakai tag yang sah untuk kotaknya", () => {
    for (const jenis of JENIS_TEMPLAT) expect(tagTakDikenal(TEMPLAT_AWAL[jenis], jenis)).toEqual([]);
  });

  it("data contoh mengisi semua tag kotaknya", () => {
    for (const jenis of JENIS_TEMPLAT) {
      for (const tag of TAG[jenis]) expect(CONTOH[jenis][tag], `${jenis}.${tag}`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/templat.test.ts`
Expected: FAIL, `Failed to resolve import "./templat"`.

- [ ] **Step 3: Tulis `src/lib/templat.ts`**

```ts
/**
 * Templat pesan yang bisa diubah Ibu/Bapak di halaman Pengaturan.
 *
 * Isi yang berubah-ubah ditulis sebagai tag, misalnya {nama}. File ini
 * murni (tanpa database) supaya bisa dipakai di server untuk mengirim
 * pesan dan di browser untuk pratinjau.
 */

export const JENIS_TEMPLAT = ["wa_pesan", "wa_lelang", "bagikan_jual", "bagikan_lelang"] as const;
export type JenisTemplat = (typeof JENIS_TEMPLAT)[number];
export type TemplatPesan = Record<JenisTemplat, string>;

const TAG_PEMBERITAHUAN = [
  "nama",
  "nomor",
  "barang",
  "harga",
  "catatan",
  "link_balas",
  "link_admin",
] as const;

/** Tag yang sah untuk tiap kotak. Urutannya = urutan tombol di Pengaturan. */
export const TAG: Record<JenisTemplat, readonly string[]> = {
  wa_pesan: TAG_PEMBERITAHUAN,
  wa_lelang: [...TAG_PEMBERITAHUAN, "tawaran", "ditutup", "sisa_waktu"],
  bagikan_jual: ["barang", "harga", "satuan", "link"],
  bagikan_lelang: ["barang", "harga_mulai", "satuan", "ditutup", "link"],
};

/** Dipakai kalau kolomnya kosong. Bagikan sama persis dengan teks lama. */
export const TEMPLAT_AWAL: TemplatPesan = {
  wa_pesan: [
    "Ada pesanan baru.",
    "",
    "Barang  : {barang}",
    "Nama    : {nama}",
    "No. WA  : {nomor}",
    "Harga   : {harga}",
    "Catatan : {catatan}",
    "",
    "Balas {nama}: {link_balas}",
    "Kotak masuk: {link_admin}",
  ].join("\n"),
  wa_lelang: [
    "Ada tawaran lelang baru.",
    "",
    "Barang  : {barang}",
    "Nama    : {nama}",
    "No. WA  : {nomor}",
    "Tawaran : {tawaran}",
    "Ditutup : {ditutup} ({sisa_waktu})",
    "Catatan : {catatan}",
    "",
    "Balas {nama}: {link_balas}",
    "Kotak masuk: {link_admin}",
  ].join("\n"),
  bagikan_jual: [
    "Ada {barang} nih.",
    "Harga {harga} {satuan}.",
    "",
    "Mau pesan? Lewat sini aja:",
    "{link}",
  ].join("\n"),
  bagikan_lelang: [
    "Ada {barang} nih, dilelang.",
    "Mulai {harga_mulai} {satuan}, ditutup {ditutup}.",
    "",
    "Ikut lelang lewat sini:",
    "{link}",
  ].join("\n"),
};

export const TEMPLAT_KOSONG: TemplatPesan = {
  wa_pesan: "",
  wa_lelang: "",
  bagikan_jual: "",
  bagikan_lelang: "",
};

const CONTOH_PEMBERITAHUAN = {
  nama: "Budi",
  nomor: "0812-3456-7890",
  barang: "Mangga arumanis",
  harga: "Rp 50.000",
  catatan: "Ambil sore ya",
  link_balas: "https://wa.me/6281234567890",
  link_admin: "https://kebun-ibu.vercel.app/admin",
};

/** Data pura-pura untuk pratinjau di halaman Pengaturan. */
export const CONTOH: Record<JenisTemplat, Record<string, string>> = {
  wa_pesan: CONTOH_PEMBERITAHUAN,
  wa_lelang: {
    ...CONTOH_PEMBERITAHUAN,
    tawaran: "Rp 80.000",
    ditutup: "Sab, 17 Okt, 20.00 WITA",
    sisa_waktu: "3 hari lagi",
  },
  bagikan_jual: {
    barang: "Pisang kepok",
    harga: "Rp 30.000",
    satuan: "/sisir",
    link: "https://kebun-ibu.vercel.app/l/contoh",
  },
  bagikan_lelang: {
    barang: "Mangga arumanis",
    harga_mulai: "Rp 50.000",
    satuan: "/keranjang",
    ditutup: "Sab, 17 Okt, 20.00 WITA",
    link: "https://kebun-ibu.vercel.app/l/contoh",
  },
};

// Apa pun di antara kurung kurawal dalam satu baris, supaya {Nama} dan
// { nama } ikut tertangkap sebagai tag yang salah, bukan diam-diam lolos.
const POLA_TAG = /\{([^{}\n]*)\}/g;

/**
 * Mengganti tag dengan nilainya dalam satu kali jalan. Nilai yang sudah
 * dimasukkan tidak dibaca ulang, jadi catatan pembeli yang berisi
 * "{link_admin}" tetap tampil apa adanya.
 */
export function isiTemplat(templat: string, nilai: Record<string, string>): string {
  return templat.replace(POLA_TAG, (utuh, nama: string) =>
    Object.prototype.hasOwnProperty.call(nilai, nama) ? nilai[nama] : utuh,
  );
}

export function tagTakDikenal(templat: string, jenis: JenisTemplat): string[] {
  const sah = new Set(TAG[jenis]);
  const asing = new Set<string>();
  for (const [, nama] of templat.matchAll(POLA_TAG)) if (!sah.has(nama)) asing.add(nama);
  return [...asing];
}

export function pakaiTemplat(templat: string | null | undefined, jenis: JenisTemplat): string {
  return templat && templat.trim() !== "" ? templat : TEMPLAT_AWAL[jenis];
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/templat.test.ts`
Expected: PASS, 12 tes.

---

### Task 3: Tombol Bagikan memakai templat

**Files:**
- Modify: `src/lib/wa.ts` (fungsi `pesanBagikan`)
- Modify: `src/components/TombolBagikan.tsx`
- Modify: `src/app/admin/listing/BarisListing.tsx`
- Modify: `src/app/admin/listing/DaftarBarangAdmin.tsx`
- Modify: `src/app/admin/listing/page.tsx`
- Test: `src/lib/wa.test.ts`

**Interfaces:**
- Consumes: `isiTemplat`, `pakaiTemplat`, `TEMPLAT_KOSONG`, `type TemplatPesan` dari Task 2; tabel `templat_pesan` dari Task 1.
- Produces: `pesanBagikan(listing: Listing, templat?: Partial<TemplatPesan>): string`; prop `templat?: Partial<TemplatPesan>` di `TombolBagikan`, `BarisListing`, `DaftarBarangAdmin`.

- [ ] **Step 1: Tambah uji yang gagal di `src/lib/wa.test.ts`**

Tambahkan di dalam `describe("pesanBagikan", ...)`, setelah tes terakhir:

```ts
  it("memakai templat khusus sesuai mode barang", () => {
    const templat = {
      bagikan_jual: "Jual {barang} {harga}{satuan} {link}",
      bagikan_lelang: "Lelang {barang} mulai {harga_mulai}, tutup {ditutup}",
    };
    expect(pesanBagikan(dasar, templat)).toBe(
      `Jual Mangga Harum Manis ${rupiah(50000)}/keranjang ${alamatSitus()}/l/abc`,
    );
    expect(
      pesanBagikan({ ...dasar, mode: "lelang", batas_waktu: "2026-10-10T06:00:00Z" }, templat),
    ).toBe(`Lelang Mangga Harum Manis mulai ${rupiah(50000)}, tutup Sab, 10 Okt, 14.00 WITA`);
  });

  it("templat kosong memakai teks bawaan", () => {
    expect(pesanBagikan(dasar, { bagikan_jual: "  " })).toBe(pesanBagikan(dasar));
  });
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/wa.test.ts`
Expected: FAIL pada "memakai templat khusus" (templat diabaikan, teks bawaan yang keluar).

- [ ] **Step 3: Ubah `pesanBagikan` di `src/lib/wa.ts`**

Tambahkan impor di atas file:

```ts
import { isiTemplat, pakaiTemplat, type TemplatPesan } from "./templat";
```

Ganti seluruh fungsi `pesanBagikan` dengan:

```ts
/** Pesan siap tempel untuk dibagikan Ibu/Bapak ke grup keluarga. */
export function pesanBagikan(listing: Listing, templat: Partial<TemplatPesan> = {}): string {
  const link = `${alamatSitus()}/l/${listing.id}`;

  if (listing.mode === "lelang" && listing.batas_waktu) {
    return isiTemplat(pakaiTemplat(templat.bagikan_lelang, "bagikan_lelang"), {
      barang: listing.judul,
      harga_mulai: rupiah(listing.harga),
      satuan: listing.satuan,
      ditutup: formatWita(new Date(listing.batas_waktu)),
      link,
    });
  }

  return isiTemplat(pakaiTemplat(templat.bagikan_jual, "bagikan_jual"), {
    barang: listing.judul,
    harga: rupiah(listing.harga),
    satuan: listing.satuan,
    link,
  });
}
```

- [ ] **Step 4: Jalankan uji wa, pastikan lulus (termasuk tes lama)**

Run: `npx vitest run src/lib/wa.test.ts`
Expected: PASS semua. Tes lama ("dilelang", "Mau pesan?", jam WITA) tetap lulus karena teks bawaan sama persis.

- [ ] **Step 5: Teruskan templat ke tombol**

`src/components/TombolBagikan.tsx`: tambah impor `import type { TemplatPesan } from "@/lib/templat";`, lalu ubah props dan pemanggilan:

```tsx
export default function TombolBagikan({
  listing,
  templat,
  className = "",
}: {
  listing: Listing;
  templat?: Partial<TemplatPesan>;
  className?: string;
}) {
  const [keadaan, setKeadaan] = useState<Keadaan>("diam");
  const teks = pesanBagikan(listing, templat);
```

`src/app/admin/listing/BarisListing.tsx`: tambah impor `import type { TemplatPesan } from "@/lib/templat";`, tambah prop `templat` dan teruskan:

```tsx
export default function BarisListing({
  listing,
  jumlahPesanan,
  templat,
}: {
  listing: ListingLengkap;
  jumlahPesanan: number;
  templat: Partial<TemplatPesan>;
}) {
```

dan ganti `<TombolBagikan listing={listing} />` dengan `<TombolBagikan listing={listing} templat={templat} />`.

`src/app/admin/listing/DaftarBarangAdmin.tsx`: tambah impor `import type { TemplatPesan } from "@/lib/templat";`, tambah prop:

```tsx
export default function DaftarBarangAdmin({
  daftar,
  hitung,
  templat,
}: {
  daftar: ListingLengkap[];
  hitung: Record<string, number>;
  templat: Partial<TemplatPesan>;
}) {
```

dan ganti `<BarisListing listing={l} jumlahPesanan={hitung[l.id] ?? 0} />` dengan `<BarisListing listing={l} jumlahPesanan={hitung[l.id] ?? 0} templat={templat} />`.

`src/app/admin/listing/page.tsx`: tambah impor `import type { TemplatPesan } from "@/lib/templat";`, baca templat bersamaan dengan data lain:

```tsx
  const [{ data: listings }, { data: pesanan }, { data: templat }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, listing_foto(*)")
      .order("created_at", { ascending: false }),
    supabase.from("pesanan").select("listing_id"),
    // Gagal dibaca (misalnya migrasi belum dijalankan) = null, dan
    // tombol Bagikan memakai teks bawaan.
    supabase.from("templat_pesan").select("bagikan_jual, bagikan_lelang").eq("id", 1).maybeSingle(),
  ]);
```

dan ganti `<DaftarBarangAdmin daftar={daftar} hitung={hitung} />` dengan:

```tsx
        <DaftarBarangAdmin
          daftar={daftar}
          hitung={hitung}
          templat={(templat ?? {}) as Partial<TemplatPesan>}
        />
```

- [ ] **Step 6: Periksa tipe dan lint**

Run: `npx tsc --noEmit && npx eslint src/lib/wa.ts src/components/TombolBagikan.tsx src/app/admin/listing`
Expected: tidak ada keluaran (bersih).

---

### Task 4: Pemberitahuan WhatsApp memakai templat

**Files:**
- Modify: `src/lib/pemberitahuan.ts`
- Modify: `src/lib/whatsapp.ts`
- Create: `src/lib/templatServer.ts`
- Modify: `src/app/actions/pesanan.ts`
- Test: `src/lib/pemberitahuan.test.ts`, `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: `isiTemplat`, `pakaiTemplat`, `type TemplatPesan` dari Task 2; tabel `templat_pesan` dari Task 1.
- Produces:
  - `type IsiPemberitahuan` mendapat kolom wajib `hargaListing: number`.
  - `nilaiPemberitahuan(isi: IsiPemberitahuan, sekarang?: Date): Record<string, string>`
  - `teksPemberitahuan(isi: IsiPemberitahuan, sekarang?: Date, templat?: Partial<TemplatPesan>): { judul: string; teks: string }`
  - `kirimWaPemberitahuan(isi: IsiPemberitahuan, templat?: Partial<TemplatPesan>): Promise<void>`
  - `ambilTemplat(): Promise<Partial<TemplatPesan>>` (server-only, tidak pernah melempar)

- [ ] **Step 1: Perbarui uji `src/lib/pemberitahuan.test.ts`**

Ganti seluruh isi file dengan:

```ts
import { describe, expect, it } from "vitest";
import { rupiah } from "./format";
import { teksPemberitahuan, type IsiPemberitahuan } from "./pemberitahuan";
import { alamatSitus } from "./wa";

const SEKARANG = new Date("2026-10-08T04:00:00Z"); // Kamis 8 Okt, 12.00 WITA

const lelang: IsiPemberitahuan = {
  nama: "Budi",
  noWa: "6281234567890",
  judulListing: "Mangga arumanis",
  jenis: "lelang",
  hargaListing: 50000,
  hargaTawar: 80000,
  batasWaktu: "2026-10-10T06:00:00Z",
  catatan: "",
};

const biasa: IsiPemberitahuan = {
  ...lelang,
  jenis: "pesan",
  hargaListing: 30000,
  hargaTawar: null,
  batasWaktu: null,
  catatan: "ambil sore",
};

describe("teksPemberitahuan", () => {
  it("lelang: judul, tawaran, jam tutup, dan link balas", () => {
    const { judul, teks } = teksPemberitahuan(lelang, SEKARANG);
    expect(judul).toBe("Tawaran lelang baru: Mangga arumanis");
    expect(teks).toContain("Ada tawaran lelang baru.");
    expect(teks).toContain("Nama    : Budi");
    expect(teks).toContain("No. WA  : 0812-3456-7890");
    expect(teks).toContain(`Tawaran : ${rupiah(80000)}`);
    expect(teks).toContain("Ditutup : Sab, 10 Okt, 14.00 WITA");
    expect(teks).toContain("Catatan : -");
    expect(teks).toContain("Balas Budi: https://wa.me/6281234567890");
    expect(teks).toContain(`Kotak masuk: ${alamatSitus()}/admin`);
  });

  it("pesanan biasa: harga barang, tanpa baris ditutup", () => {
    const { judul, teks } = teksPemberitahuan(biasa, SEKARANG);
    expect(judul).toBe("Pesanan baru: Mangga arumanis");
    expect(teks).toContain("Ada pesanan baru.");
    expect(teks).toContain(`Harga   : ${rupiah(30000)}`);
    expect(teks).toContain("Catatan : ambil sore");
    expect(teks).not.toContain("Ditutup");
    expect(teks).not.toMatch(/\n\n\n/);
  });

  it("memakai templat khusus sesuai jenis pesanan", () => {
    const templat = { wa_pesan: "Pesan {nama} {harga}", wa_lelang: "Lelang {nama} {tawaran}" };
    expect(teksPemberitahuan(biasa, SEKARANG, templat).teks).toBe(`Pesan Budi ${rupiah(30000)}`);
    expect(teksPemberitahuan(lelang, SEKARANG, templat).teks).toBe(`Lelang Budi ${rupiah(80000)}`);
  });

  it("templat kosong atau tidak terbaca ({}) memakai teks bawaan", () => {
    const bawaan = teksPemberitahuan(lelang, SEKARANG).teks;
    expect(teksPemberitahuan(lelang, SEKARANG, {}).teks).toBe(bawaan);
    expect(teksPemberitahuan(lelang, SEKARANG, { wa_lelang: "" }).teks).toBe(bawaan);
  });

  it("judul tidak ikut templat", () => {
    expect(teksPemberitahuan(biasa, SEKARANG, { wa_pesan: "x" }).judul).toBe(
      "Pesanan baru: Mangga arumanis",
    );
  });
});
```

- [ ] **Step 2: Perbarui uji `src/lib/whatsapp.test.ts`**

Di objek `isi`, tambahkan `hargaListing: 30000,` setelah `jenis: "pesan",`. Lalu tambahkan tes ini di dalam `describe`, setelah tes pertama:

```ts
  it("memakai templat yang diberikan, judul tebal tetap", async () => {
    fetchPalsu.mockResolvedValue(jawab({ status: true }));
    await kirimWaPemberitahuan(isi, { wa_pesan: "Ada {nama} pesan {barang}" });
    const badan = fetchPalsu.mock.calls[0][1].body as URLSearchParams;
    expect(badan.get("message")).toBe("*Pesanan baru: Pisang kepok*\n\nAda Wati pesan Pisang kepok");
  });
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/pemberitahuan.test.ts src/lib/whatsapp.test.ts`
Expected: FAIL. Tes "harga barang", "templat khusus", dan "memakai templat yang diberikan" gagal; tsc juga akan mengeluh `hargaListing` belum ada di tipe.

- [ ] **Step 4: Ubah `src/lib/pemberitahuan.ts`**

Ganti seluruh isi file dengan:

```ts
import { rupiah, tampilkanNoWa } from "./format";
import { isiTemplat, pakaiTemplat, type TemplatPesan } from "./templat";
import { formatWita, sisaWaktu } from "./waktu";
import { alamatSitus } from "./wa";

export type IsiPemberitahuan = {
  nama: string;
  /** Bentuk yang disimpan, 62812..., supaya bisa jadi link wa.me. */
  noWa: string;
  judulListing: string;
  jenis: "pesan" | "lelang";
  /** Harga yang dipasang. Untuk lelang = harga minimum. */
  hargaListing: number;
  hargaTawar: number | null;
  /** Hanya untuk lelang, ISO. */
  batasWaktu: string | null;
  catatan: string;
};

/** Nilai setiap tag pemberitahuan. Yang tidak berlaku diisi "-". */
export function nilaiPemberitahuan(
  isi: IsiPemberitahuan,
  sekarang = new Date(),
): Record<string, string> {
  const batas = isi.batasWaktu ? new Date(isi.batasWaktu) : null;
  return {
    nama: isi.nama,
    nomor: tampilkanNoWa(isi.noWa),
    barang: isi.judulListing,
    harga: rupiah(isi.hargaListing),
    tawaran: isi.hargaTawar !== null ? rupiah(isi.hargaTawar) : "-",
    catatan: isi.catatan || "-",
    ditutup: batas ? formatWita(batas) : "-",
    sisa_waktu: batas ? sisaWaktu(batas, sekarang) : "-",
    link_balas: `https://wa.me/${isi.noWa}`,
    link_admin: `${alamatSitus()}/admin`,
  };
}

/**
 * Isi pemberitahuan pesanan baru untuk Ibu/Bapak. Email memanggil tanpa
 * templat (selalu teks bawaan); WhatsApp memberikan templat dari
 * Pengaturan. Judul tidak ikut templat.
 */
export function teksPemberitahuan(
  isi: IsiPemberitahuan,
  sekarang = new Date(),
  templat: Partial<TemplatPesan> = {},
): { judul: string; teks: string } {
  const jenis = isi.jenis === "lelang" ? "wa_lelang" : "wa_pesan";
  return {
    judul:
      isi.jenis === "lelang"
        ? `Tawaran lelang baru: ${isi.judulListing}`
        : `Pesanan baru: ${isi.judulListing}`,
    teks: isiTemplat(pakaiTemplat(templat[jenis], jenis), nilaiPemberitahuan(isi, sekarang)),
  };
}
```

- [ ] **Step 5: Ubah `src/lib/whatsapp.ts`**

Ganti baris impor dengan:

```ts
import { teksPemberitahuan, type IsiPemberitahuan } from "./pemberitahuan";
import type { TemplatPesan } from "./templat";
```

Ganti tanda tangan fungsi dan baris pembuatan teks:

```ts
export async function kirimWaPemberitahuan(
  isi: IsiPemberitahuan,
  templat: Partial<TemplatPesan> = {},
): Promise<void> {
  const token = process.env.FONNTE_TOKEN;
  const tujuan = process.env.WA_TUJUAN;
  if (!token || !tujuan) return; // belum dipasang: lewati diam-diam

  const { judul, teks } = teksPemberitahuan(isi, new Date(), templat);
```

Sisa fungsi tidak berubah.

- [ ] **Step 6: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/pemberitahuan.test.ts src/lib/whatsapp.test.ts`
Expected: PASS semua.

- [ ] **Step 7: Buat `src/lib/templatServer.ts`**

```ts
import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type { TemplatPesan } from "./templat";

/**
 * Templat untuk pemberitahuan WhatsApp. Pesanan dikirim pembeli tanpa
 * login, sedangkan tabel templat hanya boleh dibaca pengelola, jadi
 * dibaca lewat service role. Yang keluar dari sini hanya teks templat.
 *
 * Tidak pernah melempar: gagal dibaca (termasuk tabel belum dibuat) =
 * {} = teks bawaan. Pemberitahuan tetap terkirim.
 */
export async function ambilTemplat(): Promise<Partial<TemplatPesan>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("templat_pesan")
      .select("wa_pesan, wa_lelang")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data ?? {};
  } catch (error) {
    console.error("[templat] gagal membaca templat:", error);
    return {};
  }
}
```

- [ ] **Step 8: Sambungkan di `src/app/actions/pesanan.ts`**

Tambah impor setelah impor `kirimWaPemberitahuan`:

```ts
import { ambilTemplat } from "@/lib/templatServer";
```

Di objek `isiPemberitahuan`, tambahkan `hargaListing: listing.harga,` setelah `jenis: data.jenis,`. Lalu ganti `Promise.all` dengan:

```ts
  await Promise.all([
    kirimPemberitahuanPesanan(isiPemberitahuan),
    ambilTemplat().then((templat) => kirimWaPemberitahuan(isiPemberitahuan, templat)),
  ]);
```

- [ ] **Step 9: Periksa tipe, lint, dan semua uji**

Run: `npx tsc --noEmit && npx eslint src/lib src/app/actions && npm test`
Expected: tsc dan eslint tanpa keluaran; semua tes lulus. (`email.ts` tidak perlu diubah: ia memanggil `teksPemberitahuan(isi)` tanpa templat.)

---

### Task 5: Simpan dan ubah templat di halaman Pengaturan

**Files:**
- Modify: `src/lib/validasi.ts` (tambah `skemaTemplat`)
- Modify: `src/app/admin/actions.ts:339-365` (`simpanPengaturan`)
- Create: `src/app/admin/pengaturan/KotakTemplat.tsx`
- Modify: `src/app/admin/pengaturan/FormPengaturan.tsx`
- Modify: `src/app/admin/pengaturan/page.tsx`
- Test: `src/lib/validasi.test.ts`

**Interfaces:**
- Consumes: `JENIS_TEMPLAT`, `TAG`, `TEMPLAT_AWAL`, `TEMPLAT_KOSONG`, `CONTOH`, `isiTemplat`, `pakaiTemplat`, `tagTakDikenal`, `type JenisTemplat`, `type TemplatPesan` dari Task 2; tabel dari Task 1.
- Produces: `skemaTemplat` (zod object, keluaran `TemplatPesan`); field form bernama `wa_pesan`, `wa_lelang`, `bagikan_jual`, `bagikan_lelang`; komponen `KotakTemplat`.

- [ ] **Step 1: Tambah uji yang gagal di `src/lib/validasi.test.ts`**

Tambahkan `skemaTemplat` ke impor dari `"./validasi"`, tambahkan `import { TEMPLAT_AWAL } from "./templat";`, lalu di akhir file:

```ts
describe("skemaTemplat", () => {
  const kosong = { wa_pesan: "", wa_lelang: "", bagikan_jual: "", bagikan_lelang: "" };

  it("templat sah disimpan dengan baris baru \\n", () => {
    const hasil = skemaTemplat.safeParse({ ...kosong, wa_pesan: "Ada {nama}\r\nNomor {nomor}" });
    expect(hasil.success && hasil.data.wa_pesan).toBe("Ada {nama}\nNomor {nomor}");
  });

  it("teks bawaan yang dikirim browser (\\r\\n) disimpan sebagai kosong", () => {
    const dariBrowser = TEMPLAT_AWAL.wa_lelang.replace(/\n/g, "\r\n");
    const hasil = skemaTemplat.safeParse({ ...kosong, wa_lelang: dariBrowser });
    expect(hasil.success && hasil.data.wa_lelang).toBe("");
  });

  it("hanya spasi dan baris kosong disimpan sebagai kosong", () => {
    const hasil = skemaTemplat.safeParse({ ...kosong, bagikan_jual: "  \r\n  " });
    expect(hasil.success && hasil.data.bagikan_jual).toBe("");
  });

  it("tag tak dikenal ditolak dengan nama tagnya, di kotak yang benar", () => {
    const hasil = skemaTemplat.safeParse({ ...kosong, wa_pesan: "Halo {nma} {tawaran}" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) {
      const galat = hasil.error.issues[0];
      expect(galat.path[0]).toBe("wa_pesan");
      expect(galat.message).toContain("{nma}");
      expect(galat.message).toContain("{tawaran}");
    }
  });

  it("batas 1.000 huruf dihitung setelah \\r\\n diseragamkan", () => {
    const pas = "a\r\n".repeat(500); // 1.000 huruf setelah jadi "a\n" x 500
    expect(skemaTemplat.safeParse({ ...kosong, bagikan_lelang: pas }).success).toBe(true);
    const lebih = skemaTemplat.safeParse({ ...kosong, bagikan_lelang: "a".repeat(1001) });
    expect(lebih.success).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/validasi.test.ts`
Expected: FAIL, `skemaTemplat` tidak diekspor.

- [ ] **Step 3: Tambah `skemaTemplat` di `src/lib/validasi.ts`**

Tambah impor di bagian atas:

```ts
import { TEMPLAT_AWAL, tagTakDikenal, type JenisTemplat } from "./templat";
```

Tambahkan setelah `skemaPengaturan`:

```ts
/**
 * Satu kotak templat. Browser mengirim baris baru sebagai \r\n, jadi
 * diseragamkan dulu sebelum dihitung panjangnya dan dibandingkan dengan
 * teks bawaan. Teks bawaan dan isi kosong disimpan sebagai "", supaya
 * perbaikan teks bawaan nanti ikut terpakai.
 */
const kotakTemplat = (jenis: JenisTemplat) =>
  z
    .string()
    .transform((s) => s.replace(/\r\n/g, "\n"))
    .pipe(
      z
        .string()
        .max(1000, "Maksimal 1.000 huruf.")
        .superRefine((s, ctx) => {
          const asing = tagTakDikenal(s, jenis);
          if (asing.length > 0) {
            ctx.addIssue({
              code: "custom",
              message: `Tag ${asing.map((t) => `{${t}}`).join(", ")} tidak dikenal di pesan ini. Pakai tombol tag di bawah kotak.`,
            });
          }
        }),
    )
    .transform((s) => (s.trim() === "" || s === TEMPLAT_AWAL[jenis] ? "" : s));

export const skemaTemplat = z.object({
  wa_pesan: kotakTemplat("wa_pesan"),
  wa_lelang: kotakTemplat("wa_lelang"),
  bagikan_jual: kotakTemplat("bagikan_jual"),
  bagikan_lelang: kotakTemplat("bagikan_lelang"),
});
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/validasi.test.ts`
Expected: PASS semua (tes lama ikut lulus).

- [ ] **Step 5: Simpan kedua tabel di `simpanPengaturan` (`src/app/admin/actions.ts`)**

Tambahkan `skemaTemplat` ke impor dari `"@/lib/validasi"`. Ganti seluruh fungsi `simpanPengaturan` dengan:

```ts
export async function simpanPengaturan(
  _sebelumnya: HasilAksi | null,
  formData: FormData,
): Promise<HasilAksi> {
  const pengaturan = skemaPengaturan.safeParse({
    teks_musim: formData.get("teks_musim") ?? "",
    tampilkan_banner: formData.get("tampilkan_banner") === "on",
  });
  const templat = skemaTemplat.safeParse({
    wa_pesan: formData.get("wa_pesan") ?? "",
    wa_lelang: formData.get("wa_lelang") ?? "",
    bagikan_jual: formData.get("bagikan_jual") ?? "",
    bagikan_lelang: formData.get("bagikan_lelang") ?? "",
  });

  if (!pengaturan.success || !templat.success) {
    return {
      ok: false,
      pesan: "Belum tersimpan. Periksa tulisan merah di bawah.",
      error: {
        ...(pengaturan.success ? {} : pesanError(pengaturan.error)),
        ...(templat.success ? {} : pesanError(templat.error)),
      },
    };
  }

  const supabase = await supabaseServer();
  const [simpanMusim, simpanTemplat] = await Promise.all([
    supabase.from("pengaturan").update(pengaturan.data).eq("id", 1),
    supabase
      .from("templat_pesan")
      .update({ ...templat.data, diubah_at: new Date().toISOString() })
      .eq("id", 1),
  ]);

  const gagal = simpanMusim.error ?? simpanTemplat.error;
  if (gagal) {
    console.error("[admin] gagal simpan pengaturan:", gagal.message);
    return { ok: false, pesan: "Gagal menyimpan pengaturan." };
  }

  segarkan();
  return { ok: true, pesan: "Pengaturan tersimpan." };
}
```

- [ ] **Step 6: Buat `src/app/admin/pengaturan/KotakTemplat.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import {
  CONTOH,
  TAG,
  TEMPLAT_AWAL,
  isiTemplat,
  pakaiTemplat,
  type JenisTemplat,
} from "@/lib/templat";

/**
 * Satu kotak templat: teks bebas, tombol untuk menyisipkan tag di posisi
 * kursor, dan pratinjau dengan data contoh. Kotak dikendalikan state,
 * jadi isinya tidak hilang saat simpan gagal.
 */
export default function KotakTemplat({
  jenis,
  judul,
  keterangan,
  awal,
  galat,
}: {
  jenis: JenisTemplat;
  judul: string;
  keterangan: string;
  /** Isi tersimpan. Kosong = tampilkan teks bawaan. */
  awal: string;
  galat?: string;
}) {
  const [teks, setTeks] = useState(awal || TEMPLAT_AWAL[jenis]);
  const kotak = useRef<HTMLTextAreaElement>(null);

  function sisipkan(tag: string) {
    const el = kotak.current;
    const sisip = `{${tag}}`;
    const mulai = el?.selectionStart ?? teks.length;
    const akhir = el?.selectionEnd ?? teks.length;
    setTeks(teks.slice(0, mulai) + sisip + teks.slice(akhir));
    // Kursor dipindah ke setelah tag, setelah React memperbarui kotaknya.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(mulai + sisip.length, mulai + sisip.length);
    });
  }

  return (
    <fieldset className="grid gap-3 rounded-[10px] border-2 border-daun-tua bg-putih p-4">
      <legend className="px-1 text-lg font-bold text-daun-tua">{judul}</legend>
      <p className="text-base text-daun">{keterangan}</p>

      <textarea
        ref={kotak}
        name={jenis}
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        rows={9}
        maxLength={1000}
        aria-label={judul}
        className="w-full rounded-[10px] border-2 border-daun-tua bg-putih px-4 py-3 text-base"
      />

      <div className="flex flex-wrap gap-2">
        {TAG[jenis].map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => sisipkan(tag)}
            className="min-h-11 rounded-full border-2 border-daun-tua px-3 font-semibold text-daun-tua"
          >
            + {tag}
          </button>
        ))}
      </div>

      {galat ? <p className="font-semibold text-bata">{galat}</p> : null}

      <div className="rounded-[10px] bg-kertas px-4 py-3">
        <p className="mb-1 text-sm font-bold text-daun">Contoh hasil</p>
        <p className="text-base break-words whitespace-pre-wrap">
          {isiTemplat(pakaiTemplat(teks, jenis), CONTOH[jenis])}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setTeks(TEMPLAT_AWAL[jenis])}
        className="min-h-11 justify-self-start rounded-full border-2 border-daun-tua px-4 font-semibold"
      >
        Kembalikan ke awal
      </button>
    </fieldset>
  );
}
```

- [ ] **Step 7: Pasang empat kotak di `FormPengaturan.tsx`**

Tambah impor:

```tsx
import KotakTemplat from "./KotakTemplat";
import type { TemplatPesan } from "@/lib/templat";
```

Ubah props:

```tsx
export default function FormPengaturan({
  pengaturan,
  templat,
}: {
  pengaturan: Pengaturan | null;
  templat: TemplatPesan;
}) {
```

Sisipkan blok ini tepat setelah `</label>` milik kotak centang "Tampilkan di halaman depan" dan sebelum `{hasil?.pesan ? (`:

```tsx
      <div className="mt-4 grid gap-1">
        <h2 className="text-2xl font-extrabold text-daun-tua">Isi pesan</h2>
        <p className="text-daun">
          Tulis bebas. Tekan tombol tag untuk menyisipkan nama, nomor, harga,
          dan lainnya. Bagian &ldquo;Contoh hasil&rdquo; menunjukkan pesannya
          nanti.
        </p>
      </div>

      <KotakTemplat
        jenis="wa_pesan"
        judul="WhatsApp: pesanan baru"
        keterangan="Dikirim ke WhatsApp Ibu setiap ada pesanan barang biasa."
        awal={templat.wa_pesan}
        galat={hasil?.error?.wa_pesan}
      />
      <KotakTemplat
        jenis="wa_lelang"
        judul="WhatsApp: tawaran lelang baru"
        keterangan="Dikirim ke WhatsApp Ibu setiap ada tawaran lelang."
        awal={templat.wa_lelang}
        galat={hasil?.error?.wa_lelang}
      />
      <KotakTemplat
        jenis="bagikan_jual"
        judul="Bagikan: barang biasa"
        keterangan="Teks yang disalin saat menekan Bagikan pada barang biasa."
        awal={templat.bagikan_jual}
        galat={hasil?.error?.bagikan_jual}
      />
      <KotakTemplat
        jenis="bagikan_lelang"
        judul="Bagikan: barang lelang"
        keterangan="Teks yang disalin saat menekan Bagikan pada barang lelang."
        awal={templat.bagikan_lelang}
        galat={hasil?.error?.bagikan_lelang}
      />
```

- [ ] **Step 8: Baca templat di `src/app/admin/pengaturan/page.tsx`**

Ganti isi file dengan:

```tsx
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
```

- [ ] **Step 9: Periksa tipe, lint, dan semua uji**

Run: `npx tsc --noEmit && npx eslint src && npm test`
Expected: tsc dan eslint tanpa keluaran; semua tes lulus.

---

### Task 6: Uji manual di lokal dan serah terima

**Files:** tidak ada perubahan kode.

- [ ] **Step 1: Pastikan server lokal berjalan dengan Supabase lokal**

Kalau belum berjalan, di PowerShell (kunci dari `npx supabase status -o env`):

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="<ANON_KEY>"; $env:SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"; npx next dev --webpack
```

- [ ] **Step 2: Cek halaman Pengaturan**

Buka `http://localhost:3000/admin/pengaturan`. Expected:
- Empat kotak terisi teks bawaan, pratinjau menampilkan Budi / Mangga arumanis.
- Tekan `+ nama` di tengah teks: `{nama}` muncul di posisi kursor, pratinjau berubah.
- Ketik `{nma}`, tekan Simpan: pesan merah "Tag {nma} tidak dikenal" di bawah kotak itu, isi kotak tidak hilang.
- Hapus `{nma}`, ubah kalimat pertama `WhatsApp: pesanan baru`, Simpan: "Pengaturan tersimpan."
- Muat ulang halaman: perubahan tetap ada.

- [ ] **Step 3: Cek pemberitahuan WhatsApp**

Buka barang "Pisang kepok (uji cari)", kirim pesanan dengan nomor baru. Expected: WhatsApp ke `WA_TUJUAN` memakai kalimat yang diubah, dengan judul tebal tetap di atas.

- [ ] **Step 4: Cek tombol Bagikan**

Ubah templat "Bagikan: barang biasa", Simpan, buka `/admin/listing`, tekan Bagikan pada Pisang kepok. Expected: teks tersalin memakai templat baru. Tekan "Kembalikan ke awal", Simpan, Bagikan lagi: teks lama kembali.

- [ ] **Step 5: Serahkan ke pengguna untuk peluncuran (urutan penting)**

1. Jalankan `supabase/migrations/20261012000000_templat_pesan.sql` di SQL Editor Supabase produksi. **Sebelum** push, supaya halaman admin langsung bisa menyimpan templat.
2. Pengguna commit dan push sendiri: file di Task 1 sampai 5, ditambah perubahan sebelumnya yang belum di-commit (kotak cari kotak masuk, pemberitahuan WhatsApp, FormPesanan).
3. Pasang `FONNTE_TOKEN` dan `WA_TUJUAN` di Vercel > Settings > Environment Variables, lalu redeploy.
