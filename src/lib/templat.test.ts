import { describe, expect, it } from "vitest";
import {
  CONTOH,
  JENIS_TEMPLAT,
  TAG,
  TEMPLAT_AWAL,
  isiTemplat,
  pakaiTemplat,
  tagTakDikenal,
} from "./templat";

describe("isiTemplat", () => {
  it("mengganti tag yang dikenal", () => {
    expect(isiTemplat("Halo {nama}, {barang}!", { nama: "Budi", barang: "Mangga" })).toBe(
      "Halo Budi, Mangga!",
    );
  });

  it("tag yang tidak ada nilainya dibiarkan apa adanya", () => {
    expect(isiTemplat("Halo {nma}", { nama: "Budi" })).toBe("Halo {nma}");
  });

  it("isi dari pembeli yang mirip tag tidak ikut diganti", () => {
    const teks = isiTemplat("Catatan: {catatan}", {
      catatan: "{link_admin} $1 $&",
      link_admin: "RAHASIA",
    });
    expect(teks).toBe("Catatan: {link_admin} $1 $&");
  });

  it("tidak membaca properti bawaan objek", () => {
    expect(isiTemplat("{constructor}", {})).toBe("{constructor}");
  });
});

describe("tagTakDikenal", () => {
  it("kosong kalau semua tag sah untuk kotaknya", () => {
    expect(tagTakDikenal("{nama} {tawaran} {ditutup}", "wa_lelang")).toEqual([]);
  });

  it("menyebut tag yang salah ketik, sekali saja", () => {
    expect(tagTakDikenal("{nma} {nma} {nama}", "wa_pesan")).toEqual(["nma"]);
  });

  it("tag lelang tidak sah di pesanan biasa", () => {
    expect(tagTakDikenal("{tawaran}", "wa_pesan")).toEqual(["tawaran"]);
  });

  it("huruf besar dan spasi di dalam kurung ditolak", () => {
    expect(tagTakDikenal("{Nama} { nama }", "wa_pesan")).toEqual(["Nama", " nama "]);
  });
});

describe("pakaiTemplat", () => {
  it("kosong, hanya spasi, atau null jatuh ke teks bawaan", () => {
    expect(pakaiTemplat("", "wa_pesan")).toBe(TEMPLAT_AWAL.wa_pesan);
    expect(pakaiTemplat("  \n \n", "wa_pesan")).toBe(TEMPLAT_AWAL.wa_pesan);
    expect(pakaiTemplat(null, "bagikan_jual")).toBe(TEMPLAT_AWAL.bagikan_jual);
    expect(pakaiTemplat(undefined, "bagikan_lelang")).toBe(TEMPLAT_AWAL.bagikan_lelang);
  });

  it("templat berisi dipakai apa adanya", () => {
    expect(pakaiTemplat("Ada {nama}", "wa_pesan")).toBe("Ada {nama}");
  });
});

describe("teks bawaan dan contoh", () => {
  it("teks bawaan hanya memakai tag yang sah untuk kotaknya", () => {
    for (const jenis of JENIS_TEMPLAT) expect(tagTakDikenal(TEMPLAT_AWAL[jenis], jenis)).toEqual([]);
  });

  it("data contoh mengisi semua tag kotaknya", () => {
    for (const jenis of JENIS_TEMPLAT) {
      for (const tag of TAG[jenis]) expect(CONTOH[jenis][tag], `${jenis}.${tag}`).toBeTruthy();
    }
  });
});
