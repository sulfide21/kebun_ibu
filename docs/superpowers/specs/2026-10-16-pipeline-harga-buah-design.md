# Desain: Pipeline ETL Harga Buah Marketplace

Tanggal: 16 Oktober 2026
Status: menunggu tinjauan
Latar belakang: [`rencana-data-science.md`](../../rencana-data-science.md),
[`keputusan-data-science-2026-10-13.md`](../../keputusan-data-science-2026-10-13.md)

## 1. Tujuan dan lingkup

Membangun pipeline **ETL** yang mengambil produk buah dari **Blibli** dan
**Tokopedia**, membersihkan dan menyeragamkannya di Python, lalu memuatnya
ke **DuckDB** sebagai **star schema**. Hasilnya menjadi dasar analisis dan
model di tahap berikutnya.

Diperlakukan sebagai proyek data engineering yang serius:
- pemuatan yang aman diulang;
- data mentah tidak pernah diubah atau dihapus;
- validasi data berupa kode;
- baris yang gagal dikarantina, tidak dibuang;
- setiap run tercatat;
- ada tes dan CI.

**Di luar lingkup:**
- model harga per kg (didesain setelah pipeline ini jadi);
- dashboard;
- penjadwalan otomatis;
- Shopee.

## 2. Keputusan yang dikunci

| Hal | Keputusan |
|---|---|
| Pola | ETL: transformasi di Python **sebelum** dimuat |
| Ambil data | `urllib` (Blibli), `curl_cffi` `impersonate="chrome"` (Tokopedia), dua-duanya API JSON tersembunyi |
| Transformasi | **Polars** |
| Validasi | **Pandera** (backend Polars) |
| Gudang data | **DuckDB**, satu berkas |
| Bentuk tabel akhir | **Star schema** + view datar `v_produk` |
| Menjalankan | `run.py` dari laptop sendiri, beberapa kali (bukan harian) |
| Tes | pytest + GitHub Actions |
| Tidak dipakai | Airflow, Kafka, dbt, Selenium/BeautifulSoup |

## 3. Arsitektur

```
EXTRACT                     TRANSFORM (Polars)                LOAD (DuckDB)
                                                              lapisan 1 (per platform)
extract/blibli.py    ─┐     transform/blibli.py ──┐           ├─ blibli_produk
extract/tokopedia.py ─┤     transform/tokopedia.py┤           ├─ tokopedia_produk
                      │       ↓ parser bersama    │           lapisan 2 (star schema)
data_lake/raw/        │       ↓ Pandera ──gagal──►│──────────►├─ dim_produk
 <sumber>/            │       ↓ lolos             │           ├─ dim_toko
 date=YYYY-MM-DD/     │     transform/model.py    │           ├─ dim_tanggal
 page_NNN.json ◄──────┘     (bangun dim + fakta)  │           ├─ fakta_harga
 (tidak pernah diubah)                            │           ├─ v_produk (view)
                                                  └──────────►├─ produk_karantina
                                                              └─ pipeline_runs
```

## 4. Extract

### 4.1 Blibli

- **Telusuri kategori buah** (`BU-1000105`), bukan pencarian kata.
  Skrip lama `skrip/tarik_blibli.py` masih berbasis pencarian kata, jadi
  penarik kategori ditulis ulang. Data mentah kategori dari 27 September
  (`data-mentah/blibli_kategori_mentah.json`, 1.869 produk) menjadi bahan
  uji dan cuplikan awal.
- Header browser lengkap seperti `tarik_blibli.py`.
- Batas situs 20 halaman per kategori. Itu sudah batasnya, bukan galat.

### 4.2 Tokopedia

- `POST https://gql.tokopedia.com/graphql/SearchProductV5Query`.
- Parameter: `source=directory`,
  `identifier=makanan-minuman_buah_buah-buahan`, `sc=2705`, `q=""`,
  `rows=60`, `page=N`, `start=(N-1)*60`, `ob=23`.
- Kunjungi beranda dulu dalam sesi yang sama untuk mendapat cookie Akamai.
- Halaman 1 sampai halaman kosong pertama atau halaman 100 (sekitar
  6.000 produk).

