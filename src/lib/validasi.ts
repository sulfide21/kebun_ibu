import { z } from "zod";

import { rupiah } from "./format";
import { lelangTerbuka } from "./lelang";
import { TEMPLAT_AWAL, tagTakDikenal, type JenisTemplat } from "./templat";
import type { Listing, ModeListing } from "./types";
import { bacaInputWita } from "./waktu";

/**
 * Nomor WhatsApp datang dalam banyak bentuk: 0812..., +62 812-3456,
 * 62812..., "0812 3456 7890". Link wa.me hanya jalan dengan 628123456789,
 * jadi semuanya diseragamkan di server sebelum disimpan.
 */
export function normalkanNoWa(input: string): string | null {
  const angka = input.replace(/\D/g, "");
  if (!angka) return null;

  let no = angka;
  if (no.startsWith("620")) no = "62" + no.slice(3);
  else if (no.startsWith("62")) no = no;
  else if (no.startsWith("0")) no = "62" + no.slice(1);
  else if (no.startsWith("8")) no = "62" + no;
  else return null;

  return /^62[0-9]{8,15}$/.test(no) ? no : null;
}

const noWa = z
  .string()
  .min(1, "Nomor WhatsApp wajib diisi.")
  .transform((v) => normalkanNoWa(v))
  .refine((v): v is string => v !== null, {
    message: "Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890",
  });

export const skemaPesanan = z
  .object({
    listing_id: z.string().uuid("Barang tidak dikenali."),
    nama: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 huruf.")
      .max(80, "Nama terlalu panjang."),
    no_wa: noWa,
    jenis: z.enum(["pesan", "lelang"]),
    // input HTML selalu string; kosong berarti bukan tawaran lelang
    harga_tawar: z
      .string()
      .optional()
      .transform((v) => {
        if (!v) return null;
        const angka = Number(v.replace(/\D/g, ""));
        return Number.isFinite(angka) ? angka : null;
      }),
    catatan: z.string().trim().max(500, "Catatan terlalu panjang.").default(""),
    // jebakan bot: manusia tidak pernah mengisi kolom tersembunyi
    alamat_web: z.string().max(0, "Terdeteksi sebagai bot.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.jenis !== "lelang") return;
    if (data.harga_tawar === null) {
      ctx.addIssue({ code: "custom", path: ["harga_tawar"], message: "Isi jumlah tawaran." });
    } else if (data.harga_tawar <= 0) {
      ctx.addIssue({ code: "custom", path: ["harga_tawar"], message: "Jumlah tawaran harus lebih dari 0." });
    } else if (data.harga_tawar > 1_000_000_000) {
      ctx.addIssue({ code: "custom", path: ["harga_tawar"], message: "Jumlah tawaran tidak masuk akal." });
    }
  });

/**
 * Pemeriksaan sebelum menyimpan. RLS di database memeriksa hal yang sama
 * dan tetap jadi penjaga terakhir; yang ini supaya pembeli mendapat pesan
 * yang jelas, bukan "gagal" yang membingungkan.
 */
export function cekKiriman(
  listing: Pick<Listing, "mode" | "status" | "harga" | "batas_waktu">,
  kiriman: { jenis: "pesan" | "lelang"; harga_tawar: number | null },
  sekarang: Date,
): { pesan?: string; error?: Record<string, string> } | null {
  if (listing.status === "sudah_laku") return { pesan: "Maaf, barang ini sudah laku." };
  if (listing.status !== "tersedia") return { pesan: "Barang ini belum dibuka." };

  if (kiriman.jenis === "lelang") {
    if (listing.mode !== "lelang") {
      return { pesan: "Barang ini tidak sedang dilelang. Coba muat ulang halaman." };
    }
    if (!lelangTerbuka(listing, sekarang)) return { pesan: "Lelang sudah ditutup." };
    if ((kiriman.harga_tawar ?? 0) < listing.harga) {
      return { error: { harga_tawar: `Tawaran minimal ${rupiah(listing.harga)}.` } };
    }
    return null;
  }

  if (listing.mode !== "jual") {
    return { pesan: "Barang ini sedang dilelang. Coba muat ulang halaman." };
  }
  return null;
}

export const skemaListing = z.object({
  jenis: z.enum(["mangga", "pisang", "lainnya"]),
  judul: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(120, "Judul terlalu panjang."),
  deskripsi: z.string().trim().max(2000, "Deskripsi terlalu panjang.").default(""),
  harga: z
    .string()
    .min(1, "Harga wajib diisi.")
    .transform((v) => Number(v.replace(/\D/g, "")))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 1_000_000_000, {
      message: "Harga tidak valid.",
    }),
  satuan: z.string().trim().max(30).default("/keranjang"),
  status: z.enum(["segera", "tersedia", "sudah_laku"]),
  mode: z.enum(["jual", "lelang"]),
  // "2026-10-10T14:00" dari datetime-local, selalu dibaca sebagai WITA
  batas_waktu: z
    .string()
    .optional()
    .transform((v) => (v ? bacaInputWita(v) : null)),
});

