import { describe, expect, it } from "vitest";
import {
  hargaAkhir,
  lelangTerbuka,
  ringkasLelang,
  susunBeranda,
  tawaranTerbaruPerNomor,
  tertinggiSebelum,
  urutkanPenawar,
  type Tawaran,
} from "./lelang";

const SEKARANG = new Date("2026-10-08T04:00:00Z"); // Kamis 8 Okt, 12.00 WITA
const BESOK = "2026-10-09T04:00:00Z";
const KEMARIN = "2026-10-07T04:00:00Z";

function tawaran(
  isi: Partial<Tawaran> & Pick<Tawaran, "no_wa" | "harga_tawar" | "created_at">,
): Tawaran {
  return {
    id: `${isi.no_wa}-${isi.created_at}`,
    nama: "Penawar",
    catatan: "",
    status: "baru",
    ...isi,
  };
}

describe("hargaAkhir", () => {
  it("pesan memakai harga yang dipasang", () => {
    expect(hargaAkhir({ jenis: "pesan", harga_tawar: null, harga_listing: 20000 })).toBe(20000);
  });
  it("lelang dan nawar memakai jumlah tawaran", () => {
    expect(hargaAkhir({ jenis: "lelang", harga_tawar: 95000, harga_listing: 50000 })).toBe(95000);
    expect(hargaAkhir({ jenis: "nawar", harga_tawar: 15000, harga_listing: 20000 })).toBe(15000);
  });
  it("jatuh ke harga listing kalau salinan harga kosong", () => {
    expect(
      hargaAkhir({ jenis: "pesan", harga_tawar: null, harga_listing: null, listings: { harga: 30000 } }),
    ).toBe(30000);
  });
});

describe("lelangTerbuka", () => {
  const lelang = { mode: "lelang" as const, status: "tersedia" as const, batas_waktu: BESOK };
  it("terbuka sebelum batas waktu", () => {
    expect(lelangTerbuka(lelang, SEKARANG)).toBe(true);
  });
  it("tertutup tepat pada batas waktu", () => {
    expect(lelangTerbuka(lelang, new Date(BESOK))).toBe(false);
  });
  it("tertutup kalau sudah laku, bukan lelang, atau tanpa batas", () => {
    expect(lelangTerbuka({ ...lelang, status: "sudah_laku" }, SEKARANG)).toBe(false);
    expect(lelangTerbuka({ ...lelang, mode: "jual" }, SEKARANG)).toBe(false);
    expect(lelangTerbuka({ ...lelang, batas_waktu: null }, SEKARANG)).toBe(false);
  });
});

describe("tertinggiSebelum", () => {
  const batas = new Date("2026-10-07T16:00:00Z"); // 00.00 WITA tanggal 8
  const baris = (listing_id: string | null, harga_tawar: number, created_at: string, status: Tawaran["status"] = "baru") =>
    ({ listing_id, harga_tawar, created_at, status });

  it("mengambil tawaran tertinggi per barang sebelum batas", () => {
    expect(
      tertinggiSebelum(
        [baris("a", 60000, KEMARIN), baris("a", 75000, KEMARIN), baris("b", 30000, KEMARIN)],
        batas,
      ),
    ).toEqual({ a: 75000, b: 30000 });
  });

  it("tawaran tepat 00.00 WITA sudah termasuk hari ini, jadi belum tampil", () => {
    expect(tertinggiSebelum([baris("a", 90000, "2026-10-07T16:00:00Z")], batas)).toEqual({});
  });

  it("tawaran yang ditolak atau batal tidak pernah tampil", () => {
    expect(
      tertinggiSebelum(
        [
          baris("a", 999_999_999, KEMARIN, "ditolak"),
          baris("a", 120000, KEMARIN, "batal"),
          baris("a", 60000, KEMARIN),
        ],
        batas,
      ),
    ).toEqual({ a: 60000 });
  });

  it("mengabaikan baris tanpa barang", () => {
    expect(tertinggiSebelum([baris(null, 60000, KEMARIN)], batas)).toEqual({});
  });
});

