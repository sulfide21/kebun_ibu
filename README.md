# Kebun Ibu

Situs jualan mangga dan pisang untuk keluarga. Ibu/Bapak memasang foto dan
harga, keluarga memesan atau menawar lewat link WhatsApp, lalu Ibu/Bapak yang
memilih siapa yang dapat.

Tidak ada pembayaran online, tidak ada hitungan kilo, tidak ada pendaftaran
akun untuk pembeli. Uang tetap tunai, seperti biasa.

---

## Menyiapkan database

Ada dua cara. **Cara A untuk mengerjakan dan demo**, Cara B saat sudah mau
dinaikkan ke internet. Keduanya memakai skema yang sama, jadi pindah dari A
ke B cukup mengganti tiga nilai di `.env.local`.

---

### Cara A — Supabase lokal (Docker)

Perkiraan waktu: **20 menit**, hampir seluruhnya mengunduh.

Tidak perlu membuka supabase.com sama sekali. Semuanya jalan di komputer
sendiri: Postgres, Auth, Storage, plus Studio (tampilan seperti dashboard
Supabase) di `localhost:54323`.

1. **Nyalakan Docker Desktop**, tunggu sampai ikon paus berhenti bergerak.

2. **Jalankan:**

   ```bash
   npx supabase start
   ```

   Unduhan pertama sekitar 2 GB. Sesudahnya, menyalakan hanya butuh beberapa
   detik. Skema di `supabase/migrations/` ikut dipasang otomatis — tidak
   perlu menempel SQL ke mana pun.

3. **Salin kunci yang dicetak** ke `.env.local` (salin dulu dari
   `.env.example`):

   | Isian | Baris yang dicetak |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `API URL` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon key` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role key` |

