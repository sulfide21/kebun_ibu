import time
import urllib.parse
from datetime import date
from functools import partial
from pathlib import Path
from typing import Callable


from curl_cffi import requests

from extract.http import (
    AmbilGagal,
    HasilTarik,
    KesalahanSementara,
    ambil_dengan_coba_ulang,
    jeda_sopan,
    siapkan_folder,
    simpan_json,
)

URL = "https://gql.tokopedia.com/graphql/SearchProductV5Query"

PARAM_DASAR = {
    "source": "directory",
    "identifier": "makanan-minuman_buah_buah-buahan",
    "sc": 2705,
    "q": "",
    "rows": 60,
    "ob": 23,
    "device": "desktop",
    "st": "product",
    "safe_search": "false",
    "user_id": 0,
    "related": "true",
}

HALAMAN_MAKS = 100

KEPALA = {
    "Content-Type": "application/json",
    "Origin": "https://www.tokopedia.com",
    "Referer": "https://www.tokopedia.com/p/makanan-minuman/buah/buah-buahan",
    "X-Source": "tokopedia-lite",
    "X-Tkpd-Lite-Service": "zeus",
    "X-Device": "desktop-0.0",
    
}

QUERY = """ 
query SearchProductV5Query($params: String!) {
    searchProductV5(params: $params) {
        header { totalData }
        data{
            products {
                id name url
                price { number original discountPercentage }
                shop { id name city tier }
                category { breadcrumb }
                rating
                labelGroups { position title }
            }
        }
    }
}
"""

def buat_sesi() -> requests.Session:
    sesi = requests.Session(impersonate="chrome")
    sesi.get("https://www.tokopedia.com/", timeout=60)
    return sesi

def ambil_halaman_http(sesi: requests.Session, halaman: int) -> list:
    param = dict(PARAM_DASAR, page=halaman, start=(halaman - 1) * PARAM_DASAR["rows"])
    badan = [
        {
            "operationName": "SearchProductV5Query",
            "variables": {"params": urllib.parse.urlencode(param)},
            "query":QUERY,
        }
    ]
    try:
        jawaban = sesi.post(URL, json=badan, headers=KEPALA, timeout=60)
        
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as galat:
        raise KesalahanSementara(str(galat)) from galat
    
    if jawaban.status_code == 429 or jawaban.status_code >= 500:
        raise KesalahanSementara(f"HTTP {jawaban.status_code}")
    jawaban.raise_for_status()
    
    isi = jawaban.json()
    if isi[0].get("errors"):
        pesan = "; ".join(e.get("message", "?") for e in isi[0]["errors"])
        raise RuntimeError(f"GraphQL Tokopedia: {pesan}")
    return isi

def produk_dari_jawaban(jawaban: list) -> list[dict]:
    return jawaban[0]["data"]["searchProductV5"]["data"]["products"] or []

def tarik(
    tanggal: date,
    akar: Path,
    ambil_halaman: Callable[[int], list] | None = None,
    tidur: Callable[[float], None] = time.sleep,
    
) -> HasilTarik:
    if ambil_halaman is None:
        ambil_halaman = partial(ambil_halaman_http, buat_sesi())
        
    folder = siapkan_folder(akar, "tokopedia", tanggal)
    jumlah = 0
    
    for n in range(1, HALAMAN_MAKS + 1):
        try:
            jawaban = ambil_dengan_coba_ulang(lambda: ambil_halaman(n), tidur=tidur)
            
        except AmbilGagal as galat:
            status = "gagal" if jumlah == 0 else "sebagian"
            return HasilTarik(jumlah, status, f"halaman {n}: {galat}")
        
        if not produk_dari_jawaban(jawaban):
            break
        
        simpan_json(folder, f"page_{n:03d}.json", jawaban)
        jumlah += 1
        jeda_sopan(tidur)
        
    return HasilTarik(jumlah, "berhasil")
    
    
    
    
    
    
    
    
    
    
    
    
    
    
























