import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IsiPemberitahuan } from "./pemberitahuan";
import { kirimWaPemberitahuan } from "./whatsapp";

const isi: IsiPemberitahuan = {
  nama: "Wati",
  noWa: "6287700002222",
  judulListing: "Pisang kepok",
  jenis: "pesan",
  hargaListing: 30000,
  hargaTawar: null,
  batasWaktu: null,
  catatan: "",
};

const jawab = (badan: object) =>
  new Response(JSON.stringify(badan), { status: 200, headers: { "content-type": "application/json" } });

describe("kirimWaPemberitahuan", () => {
  const fetchPalsu = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchPalsu);
    vi.stubEnv("FONNTE_TOKEN", "token-uji");
    vi.stubEnv("WA_TUJUAN", "6282359422252");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fetchPalsu.mockReset();
  });

  it("mengirim ke Fonnte dengan token dan nomor tujuan", async () => {
    fetchPalsu.mockResolvedValue(jawab({ status: true, detail: "success! message in queue" }));
    await kirimWaPemberitahuan(isi);

    expect(fetchPalsu).toHaveBeenCalledOnce();
    const [url, opsi] = fetchPalsu.mock.calls[0];
    expect(url).toBe("https://api.fonnte.com/send"); 
    expect(opsi.method).toBe("POST");
    expect(opsi.headers.Authorization).toBe("token-uji");
    const badan = opsi.body as URLSearchParams;
    expect(badan.get("target")).toBe("6282359422252");
    expect(badan.get("message")).toContain("Ada pesanan baru.");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("memakai templat yang diberikan, judul tebal tetap", async () => {
    fetchPalsu.mockResolvedValue(jawab({ status: true }));
    await kirimWaPemberitahuan(isi, { wa_pesan: "Ada {nama} pesan {barang}" });
    const badan = fetchPalsu.mock.calls[0][1].body as URLSearchParams;
    expect(badan.get("message")).toBe("*Pesanan baru: Pisang kepok*\n\nAda Wati pesan Pisang kepok");
  });

  it("dilewati diam-diam kalau token atau nomor belum dipasang", async () => {
    vi.stubEnv("FONNTE_TOKEN", "");
    await kirimWaPemberitahuan(isi);
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("jawaban gagal dari Fonnte dicatat, tidak dilempar", async () => {
    fetchPalsu.mockResolvedValue(jawab({ status: false, reason: "token invalid" }));
    await expect(kirimWaPemberitahuan(isi)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[wa]"), "token invalid");
  });

  it("jaringan putus dicatat, tidak dilempar", async () => {
    fetchPalsu.mockRejectedValue(new Error("timeout"));
    await expect(kirimWaPemberitahuan(isi)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