### 4.3 Aturan bersama

- Jeda acak **1,5–3 detik** antar-halaman.
- Coba ulang 3 kali dengan jeda makin panjang (2, 4, 8 detik) untuk galat
  jaringan, `429`, atau `5xx`.
- Setiap jawaban disimpan **apa adanya** ke
  `data_lake/raw/<sumber>/date=YYYY-MM-DD/page_NNN.json`. Kalau folder
  tanggal itu sudah ada, isinya ditimpa utuh. Tarik ulang di hari yang sama
  menggantikan tarikan sebelumnya.
- Kalau satu halaman tetap gagal setelah 3 kali coba, penarikan berhenti
  di situ. Halaman yang sudah tersimpan tetap dipakai, dan run dicatat
  `sebagian` (bagian 9).

## 5. Transform

### 5.1 Lapisan 1: tabel per platform

Setiap modul platform membaca semua halaman mentah satu tanggal dan
menghasilkan satu DataFrame. **Kolom asli platform dipertahankan.**

| `blibli_produk` | `tokopedia_produk` |
|---|---|
| `tanggal`, `produk_id` (`id`), `sku`, `nama`, `harga`, `harga_coret`, `diskon_persen`, `merchant_code`, `penjual`, `resmi`, `lokasi`, `kategori` (jenjang lengkap), `rating`, `jumlah_ulasan`, `total_terjual` (angka pasti), `url` | `tanggal`, `produk_id`, `nama`, `harga`, `harga_asli`, `diskon_persen`, `toko_id`, `nama_toko`, `kota`, `tier_toko`, `rating`, `terjual_label` ("60+ terjual"), `kategori` (breadcrumb), `url` |

Baris ganda dalam satu tanggal (karena halaman tumpang tindih) diambil
satu per (`produk_id`, `tanggal`).

### 5.2 Parser bersama (`transform/parser.py`)

Semua berupa fungsi Python murni, masing-masing dengan unit test.

| Fungsi | Aturan |
|---|---|
| `berat_gram(nama)` | Logika dari `skrip/bersihkan_blibli.py`. Rentang "470 - 500 G" diambil titik tengahnya. "1/2 kg" dan sejenisnya dilewati, bukan ditebak. Di luar 100–20.000 g dianggap tidak terbaca. Hasil `None` kalau tidak ada berat. |
| `jenis_buah(nama)` | Kamus kata kunci → jenis (mangga, apel, pisang, jeruk, anggur, melon, alpukat, pepaya, buah naga, pir, …), dengan sinonim (dragon fruit, avocado, pear). Tidak cocok → `lainnya`. |
| `asal(...)` | Blibli: dari kategori ("Buah Lokal" / "Buah Impor"), dengan `asal_sumber = 'label'`. Tokopedia: kata "impor"/"import"/"lokal" di nama lebih dulu, lalu daftar varietas (kiwi, fuji, red globe, sunkist → impor; salak, manggis, arumanis → lokal). `asal_sumber = 'aturan'`. Tidak bisa ditentukan → `tidak_diketahui`. |
| `olahan(nama)` | `True` untuk bibit, benih, keripik, sale, jus, dan lain-lain (pola dari `bersihkan_blibli.py`). **Baris tetap disimpan**, hanya ditandai. |
| `terjual_min(...)` | Blibli: angka pasti dipetakan ke batas bawah rentang Tokopedia. Tokopedia: "60+ terjual" → 60, "1rb+ terjual" → 1000. Rentangnya diseragamkan supaya kedua platform bisa dibandingkan. |
| `jenis_toko(...)` | Blibli: `resmi` → `resmi`, selain itu `biasa`. Tokopedia: dari `tier_toko`, pemetaannya **menunggu verifikasi** (bagian 13). |
| `region(kota)` | Kota → `jabodetabek` / `jawa_lain` / `luar_jawa`, lewat tabel pemetaan. |

