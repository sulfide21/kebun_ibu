# Kebun Ibu

Situs jualan mangga dan pisang untuk keluarga. Ibu/Bapak memasang foto dan
harga, keluarga memesan atau menawar lewat link WhatsApp, lalu Ibu/Bapak yang
memilih siapa yang dapat.

Tidak ada pembayaran online, tidak ada hitungan kilo, tidak ada pendaftaran
akun untuk pembeli. Uang tetap tunai, seperti biasa.

---

## Yang perlu disiapkan sekali saja

Perkiraan waktu: **30-45 menit**, sebagian besar menunggu.

### 1. Buat proyek Supabase (gratis)

1. Daftar di [supabase.com](https://supabase.com), buat proyek baru.
2. Pilih region **Southeast Asia (Singapore)** — paling dekat.
3. Simpan kata sandi database di tempat aman.
4. Tunggu sampai proyeknya siap (sekitar 2 menit).

### 2. Jalankan skema database

1. Di Supabase, buka **SQL Editor**.
2. Buka berkas [`supabase/schema.sql`](supabase/schema.sql), salin **seluruh
   isinya**, tempel di editor, tekan **Run**.
3. Harus muncul "Success". Berkas ini aman dijalankan berulang kali.

### 3. Buat akun untuk Ibu dan Bapak

1. Di Supabase, buka **Authentication > Users > Add user**.
2. Isi email dan kata sandi, centang **Auto Confirm User**.
3. Ulangi untuk akun kedua.

Pakai kata sandi yang panjang dan berbeda dari kata sandi lain. Akun inilah
jalan masuk yang paling mungkin ditembus orang — bukan celah di kodenya.

### 4. Isi kunci di `.env.local`

Salin `.env.example` jadi `.env.local`, lalu isi dari Supabase
(**Project Settings > API**):

| Isian | Diambil dari |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

> `SUPABASE_SERVICE_ROLE_KEY` menembus semua aturan keamanan database.
> Jangan di-commit, jangan dikirim lewat WhatsApp, jangan diberi awalan
> `NEXT_PUBLIC_`.

### 5. Jalankan

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>. Halaman penjual ada di `/admin`.

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
supabase/schema.sql        tabel, aturan RLS, fungsi terima_pesanan
src/lib/                   validasi, format rupiah/WIB, klien Supabase, email
src/app/page.tsx           beranda (daftar barang)
src/app/l/[id]/            halaman barang + form pesan/nawar
src/app/admin/             kotak masuk, barang, riwayat, pengaturan
src/app/api/keepalive/     cron penjaga database
```
