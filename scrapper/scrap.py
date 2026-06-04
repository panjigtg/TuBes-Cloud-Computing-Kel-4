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
STREET_VIEW_URL = "https://maps.googleapis.com/maps/api/streetview"
STREET_VIEW_METADATA_URL = f"{STREET_VIEW_URL}/metadata"

OUTPUT_DIR = Path("hasil_bengkel_unair_b")
PHOTO_DIR = OUTPUT_DIR / "foto_bengkel"
STREET_VIEW_DIR = OUTPUT_DIR / "foto_jalan_depan_bengkel"
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


def bearing_between(lat1, lon1, lat2, lon2):
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon_rad = math.radians(lon2 - lon1)

    x = math.sin(dlon_rad) * math.cos(lat2_rad)
    y = (
        math.cos(lat1_rad) * math.sin(lat2_rad)
        - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon_rad)
    )

    return (math.degrees(math.atan2(x, y)) + 360) % 360


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
    photo_name contoh: places/PLACE_ID/photos/PHOTO_RESOURCE

    Google Places API (New) foto endpoint redirect ke lh3.googleusercontent.com.
    Kita ikuti redirect secara manual agar key tidak ikut ke domain lain.
    """

    # Pastikan tidak ada double prefix "/v1/places/..."
    # photo_name dari API sudah bentuk "places/xxx/photos/yyy"
    clean_name = photo_name.lstrip("/")
    if clean_name.startswith("v1/"):
        clean_name = clean_name[3:]

    url = f"{PHOTO_BASE_URL}/{clean_name}/media"

    params = {
        "maxWidthPx": max_width,
        "key": API_KEY,
        "skipHttpRedirect": "false",  # eksplisit minta binary (bukan JSON redirect)
    }

    session = requests.Session()

    # Langkah 1: request pertama — Google akan redirect ke lh3.googleusercontent.com
    try:
        resp1 = session.get(url, params=params, timeout=30, allow_redirects=False)
    except requests.RequestException as e:
        print(f"    [request error] {e}")
        return None

    # Ikuti redirect secara manual supaya key tidak dikirim ke domain lain
    if resp1.status_code in (301, 302, 303, 307, 308):
        redirect_url = resp1.headers.get("Location", "")
        if not redirect_url:
            print(f"    [redirect tanpa Location header]")
            return None
        try:
            resp2 = session.get(redirect_url, timeout=60, allow_redirects=True)
        except requests.RequestException as e:
            print(f"    [redirect request error] {e}")
            return None
        response = resp2
    else:
        response = resp1

    if response.status_code != 200:
        print(f"    [photo gagal] HTTP {response.status_code}: {response.text[:200]}")
        return None

    content_type = response.headers.get("Content-Type", "")

    if "image" not in content_type:
        print(f"    [bukan image] content-type: {content_type}")
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


def get_street_view_metadata(lat, lon, radius=80):
    """
    Cek panorama Street View terdekat sebelum download foto.
    Metadata tidak menggunakan quota gambar, dan mencegah hasil abu-abu/no image.
    """

    params = {
        "location": f"{lat},{lon}",
        "radius": radius,
        "source": "outdoor",
        "key": API_KEY,
    }

    try:
        response = requests.get(STREET_VIEW_METADATA_URL, params=params, timeout=30)
    except requests.RequestException as e:
        print(f"    [street view metadata error] {lat},{lon}: {e}")
        return {"status": "REQUEST_ERROR", "error_message": str(e)}

    if response.status_code != 200:
        print(
            f"    [street view metadata gagal] HTTP {response.status_code}: "
            f"{response.text[:200]}"
        )
        return {
            "status": f"HTTP_{response.status_code}",
            "error_message": response.text[:200],
        }

    try:
        data = response.json()
    except ValueError:
        print("    [street view metadata bukan JSON]")
        return {"status": "INVALID_JSON", "error_message": response.text[:200]}

    status = data.get("status", "")
    if status != "OK":
        error_message = data.get("error_message", "")
        detail = f": {error_message}" if error_message else ""
        print(f"    [street view tidak tersedia] status={status}{detail}")

    return data


def get_heading_to_place(metadata, place_lat, place_lon):
    pano_location = metadata.get("location", {})
    pano_lat = pano_location.get("lat")
    pano_lon = pano_location.get("lng")

    if pano_lat is None or pano_lon is None:
        return None

    return bearing_between(pano_lat, pano_lon, place_lat, place_lon)


def download_street_view_photo(
    lat,
    lon,
    output_path,
    metadata,
    size="640x640",
    fov=80,
    pitch=0,
):
    """
    Download foto jalan depan bengkel dari Street View Static API.
    Kamera diarahkan dari titik panorama terdekat menuju koordinat bengkel.
    """

    if metadata.get("status") != "OK":
        return None, None

    heading = get_heading_to_place(metadata, lat, lon)

    params = {
        "size": size,
        "fov": fov,
        "pitch": pitch,
        "source": "outdoor",
        "return_error_code": "true",
        "key": API_KEY,
    }

    pano_id = metadata.get("pano_id")
    if pano_id:
        params["pano"] = pano_id
    else:
        params["location"] = f"{lat},{lon}"

    if heading is not None:
        params["heading"] = round(heading, 2)

    try:
        response = requests.get(STREET_VIEW_URL, params=params, timeout=60)
    except requests.RequestException as e:
        print(f"    [street view download error] {lat},{lon}: {e}")
        return None, heading

    if response.status_code != 200:
        print(
            f"    [street view gagal] HTTP {response.status_code}: "
            f"{response.text[:200]}"
        )
        return None, heading

    content_type = response.headers.get("Content-Type", "")
    if "image" not in content_type:
        print(f"    [street view bukan image] content-type: {content_type}")
        return None, heading

    suffix = ".jpg"
    if "png" in content_type:
        suffix = ".png"
    elif "webp" in content_type:
        suffix = ".webp"

    final_path = output_path.with_suffix(suffix)

    with open(final_path, "wb") as f:
        f.write(response.content)

    return str(final_path), heading


def get_photo_from_place_details(place_id):
    """
    Ambil photo_name dari Place Details API (New).
    FieldMask harus eksplisit menyebut sub-field photos.name dll,
    bukan hanya 'photos' — kalau tidak, API sering return photos kosong.
    """

    if not place_id:
        return "", ""

    url = f"{PHOTO_BASE_URL}/places/{place_id}"

    headers = {
        "X-Goog-Api-Key": API_KEY,
        # Sebutkan sub-field secara eksplisit agar API benar-benar return data foto
        "X-Goog-FieldMask": (
            "id,"
            "displayName,"
            "photos.name,"
            "photos.widthPx,"
            "photos.heightPx,"
            "photos.authorAttributions"
        ),
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        print(f"    [details error] {place_id}: {e}")
        return "", ""

    if response.status_code != 200:
        print(f"    [details gagal] {place_id}: HTTP {response.status_code} {response.text[:200]}")
        return "", ""

    data = response.json()
    photos = data.get("photos", [])

    if not photos:
        print(f"    [details: 0 foto] {place_id} — tempat ini memang tidak punya foto di Maps")
        return "", ""

    print(f"    [details: {len(photos)} foto ditemukan] {place_id}")

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
        "foto_tempat_path": "",
        "foto_jalan_path": "",
        "foto_path": "",
        "street_view_status": "",
        "street_view_pano_id": "",
        "street_view_date": "",
        "street_view_heading": "",
        "street_view_copyright": "",
        "query_source": query_source,
    }


def main():
    check_api_key()

    OUTPUT_DIR.mkdir(exist_ok=True)
    PHOTO_DIR.mkdir(exist_ok=True)
    STREET_VIEW_DIR.mkdir(exist_ok=True)

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
            # Kalau photo_name kosong, wajib fallback ke Place Details.
            if row["photo_name"]:
                print(f"    [foto dari search] {row['nama']}")
            else:
                print(f"    [cari foto via details] {row['nama']} ...")
                detail_photo_name, detail_attribution = get_photo_from_place_details(place_id)

                if detail_photo_name:
                    row["photo_name"] = detail_photo_name
                    row["photo_attribution"] = detail_attribution

                time.sleep(0.3)

            if row["photo_name"]:
                filename = safe_filename(row["nama"]) or place_id
                photo_path = PHOTO_DIR / filename

                downloaded = download_place_photo(
                    row["photo_name"],
                    photo_path
                )

                if downloaded:
                    row["foto_tempat_path"] = downloaded
                    row["foto_path"] = downloaded
                    print(f"    [foto] {row['nama']} -> {downloaded}")
                else:
                    print(f"    [foto gagal download] {row['nama']}")
            else:
                print(f"    [benar-benar tanpa foto] {row['nama']}")

            filename = safe_filename(row["nama"]) or place_id
            street_view_path = STREET_VIEW_DIR / filename
            print(f"    [cari foto jalan depan] {row['nama']} ...")

            street_view_metadata = get_street_view_metadata(
                row["latitude"],
                row["longitude"],
            )
            row["street_view_status"] = street_view_metadata.get("status", "")
            row["street_view_pano_id"] = street_view_metadata.get("pano_id", "")
            row["street_view_date"] = street_view_metadata.get("date", "")
            row["street_view_copyright"] = street_view_metadata.get("copyright", "")

            downloaded_street_view, heading = download_street_view_photo(
                row["latitude"],
                row["longitude"],
                street_view_path,
                street_view_metadata,
            )

            if heading is not None:
                row["street_view_heading"] = round(heading, 2)

            if downloaded_street_view:
                row["foto_jalan_path"] = downloaded_street_view
                row["foto_path"] = downloaded_street_view
                print(
                    f"    [foto jalan] {row['nama']} -> "
                    f"{downloaded_street_view}"
                )
            else:
                print(f"    [foto jalan gagal/tidak tersedia] {row['nama']}")

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
    print(f"Folder foto tempat: {PHOTO_DIR}")
    print(f"Folder foto jalan : {STREET_VIEW_DIR}")
    print("\nPreview:")
    print(
        df[
            [
                "nama",
                "latitude",
                "longitude",
                "jarak_meter",
                "foto_jalan_path",
                "foto_tempat_path",
                "foto_path",
            ]
        ]
    )


if __name__ == "__main__":
    main()