**Aturan asal diuji terhadap Blibli,** yang label aslinya diketahui. Kalau
label Blibli disembunyikan dan aturannya dijalankan, tingkat ketepatannya
dicatat. Angka itu masuk laporan sebagai bukti seberapa bisa dipercaya
label asal di Tokopedia.

### 5.3 Lapisan 2: star schema (`transform/model.py`)

```
                    dim_toko
         toko_key, sumber, toko_id, nama_toko,
         kota, region, jenis_toko
                       │
dim_produk ───── fakta_harga ───── dim_tanggal
produk_key, sumber,   tanggal, produk_key, toko_key,   tanggal, tahun,
produk_id, nama,      harga, harga_coret, diskon,      bulan, minggu, hari
jenis_buah, asal,     harga_per_kg, rating,
asal_sumber,          terjual_min
berat_gram, olahan
```

- **Grain `fakta_harga`:** satu baris = satu produk di satu marketplace
  pada satu tanggal tarik.
- **Kunci pengganti berbasis hash, bukan nomor urut:**
  `produk_key = md5(sumber || '|' || produk_id)` dan
  `toko_key = md5(sumber || '|' || toko_id)`. Kuncinya tetap sama di
  setiap run. (Pelajaran dari proyek jobstreet: nomor urut berubah setiap
  dibangun ulang.)
- **Kunci alami toko:** Blibli `merchant_code`, Tokopedia `shop.id`.
- **Perubahan atribut** (nama produk diganti, toko pindah kota):
  **SCD tipe 1**. Dimensi menyimpan nilai terbaru, riwayat tidak
  disimpan. Riwayat harga ada di `fakta_harga`, dan itu yang penting.
- `harga_per_kg = round(harga / berat_gram * 1000)`, `NULL` kalau berat
  tidak terbaca.
- `v_produk`: view yang menggabungkan fakta dengan ketiga dimensi menjadi
  satu tabel datar untuk analisis.

## 6. Validasi dan karantina

Skema Pandera untuk setiap DataFrame **sebelum dimuat**:

| Cek | Berlaku untuk |
|---|---|
| `produk_id`, `nama`, `tanggal` tidak kosong | lapisan 1 |
| `harga > 0` | lapisan 1, fakta |
| `rating` di antara 0–5, atau kosong | lapisan 1 |
| `diskon_persen` di antara 0–100 | lapisan 1 |
| `harga_per_kg` di antara 3.000–500.000, atau kosong | fakta |
| `sumber` ∈ {blibli, tokopedia} | dimensi, fakta |
| (`produk_id`, `tanggal`) unik | lapisan 1 |
| `produk_key` unik di `dim_produk`; `toko_key` unik di `dim_toko` | dimensi |
| setiap `produk_key`/`toko_key` di fakta ada di dimensinya | fakta |

Baris yang gagal masuk ke `produk_karantina` (`sumber`, `tanggal`,
`produk_id`, `data` berupa JSON baris aslinya, `alasan`). **Tidak ada
baris yang dibuang diam-diam.** Jumlahnya dicatat di `pipeline_runs`.

## 7. Load

- Berkas: `warehouse/harga_buah.duckdb`.
- **Aman diulang (idempoten)**: dalam satu transaksi, hapus semua baris
  (`sumber`, `tanggal`) di lapisan 1, fakta, dan karantina, lalu sisipkan
  yang baru. Dimensi di-*upsert* per kunci. Menjalankan dua kali tidak
  pernah membuat baris ganda.
- Tabel `pipeline_runs`: `run_id`, `mulai`, `selesai`, `sumber`,
  `tanggal`, `halaman_ditarik`, `baris_mentah`, `baris_dimuat`,
  `baris_karantina`, `status` (`berhasil` / `sebagian` / `gagal`),
  `pesan_galat`.

## 8. Menjalankan

```
python run.py --sumber blibli,tokopedia             # tarik hari ini + proses + muat
python run.py --sumber tokopedia --tahap transform,load --tanggal 2026-10-13
                                                    # proses ulang data mentah lama
```

`--tahap` bisa `extract`, `transform`, `load`, atau gabungannya. Proses
ulang tanpa menarik lagi dimungkinkan karena data mentah disimpan. Log
ditulis ke layar dan ke `logs/run_<run_id>.log`.

