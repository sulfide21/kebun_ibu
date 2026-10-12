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
