import { describe, expect, it } from "vitest";
import { awalBulanWita } from "./format";

describe("awalBulanWita", () => {
  // 16.30 UTC tanggal 31 Okt = 00.30 WITA tanggal 1 Nov
  const awalNovember = new Date("2026-10-31T16:30:00Z");

  it("bulan ini dihitung menurut WITA, bukan UTC", () => {
    expect(awalBulanWita(0, awalNovember)).toBe("2026-10-31T16:00:00.000Z");
  });

  it("bulan lalu", () => {
    expect(awalBulanWita(1, awalNovember)).toBe("2026-09-30T16:00:00.000Z");
  });

  it("23.30 WITA tanggal 31 masih bulan itu", () => {
    expect(awalBulanWita(0, new Date("2026-10-31T15:30:00Z"))).toBe(
      "2026-09-30T16:00:00.000Z",
    );
  });

  it("mundur melewati pergantian tahun", () => {
    expect(awalBulanWita(1, new Date("2026-01-15T00:00:00Z"))).toBe(
      "2025-11-30T16:00:00.000Z",
    );
  });
});