describe("tawaranTerbaruPerNomor", () => {
  it("satu baris per nomor, berisi tawaran terbarunya", () => {
    const { aktif } = tawaranTerbaruPerNomor([
      tawaran({ no_wa: "62811", harga_tawar: 60000, created_at: "2026-10-05T01:00:00Z" }),
      tawaran({ no_wa: "62811", harga_tawar: 75000, created_at: "2026-10-06T01:00:00Z" }),
      tawaran({ no_wa: "62822", harga_tawar: 70000, created_at: "2026-10-06T02:00:00Z" }),
    ]);
    expect(aktif).toHaveLength(2);
    const rina = aktif.find((p) => p.no_wa === "62811")!;
    expect(rina.terbaru.harga_tawar).toBe(75000);
    expect(rina.jumlahNaik).toBe(1);
  });

  it("hanya kenaikan yang dihitung sebagai naik", () => {
    const { aktif } = tawaranTerbaruPerNomor([
      tawaran({ no_wa: "62811", harga_tawar: 60000, created_at: "2026-10-05T01:00:00Z" }),
      tawaran({ no_wa: "62811", harga_tawar: 75000, created_at: "2026-10-06T01:00:00Z" }),
      tawaran({ no_wa: "62811", harga_tawar: 70000, created_at: "2026-10-07T01:00:00Z" }),
    ]);
    expect(aktif[0].terbaru.harga_tawar).toBe(70000);
    expect(aktif[0].jumlahNaik).toBe(1);
  });

  it("penawar yang ditolak masuk ke bagian ditolak", () => {
    const hasil = tawaranTerbaruPerNomor([
      tawaran({ no_wa: "62833", harga_tawar: 1, created_at: KEMARIN, status: "ditolak" }),
    ]);
    expect(hasil.aktif).toHaveLength(0);
    expect(hasil.ditolak.map((p) => p.no_wa)).toEqual(["62833"]);
  });

  it("ditolak lalu menawar lagi: kembali ke daftar utama dengan tawaran barunya", () => {
    const hasil = tawaranTerbaruPerNomor([
      tawaran({ no_wa: "62833", harga_tawar: 1, created_at: "2026-10-05T01:00:00Z", status: "ditolak" }),
      tawaran({ no_wa: "62833", harga_tawar: 80000, created_at: "2026-10-06T01:00:00Z" }),
    ]);
    expect(hasil.ditolak).toHaveLength(0);
    expect(hasil.aktif[0].terbaru.harga_tawar).toBe(80000);
  });

  it("pemenang tidak muncul lagi di daftar utama walau punya baris lama", () => {
    const hasil = tawaranTerbaruPerNomor([
      tawaran({ no_wa: "62811", harga_tawar: 60000, created_at: "2026-10-05T01:00:00Z" }),
      tawaran({ no_wa: "62811", harga_tawar: 95000, created_at: "2026-10-06T01:00:00Z", status: "diterima" }),
      tawaran({ no_wa: "62822", harga_tawar: 90000, created_at: "2026-10-06T02:00:00Z" }),
    ]);
    expect(hasil.pemenang?.terbaru.harga_tawar).toBe(95000);
    expect(hasil.aktif.map((p) => p.no_wa)).toEqual(["62822"]);
  });

  it("pemenang yang batal masuk ke bagian ditolak", () => {
    const hasil = tawaranTerbaruPerNomor([
      tawaran({ no_wa: "62811", harga_tawar: 95000, created_at: KEMARIN, status: "batal" }),
    ]);
    expect(hasil.pemenang).toBeNull();
    expect(hasil.ditolak[0].terbaru.status).toBe("batal");
  });
});

describe("urutkanPenawar", () => {
  const { aktif } = tawaranTerbaruPerNomor([
    tawaran({ no_wa: "62811", harga_tawar: 90000, created_at: "2026-10-06T01:00:00Z" }),
    tawaran({ no_wa: "62822", harga_tawar: 95000, created_at: "2026-10-05T01:00:00Z" }),
    tawaran({ no_wa: "62833", harga_tawar: 90000, created_at: "2026-10-07T01:00:00Z" }),
  ]);

  it("tertinggi dulu; kalau sama, yang lebih dulu menawar di atas", () => {
    expect(urutkanPenawar(aktif, "tertinggi").map((p) => p.no_wa)).toEqual(["62822", "62811", "62833"]);
  });
  it("terbaru dulu", () => {
    expect(urutkanPenawar(aktif, "terbaru").map((p) => p.no_wa)).toEqual(["62833", "62811", "62822"]);
  });
});

describe("ringkasLelang", () => {
  const listing = (id: string, batas: string) => ({
    id, judul: id, harga: 50000, satuan: "/keranjang", status: "tersedia" as const,
    mode: "lelang" as const, batas_waktu: batas,
  });
  const a = listing("a", "2026-10-10T06:00:00Z");
  const b = listing("b", "2026-10-09T06:00:00Z");

  it("satu ringkasan per lelang, diurutkan dari yang paling cepat ditutup", () => {
    const hasil = ringkasLelang([
      { jenis: "lelang", no_wa: "62811", harga_tawar: 60000, listings: a },
      { jenis: "lelang", no_wa: "62811", harga_tawar: 75000, listings: a },
      { jenis: "lelang", no_wa: "62822", harga_tawar: 70000, listings: a },
      { jenis: "lelang", no_wa: "62833", harga_tawar: 55000, listings: b },
      { jenis: "pesan", no_wa: "62844", harga_tawar: null, listings: { ...a, id: "c", mode: "jual" as const } },
    ]);
    expect(hasil.map((r) => r.listing.id)).toEqual(["b", "a"]);
    expect(hasil[1]).toMatchObject({ jumlahPenawar: 2, tertinggi: 75000 });
  });
});

describe("susunBeranda", () => {
  const dasar = { batas_waktu: null, created_at: "2026-10-01T00:00:00Z" };
  const daftar = [
    { ...dasar, id: "laku", mode: "jual" as const, status: "sudah_laku" as const },
    { ...dasar, id: "tutup", mode: "lelang" as const, status: "tersedia" as const, batas_waktu: KEMARIN },
    { ...dasar, id: "segera", mode: "jual" as const, status: "segera" as const },
    { ...dasar, id: "jual", mode: "jual" as const, status: "tersedia" as const },
    { ...dasar, id: "lelang-lama", mode: "lelang" as const, status: "tersedia" as const, batas_waktu: "2026-10-12T00:00:00Z" },
    { ...dasar, id: "lelang-cepat", mode: "lelang" as const, status: "tersedia" as const, batas_waktu: BESOK },
  ];

  it("lelang terbuka di atas, paling cepat ditutup dulu", () => {
    expect(susunBeranda(daftar, SEKARANG).lelang.map((l) => l.id)).toEqual(["lelang-cepat", "lelang-lama"]);
  });

  it("sisanya: dijual, segera, lelang ditutup, lalu sudah laku", () => {
    expect(susunBeranda(daftar, SEKARANG).lainnya.map((l) => l.id)).toEqual(["jual", "segera", "tutup", "laku"]);
  });
});
