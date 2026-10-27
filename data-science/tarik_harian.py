"""Tarikan harian Blibli + Tokopedia, dijalankan Task Scheduler (laptop) atau cron (VPS).

Aman dijalankan berkali-kali dalam sehari: sumber yang sudah sukses hari ini
dilewati, karena siapkan_folder menghapus folder tanggal itu sebelum menarik.
"""
import logging
import sys
from datetime import date
from pathlib import Path
from typing import Callable

from extract import blibli, tokopedia
from extract.http import HasilTarik

DASAR = Path(__file__).resolve().parent
AKAR = DASAR / "data_lake"
LOG = DASAR / "logs" / "tarik_harian.log"
PENANDA = "_SUKSES"

PENARIK: dict[str, Callable[[date, Path], HasilTarik]] = {
    "blibli": blibli.tarik,
    "tokopedia": tokopedia.tarik,
}

log = logging.getLogger("tarik_harian")


def folder_tanggal(akar: Path, sumber: str, tanggal: date) -> Path:
    return akar / "raw" / sumber / f"date={tanggal:%Y-%m-%d}"


def jalankan(
    tanggal: date,
    akar: Path,
    penarik: dict[str, Callable[[date, Path], HasilTarik]] = PENARIK,
) -> int:
    """Menarik setiap sumber yang belum sukses hari ini. Mengembalikan jumlah sumber yang gagal."""
    gagal = 0
    for sumber, tarik in penarik.items():
        folder = folder_tanggal(akar, sumber, tanggal)
        if (folder / PENANDA).exists():
            log.info("%s: dilewati, sudah sukses %s", sumber, tanggal)
            continue
        try:
            hasil = tarik(tanggal, akar)
        except Exception:
            log.exception("%s: galat tak terduga", sumber)
            gagal += 1
            continue
        log.info("%s: %s, %d halaman %s", sumber, hasil.status, hasil.halaman, hasil.pesan or "")
        if hasil.status == "berhasil":
            (folder / PENANDA).touch()
        else:
            gagal += 1
    return gagal


def main() -> int:
    LOG.parent.mkdir(exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(LOG, encoding="utf-8"), logging.StreamHandler()],
    )
    gagal = jalankan(date.today(), AKAR)
    log.info("selesai, %d sumber gagal", gagal)
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main())
