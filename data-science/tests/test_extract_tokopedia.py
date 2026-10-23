from datetime import date

from extract.http import AmbilGagal
from extract.tokopedia import produk_dari_jawaban, tarik

TANGGAL = date(2026, 10, 19)


def jawaban_palsu(produk):
    return [{"data": {"searchProductV5": {"data": {"products": produk}}}}]


def berkas_tersimpan(akar):
    return sorted(p.name for p in (akar / "raw" / "tokopedia" / "date=2026-10-19").iterdir())


def test_produk_dari_jawaban():
    produk = [{"id": 1, "name": "Mangga"}, {"id": 2, "name": "Pisang"}]

    assert produk_dari_jawaban(jawaban_palsu(produk)) == produk


def test_berhenti_di_halaman_kosong(tmp_path):
    def ambil(halaman):
        return jawaban_palsu([{"id": halaman}] if halaman <= 3 else [])

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "berhasil"
    assert hasil.halaman == 3
    assert berkas_tersimpan(tmp_path) == ["page_001.json", "page_002.json", "page_003.json"]


def test_berhenti_di_halaman_100(tmp_path):
    def ambil(halaman):
        return jawaban_palsu([{"id": halaman}])

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "berhasil"
    assert hasil.halaman == 100
    assert len(berkas_tersimpan(tmp_path)) == 100


def test_halaman_pertama_gagal_berarti_gagal(tmp_path):
    def ambil(halaman):
        raise AmbilGagal("diblokir")

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "gagal"
    assert hasil.halaman == 0


def test_gagal_di_tengah_berarti_sebagian(tmp_path):
    def ambil(halaman):
        if halaman == 3:
            raise AmbilGagal("putus")
        return jawaban_palsu([{"id": halaman}])

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "sebagian"
    assert hasil.halaman == 2
    assert berkas_tersimpan(tmp_path) == ["page_001.json", "page_002.json"]
