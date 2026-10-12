# Desain: Templat Pesan yang Bisa Diubah

Tanggal: 12 Oktober 2026
Status: menunggu tinjauan

## 1. Tujuan

Ibu dan Bapak bisa menulis sendiri kalimat dua jenis pesan, dari halaman
Pengaturan:

1. **Pemberitahuan WhatsApp** yang masuk ke nomor mereka (lewat Fonnte)
   setiap ada pesanan atau tawaran lelang baru.
2. **Pesan "Bagikan"** yang disalin/dibagikan dari daftar barang admin
   ke grup keluarga.

Isi yang berubah-ubah (nama pembeli, nomor, barang, harga, dan
seterusnya) disisipkan lewat tag seperti `{nama}`.

### Yang tetap sama

- Email pemberitahuan tetap memakai teks bawaan. Templat hanya untuk
  WhatsApp.
- Baris judul tebal di pesan WhatsApp (`*Pesanan baru: ...*`) tetap,
  tidak ikut templat.
- Tulisan musim dan tabel `pengaturan` tidak berubah.
- Pemberitahuan tidak pernah membatalkan pesanan: kalau templat gagal
  dibaca, teks bawaan dipakai.

## 2. Empat templat

| Kunci kolom | Dipakai untuk | Tag yang tersedia |
|---|---|---|
| `wa_pesan` | Pemberitahuan pesanan biasa | `{nama}` `{nomor}` `{barang}` `{harga}` `{catatan}` `{link_balas}` `{link_admin}` |
| `wa_lelang` | Pemberitahuan tawaran lelang | sama dengan di atas + `{tawaran}` `{ditutup}` `{sisa_waktu}` |
| `bagikan_jual` | Tombol Bagikan, barang biasa | `{barang}` `{harga}` `{satuan}` `{link}` |
| `bagikan_lelang` | Tombol Bagikan, barang lelang | `{barang}` `{harga_mulai}` `{satuan}` `{ditutup}` `{link}` |

Arti tag:

- `{nama}` nama pembeli; `{nomor}` nomor WA bentuk 0812-3456-7890.
- `{barang}` judul barang.
- `{harga}` harga barang yang dipasang (Rp 30.000). Di `wa_lelang`
  artinya harga minimum.
- `{tawaran}` jumlah tawaran pembeli.
- `{catatan}` catatan pembeli, atau `-` kalau kosong.
- `{ditutup}` jam tutup lelang dalam WITA (Sab, 10 Okt, 14.00 WITA).
- `{sisa_waktu}` sisa waktu sampai tutup (2 hari lagi).
- `{link_balas}` link wa.me ke pembeli; `{link_admin}` link kotak masuk.
- `{satuan}` satuan barang (/keranjang); `{harga_mulai}` harga minimum
  lelang; `{link}` link halaman barang.

Aturan pengisian:

- Templat kosong (atau hanya spasi) = pakai teks bawaan.
- Tag yang tidak dikenal dibiarkan apa adanya, supaya salah ketik
  terlihat di pratinjau.
- Saat menyimpan, templat yang berisi tag tidak dikenal untuk kotaknya
  ditolak, dengan pesan yang menyebut tagnya ("Tag {nma} tidak dikenal").
- Maksimal 1.000 karakter per templat.

Teks bawaan sama dengan teks yang dipakai sekarang, dengan satu
perbedaan: pemberitahuan pesanan biasa menampilkan harga barangnya
(`Harga   : Rp 30.000`), bukan "sesuai harga yang dipasang". Teks
bawaan Bagikan sama persis.

## 3. Database

Migrasi baru `supabase/migrations/20261012000000_templat_pesan.sql`,
aman dijalankan ulang:

- Tabel `templat_pesan`, satu baris (`id = 1`, seperti `pengaturan`),
  kolom `wa_pesan`, `wa_lelang`, `bagikan_jual`, `bagikan_lelang`
  bertipe `text not null default ''` dengan batas 1.000 karakter, dan
  `diubah_at`.
- **Hanya pengelola** yang boleh membaca dan mengubah. Anon tidak diberi
  hak apa pun; `authenticated` diberi select/update, lalu RLS membatasi
  ke `is_pengelola()`. Pola sama dengan tabel lain.
- Alasan tabel terpisah dan bukan kolom di `pengaturan`: `pengaturan`
  bisa dibaca publik (beranda butuh tulisan musim), sedangkan aturan
  akses berlaku per tabel.

## 4. Alur data

- **Pemberitahuan WhatsApp.** Pesanan dikirim pembeli tanpa login, jadi
  server membaca templat dengan service role (`ambilTemplat()`, file
  `server-only`). Kalau gagal dibaca, pakai teks bawaan dan catat ke log.
  `kirimWaPemberitahuan(isi, templat)` menerima templat sebagai argumen
  supaya bisa diuji tanpa database.
- **Tombol Bagikan.** Halaman daftar barang admin membaca templat (sesi
  pengelola, lewat RLS) dan meneruskannya ke `BarisListing` lalu
  `TombolBagikan`. `pesanBagikan(listing, templat)` mengisi tagnya.
- **Halaman Pengaturan.** Membaca `pengaturan` dan `templat_pesan`.
  Satu tombol Simpan menyimpan keduanya.

Kode inti di `src/lib/templat.ts` (bisa jalan di server dan browser):
daftar tag per templat, teks bawaan, `isiTemplat()`, `tagTakDikenal()`.

## 5. Halaman Pengaturan

Di bawah bagian tulisan musim, empat bagian. Masing-masing berisi:

- Judul dan satu kalimat penjelasan (kapan pesan ini dipakai).
- Kotak teks.
- Tombol tag (`+ nama`, `+ nomor`, ...) yang menyisipkan tag di posisi
  kursor.
- Pratinjau langsung dengan data contoh (Budi, Mangga arumanis,
  Rp 80.000, ...).
- Tombol "Kembalikan ke awal" yang mengisi kotak dengan teks bawaan.
  Kalau yang disimpan sama persis dengan teks bawaan, disimpan sebagai
  kosong, supaya perbaikan teks bawaan nanti ikut terpakai.

Pesan galat per kotak tampil di bawah kotaknya.

## 6. Pengujian

- `templat.test.ts`: tag terisi, tag tak dikenal dibiarkan, templat
  kosong jatuh ke bawaan, teks bawaan menghasilkan teks yang sama dengan
  sekarang.
- Validasi simpan: tag tak dikenal ditolak per kotak, batas panjang.
- `whatsapp.test.ts` dan `wa.test.ts` diperbarui untuk templat khusus.
- Uji manual di lokal: ubah templat, kirim pesanan, cek WhatsApp; tekan
  Bagikan dan cek teksnya.

## 7. Peluncuran

Dilakukan sendiri oleh pengguna:

1. Jalankan migrasi di SQL Editor Supabase produksi.
2. Commit dan push.
3. Pasang `FONNTE_TOKEN` dan `WA_TUJUAN` di Vercel, lalu redeploy.
