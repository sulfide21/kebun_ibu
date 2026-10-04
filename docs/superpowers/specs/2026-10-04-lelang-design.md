# Desain: Mode Lelang

Tanggal: 4 Oktober 2026
Status: menunggu tinjauan

Dokumen ini menggantikan keputusan 3.1 di `docs/desain.md` ("antrean
penawaran, bukan lelang terbuka"). Keputusan lama diambil sebelum situasi
penjual diketahui; sekarang lelang dengan harga tertinggi yang tampil ke
publik memang dikehendaki.

## 1. Tujuan

Ibu bisa melelang satu barang: menetapkan harga minimum dan batas waktu,
lalu kerabat mengirim tawaran. Setelah batas waktu lewat, Ibu memilih
pemenangnya sendiri, tidak harus yang tertinggi.

Lelang menyelesaikan dua masalah sekaligus:

1. Penawaran tidak pernah ditutup, jadi Ibu tidak tahu kapan harus
   memutuskan. Batas waktu menyelesaikan ini.
2. Kerabat tidak tahu berapa yang pantas ditawar. Harga tertinggi yang
   tampil sekali sehari menyelesaikan ini.

### Yang tetap sama

- Pembeli tidak perlu akun: cukup nama dan nomor WhatsApp.
- Daftar tawaran hanya terlihat oleh pengelola.
- Ibu yang memilih pemenang, lalu menghubunginya lewat WhatsApp.
- Pembayaran tunai.

### Di luar lingkup

- Pemberitahuan WhatsApp otomatis ke Ibu saat lelang selesai (menyusul).
- Cron job Vercel untuk lelang. Semua perhitungan waktu dilakukan saat
  halaman dibuka (lihat bagian 4).

## 2. Dua mode barang

| | Mode `jual` | Mode `lelang` |
|---|---|---|
| Tombol di halaman barang | **Pesan Rp X** | **Lelang** |
| Arti kolom `harga` | harga jual | harga minimum |
| Batas waktu | tidak ada | `batas_waktu`, wajib |
| Jenis baris di `pesanan` | `pesan` | `lelang` |

Tombol **Nawar harga** dihapus dari seluruh situs. Menawar sekarang hanya
bisa lewat lelang.

## 3. Database

Migrasi baru: `supabase/migrations/20261004000000_lelang.sql`. Sama seperti
skema awal, file ini aman dijalankan ulang dan dijalankan lewat SQL Editor.

### 3.1 `listings`

```sql
alter table public.listings
  add column if not exists mode text not null default 'jual'
    check (mode in ('jual','lelang')),
  add column if not exists batas_waktu timestamptz;

alter table public.listings
  add constraint lelang_wajib_batas_waktu
  check (mode = 'jual' or batas_waktu is not null);
```

`batas_waktu` disimpan sebagai `timestamptz` (titik waktu mutlak). Mode
tidak boleh diubah setelah ada tawaran masuk; ini dijaga di server action
`simpanListing`, karena hanya pengelola yang bisa mengubah listing.

### 3.2 `pesanan`

- `jenis` boleh `pesan`, `nawar`, atau `lelang`. Nilai `nawar` dipertahankan
  hanya supaya riwayat lama tetap sah. Kebijakan RLS di bawah melarang
  baris `nawar` baru.
- Constraint `harga_tawar_sesuai_jenis` diganti: `pesan` → `harga_tawar`
  kosong; `nawar` dan `lelang` → `harga_tawar` wajib.
- Setiap tawaran adalah satu baris baru. Baris tidak pernah ditimpa,
  karena memberi publik hak `update` berarti mereka juga bisa mengubah
  tawaran orang lain. "Satu baris per orang" adalah urusan tampilan admin
  (bagian 6.3).

### 3.3 Aturan kirim publik (RLS)

Kebijakan `pesanan_kirim_publik` diganti menjadi:

```sql
with check (
  status = 'baru'
  and diputuskan_at is null
  and exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.status = 'tersedia'
      and (
        (jenis = 'pesan'  and l.mode = 'jual')
        or
        (jenis = 'lelang' and l.mode = 'lelang'
                          and now() < l.batas_waktu
                          and harga_tawar >= l.harga)
      )
  )
)
```

Database sendiri menolak tawaran di bawah minimum, tawaran setelah batas
waktu, dan tawaran untuk barang yang bukan lelang. Pemeriksaan di form
hanya untuk pesan error yang ramah.

### 3.4 `terima_pesanan`

Tambahan satu penjaga: kalau listingnya mode `lelang` dan
`now() < batas_waktu`, fungsi menolak dengan pesan "Lelang belum ditutup."
Sisanya tetap: kunci baris listing, tolak kalau sudah ada pemenang
`diterima` atau `selesai`.

### 3.5 Harga yang tampil ke publik

Harga tampil = tawaran `lelang` tertinggi untuk barang itu yang dibuat
**sebelum pukul 00.00 WITA hari ini**. Kalau belum ada, yang tampil adalah
harga minimum.

Dihitung di server memakai klien service role yang sudah ada
(`supabaseAdmin`, sama seperti cek kiriman ganda), lalu hanya angkanya yang
dikirim ke halaman.

Sengaja **bukan** fungsi database `security definer`. Fungsi seperti itu
yang bisa dipanggil anon ditandai Security Advisor Supabase (lint
`0028_anon_security_definer_function_executable`). Proyek ini sudah pernah
menghapus `security definer` dari `is_pengelola` karena peringatan yang
sama.

## 4. Waktu: selalu WITA

Zona waktu yang dipakai: `Asia/Makassar` (UTC+8, tanpa musim panas).

Server Vercel selalu berjalan dalam UTC, dan variabel `TZ` di Vercel tidak
bisa diubah. Percobaan tanggal 4 Oktober 2026: input `2026-10-10T14:00` yang
dibaca dengan `new Date()` tanpa zona menghasilkan 14.00 WITA di laptop
(zona WITA), tetapi **22.00 WITA** di server UTC. Selisih 8 jam, dan hanya
muncul setelah deploy.

Aturan:

1. Semua perhitungan waktu lewat satu modul, `src/lib/waktu.ts`. Kode lain
   tidak memanggil `new Date(string)` untuk input pengguna.
2. Input `datetime-local` dari form selalu ditempeli `+08:00` sebelum
   diubah ke `Date`.
3. Awal hari ini = 00.00 WITA, dihitung dari UTC (`now` dikurangi offset,
   dipotong ke hari, ditambah offset kembali), bukan dari jam server.
4. Semua tampilan memakai `Intl.DateTimeFormat` dengan
   `timeZone: "Asia/Makassar"` dan akhiran "WITA".

Fungsi yang dibutuhkan:

| Fungsi | Isi |
|---|---|
| `bacaInputWita(s)` | `"2026-10-10T14:00"` → `Date` 06.00 UTC |
| `keInputWita(d)` | kebalikannya, untuk mengisi form edit |
| `awalHariIniWita(now)` | 00.00 WITA hari ini sebagai `Date` |
| `formatWita(d)` | "Sab 10 Okt, 14.00 WITA" |
| `sisaWaktu(batas, now)` | "3 hari lagi", "5 jam lagi", "Ditutup" |

Lelang dianggap terbuka kalau `status = 'tersedia'` dan
`now < batas_waktu`. Tidak ada job terjadwal yang menutupnya.

Cron `keepalive` yang sudah ada tetap dipertahankan. Cron itu tidak ada
hubungannya dengan lelang; fungsinya mencegah database Supabase gratis
berhenti setelah 7 hari tanpa aktivitas.

## 5. Halaman pembeli

### 5.1 Beranda (`/`)

- Bagian **"Sedang dilelang"** di paling atas, hanya muncul kalau ada
  lelang yang terbuka. Di bawahnya bagian **"Dijual"** untuk barang biasa.
- Kartu lelang menampilkan:
  - lencana bertuliskan **LELANG** (kata, bukan hanya warna);
  - "Mulai Rp X" kalau belum ada tawaran sebelum hari ini, atau
    "Tertinggi Rp X";
  - sisa waktu ("3 hari lagi") atau "Ditutup".
- Lelang yang sudah lewat batas waktu tetapi belum laku pindah ke bagian
  bawah dengan label "Ditutup".

### 5.2 Halaman barang (`/l/[id]`), mode lelang

Selama terbuka:

- "Tawaran tertinggi sampai kemarin" dan angkanya. Kata *sampai kemarin*
  sengaja ditulis: tawaran hari ini baru terlihat setelah 00.00 WITA.
- "Harga minimum Rp X".
- "Ditutup Sab 10 Okt, 14.00 WITA (3 hari lagi)".
- Satu tombol **Lelang**, yang membuka form berisi nama, nomor WhatsApp,
  jumlah tawaran (petunjuk "minimal Rp X"), dan catatan.
- Keterangan kecil: "Harga diperbarui tiap hari jam 00.00 WITA."
- Setelah terkirim: "Tawaran kamu masuk. Ibu akan menghubungi lewat
  WhatsApp kalau terpilih."
- Menaikkan tawaran = mengisi form lagi.

Setelah batas waktu: tombol diganti kotak "Lelang sudah ditutup. Ibu sedang
memilih pemenang." Setelah laku: "Barang ini sudah laku." seperti sekarang.

### 5.3 Halaman barang, mode jual

Hanya tombol **Pesan Rp X**. Form nawar dihapus dari `FormPesanan.tsx`.

### 5.4 Teks bagikan (`src/lib/wa.ts`)

- Lelang: "Ada {judul} nih, dilelang. Mulai Rp X, ditutup {hari jam} WITA.
  Ikut lelang lewat sini:" lalu tautannya.
- Jual: "atau nawar" dihapus dari teks yang ada.

## 6. Halaman admin

### 6.1 Form barang (`FormListing.tsx`)

- Pilihan **Jual / Lelang** di paling atas, dua tombol besar.
- Saat Lelang dipilih: label "Harga" menjadi "Harga minimum", dan muncul
  isian "Ditutup pada" (`datetime-local`, dibaca sebagai WITA).
- `batas_waktu` harus di masa depan saat barang dibuat atau batasnya
  diubah.
- Harga minimum dan batas waktu boleh diubah kapan saja. Pilihan mode
  dikunci (tidak bisa diklik, dengan keterangan) setelah ada tawaran.

### 6.2 Kotak masuk (`/admin`)

- Pesanan biasa tetap satu kartu per pesanan.
- Setiap lelang menjadi **satu kartu**: "Lelang: {judul} · 5 penawar ·
  tertinggi Rp X · ditutup 3 hari lagi", dengan tombol **Lihat tawaran**.

### 6.3 Daftar tawaran (`/admin/listing/[id]/tawaran`, baru)

- Kepala halaman: judul, harga minimum, batas waktu, harga yang tampil di
  publik, dan tawaran tertinggi yang sebenarnya.
- **Satu baris per nomor WhatsApp**, menampilkan tawaran terbaru orang itu,
  jamnya, dan "naik 2x" kalau ia pernah menaikkan tawaran.
- Urutan: **Tertinggi** (bawaan) atau **Terbaru**, lewat `?urut=`.
- Tombol **Pilih** hanya aktif setelah batas waktu lewat.
- Tombol **Tutup lelang sekarang** mengisi `batas_waktu = now()`, dengan
  konfirmasi.
- Tombol **Tolak** di setiap baris menolak **semua** baris `baru` milik
  nomor itu untuk barang ini, bukan hanya yang terbaru. Kalau hanya yang
  terbaru, tawaran lamanya akan muncul lagi di daftar. Bisa dipakai
  sebelum batas waktu, misalnya untuk tawaran iseng.
- Tombol **Tolak semua** (dengan konfirmasi "Tolak semua N tawaran?")
  menolak semua baris `baru` untuk barang ini. Lelang **tetap terbuka**
  sampai batas waktunya; tawaran yang masuk sesudahnya tampil sebagai baris
  baru. Kalau pemenang sudah dipilih, pemenangnya tidak ikut ditolak.
- Orang yang ditolak pindah ke bagian lipat **"Ditolak (N)"** di bawah
  daftar, dengan tombol **Batalkan** yang mengembalikan semua barisnya
  menjadi `baru`. Kalau orang itu menawar lagi selagi lelang terbuka,
  tawaran barunya tampil sebagai baris biasa di daftar utama.

### 6.4 Memilih pemenang

1. **Pilih** memanggil `terima_pesanan(id, p_tandai_laku => true,
   p_tolak_lain => false)`. Tawaran itu menjadi `diterima` dan barangnya
   `sudah_laku`. Muncul tombol WhatsApp: "Halo {nama}, tawaranmu Rp X
   untuk {judul} menang lelang ya…"
2. Penawar lain **tidak** ditolak. Mereka menjadi cadangan.
3. Pemenang membayar dan mengambil → **Selesai**. Baru saat itu semua baris
   lain untuk barang itu yang masih `baru` diubah menjadi `ditolak`.
4. Pemenang menghilang → **Batal**. Barang kembali `tersedia` (lelangnya
   tetap ditutup karena batas waktunya sudah lewat), dan Ibu menekan
   **Pilih** pada penawar berikutnya.

Langkah 3 dan 4 masuk ke `ubahStatusPesanan` untuk pesanan berjenis
`lelang`. Pesanan biasa tidak berubah perilakunya.

Tolak, Tolak semua, dan Batalkan adalah server action baru
(`tolakPenawar(listingId, noWa)`, `tolakSemuaTawaran(listingId)`,
`batalkanTolak(listingId, noWa)`). Ketiganya memakai klien sesi biasa,
jadi RLS `pesanan_kelola_admin` yang menjaga hanya pengelola yang bisa
memanggilnya.

`Ringkasan` dan `Riwayat` memperlakukan `lelang` sama seperti `nawar`:
harga akhirnya adalah `harga_tawar`.

## 7. Error dan kiriman ganda

| Keadaan | Hasil |
|---|---|
| Tawaran di bawah minimum | "Tawaran minimal Rp X." (zod dan RLS) |
| Halaman dibuka sebelum batas waktu, dikirim sesudahnya | RLS menolak (42501) → "Lelang sudah ditutup." |
| Nomor sama, jumlah sama, dalam 5 menit | "Tawaran kamu sudah masuk." Tidak disimpan dua kali |
| Nomor sama, jumlah **berbeda**, dalam 5 menit | Disimpan sebagai tawaran baru |
| Email ke Ibu gagal | Tawaran tetap tersimpan |
| Admin mengisi batas waktu di masa lalu | Error di form, ditolak juga di server |
| Admin menekan Pilih sebelum batas waktu | Tombol nonaktif; `terima_pesanan` juga menolak |

Untuk pesanan biasa (`pesan`), cek kiriman ganda tetap seperti sekarang:
nomor sama dan barang sama dalam 5 menit.

Pesan email untuk tawaran lelang: subjek "Tawaran lelang baru: {judul}",
berisi nama, nomor, jumlah, dan sisa waktu lelang.

## 8. Pengujian

### 8.1 Vitest (logika murni)

Dipasang mengikuti panduan Next.js 16
(`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`).
Yang diuji:

- `src/lib/waktu.ts`, dengan `process.env.TZ` diatur ke `UTC` **dan**
  `Asia/Makassar` di setiap tes. Kasus wajib: input 14.00 harus menjadi
  06.00 UTC di kedua zona, dan awal hari pada pukul 23.30 dan 00.30 WITA.
- Validasi tawaran (`skemaPesanan`): minimum, angka kosong, honeypot.
- `tawaranTerbaruPerNomor()`: satu baris per nomor, hitungan "naik Nx",
  dan pemisahan antara daftar utama dan bagian "Ditolak". Orang yang
  ditolak lalu menawar lagi harus muncul di daftar utama.
- Pengurutan Tertinggi dan Terbaru.
- `hargaTampil()`: memilih maksimum sebelum batas hari, atau kembali ke
  harga minimum.

### 8.2 Database (Supabase lokal di Docker)

Docker sudah terpasang. Supabase dijalankan lokal dengan
`npx supabase start`, lalu tes pgTAP di `supabase/tests/` dijalankan
dengan `npx supabase test db`. Tes memastikan anon **tidak bisa**:

- membaca baris `pesanan`;
- mengirim tawaran di bawah minimum;
- mengirim tawaran setelah batas waktu;
- mengirim `lelang` ke barang mode `jual`, atau `pesan` ke barang lelang;
- mengirim baris `nawar` baru;
- mengubah atau menghapus tawaran.

Dan memastikan `terima_pesanan` menolak sebelum batas waktu, serta hanya
menerima satu pemenang.

### 8.3 Uji manual di HP

Sebelum dipakai keluarga: buat lelang → tawar dari 2 nomor → cek harga
tampil esok harinya → tutup lelang → pilih pemenang → batal → pilih
cadangan → selesai → cek penawar lain menjadi `ditolak`. Lelang kedua:
tolak satu penawar → batalkan → tolak semua sebelum batas waktu → kirim
tawaran baru → pastikan tawaran itu masuk ke daftar utama.
