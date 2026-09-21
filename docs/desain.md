# Kebun Ibu — Dokumen Desain

**Proyek:** Situs penjualan hasil kebun (mangga, pisang) untuk lingkup keluarga
**Tanggal:** 21 September 2026
**Status:** Desain disetujui, implementasi berjalan

---

## 1. Latar belakang

Ibu dan Bapak menjual mangga dan pisang hasil kebun sendiri. Pembelinya
hampir seluruhnya kerabat — lingkaran tertutup yang sudah saling kenal.
Selama ini penjualan berjalan lewat percakapan WhatsApp satu per satu:
siapa yang bertanya duluan, berapa yang dia mau, dan berapa harganya,
semuanya tersebar di banyak percakapan.

Masalahnya bukan kurangnya pembeli. Masalahnya:

1. Kabar panen harus disampaikan berulang ke banyak orang.
2. Penawaran harga tercecer di banyak percakapan, sulit dibandingkan.
3. Tidak ada catatan harga musim sebelumnya untuk jadi acuan.

Situs ini menangani ketiganya, dan tidak menangani apa pun di luar itu.

## 2. Batasan yang membentuk desain

| Batasan | Akibat pada desain |
|---|---|
| Pembeli adalah kerabat, bukan orang asing | Tidak perlu verifikasi identitas, tidak perlu escrow, tidak perlu sistem reputasi |
| Sebagian pembeli berusia di atas 50 tahun | Tidak ada pendaftaran akun untuk pembeli; huruf 18px, tombol minimal 48px |
| Penjual mengoperasikan dari HP, bukan komputer | Seluruh antarmuka dirancang mobile-first |
| Sinyal di lokasi tidak stabil | Foto dikecilkan di browser sebelum diunggah; satu keluarga huruf saja |
| Uang tetap tunai | Tidak ada payment gateway, tidak ada konfirmasi transfer |
| Penjual yang menentukan, bukan sistem | Situs tidak menghitung stok, tidak menentukan pemenang |

Batasan terakhir adalah yang paling menentukan. Rancangan awal memakai satuan
kilogram dengan perhitungan stok tersedia dan stok terpesan. Rancangan itu
dibatalkan: penjual harus menimbang sebelum memasang barang, dan sistem bisa
menjual melebihi stok. Gantinya, satu unggahan = satu foto + satu harga +
keterangan bebas, dan statusnya cukup "tersedia" atau "sudah laku".

## 3. Keputusan desain utama

### 3.1 Antrean penawaran, bukan lelang terbuka

**Dipilih:** pembeli mengirim penawaran yang hanya terlihat oleh penjual.
Penjual memilih siapa yang dapat.

**Ditolak:** papan lelang publik dengan peringkat penawaran tertinggi dan
batas waktu.

**Alasan:** pembelinya kerabat. Lelang terbuka membuat mereka bersaing di
depan satu sama lain, dan mencabut hak penjual untuk sekadar *memilih* —
misalnya memberi ke saudara yang lebih membutuhkan meski tawarannya lebih
rendah. Selain itu, lelang terbuka menambah sekitar dua minggu pekerjaan
(pembaruan waktu nyata, aturan seri, penanganan pemenang yang menghilang).

### 3.2 Musim sebagai keterangan, bukan pengendali

Musim mangga ditampilkan sebagai tulisan di bagian atas halaman, dan tidak
mengendalikan apa pun. Yang menentukan sebuah barang bisa dipesan atau tidak
adalah status barang itu sendiri.

**Alasan:** pisang berbuah terus sepanjang tahun, mangga menyerbu sekali
setahun. Satu model "musim buka/tutup" tidak cocok untuk keduanya. Status
per barang cocok untuk keduanya.

### 3.3 Pemberitahuan WhatsApp dikirim manual

Situs menyiapkan teks pengumuman lengkap dengan link; penjual yang menekan
kirim ke grup keluarga.

**Ditolak:** blast WhatsApp otomatis lewat gateway berbayar.

**Alasan:** biaya nol, tidak ada nomor pembeli yang perlu disimpan, tidak ada
risiko nomor diblokir, dan tidak ada layanan pihak ketiga yang bisa mati saat
demo. Harganya: pengumuman hanya sampai ketika penjual benar-benar mengirim.

### 3.4 Pembeli tanpa akun

Cukup nama dan nomor WhatsApp. Tidak ada kata sandi, tidak ada halaman
riwayat pesanan untuk pembeli.

**Alasan:** setiap layar pendaftaran adalah tempat kerabat berusia 50-an
berhenti. Konsekuensinya diterima: siapa pun yang punya link bisa mengirim
penawaran. Peredamnya kolom jebakan bot dan penolakan kiriman ganda, bukan
pendaftaran.

## 4. Model data

Empat tabel.

**`listings`** — barang yang dijual: jenis, judul, keterangan bebas, harga,
satuan, status (`segera` / `tersedia` / `sudah_laku`).

**`listing_foto`** — foto per barang, maksimal 6, tersimpan di Supabase
Storage.

