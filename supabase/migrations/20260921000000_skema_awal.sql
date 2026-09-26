-- =====================================================================
-- Kebun Ibu - skema database
-- Jalankan seluruh isi file ini di Supabase Dashboard > SQL Editor.
-- Aman dijalankan ulang berkali-kali.
-- =====================================================================

-- ---------- 1. TABEL ----------

create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  jenis       text not null default 'mangga' check (jenis in ('mangga','pisang','lainnya')),
  judul       text not null check (char_length(judul) between 1 and 120),
  deskripsi   text not null default '' check (char_length(deskripsi) <= 2000),
  harga       bigint not null check (harga >= 0 and harga <= 1000000000),
  satuan      text not null default '/keranjang' check (char_length(satuan) <= 30),
  status      text not null default 'tersedia' check (status in ('segera','tersedia','sudah_laku')),
  created_at  timestamptz not null default now()
);

create table if not exists public.listing_foto (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  path        text not null,
  urutan      int not null default 0
);
create index if not exists listing_foto_listing_idx on public.listing_foto(listing_id, urutan);

create table if not exists public.pesanan (
  id             uuid primary key default gen_random_uuid(),
  -- Sengaja BUKAN "on delete cascade": kalau listing dihapus, riwayat
  -- penjualannya harus tetap ada. Harga dan judul disalin ke kolom
  -- snapshot di bawah supaya laporan tetap bisa dibaca.
  listing_id     uuid references public.listings(id) on delete set null,
  judul_snapshot text not null default '',
  harga_listing  bigint,
  nama           text not null check (char_length(nama) between 2 and 80),
  no_wa          text not null check (no_wa ~ '^62[0-9]{8,15}$'),
  jenis          text not null check (jenis in ('pesan','nawar')),
  harga_tawar    bigint check (harga_tawar is null or (harga_tawar >= 0 and harga_tawar <= 1000000000)),
  catatan        text not null default '' check (char_length(catatan) <= 500),
  status         text not null default 'baru' check (status in ('baru','diterima','ditolak','selesai','batal')),
  created_at     timestamptz not null default now(),
  diputuskan_at  timestamptz,
  constraint harga_tawar_sesuai_jenis check (
    (jenis = 'pesan' and harga_tawar is null) or
    (jenis = 'nawar' and harga_tawar is not null)
  )
);
create index if not exists pesanan_listing_idx on public.pesanan(listing_id);
create index if not exists pesanan_status_idx  on public.pesanan(status, created_at desc);

-- Penyesuaian untuk database yang sudah terlanjur dibuat versi lama.
alter table public.pesanan add column if not exists judul_snapshot text not null default '';
alter table public.pesanan add column if not exists harga_listing bigint;
alter table public.pesanan alter column listing_id drop not null;

do $mig$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'pesanan_listing_id_fkey'
      and table_name = 'pesanan' and constraint_schema = 'public'
  ) then
    alter table public.pesanan drop constraint pesanan_listing_id_fkey;
  end if;
  alter table public.pesanan
    add constraint pesanan_listing_id_fkey
    foreign key (listing_id) references public.listings(id) on delete set null;
end
$mig$;

create table if not exists public.pengaturan (
  id               int primary key default 1 check (id = 1),
  teks_musim       text not null default 'Musim mangga: Oktober - Desember',
  tampilkan_banner boolean not null default true
);
insert into public.pengaturan (id) values (1) on conflict (id) do nothing;

-- Daftar siapa yang boleh mengelola. Punya akun BUKAN berarti pengelola.
--
-- Tanpa tabel ini, semua aturan hanya memeriksa "sudah login atau belum",
-- padahal Supabase mengizinkan siapa saja mendaftar akun sendiri ke proyek
-- ini. Artinya orang asing tinggal daftar, lalu langsung bisa membaca nama
-- dan nomor WhatsApp seluruh keluarga.
create table if not exists public.pengelola (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  nama      text not null default '',
  dibuat_at timestamptz not null default now()
);

