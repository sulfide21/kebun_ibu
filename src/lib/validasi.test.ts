import { describe, expect, it } from "vitest";
import { rupiah } from "./format";
import { cekKiriman, galatBatasWaktu, galatUbahMode, skemaListing, skemaPesanan } from "./validasi";

const DASAR = {
  listing_id: "3f1c2a4e-8b7d-4c1a-9e2f-1a2b3c4d5e6f",
  nama: "Tante Rina",
  no_wa: "0812-3456-7890",
  catatan: "",
  alamat_web: "",
};

describe("skemaPesanan", () => {
  it("membaca 'Rp 95.000' sebagai 95000", () => {
    const hasil = skemaPesanan.safeParse({ ...DASAR, jenis: "lelang", harga_tawar: "Rp 95.000" });
    expect(hasil.success && hasil.data.harga_tawar).toBe(95000);
  });

  it("lelang tanpa jumlah ditolak dengan pesan yang jelas", () => {
    const hasil = skemaPesanan.safeParse({ ...DASAR, jenis: "lelang", harga_tawar: "" });
    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues[0]).toMatchObject({
      path: ["harga_tawar"],
      message: "Isi jumlah tawaran.",
    });
  });

  it("nawar tidak diterima lagi", () => {
    expect(skemaPesanan.safeParse({ ...DASAR, jenis: "nawar", harga_tawar: "15000" }).success).toBe(false);
  });

  it("pesan biasa tidak membawa jumlah tawaran", () => {
    const hasil = skemaPesanan.safeParse({ ...DASAR, jenis: "pesan", harga_tawar: "" });
    expect(hasil.success && hasil.data.harga_tawar).toBeNull();
  });

  it("kolom jebakan bot yang terisi ditolak", () => {
    expect(
      skemaPesanan.safeParse({ ...DASAR, jenis: "pesan", alamat_web: "http://spam" }).success,
    ).toBe(false);
  });
});

describe("cekKiriman", () => {
  const sekarang = new Date("2026-10-08T04:00:00Z");
  const lelang = {
    mode: "lelang" as const,
    status: "tersedia" as const,
    harga: 50000,
    batas_waktu: "2026-10-10T06:00:00Z",
  };
  const jual = { ...lelang, mode: "jual" as const, batas_waktu: null };

  it("tawaran sama dengan minimum lolos", () => {
    expect(cekKiriman(lelang, { jenis: "lelang", harga_tawar: 50000 }, sekarang)).toBeNull();
  });

  it("tawaran di bawah minimum ditolak di kolom jumlah", () => {
    expect(cekKiriman(lelang, { jenis: "lelang", harga_tawar: 49999 }, sekarang)).toEqual({
      error: { harga_tawar: `Tawaran minimal ${rupiah(50000)}.` },
    });
  });

  it("lelang yang sudah lewat batas waktu", () => {
    expect(
      cekKiriman(lelang, { jenis: "lelang", harga_tawar: 90000 }, new Date("2026-10-10T06:00:00Z")),
    ).toEqual({ pesan: "Lelang sudah ditutup." });
  });

  it("jenis kiriman tidak cocok dengan mode barang", () => {
    expect(cekKiriman(jual, { jenis: "lelang", harga_tawar: 90000 }, sekarang)?.pesan).toMatch(/tidak sedang dilelang/);
    expect(cekKiriman(lelang, { jenis: "pesan", harga_tawar: null }, sekarang)?.pesan).toMatch(/sedang dilelang/);
  });

  it("barang yang sudah laku atau belum dibuka", () => {
    expect(cekKiriman({ ...jual, status: "sudah_laku" }, { jenis: "pesan", harga_tawar: null }, sekarang)).toEqual({
      pesan: "Maaf, barang ini sudah laku.",
    });
    expect(cekKiriman({ ...jual, status: "segera" }, { jenis: "pesan", harga_tawar: null }, sekarang)).toEqual({
      pesan: "Barang ini belum dibuka.",
    });
  });

  it("pesan biasa ke barang jual lolos", () => {
    expect(cekKiriman(jual, { jenis: "pesan", harga_tawar: null }, sekarang)).toBeNull();
  });
});

describe("skemaListing", () => {
  const isian = {
    jenis: "mangga",
    judul: "Mangga Harum Manis",
    deskripsi: "",
    harga: "50.000",
    satuan: "/keranjang",
    status: "tersedia",
  };

  it("lelang: batas waktu dibaca sebagai WITA", () => {
    const hasil = skemaListing.safeParse({ ...isian, mode: "lelang", batas_waktu: "2026-10-10T14:00" });
    expect(hasil.success && hasil.data.batas_waktu?.toISOString()).toBe("2026-10-10T06:00:00.000Z");
  });

  it("jual: tanpa batas waktu", () => {
    const hasil = skemaListing.safeParse({ ...isian, mode: "jual", batas_waktu: "" });
    expect(hasil.success && hasil.data.batas_waktu).toBeNull();
  });
});

describe("galatBatasWaktu", () => {
  const sekarang = new Date("2026-10-08T04:00:00Z");
  const kemarin = new Date("2026-10-07T04:00:00Z");
  const besok = new Date("2026-10-09T04:00:00Z");

  it("lelang baru dengan batas di masa lalu ditolak", () => {
    expect(galatBatasWaktu({ mode: "lelang", batasBaru: kemarin, batasLama: null, sekarang })).toBe(
      "Batas waktu harus setelah sekarang.",
    );
  });

  it("lelang tanpa batas ditolak", () => {
    expect(galatBatasWaktu({ mode: "lelang", batasBaru: null, batasLama: null, sekarang })).toBe(
      "Isi kapan lelang ditutup.",
    );
  });

  it("mengubah batas ke masa depan boleh", () => {
    expect(galatBatasWaktu({ mode: "lelang", batasBaru: besok, batasLama: kemarin, sekarang })).toBeNull();
  });

  it("mengubah keterangan lelang yang sudah ditutup tidak terhalang batas waktu", () => {
    // "Tutup lelang sekarang" menyimpan detik; form hanya mengirim menit.
    const ditutupPadaDetik = new Date("2026-10-07T04:00:37Z");
    expect(galatBatasWaktu({ mode: "lelang", batasBaru: kemarin, batasLama: ditutupPadaDetik, sekarang })).toBeNull();
  });

  it("mode jual tidak diperiksa", () => {
    expect(galatBatasWaktu({ mode: "jual", batasBaru: null, batasLama: null, sekarang })).toBeNull();
  });
});

describe("galatUbahMode", () => {
  it("mode tidak bisa diubah setelah ada pesanan atau tawaran", () => {
    expect(galatUbahMode("jual", "lelang", 1)).toMatch(/tidak bisa diubah/);
  });
  it("boleh diubah kalau belum ada apa-apa, atau tidak berubah", () => {
    expect(galatUbahMode("jual", "lelang", 0)).toBeNull();
    expect(galatUbahMode("lelang", "lelang", 5)).toBeNull();
    expect(galatUbahMode(null, "lelang", 0)).toBeNull();
  });
});