## 9. Penanganan galat

| Kejadian | Perilaku |
|---|---|
| Halaman gagal setelah 3 kali coba | Penarikan berhenti; halaman tersimpan diproses; status `sebagian` |
| Halaman pertama gagal (API berubah atau diblokir) | Status `gagal`, tidak ada yang dimuat, pesan galat dicatat |
| Bentuk JSON berubah (kolom hilang) | Transform gagal dengan pesan yang menyebut kolomnya; status `gagal` |
| Baris melanggar skema | Dikarantina, run tetap jalan |
| Load gagal di tengah | Transaksi dibatalkan, DuckDB kembali ke keadaan sebelum run |

## 10. Pengujian

1. **Unit test parser**, dengan nama produk asli sebagai bahan uji
   (sekitar 30 nama untuk `berat_gram`, termasuk "1/2 kg", rentang,
   "1,5kg", dan nama tanpa berat).
2. **Tes skema Pandera:** baris rusak buatan harus masuk karantina.
3. **Tes integrasi** atas cuplikan kecil data mentah asli
   (`tests/fixtures/`, beberapa halaman per platform): jalankan
   transform + load ke DuckDB sementara, lalu periksa:
   - jumlah baris fakta = jumlah baris yang lolos validasi;
   - tidak ada kunci fakta tanpa pasangan di dimensi;
   - **menjalankan dua kali menghasilkan jumlah baris yang sama**;
   - produk yang tokonya tanpa kota tetap masuk fakta. (Kasus ini sempat
     hilang di demo, karena join biasa tidak mencocokkan nilai kosong.)
4. **Aturan asal vs label Blibli:** tingkat ketepatan dihitung dan
   dicetak (bagian 5.2).
5. **CI** (GitHub Actions): pytest + pipeline penuh atas cuplikan tadi,
   tanpa akses internet.

## 11. Susunan repo

**Diubah 17 Oktober 2026:** subfolder `data-science/` di repo kebun-ibu,
bukan repo terpisah (keputusan pengguna).
- Folder ini punya venv, tes, dan CI sendiri.
- `vercel.json` diberi `ignoreCommand` supaya perubahan yang hanya
  menyentuh `data-science/` tidak memicu deploy ulang situs.

```
kebun-ibu/data-science/
  extract/      blibli.py, tokopedia.py, http.py (jeda + coba ulang)
  transform/    blibli.py, tokopedia.py, parser.py, model.py, skema.py
  load/         duckdb_loader.py
  run.py
  data_lake/raw/...      (diabaikan git)
  warehouse/             (diabaikan git)
  tests/        fixtures/, test_parser.py, test_skema.py, test_pipeline.py
  .github/workflows/ci.yml
  requirements.txt       polars, pandera[polars], duckdb, curl_cffi, pytest
  README.md
```

`skrip/` dan `data-mentah/` di repo kebun-ibu dipindah ke sini. Data
mentah lama masuk `data_lake/raw/blibli/date=2026-09-27/`.

## 12. Tahapan hasil

Setiap tahap berakhir dengan sesuatu yang bisa dikumpulkan:

1. Penarik Tokopedia + Blibli kategori, data mentah tersimpan.
2. Lapisan 1 + validasi + karantina, dimuat ke DuckDB.
3. Star schema + `v_produk` + tes integrasi + CI.

## 13. Hal yang masih terbuka

1. **Arti `tier_toko` Tokopedia** (2 dan 3). Perlu diverifikasi sebelum
   `jenis_toko` untuk Tokopedia dipakai. Sampai saat itu nilainya
   `tier_2` / `tier_3`, bukan tebakan.
2. ~~Nama dan lokasi repo baru~~. Diputuskan: `kebun-ibu/data-science/`
   (bagian 11).
3. **Batas ketepatan aturan asal** yang dianggap cukup. Usulan ≥ 90%
   terhadap label Blibli; kalau di bawah itu, asal Tokopedia ditandai
   `tidak_diketahui` di analisis.
