import argparse
import html
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import pandas as pd
import requests


OUTPUT_DIR = Path("hasil_bengkel_unair_b")
SOURCE_CSV = OUTPUT_DIR / "bengkel_unair_b_dengan_foto.csv"
MANUAL_CSV = OUTPUT_DIR / "manual_foto_jalan.csv"
MANUAL_HTML = OUTPUT_DIR / "manual_foto_jalan.html"
MANUAL_INPUT_DIR = OUTPUT_DIR / "foto_jalan_manual_input"
MANUAL_PHOTO_DIR = OUTPUT_DIR / "foto_jalan_manual"
UPDATED_CSV = OUTPUT_DIR / "bengkel_unair_b_dengan_foto_manual.csv"

IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]


class ImageCandidateParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta_images = []
        self.img_sources = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag == "meta":
            key = attrs.get("property") or attrs.get("name") or ""
            if key.lower() in {"og:image", "twitter:image", "twitter:image:src"}:
                content = attrs.get("content", "").strip()
                if content:
                    self.meta_images.append(content)

        if tag == "img":
            source = attrs.get("src", "").strip()
            if not source and attrs.get("srcset"):
                source = first_srcset_url(attrs.get("srcset", ""))
            if source:
                self.img_sources.append(source)


def safe_filename(text):
    text = str(text).lower()
    text = re.sub(r"[^a-z0-9_-]+", "_", text)
    return text.strip("_")[:80] or "foto_jalan"


def first_srcset_url(srcset):
    first_candidate = srcset.split(",")[0].strip()
    return first_candidate.split()[0] if first_candidate else ""


def google_maps_url(row):
    existing_url = str(row.get("google_maps_url", "")).strip()
    if existing_url and existing_url.lower() != "nan":
        return existing_url

    lat = row.get("latitude", "")
    lon = row.get("longitude", "")
    return f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"


def street_view_url(row):
    lat = row.get("latitude", "")
    lon = row.get("longitude", "")
    return f"https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}"


def add_manual_columns(df):
    if "manual_no" not in df.columns:
        df["manual_no"] = list(range(1, len(df) + 1))
    if "manual_photo_source" not in df.columns:
        df["manual_photo_source"] = ""
    if "manual_file_name" not in df.columns:
        df["manual_file_name"] = [
            safe_filename(name) for name in df.get("nama", pd.Series(range(len(df))))
        ]
    if "manual_maps_url" not in df.columns:
        df["manual_maps_url"] = [google_maps_url(row) for _, row in df.iterrows()]
    if "manual_street_view_url" not in df.columns:
        df["manual_street_view_url"] = [street_view_url(row) for _, row in df.iterrows()]
    if "manual_status" not in df.columns:
        df["manual_status"] = ""

    for column in ["foto_jalan_path", "foto_tempat_path", "foto_path"]:
        if column not in df.columns:
            df[column] = ""

    return df


