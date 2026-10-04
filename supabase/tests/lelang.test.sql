-- Tes aturan lelang di database. Jalankan: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ---------- Data uji (dibuat sebagai postgres, RLS tidak berlaku) ----------
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000a1', 'ibu@contoh.test');
insert into public.pengelola (user_id, nama)
values ('00000000-0000-0000-0000-0000000000a1', 'Ibu');

insert into public.listings (id, judul, harga, mode, batas_waktu, status) values
  ('10000000-0000-0000-0000-000000000001', 'Lelang buka',  50000, 'lelang', now() + interval '1 day',    'tersedia'),
  ('10000000-0000-0000-0000-000000000002', 'Lelang tutup', 50000, 'lelang', now() - interval '1 minute', 'tersedia'),
  ('10000000-0000-0000-0000-000000000003', 'Jual biasa',   20000, 'jual',   null,                         'tersedia');

insert into public.pesanan (id, listing_id, nama, no_wa, jenis, harga_tawar) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Om Budi',  '6281200000001', 'lelang', 70000),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Mas Dodi', '6281200000002', 'lelang', 65000),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Tante Ani','6281200000003', 'lelang', 55000),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Om Eko',   '6281200000004', 'pesan',  null);

-- ---------- Publik (anon) ----------
set local role anon;

select lives_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis, harga_tawar)
  values ('10000000-0000-0000-0000-000000000001', 'Tante Rina', '6281234567890', 'lelang', 60000)
$$, 'anon bisa menawar lelang yang masih terbuka');

select lives_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis, harga_tawar)
  values ('10000000-0000-0000-0000-000000000001', 'Tante Rina', '6281234567890', 'lelang', 50000)
$$, 'tawaran tepat sama dengan harga minimum diterima');

select throws_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis, harga_tawar)
  values ('10000000-0000-0000-0000-000000000001', 'Tante Rina', '6281234567890', 'lelang', 49999)
$$, '42501', null, 'tawaran di bawah minimum ditolak');

select throws_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis, harga_tawar)
  values ('10000000-0000-0000-0000-000000000002', 'Tante Rina', '6281234567890', 'lelang', 90000)
$$, '42501', null, 'tawaran setelah batas waktu ditolak');

select throws_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis, harga_tawar)
  values ('10000000-0000-0000-0000-000000000003', 'Tante Rina', '6281234567890', 'lelang', 30000)
$$, '42501', null, 'tawaran lelang ke barang mode jual ditolak');

select throws_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis)
  values ('10000000-0000-0000-0000-000000000001', 'Tante Rina', '6281234567890', 'pesan')
$$, '42501', null, 'pesan biasa ke barang lelang ditolak');

select lives_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis)
  values ('10000000-0000-0000-0000-000000000003', 'Tante Rina', '6281234567890', 'pesan')
$$, 'pesan biasa ke barang jual tetap jalan');

select throws_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis, harga_tawar)
  values ('10000000-0000-0000-0000-000000000003', 'Tante Rina', '6281234567890', 'nawar', 15000)
$$, '42501', null, 'baris nawar baru tidak bisa dikirim lagi');

select throws_ok($$
  insert into public.pesanan (listing_id, nama, no_wa, jenis, harga_tawar, created_at)
  values ('10000000-0000-0000-0000-000000000001', 'Tante Rina', '6281234567890', 'lelang', 60000,
          now() - interval '2 days')
$$, '42501', null, 'tawaran dengan created_at mundur ditolak');

select throws_ok($$ select count(*) from public.pesanan $$,
  '42501', null, 'anon tidak bisa membaca tawaran');
select throws_ok($$ update public.pesanan set harga_tawar = 1 $$,
  '42501', null, 'anon tidak bisa mengubah tawaran');
select throws_ok($$ delete from public.pesanan $$,
  '42501', null, 'anon tidak bisa menghapus tawaran');

reset role;

-- ---------- Pengelola ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
set local role authenticated;

select is(
  public.terima_pesanan('20000000-0000-0000-0000-000000000003', true, false) ->> 'ok',
  'false',
  'pemenang tidak bisa dipilih sebelum batas waktu');

select is(
  public.terima_pesanan('20000000-0000-0000-0000-000000000001', true, false) ->> 'ok',
  'true',
  'pemenang bisa dipilih setelah batas waktu');

select is(
  public.terima_pesanan('20000000-0000-0000-0000-000000000002', true, false) ->> 'ok',
  'false',
  'tidak boleh ada dua pemenang');

select is(
  (select status from public.listings where id = '10000000-0000-0000-0000-000000000002'),
  'sudah_laku',
  'barang ditandai sudah laku setelah pemenang dipilih');

select is(
  (select status from public.pesanan where id = '20000000-0000-0000-0000-000000000002'),
  'baru',
  'penawar lain tetap baru sebagai cadangan');

select is(
  public.terima_pesanan('20000000-0000-0000-0000-000000000004', true, false) ->> 'ok',
  'true',
  'pesan biasa ke barang jual tetap bisa diterima');

select * from finish();
rollback;
