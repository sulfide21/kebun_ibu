import { describe, expect, it } from "vitest";
import { rupiah } from "./format";
import { teksPemberitahuan, type IsiPemberitahuan } from "./pemberitahuan";
import { alamatSitus } from "./wa";

const SEKARANG = new Date("2026-10-08T04:00:00Z"); // Kamis 8 Okt, 12.00 WITA

const lelang: IsiPemberitahuan = {
  nama: "Budi",
  noWa: "6281234567890",
  judulListing: "Mangga arumanis",
  jenis: "lelang",
  hargaListing: 50000,
  hargaTawar: 80000,
  batasWaktu: "2026-10-10T06:00:00Z",
  catatan: "",
};

const biasa: IsiPemberitahuan = {
  ...lelang,
  jenis: "pesan",
  hargaListing: 30000,
  hargaTawar: null,
  batasWaktu: null,
  catatan: "ambil sore",
};

describe("teksPemberitahuan", () => {
  it("lelang: judul, tawaran, jam tutup, dan link balas", () => {
    const { judul, teks } = teksPemberitahuan(lelang, SEKARANG);
    expect(judul).toBe("Tawaran lelang baru: Mangga arumanis");
    expect(teks).toContain("Ada tawaran lelang baru.");
    expect(teks).toContain("Nama    : Budi");
    expect(teks).toContain("No. WA  : 0812-3456-7890");
    expect(teks).toContain(`Tawaran : ${rupiah(80000)}`);
    expect(teks).toContain("Ditutup : Sab, 10 Okt, 14.00 WITA");
    expect(teks).toContain("Catatan : -");
    expect(teks).toContain("Balas Budi: https://wa.me/6281234567890");
    expect(teks).toContain(`Kotak masuk: ${alamatSitus()}/admin`);
  });

  it("pesanan biasa: harga barang, tanpa baris ditutup", () => {
    const { judul, teks } = teksPemberitahuan(biasa, SEKARANG);
    expect(judul).toBe("Pesanan baru: Mangga arumanis");
    expect(teks).toContain("Ada pesanan baru.");
    expect(teks).toContain(`Harga   : ${rupiah(30000)}`);
    expect(teks).toContain("Catatan : ambil sore");
    expect(teks).not.toContain("Ditutup");
    expect(teks).not.toMatch(/\n\n\n/);
  });

  it("memakai templat khusus sesuai jenis pesanan", () => {
    const templat = { wa_pesan: "Pesan {nama} {harga}", wa_lelang: "Lelang {nama} {tawaran}" };
    expect(teksPemberitahuan(biasa, SEKARANG, templat).teks).toBe(`Pesan Budi ${rupiah(30000)}`);
    expect(teksPemberitahuan(lelang, SEKARANG, templat).teks).toBe(`Lelang Budi ${rupiah(80000)}`);
  });

  it("templat kosong atau tidak terbaca ({}) memakai teks bawaan", () => {
    const bawaan = teksPemberitahuan(lelang, SEKARANG).teks;
    expect(teksPemberitahuan(lelang, SEKARANG, {}).teks).toBe(bawaan);
    expect(teksPemberitahuan(lelang, SEKARANG, { wa_lelang: "" }).teks).toBe(bawaan);
  });

  it("judul tidak ikut templat", () => {
    expect(teksPemberitahuan(biasa, SEKARANG, { wa_pesan: "x" }).judul).toBe(
      "Pesanan baru: Mangga arumanis",
    );
  });
});