def render_manual_html(df):
    rows = []

    for index, row in df.iterrows():
        manual_no = int(row.get("manual_no", index + 1))
        name = html.escape(str(row.get("nama", "")))
        address = html.escape(str(row.get("alamat", "")))
        file_name = html.escape(str(row.get("manual_file_name", "")))
        numbered_name = html.escape(f"{manual_no}.jpg")
        source = html.escape(str(row.get("manual_photo_source", "")))
        maps_url = html.escape(str(row.get("manual_maps_url", "")), quote=True)
        street_url = html.escape(str(row.get("manual_street_view_url", "")), quote=True)

        rows.append(
            "<tr>"
            f"<td>{manual_no}</td>"
            f"<td><strong>{name}</strong><br><span>{address}</span></td>"
            f"<td><strong>{numbered_name}</strong><br><span>atau {file_name}.jpg</span></td>"
            f"<td><a href=\"{maps_url}\" target=\"_blank\">Maps</a></td>"
            f"<td><a href=\"{street_url}\" target=\"_blank\">Street View</a></td>"
            f"<td>{source}</td>"
            "</tr>"
        )

    return (
        "<!doctype html>\n"
        "<html lang=\"id\">\n"
        "<head>\n"
        "  <meta charset=\"utf-8\">\n"
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        "  <title>Manual Foto Jalan Bengkel</title>\n"
        "  <style>\n"
        "    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }\n"
        "    table { border-collapse: collapse; width: 100%; }\n"
        "    th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }\n"
        "    th { background: #f3f4f6; text-align: left; }\n"
        "    span { color: #4b5563; font-size: 13px; }\n"
        "    a { color: #0f766e; }\n"
        "    .note { max-width: 900px; line-height: 1.5; }\n"
        "  </style>\n"
        "</head>\n"
        "<body>\n"
        "  <h1>Manual Foto Jalan Bengkel</h1>\n"
        "  <p class=\"note\">Buka link Maps/Street View, ambil screenshot/foto secara manual, lalu simpan ke "
        "<code>foto_jalan_manual_input</code> sebagai <code>1.jpg</code>, <code>2.jpg</code>, dan seterusnya "
        "mengikuti nomor baris. Alternatifnya, simpan dengan nama file bengkel yang disarankan, atau isi kolom "
        "<code>manual_photo_source</code> di <code>manual_foto_jalan.csv</code> dengan path file lokal "
        "direct image URL, atau URL halaman biasa yang memiliki tag <code>&lt;img&gt;</code>. "
        "Setelah itu jalankan <code>python manual_foto_jalan.py apply</code>.</p>\n"
        "  <table>\n"
        "    <thead><tr><th>No</th><th>Bengkel</th><th>Nama File Input</th><th>Maps</th><th>Street View</th><th>Source Manual</th></tr></thead>\n"
        f"    <tbody>{''.join(rows)}</tbody>\n"
        "  </table>\n"
        "</body>\n"
        "</html>\n"
    )


def prepare_manual_files(limit=None):
    if not SOURCE_CSV.exists():
        raise FileNotFoundError(f"CSV sumber tidak ditemukan: {SOURCE_CSV}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    MANUAL_INPUT_DIR.mkdir(exist_ok=True)

    df = pd.read_csv(SOURCE_CSV)
    if limit:
        df = df.head(limit)

    df = add_manual_columns(df)
    df.to_csv(MANUAL_CSV, index=False, encoding="utf-8-sig")

    MANUAL_HTML.write_text(render_manual_html(df), encoding="utf-8")

    print("Template manual dibuat.")
    print(f"CSV manual : {MANUAL_CSV}")
    print(f"HTML bantu : {MANUAL_HTML}")
    print(f"Folder input manual: {MANUAL_INPUT_DIR}")
    if limit:
        print(f"Jumlah data: {len(df)}")
    print("Simpan foto manual sebagai 1.jpg, 2.jpg, ... di folder input.")
    print(
        "Alternatif: isi manual_photo_source dengan path file lokal, direct image URL, "
        "atau URL halaman biasa yang memiliki tag <img>."
    )


def is_url(value):
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def suffix_from_content_type(content_type):
    if "jpeg" in content_type or "jpg" in content_type:
        return ".jpg"
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    return ""


def copy_local_image(source, output_stem):
    source_path = Path(source.strip("\"'")).expanduser()
    if not source_path.exists():
        return "", f"file tidak ditemukan: {source}"

    suffix = source_path.suffix.lower()
    if suffix not in IMAGE_EXTENSIONS:
        return "", f"ekstensi bukan gambar: {source_path.suffix}"

    final_path = output_stem.with_suffix(suffix)
    shutil.copy2(source_path, final_path)
    return str(final_path), "copied"


def find_manual_input(file_name):
    for suffix in IMAGE_EXTENSIONS:
        candidate = MANUAL_INPUT_DIR / f"{file_name}{suffix}"
        if candidate.exists():
            return str(candidate)
    return ""


def find_numbered_manual_input(manual_no):
    number_variants = [str(manual_no), f"{manual_no:02d}", f"{manual_no:03d}"]

    for number in number_variants:
        for suffix in IMAGE_EXTENSIONS:
            candidate = MANUAL_INPUT_DIR / f"{number}{suffix}"
            if candidate.exists():
                return str(candidate)

    return ""


def save_image_response(response, output_stem):
    content_type = response.headers.get("Content-Type", "")
    suffix = suffix_from_content_type(content_type)
    if not suffix:
        suffix = Path(urlparse(response.url).path).suffix.lower()

    if suffix not in IMAGE_EXTENSIONS:
        return "", f"URL bukan gambar, content-type={content_type}"

    final_path = output_stem.with_suffix(suffix)
    final_path.write_bytes(response.content)
    return str(final_path), "downloaded"


def extract_image_url_from_html(html_text, base_url):
    parser = ImageCandidateParser()
    parser.feed(html_text)

    candidates = parser.meta_images + parser.img_sources
    if not candidates:
        return ""

    return urljoin(base_url, candidates[0])


def download_direct_image(session, source, output_stem):
    try:
        response = session.get(source, timeout=60, allow_redirects=True)
    except requests.RequestException as exc:
        return "", f"request gagal: {exc}"

    if response.status_code != 200:
        return "", f"HTTP {response.status_code}: {response.text[:120]}"

    return save_image_response(response, output_stem)


def download_image(source, output_stem):
    session = requests.Session()
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0 Safari/537.36"
        )
    }
    session.headers.update(headers)

    try:
        response = session.get(source, timeout=60, allow_redirects=True)
    except requests.RequestException as exc:
        return "", f"request gagal: {exc}"

    if response.status_code != 200:
        return "", f"HTTP {response.status_code}: {response.text[:120]}"

    content_type = response.headers.get("Content-Type", "").lower()
    if "image" in content_type:
        return save_image_response(response, output_stem)

    if "html" not in content_type:
        return "", f"URL bukan gambar/html, content-type={content_type}"

    image_url = extract_image_url_from_html(response.text, response.url)
    if not image_url:
        return "", "halaman tidak punya tag img/og:image yang bisa diunduh"

    final_path, status = download_direct_image(session, image_url, output_stem)
    if final_path:
        return final_path, f"downloaded from page image: {image_url}"

    return "", status