-- Akun yang sudah ada sekarang langsung dijadikan pengelola, supaya
-- Ibu dan Bapak tidak terkunci di luar saat berkas ini dijalankan.
-- Untuk menambah orang nanti: buat akunnya dulu di Authentication > Users,
-- lalu jalankan
--   insert into public.pengelola (user_id, nama)
--   select id, 'Nama' from auth.users where email = 'alamat@email';
insert into public.pengelola (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------- 2. HAK AKSES TABEL (GRANT) ----------
-- Ada DUA lapisan yang menentukan sebuah tabel bisa dipakai lewat API:
--
--   1. GRANT  - boleh menyentuh tabelnya sama sekali atau tidak
--   2. RLS    - baris mana yang boleh dilihat atau diubah
--
-- Supabase dulu memberi GRANT otomatis ke semua tabel baru di schema
-- public. Sejak 2026 itu dimatikan untuk proyek baru, dan mulai
-- 30 Oktober 2026 berlaku untuk semua proyek. Karena itu hak aksesnya
-- ditulis di sini, supaya berkas ini jalan sendiri di proyek mana pun,
-- dengan pengaturan apa pun.
--
-- GRANT di bawah sengaja longgar; yang benar-benar menjaga data adalah
-- RLS di bagian 3. Perhatikan: anon TIDAK diberi select pada pesanan.

-- Dicabut dulu, baru diberikan. GRANT hanya menambah, tidak pernah
-- mengurangi - jadi kalau proyeknya terlanjur memberi hak akses otomatis,
-- menulis GRANT saja tidak menghapusnya. Dengan dicabut lebih dulu,
-- hasil akhirnya sama persis di proyek mana pun, mau pengaturannya
-- bagaimanapun. service_role dan postgres sengaja tidak disentuh.
revoke all on public.listings     from anon, authenticated;
revoke all on public.listing_foto from anon, authenticated;
revoke all on public.pesanan      from anon, authenticated;
revoke all on public.pengaturan   from anon, authenticated;
revoke all on public.pengelola    from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select                         on public.listings     to anon, authenticated;
grant insert, update, delete         on public.listings     to authenticated;

grant select                         on public.listing_foto to anon, authenticated;
grant insert, update, delete         on public.listing_foto to authenticated;

grant select                         on public.pengaturan   to anon, authenticated;
grant update                         on public.pengaturan   to authenticated;

-- Publik boleh mengirim pesanan, tapi tidak boleh membacanya.
-- Ini ditegakkan dua kali: di GRANT ini dan di policy RLS nanti.
grant insert                         on public.pesanan      to anon;
grant select, insert, update, delete on public.pesanan      to authenticated;

-- Hanya select, dan policy di bawah membatasinya ke baris miliknya
-- sendiri. Jadi orang cuma bisa tahu "saya pengelola atau bukan",
-- tidak bisa melihat daftar pengelola lain.
grant select                         on public.pengelola    to authenticated;

-- ---------- 3. SIAPA PENGELOLA ----------
-- Dipakai semua aturan di bawah.
--
-- Fungsi ini SENGAJA BUKAN security definer. Versi pertamanya begitu, lalu
-- ditandai Security Advisor - dan peringatannya benar: fungsi security
-- definer berjalan dengan hak pembuatnya, jadi kalau ada celah di dalamnya,
-- celah itu berjalan dengan hak penuh.
--
-- Tidak diperlukan, karena pengelola punya policy "hanya baris sendiri".
-- Setiap orang bisa memeriksa dirinya sendiri tanpa bisa melihat daftar
-- pengelola lain, dan fungsinya cukup berjalan dengan hak pemanggil.
--
-- search_path tetap dikunci supaya isinya tidak bisa diarahkan ke tabel
-- palsu oleh pemanggil.

create or replace function public.is_pengelola()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $ip$
  select exists (
    select 1 from public.pengelola where user_id = auth.uid()
  );
$ip$;

revoke all on function public.is_pengelola() from public, anon;
grant execute on function public.is_pengelola() to authenticated;

-- ---------- 4. ROW LEVEL SECURITY ----------
-- Kunci utama keamanan situs ini. Anon key ikut terkirim ke browser dan
-- memang bersifat publik; RLS yang menentukan apa yang boleh dilakukan.
--
-- Perhatikan: aturan di bawah memeriksa is_pengelola(), BUKAN sekadar
-- "sudah login". Punya akun tidak memberi hak apa-apa.

alter table public.listings     enable row level security;
alter table public.listing_foto enable row level security;
alter table public.pesanan      enable row level security;
alter table public.pengaturan   enable row level security;
alter table public.pengelola    enable row level security;

-- Pengelola hanya boleh melihat BARIS DIRINYA SENDIRI, dan tidak ada
-- policy insert/update/delete sama sekali. Jadi:
--   - setiap orang bisa memeriksa "saya pengelola atau bukan"
--   - tidak ada yang bisa melihat daftar pengelola lain
--   - daftar pengelola tidak bisa diubah dari dalam aplikasi, bahkan oleh
--     pengelola sendiri; hanya lewat SQL Editor atau service_role
drop policy if exists pengelola_lihat_diri_sendiri on public.pengelola;
create policy pengelola_lihat_diri_sendiri on public.pengelola
  for select to authenticated using (user_id = auth.uid());

drop policy if exists listings_baca_publik  on public.listings;
drop policy if exists listings_kelola_admin on public.listings;
create policy listings_baca_publik  on public.listings
  for select to anon, authenticated using (true);
create policy listings_kelola_admin on public.listings
  for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

drop policy if exists foto_baca_publik  on public.listing_foto;
drop policy if exists foto_kelola_admin on public.listing_foto;
create policy foto_baca_publik  on public.listing_foto
  for select to anon, authenticated using (true);
create policy foto_kelola_admin on public.listing_foto
  for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- PESANAN: publik hanya boleh MENULIS, tidak boleh membaca.
-- Tanpa ini, siapa pun yang punya link bisa menarik daftar nama dan
-- nomor WhatsApp seluruh keluarga.
drop policy if exists pesanan_kirim_publik on public.pesanan;
drop policy if exists pesanan_kelola_admin on public.pesanan;
create policy pesanan_kirim_publik on public.pesanan
  for insert to anon, authenticated
  with check (
    status = 'baru'
    and diputuskan_at is null
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'tersedia'
    )
  );
