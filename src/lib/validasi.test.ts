import { describe, expect, it } from "vitest";
import { rupiah } from "./format";
import { TEMPLAT_AWAL } from "./templat";
import {
  cekKiriman,
  galatBatasWaktu,
  galatUbahMode,
  hasilSimpanPengaturan,
  skemaListing,
  skemaPesanan,
  skemaTemplat,
} from "./validasi";

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

describe("skemaTemplat", () => {
  const kosong = { wa_pesan: "", wa_lelang: "", bagikan_jual: "", bagikan_lelang: "" };

  it("templat sah disimpan dengan baris baru \\n", () => {
    const hasil = skemaTemplat.safeParse({ ...kosong, wa_pesan: "Ada {nama}\r\nNomor {nomor}" });
    expect(hasil.success && hasil.data.wa_pesan).toBe("Ada {nama}\nNomor {nomor}");
  });

  it("teks bawaan yang dikirim browser (\\r\\n) disimpan sebagai kosong", () => {
    const dariBrowser = TEMPLAT_AWAL.wa_lelang.replace(/\n/g, "\r\n");
    const hasil = skemaTemplat.safeParse({ ...kosong, wa_lelang: dariBrowser });
    expect(hasil.success && hasil.data.wa_lelang).toBe("");
  });

  it("hanya spasi dan baris kosong disimpan sebagai kosong", () => {
    const hasil = skemaTemplat.safeParse({ ...kosong, bagikan_jual: "  \r\n  " });
    expect(hasil.success && hasil.data.bagikan_jual).toBe("");
  });

  it("tag tak dikenal ditolak dengan nama tagnya, di kotak yang benar", () => {
    const hasil = skemaTemplat.safeParse({ ...kosong, wa_pesan: "Halo {nma} {tawaran}" });
    expect(hasil.success).toBe(false);
    if (!hasil.success) {
      const galat = hasil.error.issues[0];
      expect(galat.path[0]).toBe("wa_pesan");
      expect(galat.message).toContain("{nma}");
      expect(galat.message).toContain("{tawaran}");
    }
  });

  it("batas 1.000 huruf dihitung setelah \\r\\n diseragamkan", () => {
    const pas = "a\r\n".repeat(500); // 1.000 huruf setelah jadi "a\n" x 500
    expect(skemaTemplat.safeParse({ ...kosong, bagikan_lelang: pas }).success).toBe(true);
    const lebih = skemaTemplat.safeParse({ ...kosong, bagikan_lelang: "a".repeat(1001) });
    expect(lebih.success).toBe(false);
  });
});

describe("hasilSimpanPengaturan", () => {
  const galat = new Error("gagal");

  it("keduanya tersimpan", () => {
    expect(hasilSimpanPengaturan(null, null)).toEqual({
      ok: true,
      pesan: "Pengaturan tersimpan.",
      segarkan: true,
    });
  });

  it("templat gagal (misalnya tabel belum dibuat): musim tetap tersimpan dan disegarkan", () => {
    const hasil = hasilSimpanPengaturan(null, galat);
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain("Tulisan musim tersimpan");
    expect(hasil.pesan).toContain("isi pesan belum tersimpan");
    expect(hasil.segarkan).toBe(true);
  });

  it("musim gagal: templat tetap tersimpan dan disegarkan", () => {
    const hasil = hasilSimpanPengaturan(galat, null);
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain("Isi pesan tersimpan");
    expect(hasil.segarkan).toBe(true);
  });

  it("keduanya gagal: tidak ada yang disegarkan", () => {
    expect(hasilSimpanPengaturan(galat, galat)).toEqual({
      ok: false,
      pesan: "Gagal menyimpan pengaturan.",
      segarkan: false,
    });
  });
});