def apply_manual_photos(limit=None):
    if not MANUAL_CSV.exists():
        raise FileNotFoundError(
            f"{MANUAL_CSV} belum ada. Jalankan dulu: python manual_foto_jalan.py prepare"
        )

    MANUAL_PHOTO_DIR.mkdir(exist_ok=True)

    df = pd.read_csv(MANUAL_CSV).fillna("")
    df = add_manual_columns(df)
    apply_indexes = list(df.index[:limit]) if limit else list(df.index)

    success_count = 0
    skip_count = 0

    for index in apply_indexes:
        row = df.loc[index]
        source = str(row.get("manual_photo_source", "")).strip()
        manual_no = int(row.get("manual_no", index + 1))
        file_name = safe_filename(row.get("manual_file_name") or row.get("nama"))

        if not source:
            source = find_manual_input(file_name)

        if not source:
            source = find_numbered_manual_input(manual_no)

        if not source:
            skip_count += 1
            continue

        output_stem = MANUAL_PHOTO_DIR / file_name

        if is_url(source):
            final_path, status = download_image(source, output_stem)
        else:
            final_path, status = copy_local_image(source, output_stem)

        df.at[index, "manual_status"] = status

        if final_path:
            df.at[index, "foto_jalan_path"] = final_path
            df.at[index, "foto_path"] = final_path
            success_count += 1
            print(f"[OK] {row.get('nama', '')} -> {final_path}")
        else:
            print(f"[GAGAL] {row.get('nama', '')}: {status}")

    df.to_csv(UPDATED_CSV, index=False, encoding="utf-8-sig")
    df.to_csv(MANUAL_CSV, index=False, encoding="utf-8-sig")

    print("\nSelesai.")
    print(f"Berhasil : {success_count}")
    print(f"Dilewati : {skip_count}")
    print(f"CSV update: {UPDATED_CSV}")
    print(f"Folder   : {MANUAL_PHOTO_DIR}")


def main():
    parser = argparse.ArgumentParser(
        description="Workflow manual untuk foto jalan depan bengkel tanpa API Google."
    )
    parser.add_argument(
        "mode",
        nargs="?",
        default="prepare",
        choices=["prepare", "apply"],
        help="prepare membuat template manual, apply menyalin/mengunduh foto manual.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Batasi jumlah bengkel yang diproses, contoh: --limit 30.",
    )
    args = parser.parse_args()

    if args.mode == "prepare":
        prepare_manual_files(args.limit)
    elif args.mode == "apply":
        apply_manual_photos(args.limit)


if __name__ == "__main__":
    main()
