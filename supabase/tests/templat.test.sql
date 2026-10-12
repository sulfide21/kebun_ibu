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
