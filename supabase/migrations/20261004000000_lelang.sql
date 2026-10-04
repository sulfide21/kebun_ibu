-- =====================================================================
-- Kebun Ibu - mode lelang
-- Jalankan SETELAH 20260921000000_skema_awal.sql, lewat SQL Editor.
-- Aman dijalankan ulang berkali-kali.
-- Rancangan: docs/superpowers/specs/2026-10-04-lelang-design.md
-- =====================================================================

-- ---------- 1. LISTINGS: mode dan batas waktu ----------
-- Pada mode lelang, kolom harga dipakai sebagai harga minimum.
alter table public.listings add column if not exists mode text not null default 'jual';
alter table public.listings add column if not exists batas_waktu timestamptz;

alter table public.listings drop constraint if exists listings_mode_check;
alter table public.listings
  add constraint listings_mode_check check (mode in ('jual','lelang'));

alter table public.listings drop constraint if exists lelang_wajib_batas_waktu;
alter table public.listings
  add constraint lelang_wajib_batas_waktu check (mode = 'jual' or batas_waktu is not null);

-- ---------- 2. PESANAN: jenis lelang ----------
-- 'nawar' tetap sah supaya riwayat lama tidak rusak. Kiriman nawar baru
-- ditolak oleh policy di bagian 3.
alter table public.pesanan drop constraint if exists pesanan_jenis_check;
alter table public.pesanan
  add constraint pesanan_jenis_check check (jenis in ('pesan','nawar','lelang'));

alter table public.pesanan drop constraint if exists harga_tawar_sesuai_jenis;
alter table public.pesanan add constraint harga_tawar_sesuai_jenis check (
  (jenis = 'pesan' and harga_tawar is null) or
  (jenis in ('nawar','lelang') and harga_tawar is not null)
);

-- ---------- 3. ATURAN KIRIM PUBLIK ----------
-- Setiap kolom baris baru ditulis dengan awalan "pesanan.". Tabel listings
-- juga punya kolom jenis (mangga/pisang) dan status; di dalam subquery,
-- nama tanpa awalan terbaca sebagai kolom l, dan semua tawaran akan
-- ditolak tanpa pesan yang jelas.
drop policy if exists pesanan_kirim_publik on public.pesanan;
create policy pesanan_kirim_publik on public.pesanan
  for insert to anon, authenticated
  with check (
    pesanan.status = 'baru'
    and pesanan.diputuskan_at is null
    -- Waktu kirim harus waktu sekarang. Tanpa ini, panggilan API langsung
    -- bisa memundurkan created_at sehingga tawaran langsung masuk harga
    -- publik dan Ibu kehilangan waktu sampai tengah malam untuk menolaknya.
    and pesanan.created_at = now()
    and exists (
      select 1 from public.listings l
      where l.id = pesanan.listing_id
        and l.status = 'tersedia'
        and (
          (pesanan.jenis = 'pesan' and l.mode = 'jual')
          or
          (pesanan.jenis = 'lelang' and l.mode = 'lelang'
             and now() < l.batas_waktu
             and pesanan.harga_tawar >= l.harga)
        )
    )
  );

-- ---------- 4. TERIMA PESANAN: tunggu lelang ditutup ----------
-- Sama seperti versi di skema awal, ditambah satu penjaga: pemenang lelang
-- hanya bisa dipilih setelah batas waktunya lewat.
create or replace function public.terima_pesanan(
  p_id          uuid,
  p_tandai_laku boolean default true,
  p_tolak_lain  boolean default true
) returns json
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  v_listing uuid;
  v_lain    uuid;
  v_mode    text;
  v_batas   timestamptz;
begin
  if not public.is_pengelola() then
    return json_build_object('ok', false,
      'pesan', 'Akun ini tidak berhak menerima penawaran.');
  end if;

  select listing_id into v_listing from public.pesanan where id = p_id;
  if v_listing is null then
    return json_build_object('ok', false, 'pesan', 'Pesanan tidak ditemukan.');
  end if;

  select mode, batas_waktu into v_mode, v_batas
    from public.listings where id = v_listing for update;

  if v_mode = 'lelang' and now() < v_batas then
    return json_build_object('ok', false,
      'pesan', 'Lelang belum ditutup. Tunggu batas waktunya, atau tekan "Tutup lelang sekarang".');
  end if;

  select id into v_lain from public.pesanan
   where listing_id = v_listing and id <> p_id
     and status in ('diterima','selesai')
   limit 1;
  if v_lain is not null then
    return json_build_object('ok', false,
      'pesan', 'Penawaran lain sudah diterima untuk listing ini. Muat ulang halaman.');
  end if;

  update public.pesanan
     set status = 'diterima', diputuskan_at = now()
   where id = p_id and status = 'baru';
  if not found then
    return json_build_object('ok', false,
      'pesan', 'Pesanan ini sudah diproses sebelumnya. Muat ulang halaman.');
  end if;

  if p_tolak_lain then
    update public.pesanan
       set status = 'ditolak', diputuskan_at = now()
     where listing_id = v_listing and status = 'baru' and id <> p_id;
  end if;

  if p_tandai_laku then
    update public.listings set status = 'sudah_laku' where id = v_listing;
  end if;

  return json_build_object('ok', true);
end;
$fn$;

revoke all on function public.terima_pesanan(uuid, boolean, boolean) from public, anon;
grant execute on function public.terima_pesanan(uuid, boolean, boolean) to authenticated;