4. **Buat akun Ibu dan Bapak:** buka <http://127.0.0.1:54323> →
   **Authentication > Add user** → isi email dan kata sandi.

   Lalu jadikan keduanya pengelola (lihat
   [Siapa yang boleh mengelola](#siapa-yang-boleh-mengelola) di bawah).
   **Punya akun saja tidak cukup.**

5. **Jalankan situsnya:**

   ```bash
   npm run dev
   ```

   Buka <http://localhost:3000>. Halaman penjual ada di `/admin`.

Perintah yang sering dipakai:

```bash
npx supabase stop          # matikan (data tetap tersimpan)
npx supabase status        # lihat kunci lagi
npx supabase db reset      # kosongkan dan pasang ulang skema
```

---

### Cara B — Supabase online (saat mau dipakai betulan)

1. Daftar di [supabase.com](https://supabase.com), buat proyek baru, region
   **Southeast Asia (Singapore)**.
2. Buka **SQL Editor**, salin seluruh isi
   [`supabase/migrations/20260921000000_skema_awal.sql`](supabase/migrations/20260921000000_skema_awal.sql),
   tempel, tekan **Run**. Aman dijalankan berulang kali.
3. **Authentication > Users > Add user** untuk Ibu dan Bapak, centang
   **Auto Confirm User**. Lalu jadikan keduanya pengelola — lihat bagian
   berikutnya. **Punya akun saja tidak cukup.**
4. **Authentication > Sign In / Providers**: matikan **Allow new users to
   sign up**. Ini yang paling penting di seluruh daftar — tanpa itu, siapa
   pun bisa membuat akun sendiri di proyek ini.
5. Di halaman yang sama, atur **Minimum password length** jadi 12,
   nyalakan **Password requirements**, **Secure password change**, dan
   **Require current password when updating**.

> **Leaked password protection** (pengecekan ke HaveIBeenPwned) hanya ada di
> paket Pro, jadi peringatannya akan tetap muncul di Security Advisor.
> Penggantinya: pendaftaran ditutup, kata sandi panjang dan acak, dan syarat
> kata sandi dinyalakan. Dengan hanya dua akun yang semuanya kita kendalikan
> sendiri, pengecekan itu memang tidak banyak menambah.
4. Isi `.env.local` dari **Project Settings > API**: Project URL, anon key,
   service_role key.

Pakai kata sandi yang panjang dan berbeda dari kata sandi lain. Akun inilah
jalan masuk yang paling mungkin ditembus orang — bukan celah di kodenya.

> `SUPABASE_SERVICE_ROLE_KEY` menembus semua aturan keamanan database.
> Jangan di-commit, jangan dikirim lewat WhatsApp, jangan diberi awalan
> `NEXT_PUBLIC_`.

---

## Email pemberitahuan (boleh dilewati)

Tanpa ini situs tetap jalan — Ibu/Bapak tinggal membuka `/admin` sendiri.

1. Daftar di [resend.com](https://resend.com) **memakai Gmail yang nanti
   menerima pemberitahuan**. Di paket gratis tanpa domain sendiri, email
   hanya boleh dikirim ke alamat yang dipakai mendaftar.
2. Buat API key, isi `RESEND_API_KEY` dan `EMAIL_TUJUAN` di `.env.local`.

Kenapa bukan SMTP Gmail: di Vercel, begitu server mengirim jawaban ke
pengunjung, pekerjaan yang belum selesai dihentikan. Percakapan SMTP butuh
banyak langkah bolak-balik, jadi sering terpotong di tengah tanpa pesan error
sama sekali. Resend mengirim lewat satu permintaan HTTPS, dan emailnya tetap
masuk ke Gmail.

---

## Menaikkan ke internet (Vercel)

1. Push proyek ini ke GitHub.
2. Di [vercel.com](https://vercel.com), **Add New > Project**, pilih repo-nya.
3. Salin semua isi `.env.local` ke **Environment Variables**.
4. Setelah dapat alamat, ubah `NEXT_PUBLIC_SITE_URL` jadi alamat itu, lalu
   deploy ulang. Kalau tidak, link di pesan WhatsApp masih menunjuk ke
   `localhost` dan tidak bisa dibuka siapa pun.

`vercel.json` sudah mengatur cron harian ke `/api/keepalive`. **Jangan
dihapus.** Supabase gratis menidurkan database yang menganggur 7 hari,
sedangkan musim mangga cuma setahun sekali — tanpa cron itu, situsnya mati
persis di minggu sebelum demo.

---

## Cara pakai sehari-hari

**Ibu/Bapak:**

1. `/admin/listing` → **Pasang** → foto, harga, keterangan bebas → Simpan.
2. Tekan **Bagikan ke WhatsApp** → pilih grup keluarga → kirim.
3. Penawaran masuk ke **Kotak masuk**.
4. **Terima** yang dipilih. Dua centang muncul, keduanya sudah tercentang:
   tandai barang jadi "sudah laku", dan tolak penawaran lain. Boleh dilepas
   kalau mau menjual sisanya atau menyimpan penawar cadangan.
5. Tekan **Hubungi lewat WhatsApp** untuk mengabari yang menang.
6. Setelah diambil dan dibayar → **Sudah diambil & lunas**. Kalau tidak jadi
   datang → **Tidak jadi ambil**.

**Keluarga:** buka link, tekan **Pesan** atau **Nawar harga**, isi nama dan
nomor WhatsApp. Selesai. Tidak ada pendaftaran.

---

## Siapa yang boleh mengelola

Punya akun di proyek ini **tidak** memberi hak apa pun. Yang menentukan
adalah tabel `pengelola`.

Alasannya: Supabase mengizinkan siapa saja mendaftar akun sendiri ke sebuah
proyek. Kalau aturannya cuma memeriksa "sudah login atau belum", orang asing
tinggal mendaftar lalu langsung bisa membaca nama dan nomor WhatsApp seluruh
keluarga.

**Menambah pengelola baru** — buat akunnya dulu di
**Authentication > Users > Add user**, lalu jalankan di SQL Editor:

```sql
insert into public.pengelola (user_id, nama)
select id, 'Ibu' from auth.users where email = 'alamat@email.com'
on conflict (user_id) do nothing;
```

**Mencabut hak seseorang** tanpa menghapus akunnya:

```sql
delete from public.pengelola
where user_id = (select id from auth.users where email = 'alamat@email.com');
```

Tabel `pengelola` sengaja tidak punya policy apa pun, jadi hanya bisa diubah
lewat SQL Editor. Daftar ini tidak boleh bisa diubah dari dalam aplikasi.

> **Urutannya penting.** Berkas migrasi menjadikan semua akun yang *sudah
> ada* sebagai pengelola. Akun yang dibuat **setelah** migrasi dijalankan
> tidak ikut, dan harus ditambahkan dengan perintah di atas.

## Catatan keamanan

Seluruh pengamanan bertumpu pada **RLS di Supabase**, bukan pada kode di
browser. `NEXT_PUBLIC_SUPABASE_ANON_KEY` memang ikut terkirim ke setiap
pengunjung; itu wajar dan bukan kebocoran.

Yang sudah dipasang:

- Tabel `pesanan` **hanya bisa ditulis** publik, tidak bisa dibaca. Tanpa ini
  siapa pun yang punya link bisa menarik daftar nama dan nomor WhatsApp
  seluruh keluarga.
- Pesanan untuk barang yang sudah laku ditolak **oleh database**, bukan cuma
  disembunyikan di tampilan.
- Harga, nama, dan nomor divalidasi ulang di server. Nomor WhatsApp
  diseragamkan ke bentuk `628...`.
- Foto hanya bisa diunggah akun yang sudah masuk, dikecilkan dulu di browser.
- Kolom jebakan bot dan penolakan kiriman ganda dalam 5 menit.

**Jangan** menaruh alamat kebun atau tanggal panen persis di halaman publik.
"200 kg mangga siap panen" plus alamat, di link yang beredar bebas, adalah
undangan. Alamat disampaikan lewat WhatsApp setelah penawaran diterima.

---

## Yang sengaja tidak dibuat

Bukan karena lupa — ini keputusan, dan alasannya ada di
[`docs/desain.md`](docs/desain.md):

- Pembayaran online, upload bukti transfer
- Hitungan stok per kilo
- Akun untuk pembeli
- Lelang terbuka dengan papan peringkat
- Mode offline, antrean ulang untuk email gagal

---

## Struktur

```
supabase/migrations/       tabel, aturan RLS, fungsi terima_pesanan
supabase/config.toml       pengaturan Supabase lokal (Docker)
src/lib/                   validasi, format rupiah/WIB, klien Supabase, email
src/app/page.tsx           beranda (daftar barang)
src/app/l/[id]/            halaman barang + form pesan/nawar
src/app/admin/             kotak masuk, barang, riwayat, pengaturan
src/app/api/keepalive/     cron penjaga database
```
