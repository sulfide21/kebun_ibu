# Rencana Lanjutan: Sistem Saran Harga Berbasis Data

**Status:** rencana, belum dikerjakan
**Dikerjakan setelah:** situs Kebun Ibu selesai dan dipakai
**Perkiraan waktu:** 2-3 minggu paruh waktu
**Tanggal:** 23 September 2026

---

## 1. Masalah yang diselesaikan

Sekarang Ibu dan Bapak menentukan harga dengan menebak: kira-kira tahun lalu
segini, kira-kira tetangga jual segitu. Tidak ada acuan, dan tidak ada catatan
apakah tebakan tahun lalu terlalu murah.

Padahal harga mangga dan pisang dipublikasikan setiap hari oleh pemerintah,
lengkap per provinsi dan per tingkat pedagang. Data itu gratis, dan tidak ada
yang memakainya untuk membantu petani kecil menentukan harga.

**Yang dibangun:** sistem yang menggabungkan harga pasar nasional dengan
riwayat penjualan kebun sendiri, lalu memberi saran harga saat Ibu memasang
barang baru.

## 2. Kenapa ini proyek data science, bukan sekadar web

Situs Kebun Ibu yang sekarang hanya menyimpan dan menampilkan data. Rencana
ini menambah lapisan yang mengambil data luar, membersihkannya, menganalisis
pola musiman, membuat ramalan, lalu **mengeluarkan keputusan yang dipakai
orang sungguhan**.

Bedanya ada di kalimat terakhir. Analisis yang berhenti di notebook hanya
laporan. Analisis yang muncul di layar Ibu saat dia mengetik harga adalah
sistem.

## 3. Sumber data

### 3.1 Data luar (ini yang memberi volume)

| Sumber | Isi | Alamat |
|---|---|---|
| Panel Harga Pangan (Bapanas) | Harga harian, dipisah produsen / grosir / eceran, per provinsi | <https://panelharga.badanpangan.go.id/tabel-rekap> |
| PIHPS (Bank Indonesia) | Harga eceran harian per pasar dan provinsi | <https://hargapangan.id/> |
| BPS | Harga produsen bulanan, 37 provinsi, runtun panjang | <https://www.bps.go.id/> |
| BMKG | Curah hujan harian per wilayah | <https://data.bmkg.go.id/> |

Harga harian beberapa tahun untuk dua komoditas sudah berjumlah ribuan baris.
Itu cukup untuk analisis musiman dan peramalan yang jujur.

### 3.2 Data sendiri (sedikit, tapi paling berharga)

Dari tabel `pesanan` dan `listings` yang sudah ada:

- Harga yang dipasang dan harga yang akhirnya disepakati
- Selisih tawaran terhadap harga pasang
- Lama barang terjual, dari dipasang sampai diterima
- Penawaran yang ditolak, dan yang diterima tapi batal diambil
- Pembeli berulang, dikenali lewat nomor WhatsApp

Jumlahnya mungkin hanya puluhan baris per musim. **Itu terlalu sedikit untuk
melatih model**, tapi cukup untuk satu hal penting: mengukur selisih tetap
antara harga kebun ini dan harga pasar.

## 4. Bentuk sistemnya

```
Bapanas / PIHPS / BPS
        │  (tarik tiap hari, dijadwalkan)
        ▼
   Pembersihan
   - hari kosong diisi
   - harga aneh disaring
   - nama komoditas diseragamkan
        │
        ▼
   Tabel harga_pasar di Supabase
        │
        ├──► Analisis pola musiman + tren
        │
        ├──► Model ramalan 2-4 minggu ke depan
        │
        └──► Digabung dengan riwayat penjualan sendiri
                    │
                    ▼
        Saran harga di form "Pasang barang"
```

### Yang dilihat Ibu

Saat mengetik harga, di bawah kolomnya muncul:

> Harga pasar mangga hari ini **Rp 18.000/kg** (Bapanas, Jawa Timur).
> Kebun ini biasanya laku **12% di atas** harga pasar.
> Saran: **Rp 20.000/kg**.
> Dua minggu lagi harga pasar diperkirakan turun ke Rp 16.500.

Kalimat terakhir itu yang paling berguna: kalau harga akan turun, panen
sebaiknya dijual sekarang.

## 5. Tambahan yang dibutuhkan di database

### 5.1 Tabel baru

**`harga_pasar`** — hasil tarikan harian
```
id, komoditas, tanggal, provinsi, tingkat (produsen/grosir/eceran),
harga, sumber, ditarik_at
```

**`tarikan_log`** — catatan tiap kali ingest jalan, berhasil atau gagal.
Tanpa ini, data bolong tidak ketahuan sampai analisisnya aneh.

### 5.2 Perubahan tabel yang sudah ada

**Satu kolom baru di `listings`: `berat_kg` (boleh kosong).**

Ini perlu dibicarakan, karena **bertentangan dengan keputusan desain yang
sudah diambil**: situs ini sengaja tidak menghitung kilo, supaya Ibu tidak
perlu menimbang apa pun sebelum memasang barang.

