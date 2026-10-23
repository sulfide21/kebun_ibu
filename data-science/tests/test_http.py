from datetime import date

import pytest

from extract.http import (
    AmbilGagal,
    KesalahanSementara,
    ambil_dengan_coba_ulang,
    siapkan_folder,
)


def test_coba_ulang_sampai_berhasil():
    tidur_dicatat = []
    hasil_berurutan = iter([KesalahanSementara("putus"), KesalahanSementara("putus"), "ok"])

    def fungsi():
        hasil = next(hasil_berurutan)
        if isinstance(hasil, Exception):
            raise hasil
        return hasil

    assert ambil_dengan_coba_ulang(fungsi, tidur=tidur_dicatat.append) == "ok"
    assert tidur_dicatat == [2, 4]


def test_menyerah_setelah_tiga_kali_ulang():
    tidur_dicatat = []

    def selalu_gagal():
        raise KesalahanSementara("putus")

    with pytest.raises(AmbilGagal):
        ambil_dengan_coba_ulang(selalu_gagal, tidur=tidur_dicatat.append)
    assert tidur_dicatat == [2, 4, 8]


def test_galat_lain_tidak_diulang():
    tidur_dicatat = []

    def rusak():
        raise ValueError("bug di kode kita")

    with pytest.raises(ValueError):
        ambil_dengan_coba_ulang(rusak, tidur=tidur_dicatat.append)
    assert tidur_dicatat == []


def test_siapkan_folder_mengosongkan_isi_lama(tmp_path):
    lama = tmp_path / "raw" / "blibli" / "date=2026-10-17"
    lama.mkdir(parents=True)
    (lama / "basi.json").write_text("{}")

    folder = siapkan_folder(tmp_path, "blibli", date(2026, 10, 17))

    assert folder == lama
    assert list(folder.iterdir()) == []
