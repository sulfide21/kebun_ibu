from datetime import date

from extract.blibli import HalamanHabis, tarik
from extract.http import AmbilGagal

TANGGAL = date(2026, 10, 18)


def jawaban_palsu(total_halaman):
    return {"data": {"products": [{"id": "x"}], "paging": {"total_page": total_halaman}}}


def berkas_tersimpan(akar):
    return sorted(p.name for p in (akar / "raw" / "blibli" / "date=2026-10-18").iterdir())


def test_menarik_semua_halaman_kedua_kategori(tmp_path):
    def ambil(kategori, halaman):
        return jawaban_palsu(2)

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "berhasil"
    assert hasil.halaman == 4
    assert berkas_tersimpan(tmp_path) == [
        "BU-1000190_page_001.json",
        "BU-1000190_page_002.json",
        "BU-1000191_page_001.json",
        "BU-1000191_page_002.json",
    ]


def test_422_setelah_halaman_terakhir_berarti_selesai(tmp_path):
    def ambil(kategori, halaman):
        if halaman >= 21:
            raise HalamanHabis("422")
        return jawaban_palsu(25)

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "berhasil"
    nama = berkas_tersimpan(tmp_path)
    assert len([n for n in nama if n.startswith("BU-1000190")]) == 20
    assert len([n for n in nama if n.startswith("BU-1000191")]) == 20


def test_halaman_habis_di_tengah_bukan_galat(tmp_path):
    def ambil(kategori, halaman):
        if halaman >= 3:
            raise HalamanHabis("422")
        return jawaban_palsu(5)

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "berhasil"
    assert hasil.halaman == 4


def test_halaman_pertama_gagal_berarti_gagal(tmp_path):
    def ambil(kategori, halaman):
        raise AmbilGagal("server mati")

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "gagal"
    assert hasil.halaman == 0


def test_gagal_di_tengah_berarti_sebagian(tmp_path):
    def ambil(kategori, halaman):
        if kategori == "BU-1000191" and halaman == 2:
            raise AmbilGagal("putus")
        return jawaban_palsu(3)

    hasil = tarik(TANGGAL, tmp_path, ambil_halaman=ambil, tidur=lambda s: None)

    assert hasil.status == "sebagian"
    assert hasil.halaman == 4
    assert "BU-1000191_page_001.json" in berkas_tersimpan(tmp_path)
