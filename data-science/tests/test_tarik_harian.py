from datetime import date

from extract.http import HasilTarik, siapkan_folder, simpan_json
from tarik_harian import PENANDA, baca_argumen, jalankan

TANGGAL = date(2026, 10, 27)


def folder(akar, sumber):
    return akar / "raw" / sumber / "date=2026-10-27"


def penarik_palsu(sumber, status="berhasil", dipanggil=None):
    def tarik(tanggal, akar):
        if dipanggil is not None:
            dipanggil.append(sumber)
        f = siapkan_folder(akar, sumber, tanggal)
        simpan_json(f, "page_001.json", {"ok": True})
        return HasilTarik(1, status)

    return tarik


def test_menarik_semua_sumber_dan_memberi_penanda(tmp_path):
    penarik = {"blibli": penarik_palsu("blibli"), "tokopedia": penarik_palsu("tokopedia")}

    gagal = jalankan(TANGGAL, tmp_path, penarik)

    assert gagal == 0
    assert (folder(tmp_path, "blibli") / PENANDA).exists()
    assert (folder(tmp_path, "tokopedia") / PENANDA).exists()


def test_melewati_sumber_yang_sudah_sukses_hari_ini(tmp_path):
    jalankan(TANGGAL, tmp_path, {"blibli": penarik_palsu("blibli")})
    dipanggil = []

    gagal = jalankan(TANGGAL, tmp_path, {"blibli": penarik_palsu("blibli", dipanggil=dipanggil)})

    assert gagal == 0
    assert dipanggil == []


def test_menarik_ulang_kalau_tarikan_sebelumnya_belum_sukses(tmp_path):
    f = siapkan_folder(tmp_path, "tokopedia", TANGGAL)
    simpan_json(f, "page_001.json", {"ok": True})
    dipanggil = []

    jalankan(TANGGAL, tmp_path, {"tokopedia": penarik_palsu("tokopedia", dipanggil=dipanggil)})

    assert dipanggil == ["tokopedia"]


def test_tarikan_sebagian_tidak_diberi_penanda_dan_dihitung_gagal(tmp_path):
    gagal = jalankan(TANGGAL, tmp_path, {"blibli": penarik_palsu("blibli", status="sebagian")})

    assert gagal == 1
    assert not (folder(tmp_path, "blibli") / PENANDA).exists()


def test_galat_di_satu_sumber_tidak_menghentikan_sumber_lain(tmp_path):
    def rusak(tanggal, akar):
        raise RuntimeError("GraphQL berubah")

    penarik = {"blibli": rusak, "tokopedia": penarik_palsu("tokopedia")}

    gagal = jalankan(TANGGAL, tmp_path, penarik)

    assert gagal == 1
    assert (folder(tmp_path, "tokopedia") / PENANDA).exists()


def test_ulang_menarik_lagi_walau_sudah_sukses(tmp_path):
    jalankan(TANGGAL, tmp_path, {"blibli": penarik_palsu("blibli")})
    dipanggil = []

    gagal = jalankan(
        TANGGAL, tmp_path, {"blibli": penarik_palsu("blibli", dipanggil=dipanggil)}, ulang={"blibli"}
    )

    assert gagal == 0
    assert dipanggil == ["blibli"]
    assert (folder(tmp_path, "blibli") / PENANDA).exists()


def test_ulang_hanya_berlaku_untuk_sumber_yang_disebut(tmp_path):
    jalankan(TANGGAL, tmp_path, {"blibli": penarik_palsu("blibli"), "tokopedia": penarik_palsu("tokopedia")})
    dipanggil = []
    penarik = {
        "blibli": penarik_palsu("blibli", dipanggil=dipanggil),
        "tokopedia": penarik_palsu("tokopedia", dipanggil=dipanggil),
    }

    jalankan(TANGGAL, tmp_path, penarik, ulang={"tokopedia"})

    assert dipanggil == ["tokopedia"]


def test_baca_argumen_bawaan_semua_sumber_tanpa_ulang():
    argumen = baca_argumen([])

    assert argumen.sumber == ["blibli", "tokopedia"]
    assert argumen.ulang == set()


def test_baca_argumen_ulang():
    assert baca_argumen(["--ulang", "tokopedia"]).ulang == {"tokopedia"}
    assert baca_argumen(["--ulang", "blibli", "tokopedia"]).ulang == {"blibli", "tokopedia"}


def test_baca_argumen_sumber_tertentu():
    assert baca_argumen(["--sumber", "tokopedia"]).sumber == ["tokopedia"]