Masalahnya, tanpa berat, harga di situs ini tidak bisa dibandingkan dengan
harga pasar sama sekali. "Sekeranjang Rp200.000" dan "Rp18.000/kg" bukan
satuan yang sama.

**Jalan tengah:** kolomnya **opsional**. Kalau diisi, baris itu ikut
dianalisis dan Ibu dapat saran harga. Kalau dikosongkan, barangnya tetap bisa
dijual seperti biasa dan hanya tidak ikut perhitungan. Ibu tidak pernah
dipaksa menimbang.

### 5.3 Tambahan lain, sesuai kegunaan

1. `tanggal_panen` dan `mutu` sebagai kolom sendiri, bukan diselipkan di
   keterangan bebas
2. Penghitung berapa kali halaman barang dibuka, untuk mengukur berapa persen
   yang melihat lalu menawar
3. Alasan penolakan, berupa pilihan singkat, supaya "terlalu murah" bisa
   dibedakan dari "sudah dijanjikan ke orang lain"

## 6. Model dan cara menilainya

**Mulai dari yang paling bodoh lebih dulu.** Ini bukan basa-basi metodologi;
tanpa pembanding, angka error sebuah model tidak punya arti apa pun.

| Urutan | Model | Gunanya |
|---|---|---|
| 1 | Naive — harga besok = harga hari ini | Batas bawah. Kalau model lain kalah dari ini, model itu tidak berguna. |
| 2 | Seasonal naive — harga = harga minggu yang sama tahun lalu | Pembanding sesungguhnya untuk komoditas musiman |
| 3 | SARIMA atau Prophet | Model musiman yang benar |
| 4 | Regresi dengan curah hujan sebagai tambahan | Menguji apakah cuaca benar-benar menambah ketepatan |

**Penilaian:** MAE dan MAPE, diuji dengan *rolling origin* (latih sampai
tanggal X, ramal minggu berikutnya, geser, ulangi). Bukan pembagian acak —
data runtun waktu tidak boleh diacak, karena artinya melatih model dengan
masa depan.

**Catatan jujur yang harus masuk laporan:** ada kemungkinan besar seasonal
naive menang. Kalau itu yang terjadi, tulis apa adanya. Laporan yang
menunjukkan model rumit kalah dari pembanding sederhana lebih bernilai
daripada laporan yang menyembunyikannya.

## 7. Batasan yang diakui di depan

1. **Data penjualan sendiri sangat sedikit** — puluhan baris per musim. Semua
   pemodelan dilakukan pada data harga pasar; data sendiri hanya dipakai untuk
   menghitung selisih tetap terhadap pasar.
2. **Harga nasional bukan harga desa.** Selisihnya bisa besar. Inilah yang
   membuat data sendiri tetap perlu, walau sedikit.
3. **Mutu tidak ada di data pemerintah.** Mangga bagus dan mangga biasa
   dihitung satu harga di sana.
4. **Satu kebun, dua komoditas.** Kesimpulannya tidak bisa digeneralkan, dan
   memang tidak diklaim begitu.

## 8. Pertanyaan untuk dosen sebelum mulai

Jawaban atas ini mengubah isi pekerjaan, jadi lebih baik ditanya lebih dulu
daripada salah kerja dua minggu:

1. Apakah proyek wajib memuat model yang dilatih, atau analisis deskriptif
   sudah cukup?
2. Apakah ada teknik tertentu dari materi kuliah yang wajib dipakai?
3. Apakah ada syarat jumlah data minimum?
4. Apakah data dari instansi pemerintah boleh dipakai, atau harus data yang
   dikumpulkan sendiri?
5. Yang dinilai hasil analisisnya, atau sistem yang memakai hasil analisis itu?

## 9. Urutan pengerjaan

| Tahap | Isi | Perkiraan |
|---|---|---|
| 0 | Tanya dosen, sesuaikan rencana | 1 hari |
| 1 | Ingest Bapanas + PIHPS, simpan mentah | 3-4 hari |
| 2 | Pembersihan, penyeragaman, tabel `harga_pasar` | 2-3 hari |
| 3 | Analisis pola musiman, notebook + grafik | 3-4 hari |
| 4 | Model ramalan bertingkat + penilaian | 4-5 hari |
| 5 | Saran harga muncul di form "Pasang barang" | 2-3 hari |
| 6 | Halaman grafik untuk Ibu/Bapak | 2 hari |

Tahap 1-4 bisa dikerjakan di notebook terpisah tanpa menyentuh situsnya sama
sekali. Situs baru berubah di tahap 5.

## 10. Penjadwalan ingest

Dua pilihan, keduanya jalan:

- **Airflow** — sudah terpasang di komputer ini dari mata kuliah lain. Lebih
  meyakinkan sebagai pipeline, dan sudah ada penanganan ulang kalau gagal.
- **Vercel cron** — sudah dipakai situs ini untuk menjaga database tidak
  tertidur. Lebih sederhana, tapi di paket gratis hanya sekali sehari, yang
  sebenarnya sudah cukup untuk data harian.

Mulai dari Vercel cron. Pindah ke Airflow kalau memang mau ditunjukkan sebagai
pipeline yang utuh.
