import { describe, expect, it } from "vitest";
import { rupiah } from "./format";
import type { Listing } from "./types";
import { alamatSitus, pesanBagikan, pesanMenangLelang } from "./wa";

const dasar: Listing = {
  id: "abc",
  jenis: "mangga",
  judul: "Mangga Harum Manis",
  deskripsi: "",
  harga: 50000,
  satuan: "/keranjang",
  status: "tersedia",
  created_at: "2026-10-01T00:00:00Z",
  mode: "jual",
  batas_waktu: null,
};

describe("pesanBagikan", () => {
  it("lelang menyebut dilelang, harga mulai, dan jam tutup WITA", () => {
    const teks = pesanBagikan({ ...dasar, mode: "lelang", batas_waktu: "2026-10-10T06:00:00Z" });
    expect(teks).toContain("dilelang");
    expect(teks).toContain(`Mulai ${rupiah(50000)}`);
    expect(teks).toContain("Sab, 10 Okt, 14.00 WITA");
    expect(teks).toContain(`${alamatSitus()}/l/abc`);
  });

  it("barang biasa tidak lagi menawarkan nawar", () => {
    const teks = pesanBagikan(dasar);
    expect(teks).not.toContain("nawar");
    expect(teks).toContain("Mau pesan?");
  });
});

describe("pesanMenangLelang", () => {
  it("menyebut jumlah dan kata menang lelang", () => {
    const teks = pesanMenangLelang("Tante Rina", "Mangga Harum Manis", 95000);
    expect(teks).toContain("Halo Tante Rina");
    expect(teks).toContain(`${rupiah(95000)} untuk Mangga Harum Manis menang lelang`);
  });
});