**`pesanan`** — satu tabel untuk dua tombol. "Pesan" adalah "Nawar" pada
harga yang dipasang, jadi keduanya baris yang sama dengan pembeda kolom
`jenis`. Ini memangkas separuh kode dan membuat kotak masuk bisa diurutkan
dengan satu query.

**`pengaturan`** — satu baris, berisi tulisan musim dan sakelar tampil.

Riwayat penjualan tidak butuh tabel sendiri: cukup `pesanan` berstatus
`selesai`, dikelompokkan per bulan.

### Catatan: kenapa pesanan menyimpan salinan judul dan harga

`pesanan.listing_id` memakai `on delete set null`, dan setiap pesanan
menyimpan salinan judul serta harga barang saat pesanan dibuat.

Tanpa itu, menghapus satu barang akan ikut menghapus seluruh riwayat
penjualannya — padahal riwayat harga justru alasan fitur itu dibuat. Ini
ditemukan saat menulis halaman Riwayat, setelah skema pertama selesai.

## 5. Alur pesanan

```
baru ──→ diterima ──→ selesai      (tercatat di Riwayat)
  └────→ ditolak
           diterima ──→ batal      (diterima, lalu tidak jadi diambil)
```

`batal` ada karena kerabat memang kadang tidak jadi datang. Tanpa status itu,
penjual harus memilih antara menandai penjualan yang tidak pernah terjadi
sebagai `selesai` — yang merusak angka laporan — atau membiarkannya
menggantung di `diterima` selamanya.

Saat menerima penawaran, dua pilihan muncul dengan keduanya tercentang:
tandai barang jadi "sudah laku", dan tolak penawaran lain. Keduanya
*anjuran*, bukan aturan. Penjual bisa melepasnya untuk menjual sisanya
terpisah atau menahan penawar cadangan.

## 6. Keamanan

Seluruh pengamanan bertumpu pada Row Level Security di Supabase. Kunci anon
ikut terkirim ke browser setiap pengunjung; itu memang rancangannya, dan
bukan kebocoran. Apa pun yang tidak dilarang RLS, bisa dilakukan siapa saja.

1. **`pesanan` hanya bisa ditulis publik, tidak bisa dibaca.** Ini lubang
   paling berbahaya kalau salah: tanpa aturan ini, siapa pun yang punya link
   bisa menarik daftar nama dan nomor WhatsApp seluruh keluarga.
2. **Pesanan untuk barang yang sudah laku ditolak oleh database**, lewat
   aturan RLS yang memeriksa status barang — bukan sekadar tombol yang
   disembunyikan di tampilan.
3. **Service role key tidak pernah keluar dari server.** Dipakai hanya untuk
   satu hal: memeriksa kiriman ganda, karena publik memang sengaja tidak
   boleh membaca tabel pesanan.
4. **Validasi ulang di server** untuk harga, nama, dan nomor. Nomor WhatsApp
   diseragamkan ke bentuk `628...`.
5. **Unggah foto hanya untuk akun yang sudah masuk**, dibatasi jenis dan
   ukuran, nama berkas dibuat acak.

Risiko non-teknis yang ikut dicatat: alamat kebun dan tanggal panen tidak
ditaruh di halaman publik. Pengumuman hasil panen berjumlah besar disertai
lokasi, pada link yang beredar bebas, adalah undangan bagi pencuri.

## 7. Kasus yang ditangani secara khusus

| Kasus | Penanganan |
|---|---|
| Database Supabase tertidur antar musim | Cron harian menyentuh database (paket gratis tidur setelah 7 hari menganggur; musim mangga setahun sekali) |
| Ibu dan Bapak menerima penawaran bersamaan | Fungsi database mengunci baris barang lebih dulu, sehingga mustahil ada dua pemenang |
| Foto 3-8 MB di sinyal lemah | Dikecilkan di browser ke ~350 KB sebelum diunggah |
| Nomor WhatsApp dalam empat format berbeda | Diseragamkan di server; kalau tidak, link hubungi tidak bisa dipakai |
| Email pemberitahuan gagal | Dibungkus try/catch — pesanan tetap tersimpan |

Email dikirim lewat HTTP API, bukan SMTP Gmail. Di Vercel, pekerjaan async
yang belum selesai dihentikan begitu server mengirim jawaban; percakapan SMTP
butuh banyak langkah bolak-balik dan sering terpotong tanpa pesan error.
Tujuannya tetap Gmail — yang berubah hanya cara kirimnya.

## 8. Yang sengaja tidak dibuat

Ini keputusan lingkup, bukan kelalaian:

- Pembayaran online dan unggah bukti transfer — uang tetap tunai antar keluarga
- Perhitungan stok per kilogram — penjual yang menentukan, bukan sistem
- Akun dan halaman riwayat untuk pembeli
- Lelang terbuka dengan papan peringkat
- Mode offline/PWA, antrean ulang email gagal, jejak audit

## 9. Teknologi

Next.js 16 + React 19 + Tailwind v4, Supabase (Postgres, Storage, Auth),
Resend untuk email, dijalankan di Vercel. Seluruhnya paket gratis.

Dipilih karena hosting HTTPS gratis, tidak perlu mengurus server, dan aturan
keamanan tertulis satu kali di database sehingga berlaku untuk semua jalur
akses.