const menit = (d: Date) => Math.floor(d.getTime() / 60_000);

/**
 * Batas waktu hanya diperiksa kalau memang diubah. Form hanya mengirim
 * menit, sedangkan "Tutup lelang sekarang" menyimpan detik; karena itu
 * dibandingkan per menit, supaya mengubah keterangan lelang yang sudah
 * ditutup tidak tertolak.
 */
export function galatBatasWaktu(a: {
  mode: ModeListing;
  batasBaru: Date | null;
  batasLama: Date | null;
  sekarang: Date;
}): string | null {
  if (a.mode !== "lelang") return null;
  if (!a.batasBaru) return "Isi kapan lelang ditutup.";
  const berubah = !a.batasLama || menit(a.batasLama) !== menit(a.batasBaru);
  if (berubah && a.batasBaru.getTime() <= a.sekarang.getTime()) {
    return "Batas waktu harus setelah sekarang.";
  }
  return null;
}

/** Lelang yang sedang berjalan tidak boleh diam-diam menjadi jualan biasa. */
export function galatUbahMode(
  modeLama: ModeListing | null,
  modeBaru: ModeListing,
  jumlahPesanan: number,
): string | null {
  if (modeLama !== null && modeLama !== modeBaru && jumlahPesanan > 0) {
    return "Mode tidak bisa diubah karena sudah ada pesanan atau tawaran masuk.";
  }
  return null;
}

export const skemaPengaturan = z.object({
  teks_musim: z.string().trim().max(200, "Teks terlalu panjang.").default(""),
  tampilkan_banner: z.boolean(),
});

/**
 * Satu kotak templat. Browser mengirim baris baru sebagai \r\n, jadi
 * diseragamkan dulu sebelum dihitung panjangnya dan dibandingkan dengan
 * teks bawaan. Teks bawaan dan isi kosong disimpan sebagai "", supaya
 * perbaikan teks bawaan nanti ikut terpakai.
 */
const kotakTemplat = (jenis: JenisTemplat) =>
  z
    .string()
    .transform((s) => s.replace(/\r\n/g, "\n"))
    .pipe(
      z
        .string()
        .max(1000, "Maksimal 1.000 huruf.")
        .superRefine((s, ctx) => {
          const asing = tagTakDikenal(s, jenis);
          if (asing.length > 0) {
            ctx.addIssue({
              code: "custom",
              message: `Tag ${asing.map((t) => `{${t}}`).join(", ")} tidak dikenal di pesan ini. Pakai tombol tag di bawah kotak.`,
            });
          }
        }),
    )
    .transform((s) => (s.trim() === "" || s === TEMPLAT_AWAL[jenis] ? "" : s));

/**
 * Pengaturan disimpan ke dua tabel, tidak dalam satu transaksi. Kalau
 * hanya satu yang gagal (misalnya tabel templat belum dibuat karena
 * migrasi belum dijalankan), yang berhasil tetap disebut dan halaman
 * tetap disegarkan, supaya Ibu tidak mengira semuanya gagal.
 */
export function hasilSimpanPengaturan(
  galatMusim: unknown,
  galatTemplat: unknown,
): { ok: boolean; pesan: string; segarkan: boolean } {
  if (!galatMusim && !galatTemplat) {
    return { ok: true, pesan: "Pengaturan tersimpan.", segarkan: true };
  }
  if (galatMusim && galatTemplat) {
    return { ok: false, pesan: "Gagal menyimpan pengaturan.", segarkan: false };
  }
  return {
    ok: false,
    pesan: galatTemplat
      ? "Tulisan musim tersimpan, tapi isi pesan belum tersimpan. Coba lagi sebentar lagi."
      : "Isi pesan tersimpan, tapi tulisan musim belum tersimpan. Coba lagi sebentar lagi.",
    segarkan: true,
  };
}

export const skemaTemplat = z.object({
  wa_pesan: kotakTemplat("wa_pesan"),
  wa_lelang: kotakTemplat("wa_lelang"),
  bagikan_jual: kotakTemplat("bagikan_jual"),
  bagikan_lelang: kotakTemplat("bagikan_lelang"),
});

/** Ubah error zod jadi { namaKolom: pesan } untuk ditampilkan di form. */
export function pesanError(error: z.ZodError): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const issue of error.issues) {
    const kunci = String(issue.path[0] ?? "_");
    if (!hasil[kunci]) hasil[kunci] = issue.message;
  }
  return hasil;
}
