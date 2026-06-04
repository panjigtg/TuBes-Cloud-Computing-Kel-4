import os
import re
import time
import math
import requests
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# Koordinat sekitar Kampus B Universitas Airlangga
CAMPUS_B_LAT = -7.272222
CAMPUS_B_LON = 112.758333

RADIUS_METER = 3000
MAX_RESULTS_PER_QUERY = 20

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PHOTO_BASE_URL = "https://places.googleapis.com/v1"

OUTPUT_DIR = Path("hasil_bengkel_unair_b")
PHOTO_DIR = OUTPUT_DIR / "foto_bengkel"
CSV_PATH = OUTPUT_DIR / "bengkel_unair_b_dengan_foto.csv"


QUERIES = [
    "bengkel motor dekat Kampus B Universitas Airlangga Surabaya",
    "bengkel mobil dekat Kampus B Universitas Airlangga Surabaya",
    "tambal ban dekat Kampus B Universitas Airlangga Surabaya",
    "service motor dekat Kampus B Universitas Airlangga Surabaya",
]


def check_api_key():
    if not API_KEY:
        raise RuntimeError(
            "API key belum ada. Set dulu GOOGLE_MAPS_API_KEY di environment variable."
        )


def safe_filename(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9_-]+", "_", text)
    return text.strip("_")[:80]


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )

    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def search_places(query):
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": (
            "places.id,"
            "places.displayName,"
            "places.formattedAddress,"
            "places.location,"
            "places.types,"
            "places.googleMapsUri,"
            "places.photos"
        ),
    }

    payload = {
        "textQuery": query,
        "languageCode": "id",
        "regionCode": "ID",
        "maxResultCount": MAX_RESULTS_PER_QUERY,
        "locationBias": {
            "circle": {
                "center": {
                    "latitude": CAMPUS_B_LAT,
                    "longitude": CAMPUS_B_LON,
                },
                "radius": RADIUS_METER,
            }
        },
    }

    response = requests.post(
        SEARCH_URL,
        headers=headers,
        json=payload,
        timeout=30
    )
    response.raise_for_status()
    return response.json().get("places", [])


def download_place_photo(photo_name, output_path, max_width=900):
    """
    photo_name contoh:
    places/PLACE_ID/photos/PHOTO_RESOURCE

    Endpoint:
    https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=900&key=API_KEY
    """

    url = f"{PHOTO_BASE_URL}/{photo_name}/media"

    params = {
        "maxWidthPx": max_width,
        "key": API_KEY,
    }

    response = requests.get(
        url,
        params=params,
        timeout=60,
        allow_redirects=True
    )

    if response.status_code != 200:
        print(f"    [photo request gagal] HTTP {response.status_code}: {response.text[:150]}")
        return None

    content_type = response.headers.get("Content-Type", "")

    if "image" not in content_type:
        print(f"    [photo bukan image] content-type: {content_type}")
        return None

    suffix = ".jpg"
    if "png" in content_type:
        suffix = ".png"
    elif "webp" in content_type:
        suffix = ".webp"

    final_path = output_path.with_suffix(suffix)

    with open(final_path, "wb") as f:
        f.write(response.content)

    return str(final_path)


def get_photo_from_place_details(place_id):
    """
    Fallback: kalau Text Search tidak mengembalikan photos,
    ambil photos dari Place Details (New).
    """

    if not place_id:
        return "", ""

    url = f"{PHOTO_BASE_URL}/places/{place_id}"

    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "id,displayName,photos",
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        print(f"    [details error] {place_id}: {e}")
        return "", ""

    if response.status_code != 200:
        print(f"    [details gagal] {place_id}: HTTP {response.status_code} {response.text[:150]}")
        return "", ""

    data = response.json()
    photos = data.get("photos", [])

    if not photos:
        return "", ""

    first_photo = photos[0]
    photo_name = first_photo.get("name", "")

    attrs = first_photo.get("authorAttributions", [])
    attribution = " | ".join(
        attr.get("displayName", "")
        for attr in attrs
        if attr.get("displayName")
    )

    return photo_name, attribution


def parse_place(place, query_source):
    name = place.get("displayName", {}).get("text", "")
    location = place.get("location", {})
    lat = location.get("latitude")
    lon = location.get("longitude")

    if not name or lat is None or lon is None:
        return None

    photos = place.get("photos", [])
    first_photo = photos[0] if photos else None

    photo_name = ""
    attribution = ""

    if first_photo:
        photo_name = first_photo.get("name", "")

        attrs = first_photo.get("authorAttributions", [])
        attribution = " | ".join(
            [
                attr.get("displayName", "")
                for attr in attrs
                if attr.get("displayName")
            ]
        )

    jarak = haversine(CAMPUS_B_LAT, CAMPUS_B_LON, lat, lon)

    return {
        "place_id": place.get("id", ""),
        "nama": name,
        "latitude": lat,
        "longitude": lon,
        "jarak_meter": round(jarak, 2),
        "alamat": place.get("formattedAddress", ""),
        "google_maps_url": place.get("googleMapsUri", ""),
        "types": ", ".join(place.get("types", [])),
        "photo_name": photo_name,
        "photo_attribution": attribution,
        "foto_path": "",
        "query_source": query_source,
    }


def main():
    check_api_key()

    OUTPUT_DIR.mkdir(exist_ok=True)
    PHOTO_DIR.mkdir(exist_ok=True)

    seen_place_ids = set()
    rows = []

    for query in QUERIES:
        print(f"[+] Searching: {query}")

        try:
            places = search_places(query)
        except requests.HTTPError as e:
            print(f"[!] Error search: {e}")
            continue

        for place in places:
            row = parse_place(place, query)

            if not row:
                continue

            place_id = row["place_id"]

            if place_id in seen_place_ids:
                continue

            seen_place_ids.add(place_id)

            # Text Search kadang tidak mengembalikan photos.
            # Kalau photo_name kosong, coba fallback ke Place Details.
            if not row["photo_name"]:
                detail_photo_name, detail_attribution = get_photo_from_place_details(place_id)

                if detail_photo_name:
                    row["photo_name"] = detail_photo_name
                    row["photo_attribution"] = detail_attribution

                # Jeda kecil karena fallback ini menambah request per tempat.
                time.sleep(0.1)

            if row["photo_name"]:
                filename = safe_filename(row["nama"]) or place_id
                photo_path = PHOTO_DIR / filename

                downloaded = download_place_photo(
                    row["photo_name"],
                    photo_path
                )

                if downloaded:
                    row["foto_path"] = downloaded
                    print(f"    [foto] {row['nama']} -> {downloaded}")
                else:
                    print(f"    [foto gagal download] {row['nama']}")
            else:
                print(f"    [benar-benar tanpa foto] {row['nama']}")

            rows.append(row)

            # Jeda kecil biar tidak terlalu agresif request-nya
            time.sleep(0.2)

    if not rows:
        print("Tidak ada data bengkel ditemukan.")
        return

    rows = sorted(rows, key=lambda x: x["jarak_meter"])

    df = pd.DataFrame(rows)
    df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")

    print("\nSelesai.")
    print(f"CSV       : {CSV_PATH}")
    print(f"Folder foto: {PHOTO_DIR}")
    print("\nPreview:")
    print(df[["nama", "latitude", "longitude", "jarak_meter", "foto_path"]])


if __name__ == "__main__":
    main()