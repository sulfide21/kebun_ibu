import { z } from "zod";

import { rupiah } from "./format";
import { lelangTerbuka } from "./lelang";
import type { Listing } from "./types";

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
});

export const skemaPengaturan = z.object({
  teks_musim: z.string().trim().max(200, "Teks terlalu panjang.").default(""),
  tampilkan_banner: z.boolean(),
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
