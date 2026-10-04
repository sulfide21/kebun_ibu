import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  awalHariIniWita,
  bacaInputWita,
  formatWita,
  keInputWita,
  sisaWaktu,
} from "./waktu";

const TZ_ASLI = process.env.TZ;
afterEach(() => {
  // process.env.TZ = undefined akan menjadi string "undefined"
  if (TZ_ASLI === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ASLI;
});

// Vercel selalu UTC; laptop pengembang bisa WIB atau WITA. Hasilnya
// harus sama persis di ketiganya.
describe.each(["UTC", "Asia/Makassar", "Asia/Jakarta"])("jam server %s", (tz) => {
  beforeEach(() => {
    process.env.TZ = tz;
  });

  it("membaca isian form sebagai WITA", () => {
    expect(bacaInputWita("2026-10-10T14:00")?.toISOString()).toBe(
      "2026-10-10T06:00:00.000Z",
    );
  });

  it("menolak isian yang tidak lengkap atau tanggal yang tidak ada", () => {
    expect(bacaInputWita("")).toBeNull();
    expect(bacaInputWita("2026-10-10 14:00")).toBeNull();
    expect(bacaInputWita("2026-02-30T10:00")).toBeNull();
    expect(bacaInputWita("2026-13-01T10:00")).toBeNull();
  });

  it("mengisi form edit dalam WITA", () => {
    expect(keInputWita(new Date("2026-10-10T06:00:00Z"))).toBe("2026-10-10T14:00");
  });

  it("awal hari pada 23.30 WITA adalah 00.00 hari yang sama", () => {
    // 15.30 UTC = 23.30 WITA tanggal 10
    expect(awalHariIniWita(new Date("2026-10-10T15:30:00Z")).toISOString()).toBe(
      "2026-10-09T16:00:00.000Z",
    );
  });

  it("awal hari pada 00.30 WITA sudah hari berikutnya", () => {
    // 16.30 UTC = 00.30 WITA tanggal 11
    expect(awalHariIniWita(new Date("2026-10-10T16:30:00Z")).toISOString()).toBe(
      "2026-10-10T16:00:00.000Z",
    );
  });

  it("tepat 00.00 WITA adalah awal hari itu sendiri", () => {
    expect(awalHariIniWita(new Date("2026-10-10T16:00:00Z")).toISOString()).toBe(
      "2026-10-10T16:00:00.000Z",
    );
  });

  it("menampilkan jam WITA dengan akhiran", () => {
    expect(formatWita(new Date("2026-10-10T06:00:00Z"))).toBe(
      "Sab, 10 Okt, 14.00 WITA",
    );
  });
});

describe("sisaWaktu", () => {
  const sekarang = new Date("2026-10-08T04:00:00Z");
  const tambah = (ms: number) => new Date(sekarang.getTime() + ms);

  it("Ditutup kalau batas sudah lewat atau tepat sekarang", () => {
    expect(sisaWaktu(sekarang, sekarang)).toBe("Ditutup");
    expect(sisaWaktu(tambah(-1000), sekarang)).toBe("Ditutup");
  });

  it("menit, jam, lalu hari", () => {
    expect(sisaWaktu(tambah(30_000), sekarang)).toBe("1 menit lagi");
    expect(sisaWaktu(tambah(20 * 60_000), sekarang)).toBe("20 menit lagi");
    expect(sisaWaktu(tambah(5 * 3_600_000 + 10 * 60_000), sekarang)).toBe("5 jam lagi");
    expect(sisaWaktu(tambah(3 * 86_400_000 + 3_600_000), sekarang)).toBe("3 hari lagi");
  });
});
