"""Alat bersama untuk semua penarik: coba ulang, jeda, dan simpan berkas mentah."""
import json
import random
import shutil
import time
from dataclasses import dataclass 
from datetime import date
from pathlib import Path
from typing import Callable, TypeVar

T = TypeVar("T")

JEDA_COBA_ULANG = [2, 4, 8]


class KesalahanSementara(Exception):
    """Galat yang mungkin hilang kalau dicoba lagi: jaringan putus, 429, 5xx."""


class AmbilGagal(Exception):
    """Dilempar setelah semua percobaan habis."""


@dataclass
class HasilTarik:
    halaman: int
    status: str  # "berhasil", "sebagian", atau "gagal"
    pesan: str | None = None


def ambil_dengan_coba_ulang(
    fungsi: Callable[[], T], *, tidur: Callable[[float], None] = time.sleep
) -> T:
    for jeda in JEDA_COBA_ULANG:
        try:
            return fungsi()
        except KesalahanSementara:
            tidur(jeda)
    try:
        return fungsi()
    except KesalahanSementara as galat:
        raise AmbilGagal(f"gagal setelah {len(JEDA_COBA_ULANG)} kali coba ulang: {galat}") from galat


def jeda_sopan(
    tidur: Callable[[float], None] = time.sleep,
    acak: Callable[[float, float], float] = random.uniform,
) -> None:
    tidur(acak(1.5, 3.0))


def siapkan_folder(akar: Path, sumber: str, tanggal: date) -> Path:
    folder = Path(akar) / "raw" / sumber / f"date={tanggal:%Y-%m-%d}"
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir(parents=True)
    return folder


def simpan_json(folder: Path, nama_berkas: str, isi: object) -> Path:
    jalur = folder / nama_berkas
    jalur.write_text(json.dumps(isi, ensure_ascii=False), encoding="utf-8")
    return jalur