create policy pesanan_kelola_admin on public.pesanan
  for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

drop policy if exists pengaturan_baca_publik on public.pengaturan;
drop policy if exists pengaturan_ubah_admin  on public.pengaturan;
create policy pengaturan_baca_publik on public.pengaturan
  for select to anon, authenticated using (true);
create policy pengaturan_ubah_admin  on public.pengaturan
  for update to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- ---------- 5. TERIMA PESANAN (anti dua pemenang) ----------
-- Ibu dan Bapak bisa membuka halaman yang sama di HP masing-masing.
-- Fungsi ini mengunci baris listing lebih dulu, jadi hanya satu
-- penawaran yang bisa menang untuk satu listing.

create or replace function public.terima_pesanan(
  p_id          uuid,
  p_tandai_laku boolean default true,
  p_tolak_lain  boolean default true
) returns json
language plpgsql
-- Dikunci supaya isi fungsi tidak bisa diarahkan ke tabel palsu lewat
-- search_path yang diatur pemanggilnya.
set search_path = public, pg_temp
as $fn$
declare
  v_listing uuid;
  v_lain    uuid;
begin
  -- Penjaga tersendiri. Tanpa ini, orang yang punya akun tapi bukan
  -- pengelola akan dapat jawaban "pesanan sudah diproses" yang
  -- menyesatkan, karena RLS diam-diam menyaring barisnya.
  if not public.is_pengelola() then
    return json_build_object('ok', false,
      'pesan', 'Akun ini tidak berhak menerima penawaran.');
  end if;

  select listing_id into v_listing from public.pesanan where id = p_id;
  if v_listing is null then
    return json_build_object('ok', false, 'pesan', 'Pesanan tidak ditemukan.');
  end if;

  perform 1 from public.listings where id = v_listing for update;

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

-- ---------- 6. STORAGE (foto) ----------
insert into storage.buckets (id, name, public)
values ('foto', 'foto', true)
on conflict (id) do update set public = true;

drop policy if exists foto_lihat_semua  on storage.objects;
drop policy if exists foto_unggah_admin on storage.objects;
drop policy if exists foto_hapus_admin  on storage.objects;

-- SENGAJA TIDAK ADA policy select untuk anon.
--
-- Bucket ini publik, jadi foto tetap bisa dibuka siapa saja lewat alamat
-- langsungnya - itu memang dikehendaki, dan tidak butuh policy sama
-- sekali. Yang dihilangkan adalah kemampuan MENDAFTAR isi bucket, yaitu
-- melihat seluruh berkas yang pernah diunggah, termasuk milik barang
-- yang sudah dihapus. Orang perlu tahu alamat fotonya untuk membukanya.
create policy foto_lihat_pengelola on storage.objects
  for select to authenticated
  using (bucket_id = 'foto' and public.is_pengelola());
create policy foto_unggah_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'foto' and public.is_pengelola());
create policy foto_hapus_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'foto' and public.is_pengelola());
