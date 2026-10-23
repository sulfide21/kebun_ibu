import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Callable


from extract.http import(
    AmbilGagal,
    HasilTarik,
    KesalahanSementara,
    ambil_dengan_coba_ulang,
    jeda_sopan,
    siapkan_folder,
    simpan_json,
)

CARI = "https://www.blibli.com/backend/search/products"
KATEGORI = {"BU-1000190": "lokal", "BU-1000191": "impor"}
MAKS_HALAMAN = 20

KEPALA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Origin": "https://www.blibli.com",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
}


class HalamanHabis(Exception):
    """Blibli menjawab 422: halaman yang diminta sudah lewat batas."""
    
def ambil_halaman_http(kategori: str, halaman: int) -> dict:
    param = urllib.parse.urlencode(
        {
            "category": kategori,
            "page": halaman,
            "start": (halaman - 1) * 40,
            "itemPerPage": 40,
            "channelId": "web",
        }
    )
    kepala = dict(KEPALA)
    kepala["Referer"] = f"https://www.blibli.com/cari?category={kategori}"
    permintaan = urllib.request.Request(f"{CARI}?{param}", headers=kepala)
    try:
        with urllib.request.urlopen(permintaan, timeout=60) as jawaban:
            return json.load(jawaban)
    except urllib.error.HTTPError as galat:
        if galat.code == 422:
            raise HalamanHabis(f"{kategori} halaman {halaman}") from galat
        if galat.code == 429 or galat.code >= 500:
            raise KesalahanSementara(f"HTTP {galat.code}") from galat
        raise
    except (urllib.error.URLError, TimeoutError) as galat:
        raise KesalahanSementara(str(galat)) from galat
    
    
def tarik(
        tanggal: date,
        akar: Path,
        ambil_halaman: Callable[[str,int], dict] = ambil_halaman_http,
        tidur: Callable[[float], None] = time.sleep,
        
    ) -> HasilTarik:
        folder = siapkan_folder(akar, "blibli", tanggal)
        jumlah = 0
        
        for kategori in KATEGORI:
            for n in range(1,MAKS_HALAMAN + 1):
                try: 
                    jawaban = ambil_dengan_coba_ulang(lambda: ambil_halaman(kategori, n), tidur=tidur)
                except HalamanHabis:
                    break
                except AmbilGagal as galat:
                    status = "gagal" if jumlah == 0 else "sebagian"
                    return HasilTarik(jumlah, status, f"{kategori} halaman {n}: {galat}")
                
                data = jawaban.get("data") or {}
                if not data.get("products"):
                    break
                
                simpan_json(folder, f"{kategori}_page_{n:03d}.json", jawaban)
                jumlah += 1
                total = (data.get("paging") or {}).get("total_page", 0)
                if n >= total:
                    break
                jeda_sopan(tidur)
                
        return HasilTarik(jumlah, "berhasil")
    
    
    
    
    
    
    
    
    
    
    
    
    